import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { baseUrl } from "@/lib/base-url";

describe("baseUrl fallback order", () => {
  beforeEach(() => {
    delete process.env.PUBLIC_BASE_URL;
    delete process.env.VERCEL_URL;
  });
  afterEach(() => {
    delete process.env.PUBLIC_BASE_URL;
    delete process.env.VERCEL_URL;
  });

  it("prefers PUBLIC_BASE_URL when set", () => {
    process.env.PUBLIC_BASE_URL = "https://ar-postcard-studio.vercel.app";
    process.env.VERCEL_URL = "preview-abc.vercel.app";
    expect(baseUrl()).toBe("https://ar-postcard-studio.vercel.app");
  });

  it("falls back to the auto-injected VERCEL_URL, with https", () => {
    process.env.VERCEL_URL = "preview-abc.vercel.app";
    expect(baseUrl()).toBe("https://preview-abc.vercel.app");
  });

  it("falls back to localhost when neither is set", () => {
    expect(baseUrl()).toBe("http://localhost:3000");
  });

  // Regression test for commit 7e2d0aa: with `??`, an empty-string
  // PUBLIC_BASE_URL counted as present, so every MCP tool call built an
  // unparseable URL and failed in production.
  it("treats an empty-string PUBLIC_BASE_URL as unset (?? vs || regression)", () => {
    process.env.PUBLIC_BASE_URL = "";
    process.env.VERCEL_URL = "preview-abc.vercel.app";
    expect(baseUrl()).toBe("https://preview-abc.vercel.app");
    delete process.env.VERCEL_URL;
    expect(baseUrl()).toBe("http://localhost:3000");
  });

  it("treats an empty-string VERCEL_URL as unset", () => {
    process.env.VERCEL_URL = "";
    expect(baseUrl()).toBe("http://localhost:3000");
  });

  it("always yields a URL that fetch() can parse", () => {
    for (const value of ["", undefined]) {
      if (value === undefined) delete process.env.PUBLIC_BASE_URL;
      else process.env.PUBLIC_BASE_URL = value;
      expect(() => new URL(baseUrl())).not.toThrow();
    }
  });
});
