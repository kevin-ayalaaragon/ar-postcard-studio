import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminRequest, decodeQr, makePng } from "./helpers";

// Prisma is mocked (see docs/adr/0012-vitest-testing.md): these tests cover
// route logic, not the database. Storage is the real local driver writing
// to a temp directory (tests/setup.ts).
const db = vi.hoisted(() => ({
  postcard: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { GET as listAdmin } from "@/app/api/admin/postcards/route";
import { POST as attachAssets } from "@/app/api/admin/postcards/[slug]/assets/route";
import { POST as submit } from "@/app/api/postcards/route";
import { GET as getPostcard } from "@/app/api/postcards/[slug]/route";
import { GET as printBack } from "@/app/api/postcards/[slug]/print/back/route";
import { GET as getFile } from "@/app/api/files/[...key]/route";
import { storage } from "@/lib/storage";

const SECRET = "test-admin-secret";
const params = <T extends object>(value: T) => ({ params: Promise.resolve(value) });

beforeEach(() => {
  vi.clearAllMocks();
});

// Regression tests for commit acc62c8 (broken access control on the MCP
// route) apply the same three-case matrix to every admin endpoint.
describe("GET /api/admin/postcards auth gate", () => {
  const url = "http://localhost/api/admin/postcards";

  it("401 with no secret", async () => {
    const res = await listAdmin(adminRequest(url));
    expect(res.status).toBe(401);
    expect(db.postcard.findMany).not.toHaveBeenCalled();
  });

  it("401 with a wrong secret", async () => {
    const res = await listAdmin(adminRequest(url, "wrong-secret"));
    expect(res.status).toBe(401);
    expect(db.postcard.findMany).not.toHaveBeenCalled();
  });

  it("200 with the correct secret, returning mapped fields and same-origin photo URLs", async () => {
    db.postcard.findMany.mockResolvedValue([
      {
        slug: "abc",
        status: "SUBMITTED",
        senderName: "Kevin",
        recipientName: "Ana",
        message: "hi",
        photoPath: "postcards/abc/photo.png",
        createdAt: new Date("2026-09-30T00:00:00Z"),
        targetMindPath: null,
      },
    ]);
    const res = await listAdmin(adminRequest(url, SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ slug: "abc", photoUrl: "/api/files/postcards/abc/photo.png" });
  });
});

describe("POST /api/admin/postcards/[slug]/assets", () => {
  const url = "http://localhost/api/admin/postcards/abc/assets";

  function form(parts: Record<string, File>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(parts)) fd.set(k, v);
    return fd;
  }
  const mind = () => new File([new Uint8Array(10)], "target.mind");
  const mp4 = () => new File([new Uint8Array(10)], "video.mp4", { type: "video/mp4" });

  it("401 with no secret or a wrong secret, before touching the database", async () => {
    for (const secret of [undefined, "wrong"]) {
      const res = await attachAssets(
        adminRequest(url, secret, { method: "POST", body: form({ targetMind: mind(), video: mp4() }) }),
        params({ slug: "abc" })
      );
      expect(res.status).toBe(401);
    }
    expect(db.postcard.findUnique).not.toHaveBeenCalled();
  });

  it("404 for an unknown slug", async () => {
    db.postcard.findUnique.mockResolvedValue(null);
    const res = await attachAssets(
      adminRequest(url, SECRET, { method: "POST", body: form({ targetMind: mind(), video: mp4() }) }),
      params({ slug: "abc" })
    );
    expect(res.status).toBe(404);
  });

  it("400 when the video is not an MP4", async () => {
    db.postcard.findUnique.mockResolvedValue({ slug: "abc" });
    const res = await attachAssets(
      adminRequest(url, SECRET, {
        method: "POST",
        body: form({ targetMind: mind(), video: new File([new Uint8Array(10)], "v.webm", { type: "video/webm" }) }),
      }),
      params({ slug: "abc" })
    );
    expect(res.status).toBe(400);
  });

  it("400 when the target is not a .mind file", async () => {
    db.postcard.findUnique.mockResolvedValue({ slug: "abc" });
    const res = await attachAssets(
      adminRequest(url, SECRET, {
        method: "POST",
        body: form({ targetMind: new File([new Uint8Array(10)], "target.png"), video: mp4() }),
      }),
      params({ slug: "abc" })
    );
    expect(res.status).toBe(400);
  });

  it("stores both assets and flips the record to READY", async () => {
    db.postcard.findUnique.mockResolvedValue({ slug: "abc" });
    db.postcard.update.mockResolvedValue({ slug: "abc", status: "READY" });
    const res = await attachAssets(
      adminRequest(url, SECRET, { method: "POST", body: form({ targetMind: mind(), video: mp4() }) }),
      params({ slug: "abc" })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ slug: "abc", status: "READY" });
    expect(db.postcard.update).toHaveBeenCalledWith({
      where: { slug: "abc" },
      data: {
        targetMindPath: "postcards/abc/target.mind",
        videoPath: "postcards/abc/video.mp4",
        status: "READY",
      },
    });
    expect(await storage.getFile("postcards/abc/target.mind")).not.toBeNull();
    expect(await storage.getFile("postcards/abc/video.mp4")).not.toBeNull();
  });
});

describe("POST /api/postcards (public submission pipeline)", () => {
  const url = "http://localhost/api/postcards";
  const fields = { senderName: "Kevin", recipientName: "Ana", message: "Happy birthday" };

  function submission(photo: File | null, overrides: Record<string, string> = {}) {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ ...fields, ...overrides })) fd.set(k, v);
    if (photo) fd.set("photo", photo);
    return new Request(url, { method: "POST", body: fd });
  }

  it("201: stores the photo, extracts its real dimensions, creates a SUBMITTED record", async () => {
    db.postcard.create.mockImplementation(async ({ data }) => ({ slug: data.slug, status: "SUBMITTED" }));
    const png = await makePng(100, 150);
    const res = await submit(submission(new File([new Uint8Array(png)], "p.png", { type: "image/png" })));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("SUBMITTED");
    expect(body.slug).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]{10}$/);

    const data = db.postcard.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      senderName: "Kevin",
      recipientName: "Ana",
      message: "Happy birthday",
      photoWidthPx: 100,
      photoHeightPx: 150,
      photoPath: `postcards/${body.slug}/photo.png`,
    });
    expect(await storage.getFile(data.photoPath)).toEqual(png);
  });

  it("400 when the photo is missing", async () => {
    const res = await submit(submission(null));
    expect(res.status).toBe(400);
    expect(db.postcard.create).not.toHaveBeenCalled();
  });

  it("400 for a disallowed MIME type", async () => {
    const res = await submit(submission(new File([new Uint8Array(10)], "p.gif", { type: "image/gif" })));
    expect(res.status).toBe(400);
    expect(db.postcard.create).not.toHaveBeenCalled();
  });

  it("400 for a photo over the 15 MB cap", async () => {
    const big = new File([new Uint8Array(15 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    const res = await submit(submission(big));
    expect(res.status).toBe(400);
    expect(db.postcard.create).not.toHaveBeenCalled();
  });

  it("400 for bytes that claim to be a PNG but do not decode", async () => {
    const res = await submit(
      submission(new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], "p.png", { type: "image/png" }))
    );
    expect(res.status).toBe(400);
    expect(db.postcard.create).not.toHaveBeenCalled();
  });

  it("400 for invalid text fields, with the validation messages", async () => {
    const png = await makePng();
    const res = await submit(
      submission(new File([new Uint8Array(png)], "p.png", { type: "image/png" }), { message: "   " })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Message is required/);
  });
});

