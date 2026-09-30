import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// storage.ts builds its driver once at import time from the environment, so
// each test re-imports it after setting the environment it cares about.
async function loadStorage() {
  vi.resetModules();
  return import("@/lib/storage");
}

describe("storage driver selection", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env.LOCAL_STORAGE_DIR = mkdtempSync(path.join(tmpdir(), "arps-storage-"));
    delete process.env.B2_KEY_ID;
    delete process.env.B2_APPLICATION_KEY;
    delete process.env.B2_BUCKET_NAME;
    delete process.env.B2_REGION;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("uses local disk when B2_KEY_ID is unset: put then get round-trips bytes", async () => {
    const { storage } = await loadStorage();
    const data = Buffer.from([1, 2, 3, 4, 5]);
    await storage.putFile("postcards/abc/photo.png", data);
    expect(await storage.getFile("postcards/abc/photo.png")).toEqual(data);
  });

  it("returns null, not an error, for a missing key", async () => {
    const { storage } = await loadStorage();
    expect(await storage.getFile("postcards/none/photo.png")).toBeNull();
  });

  it("refuses keys that traverse outside the storage root", async () => {
    const { storage } = await loadStorage();
    await expect(storage.putFile("../escape.txt", Buffer.from("x"))).rejects.toThrow(
      /outside storage root/
    );
    await expect(storage.getFile("../../etc/passwd")).rejects.toThrow(/outside storage root/);
  });

  // Fail-closed: a half-configured production environment must not silently
  // fall back to ephemeral local disk.
  it.each([
    ["B2_BUCKET_NAME", { B2_KEY_ID: "k", B2_REGION: "us-west-004", B2_APPLICATION_KEY: "s" }],
    ["B2_REGION", { B2_KEY_ID: "k", B2_BUCKET_NAME: "b", B2_APPLICATION_KEY: "s" }],
    ["B2_APPLICATION_KEY", { B2_KEY_ID: "k", B2_BUCKET_NAME: "b", B2_REGION: "us-west-004" }],
  ])("throws at startup when B2_KEY_ID is set but %s is missing", async (_missing, env) => {
    Object.assign(process.env, env);
    await expect(loadStorage()).rejects.toThrow(/refusing to silently fall back/);
  });

  it("selects the B2 driver when all four variables are present", async () => {
    Object.assign(process.env, {
      B2_KEY_ID: "k",
      B2_APPLICATION_KEY: "s",
      B2_BUCKET_NAME: "b",
      B2_REGION: "us-west-004",
    });
    const { storage } = await loadStorage();
    expect(storage.constructor.name).toBe("B2StorageDriver");
  });
});

describe("content types and file URLs", () => {
  it("maps extensions to content types, case-insensitively, with a safe default", async () => {
    const { contentTypeFor } = await loadStorage();
    expect(contentTypeFor("a/photo.JPG")).toBe("image/jpeg");
    expect(contentTypeFor("a/photo.png")).toBe("image/png");
    expect(contentTypeFor("a/target.mind")).toBe("application/octet-stream");
    expect(contentTypeFor("a/video.mp4")).toBe("video/mp4");
    expect(contentTypeFor("a/unknown.xyz")).toBe("application/octet-stream");
  });

  it("builds same-origin file URLs so the storage vendor can change without client changes", async () => {
    const { fileUrl } = await loadStorage();
    expect(fileUrl("postcards/abc/photo.png")).toBe("/api/files/postcards/abc/photo.png");
  });
});
