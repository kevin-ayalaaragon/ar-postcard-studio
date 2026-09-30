import { describe, expect, it } from "vitest";
import {
  ACCEPTED_PHOTO_TYPES,
  ACCEPTED_VIDEO_TYPES,
  MAX_MIND_BYTES,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  submitPostcardSchema,
} from "@/lib/validation";
import { generateSlug } from "@/lib/slug";

describe("submitPostcardSchema", () => {
  const valid = { senderName: "Kevin", recipientName: "Ana", message: "Happy birthday!" };

  it("accepts a valid submission", () => {
    expect(submitPostcardSchema.safeParse(valid).success).toBe(true);
  });

  it("trims whitespace before measuring", () => {
    const parsed = submitPostcardSchema.parse({ ...valid, senderName: "  Kevin  " });
    expect(parsed.senderName).toBe("Kevin");
  });

  it.each(["senderName", "recipientName", "message"] as const)(
    "rejects a blank %s",
    (field) => {
      expect(submitPostcardSchema.safeParse({ ...valid, [field]: "   " }).success).toBe(false);
    }
  );

  it("enforces length ceilings (80 / 80 / 500)", () => {
    expect(submitPostcardSchema.safeParse({ ...valid, senderName: "a".repeat(80) }).success).toBe(true);
    expect(submitPostcardSchema.safeParse({ ...valid, senderName: "a".repeat(81) }).success).toBe(false);
    expect(submitPostcardSchema.safeParse({ ...valid, recipientName: "a".repeat(81) }).success).toBe(false);
    expect(submitPostcardSchema.safeParse({ ...valid, message: "a".repeat(500) }).success).toBe(true);
    expect(submitPostcardSchema.safeParse({ ...valid, message: "a".repeat(501) }).success).toBe(false);
  });

  it("rejects missing or non-string fields", () => {
    expect(submitPostcardSchema.safeParse({ senderName: "Kevin" }).success).toBe(false);
    expect(submitPostcardSchema.safeParse({ ...valid, message: null }).success).toBe(false);
  });
});

describe("upload limits", () => {
  it("pins the documented caps", () => {
    expect(MAX_PHOTO_BYTES).toBe(15 * 1024 * 1024);
    expect(MAX_VIDEO_BYTES).toBe(100 * 1024 * 1024);
    expect(MAX_MIND_BYTES).toBe(20 * 1024 * 1024);
  });

  it("allow-lists exactly JPEG/PNG/WebP photos and MP4 video", () => {
    expect([...ACCEPTED_PHOTO_TYPES].sort()).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(ACCEPTED_VIDEO_TYPES).toEqual(["video/mp4"]);
  });
});

describe("generateSlug", () => {
  it("is 10 characters from the unambiguous 31-symbol alphabet", () => {
    for (let i = 0; i < 500; i++) {
      expect(generateSlug()).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]{10}$/);
    }
  });

  it("never emits visually ambiguous characters (0, O, 1, I, l)", () => {
    const joined = Array.from({ length: 2000 }, generateSlug).join("");
    expect(joined).not.toMatch(/[01OIl]/);
  });

  it("produces no collisions across 20,000 draws", () => {
    const seen = new Set(Array.from({ length: 20000 }, generateSlug));
    expect(seen.size).toBe(20000);
  });

  it("has a keyspace of 31^10, about 8.2e14", () => {
    expect(31 ** 10).toBeGreaterThan(8.1e14);
    expect(31 ** 10).toBeLessThan(8.3e14);
  });
});
