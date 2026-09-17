import { customAlphabet } from "nanoid";

// Unambiguous, URL-safe alphabet (no 0/O/1/I/l) - the slug ends up in a
// printed QR code, so it should be easy to read back if anyone ever has to
// type it by hand.
const nanoid = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 10);

export function generateSlug(): string {
  return nanoid();
}
