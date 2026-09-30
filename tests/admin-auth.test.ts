import { afterEach, describe, expect, it } from "vitest";
import { isAuthorizedAdmin } from "@/lib/admin-auth";
import { adminRequest } from "./helpers";

const URL = "http://localhost/api/admin/postcards";

describe("isAuthorizedAdmin", () => {
  afterEach(() => {
    process.env.ADMIN_SECRET = "test-admin-secret";
  });

  it("rejects a request with no secret header", () => {
    expect(isAuthorizedAdmin(adminRequest(URL))).toBe(false);
  });

  it("rejects a wrong secret of the same length", () => {
    expect(isAuthorizedAdmin(adminRequest(URL, "test-admin-secreX"))).toBe(false);
  });

  it("rejects a wrong secret of a different length without throwing", () => {
    // crypto.timingSafeEqual throws on unequal lengths; the guard must
    // return false first instead of surfacing a 500.
    expect(isAuthorizedAdmin(adminRequest(URL, "short"))).toBe(false);
    expect(isAuthorizedAdmin(adminRequest(URL, "test-admin-secret-and-more"))).toBe(false);
  });

  it("rejects an empty header value", () => {
    expect(isAuthorizedAdmin(adminRequest(URL, ""))).toBe(false);
  });

  it("accepts the correct secret", () => {
    expect(isAuthorizedAdmin(adminRequest(URL, "test-admin-secret"))).toBe(true);
  });

  it("fails closed when ADMIN_SECRET is unset, even for an empty header", () => {
    delete process.env.ADMIN_SECRET;
    expect(isAuthorizedAdmin(adminRequest(URL, ""))).toBe(false);
    expect(isAuthorizedAdmin(adminRequest(URL, "anything"))).toBe(false);
  });

  it("fails closed when ADMIN_SECRET is set but empty", () => {
    process.env.ADMIN_SECRET = "";
    expect(isAuthorizedAdmin(adminRequest(URL, ""))).toBe(false);
  });
});
