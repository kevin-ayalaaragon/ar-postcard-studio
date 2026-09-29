import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

// MCP server exposing this app's own admin operations as tools - see
// docs/adr/0011-admin-mcp-server.md for why this lives here instead of a
// separate repo or package. Tools call the existing admin/public API routes
// over HTTP rather than duplicating their Prisma/storage logic, so this file
// stays a thin wrapper and the routes remain the single source of truth.

function baseUrl(): string {
  return process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
}

function adminHeaders(): HeadersInit {
  return { "x-admin-secret": process.env.ADMIN_SECRET ?? "" };
}

const PostcardStatus = z.enum(["SUBMITTED", "READY"]);

const handler = createMcpHandler((server) => {
  server.registerTool(
    "list_pending_postcards",
    {
      title: "List pending postcards",
      description:
        "List postcards still waiting on AR assets (status SUBMITTED) - the queue an admin works through.",
      inputSchema: z.object({}).strict(),
      outputSchema: z
        .object({
          postcards: z.array(
            z.object({
              slug: z.string(),
              senderName: z.string(),
              recipientName: z.string(),
              message: z.string(),
              photoUrl: z.string(),
              createdAt: z.string(),
            })
          ),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const res = await fetch(`${baseUrl()}/api/admin/postcards`, {
        headers: adminHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Failed to list postcards: ${res.status}`);
      }
      const all = (await res.json()) as Array<{ status: string }>;
      const postcards = all.filter((p) => p.status === "SUBMITTED");
      return {
        content: [
          { type: "text", text: `${postcards.length} postcard(s) pending AR assets` },
        ],
        structuredContent: { postcards },
      };
    }
  );

  server.registerTool(
    "get_postcard",
    {
      title: "Get postcard",
      description: "Get status and metadata for one postcard by slug.",
      inputSchema: z
        .object({ slug: z.string().min(1).describe("Postcard slug") })
        .strict(),
      outputSchema: z
        .object({
          slug: z.string(),
          status: PostcardStatus,
          recipientName: z.string(),
          photoUrl: z.string(),
          photoWidthPx: z.number(),
          photoHeightPx: z.number(),
          targetMindUrl: z.string().nullable(),
          videoUrl: z.string().nullable(),
        })
        .strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ slug }) => {
      const res = await fetch(`${baseUrl()}/api/postcards/${encodeURIComponent(slug)}`);
      if (res.status === 404) {
        throw new Error(`No postcard found for slug "${slug}"`);
      }
      if (!res.ok) {
        throw new Error(`Failed to fetch postcard: ${res.status}`);
      }
      const postcard = await res.json();
      return {
        content: [{ type: "text", text: `${slug}: ${postcard.status}` }],
        structuredContent: postcard,
      };
    }
  );

  server.registerTool(
    "attach_ar_assets",
    {
      title: "Attach AR assets",
      description:
        "Upload a compiled MindAR .mind target and .mp4 overlay video for a postcard, flipping it from SUBMITTED to READY.",
      inputSchema: z
        .object({
          slug: z.string().min(1),
          targetMindBase64: z
            .string()
            .min(1)
            .describe("Base64-encoded contents of the compiled .mind file"),
          videoBase64: z
            .string()
            .min(1)
            .describe("Base64-encoded contents of the .mp4 overlay video"),
        })
        .strict(),
      outputSchema: z.object({ slug: z.string(), status: PostcardStatus }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ slug, targetMindBase64, videoBase64 }) => {
      const form = new FormData();
      form.append(
        "targetMind",
        new Blob([Buffer.from(targetMindBase64, "base64")]),
        "target.mind"
      );
      form.append(
        "video",
        new Blob([Buffer.from(videoBase64, "base64")], { type: "video/mp4" }),
        "video.mp4"
      );

      const res = await fetch(
        `${baseUrl()}/api/admin/postcards/${encodeURIComponent(slug)}/assets`,
        { method: "POST", headers: adminHeaders(), body: form }
      );
      if (!res.ok) {
        throw new Error(`Failed to attach assets: ${res.status} ${await res.text()}`);
      }
      const updated = await res.json();
      return {
        content: [{ type: "text", text: `${slug} is now ${updated.status}` }],
        structuredContent: updated,
      };
    }
  );

  server.registerTool(
    "generate_print_files",
    {
      title: "Generate print files",
      description:
        "Return the print-ready front and back file URLs for a READY postcard, verifying the front file exists.",
      inputSchema: z.object({ slug: z.string().min(1) }).strict(),
      outputSchema: z.object({ frontUrl: z.string(), backUrl: z.string() }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ slug }) => {
      const frontUrl = `${baseUrl()}/api/postcards/${encodeURIComponent(slug)}/print/front`;
      const backUrl = `${baseUrl()}/api/postcards/${encodeURIComponent(slug)}/print/back`;

      const check = await fetch(frontUrl);
      if (!check.ok) {
        throw new Error(`Print front not available for "${slug}": ${check.status}`);
      }
      return {
        content: [{ type: "text", text: `Print files ready for ${slug}` }],
        structuredContent: { frontUrl, backUrl },
      };
    }
  );
});

export { handler as GET, handler as POST };