describe("GET /api/postcards/[slug] (public lookup)", () => {
  it("404 for an unknown slug", async () => {
    db.postcard.findUnique.mockResolvedValue(null);
    const res = await getPostcard(new Request("http://localhost/x"), params({ slug: "nope" }));
    expect(res.status).toBe(404);
  });

  it("returns viewer metadata, with null AR URLs until assets are attached, and no sender PII", async () => {
    db.postcard.findUnique.mockResolvedValue({
      slug: "abc",
      status: "SUBMITTED",
      senderName: "Kevin",
      recipientName: "Ana",
      message: "private message",
      photoPath: "postcards/abc/photo.png",
      photoWidthPx: 100,
      photoHeightPx: 150,
      targetMindPath: null,
      videoPath: null,
    });
    const res = await getPostcard(new Request("http://localhost/x"), params({ slug: "abc" }));
    const body = await res.json();
    expect(body).toMatchObject({ slug: "abc", targetMindUrl: null, videoUrl: null, photoWidthPx: 100 });
    expect(body).not.toHaveProperty("senderName");
    expect(body).not.toHaveProperty("message");
  });
});

describe("GET /api/postcards/[slug]/print/back", () => {
  const row = { slug: "abc", message: "hi", senderName: "Kevin", recipientName: "Ana" };

  it("404 for an unknown slug", async () => {
    db.postcard.findUnique.mockResolvedValue(null);
    const res = await printBack(new Request("http://localhost/x"), params({ slug: "nope" }));
    expect(res.status).toBe(404);
  });

  // Same ?? vs || regression as tests/base-url.test.ts (commit 7e2d0aa), on the
  // print route: an empty-string PUBLIC_BASE_URL must fall through, not encode
  // a relative "/postcard/<slug>" in the QR.
  it("encodes an absolute viewer URL in the QR when PUBLIC_BASE_URL is set but empty", async () => {
    const saved = process.env.PUBLIC_BASE_URL;
    process.env.PUBLIC_BASE_URL = "";
    try {
      db.postcard.findUnique.mockResolvedValue(row);
      const res = await printBack(new Request("http://localhost/x"), params({ slug: "abc" }));
      expect(res.status).toBe(200);
      expect(await decodeQr(Buffer.from(await res.arrayBuffer()))).toBe("http://localhost:3000/postcard/abc");
    } finally {
      if (saved === undefined) delete process.env.PUBLIC_BASE_URL;
      else process.env.PUBLIC_BASE_URL = saved;
    }
  });
});

describe("GET /api/files/[...key]", () => {
  it("404 for a missing key", async () => {
    const res = await getFile(new Request("http://localhost/x"), params({ key: ["postcards", "none", "photo.png"] }));
    expect(res.status).toBe(404);
  });

  it("200 with the stored bytes, content type and an immutable cache header", async () => {
    const png = await makePng(10, 10);
    await storage.putFile("postcards/files-test/photo.png", png);
    const res = await getFile(
      new Request("http://localhost/x"),
      params({ key: ["postcards", "files-test", "photo.png"] })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(Buffer.from(await res.arrayBuffer())).toEqual(png);
  });
});
