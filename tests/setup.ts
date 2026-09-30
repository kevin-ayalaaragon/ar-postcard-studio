import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Deterministic environment for every test file. Real values are never read
// from .env - tests must pass in CI with no secrets and no network.
process.env.ADMIN_SECRET = "test-admin-secret";
process.env.LOCAL_STORAGE_DIR = mkdtempSync(path.join(tmpdir(), "arps-test-storage-"));
delete process.env.B2_KEY_ID;
delete process.env.B2_APPLICATION_KEY;
delete process.env.B2_BUCKET_NAME;
delete process.env.B2_REGION;
delete process.env.PUBLIC_BASE_URL;
delete process.env.VERCEL_URL;
