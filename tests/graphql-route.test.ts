import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminRequest } from "./helpers";

// Same hoisted Prisma mock as tests/api-routes.test.ts (docs/adr/0012-vitest-testing.md).
// These tests go through the real route handler, Yoga and the Pothos schema.
// They prove which Prisma arguments a request produces and what the API does
// with the rows it gets back; they do NOT prove the keyset SQL against a real
// Postgres (see docs/adr/0013-graphql-admin-api.md).
const db = vi.hoisted(() => ({
  postcard: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { GET, POST } from "@/app/api/graphql/route";
import { encodeCursor } from "@/lib/postcards";

const SECRET = "test-admin-secret";
const URL = "http://localhost/api/graphql";
const ORDER = [{ createdAt: "desc" }, { id: "desc" }];

// secret: null sends no x-admin-secret header at all.
function gql(query: string, variables: Record<string, unknown> = {}, secret: string | null = SECRET) {
  return POST(
    adminRequest(URL, secret ?? undefined, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query, variables }),
    })
  );
}

function row(i: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `id${String(i).padStart(3, "0")}`,
    slug: `slug${i}`,
    status: "SUBMITTED",
    senderName: "Kevin",
    recipientName: "Ana",
    message: "private message",
    photoPath: `postcards/slug${i}/photo.png`,
    photoWidthPx: 100,
    photoHeightPx: 150,
    targetMindPath: null,
    videoPath: null,
    createdAt: new Date(Date.UTC(2026, 9, 1, 0, 0, 0) - i * 1000),
    updatedAt: new Date(Date.UTC(2026, 9, 1)),
    ...overrides,
  };
}

const LIST = /* GraphQL */ `
  query ($first: Int, $after: String, $status: PostcardStatus) {
    postcards(first: $first, after: $after, status: $status) {
      edges { cursor node { slug status photoUrl targetMindUrl createdAt } }
      pageInfo { hasNextPage hasPreviousPage endCursor }
    }
  }
`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/api/graphql auth gate (before Yoga parses anything)", () => {
  it("401 with no secret, without calling Prisma", async () => {
    const res = await gql(LIST, {}, null);
    expect(res.status).toBe(401);
    expect(db.postcard.findMany).not.toHaveBeenCalled();
  });

  it("401 with a wrong secret, without calling Prisma", async () => {
    const res = await gql(LIST, {}, "wrong-secret");
    expect(res.status).toBe(401);
    expect(db.postcard.findMany).not.toHaveBeenCalled();
  });

  it("401 when ADMIN_SECRET is unset, even with an empty header", async () => {
    const saved = process.env.ADMIN_SECRET;
    delete process.env.ADMIN_SECRET;
    try {
      expect((await gql(LIST, {}, "")).status).toBe(401);
    } finally {
      process.env.ADMIN_SECRET = saved;
    }
    expect(db.postcard.findMany).not.toHaveBeenCalled();
  });

  it("401 even for a syntactically invalid document: auth runs before parsing", async () => {
    const res = await gql("{ this is not graphql", {}, null);
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Unauthorized");
  });

  it("does not leak schema names in a 401 body", async () => {
    const res = await gql("{ __schema { types { name } } }", {}, null);
    expect(await res.text()).not.toMatch(/Postcard/);
  });

  it("200 with the correct secret", async () => {
    db.postcard.findMany.mockResolvedValue([]);
    const res = await gql(LIST);
    expect(res.status).toBe(200);
  });
});

