import { describe, expect, it, vi } from "vitest";

// The MCP route imports nothing that touches the database at load time, but
// its tools call the app's own HTTP routes via fetch(); those calls are
// stubbed so these tests stay offline.
import { GET, POST } from "@/app/mcp/route";

const SECRET = "test-admin-secret";
const URL = "http://localhost/mcp";

function rpc(method: string, params: object = {}, secret?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (secret !== undefined) headers["x-admin-secret"] = secret;
  return new Request(URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

// The response is either plain JSON or a single SSE frame ("data: {...}").
async function parse(res: Response) {
  const text = await res.text();
  const payload = text.startsWith("event:") || text.includes("\ndata: ") || text.startsWith("data:")
    ? text.split("\n").find((l) => l.startsWith("data:"))!.slice(5).trim()
    : text;
  return JSON.parse(payload);
}

// Regression tests for commit acc62c8. Before the fix, /mcp forwarded the
// server's own ADMIN_SECRET to the internal admin routes for ANY caller, so
// an unauthenticated request could list PII and attach assets.
describe("/mcp authentication gate", () => {
  it("401 with no secret (POST)", async () => {
    const res = await POST(rpc("tools/list"));
    expect(res.status).toBe(401);
  });

  it("401 with a wrong secret (POST)", async () => {
    const res = await POST(rpc("tools/list", {}, "wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("401 on GET without a secret", async () => {
    const res = await GET(new Request(URL, { headers: { accept: "text/event-stream" } }));
    expect(res.status).toBe(401);
  });

  it("does not leak tool names or data in a 401 body", async () => {
    const res = await POST(rpc("tools/list"));
    const text = await res.text();
    expect(text).not.toMatch(/attach_ar_assets|list_pending_postcards|get_postcard/);
  });

  it("401 when ADMIN_SECRET is unset, even if the caller sends an empty secret", async () => {
    const saved = process.env.ADMIN_SECRET;
    delete process.env.ADMIN_SECRET;
    try {
      expect((await POST(rpc("tools/list", {}, ""))).status).toBe(401);
    } finally {
      process.env.ADMIN_SECRET = saved;
    }
  });

  it("200 with the correct secret", async () => {
    const res = await POST(rpc("tools/list", {}, SECRET));
    expect(res.status).toBe(200);
  });
});

describe("/mcp tool surface", () => {
  async function listTools() {
    const res = await POST(rpc("tools/list", {}, SECRET));
    const body = await parse(res);
    return body.result.tools as Array<{
      name: string;
      annotations?: Record<string, boolean>;
      inputSchema: unknown;
      outputSchema?: unknown;
    }>;
  }

  it("exposes exactly the four documented tools", async () => {
    const names = (await listTools()).map((t) => t.name).sort();
    expect(names).toEqual([
      "attach_ar_assets",
      "generate_print_files",
      "get_postcard",
      "list_pending_postcards",
    ]);
  });

  it("declares read-only / idempotent / destructive annotations per MCP spec", async () => {
    const tools = Object.fromEntries((await listTools()).map((t) => [t.name, t.annotations]));
    for (const readOnly of ["list_pending_postcards", "get_postcard", "generate_print_files"]) {
      expect(tools[readOnly]).toMatchObject({ readOnlyHint: true, destructiveHint: false, idempotentHint: true });
    }
    expect(tools.attach_ar_assets).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    });
  });

  it("every tool has a typed input and output schema", async () => {
    for (const tool of await listTools()) {
      expect(tool.inputSchema, `${tool.name} input`).toBeTruthy();
      expect(tool.outputSchema, `${tool.name} output`).toBeTruthy();
    }
  });

  it("list_pending_postcards forwards the admin secret internally but only to an authenticated caller", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { slug: "a", status: "SUBMITTED", senderName: "K", recipientName: "A", message: "m", photoUrl: "/x", createdAt: "t" },
          { slug: "b", status: "READY", senderName: "K", recipientName: "A", message: "m", photoUrl: "/y", createdAt: "t" },
        ]),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const res = await POST(rpc("tools/call", { name: "list_pending_postcards", arguments: {} }, SECRET));
      const body = await parse(res);
      expect(body.result.structuredContent.postcards.map((p: { slug: string }) => p.slug)).toEqual(["a"]);
      const [, init] = fetchMock.mock.calls[0];
      expect((init.headers as Record<string, string>)["x-admin-secret"]).toBe(SECRET);

      // And an unauthenticated caller never reaches the tool at all.
      fetchMock.mockClear();
      const denied = await POST(rpc("tools/call", { name: "list_pending_postcards", arguments: {} }));
      expect(denied.status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