describe("/api/graphql transport", () => {
  it("GET never executes an operation (405 outside development)", async () => {
    const res = await GET(adminRequest(`${URL}?query=${encodeURIComponent("{ postcard(slug:\"a\") { slug } }")}`, SECRET));
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
    expect(db.postcard.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a batched (array) request body", async () => {
    const res = await POST(
      adminRequest(URL, SECRET, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify([{ query: "{ postcard(slug:\"a\") { slug } }" }, { query: "{ postcard(slug:\"b\") { slug } }" }]),
      })
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(db.postcard.findUnique).not.toHaveBeenCalled();
  });
});

describe("postcards connection (keyset pagination)", () => {
  it("first page: default first=20, fetches 21 rows, newest first, no cursor filter", async () => {
    db.postcard.findMany.mockResolvedValue([row(1), row(2)]);
    const res = await gql(LIST);
    const body = await res.json();

    expect(db.postcard.findMany).toHaveBeenCalledWith({ where: {}, orderBy: ORDER, take: 21 });
    expect(body.errors).toBeUndefined();
    expect(body.data.postcards.edges.map((e: { node: { slug: string } }) => e.node.slug)).toEqual(["slug1", "slug2"]);
    expect(body.data.postcards.pageInfo).toMatchObject({ hasNextPage: false, hasPreviousPage: false });
  });

  it("hasNextPage comes from the extra (first+1) row, which is not returned", async () => {
    db.postcard.findMany.mockResolvedValue([row(1), row(2), row(3)]);
    const body = await (await gql(LIST, { first: 2 })).json();

    expect(db.postcard.findMany.mock.calls[0][0].take).toBe(3);
    const { edges, pageInfo } = body.data.postcards;
    expect(edges).toHaveLength(2);
    expect(pageInfo.hasNextPage).toBe(true);
    expect(pageInfo.endCursor).toBe(encodeCursor(row(2)));
    expect(edges[1].cursor).toBe(pageInfo.endCursor);
  });

  it("an after cursor becomes a strictly-after (createdAt, id) where clause", async () => {
    db.postcard.findMany.mockResolvedValue([]);
    const last = row(2);
    await gql(LIST, { first: 5, after: encodeCursor(last), status: "SUBMITTED" });

    expect(db.postcard.findMany).toHaveBeenCalledWith({
      where: {
        status: "SUBMITTED",
        OR: [
          { createdAt: { lt: last.createdAt } },
          { createdAt: last.createdAt, id: { lt: last.id } },
        ],
      },
      orderBy: ORDER,
      take: 6,
    });
  });

  it("returns URLs built from storage keys, never the storage paths", async () => {
    db.postcard.findMany.mockResolvedValue([
      row(1, { status: "READY", targetMindPath: "postcards/slug1/target.mind", videoPath: "postcards/slug1/video.mp4" }),
    ]);
    const body = await (await gql(LIST)).json();
    const node = body.data.postcards.edges[0].node;
    expect(node).toEqual({
      slug: "slug1",
      status: "READY",
      photoUrl: "/api/files/postcards/slug1/photo.png",
      targetMindUrl: "/api/files/postcards/slug1/target.mind",
      createdAt: row(1).createdAt.toISOString(),
    });
    const pathQuery = await gql("{ postcards { edges { node { photoPath } } } }");
    expect((await pathQuery.json()).errors[0].message).toMatch(/photoPath/);
  });

  it("rejects first > 50 without calling Prisma", async () => {
    const body = await (await gql(LIST, { first: 51 })).json();
    expect(body.errors[0].message).toBe("first must be between 1 and 50.");
    expect(body.data).toBeNull();
    expect(db.postcard.findMany).not.toHaveBeenCalled();
  });

  it("rejects first < 1, backward pagination and a forged cursor without calling Prisma", async () => {
    for (const vars of [{ first: 0 }, { after: "not-a-cursor" }]) {
      const body = await (await gql(LIST, vars)).json();
      expect(body.errors).toHaveLength(1);
    }
    const back = await (await gql("{ postcards(last: 5) { edges { cursor } } }")).json();
    expect(back.errors[0].message).toMatch(/Backward pagination/);
    expect(db.postcard.findMany).not.toHaveBeenCalled();
  });
});

// Pothos checks these from the document's shape when execution starts, before
// any root resolver runs. Over-limit requests are therefore HTTP 200 with
// errors and every root field null (GraphQL semantics), not a 4xx.
describe("query cost limits (checked before any resolver runs)", () => {
  it("accepts the widest legal page: first=50 with every Postcard field", async () => {
    db.postcard.findMany.mockResolvedValue([]);
    const body = await (
      await gql(`{
        postcards(first: 50) {
          edges { cursor node {
            slug status senderName recipientName message photoUrl
            photoWidthPx photoHeightPx targetMindUrl videoUrl createdAt
          } }
          pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
        }
      }`)
    ).json();
    expect(body.errors).toBeUndefined();
  });

  it("rejects an alias-amplified query as 200-with-errors and zero Prisma calls", async () => {
    const aliases = Array.from({ length: 60 }, (_, i) => `p${i}: postcard(slug: "s${i}") { slug }`).join("\n");
    const res = await gql(`{ ${aliases} }`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors[0].message).toMatch(/breadth/i);
    expect(Object.values(body.data).every((v) => v === null)).toBe(true);
    expect(db.postcard.findUnique).not.toHaveBeenCalled();
  });

  it("rejects several max-size pages in one request as too complex", async () => {
    const pages = Array.from({ length: 4 }, (_, i) => `p${i}: postcards(first: 50) { edges { node { slug message senderName } } }`).join("\n");
    const res = await gql(`{ ${pages} }`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.errors?.[0].message).toMatch(/complexity/i);
    expect(db.postcard.findMany).not.toHaveBeenCalled();
  });

  it("still allows a full introspection query (GraphiQL, codegen, agents)", async () => {
    const { getIntrospectionQuery } = await import("graphql");
    const body = await (await gql(getIntrospectionQuery())).json();
    expect(body.errors).toBeUndefined();
    expect(body.data.__schema.queryType.name).toBe("Query");
  });
});

describe("postcard(slug)", () => {
  it("returns the admin view, including sender PII the public route omits", async () => {
    db.postcard.findUnique.mockResolvedValue(row(7));
    const body = await (await gql('{ postcard(slug: "slug7") { slug senderName message videoUrl } }')).json();
    expect(db.postcard.findUnique).toHaveBeenCalledWith({ where: { slug: "slug7" } });
    expect(body.data.postcard).toEqual({ slug: "slug7", senderName: "Kevin", message: "private message", videoUrl: null });
  });

  it("returns null for an unknown slug", async () => {
    db.postcard.findUnique.mockResolvedValue(null);
    const body = await (await gql('{ postcard(slug: "nope") { slug } }')).json();
    expect(body).toEqual({ data: { postcard: null } });
  });
});

describe("error masking", () => {
  it("masks an unexpected database error instead of leaking its message", async () => {
    db.postcard.findMany.mockRejectedValue(
      new Error("connect ECONNREFUSED db.internal:5432 user=neondb_owner password=hunter2")
    );
    const res = await gql(LIST);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toMatch(/ECONNREFUSED|neondb_owner|hunter2/);
    expect(JSON.parse(text).errors[0].message).toBe("Unexpected error.");
  });
});
