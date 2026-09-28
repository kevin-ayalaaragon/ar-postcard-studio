import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  type S3ServiceException,
} from "@aws-sdk/client-s3";

// Storage abstraction: every route talks to `storage`, never to `fs`
// directly. Dev uses the local filesystem below; production swaps this
// module for an S3-compatible client (Cloudflare R2 / AWS S3) without
// touching any caller. See docs/adr/0006-file-storage.md and
// docs/adr/0010-hosting-vercel-neon-r2.md.
export interface StorageDriver {
  putFile(key: string, data: Buffer): Promise<void>;
  getFile(key: string): Promise<Buffer | null>;
}

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".mind": "application/octet-stream",
  ".mp4": "video/mp4",
};

export function contentTypeFor(key: string): string {
  return CONTENT_TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream";
}

class LocalStorageDriver implements StorageDriver {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    // Reject traversal outside the storage root - `key` is built from
    // server-generated slugs/filenames, never taken verbatim from a client
    // path, but this keeps the driver safe on its own.
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(path.resolve(this.root))) {
      throw new Error(`Refusing to access path outside storage root: ${key}`);
    }
    return resolved;
  }

  async putFile(key: string, data: Buffer): Promise<void> {
    const filePath = this.resolve(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
  }

  async getFile(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }
}

class R2StorageDriver implements StorageDriver {
  private readonly client: S3Client;

  constructor(
    private readonly accountId: string,
    private readonly bucket: string,
    accessKeyId: string,
    secretAccessKey: string
  ) {
    // R2's S3-compatible endpoint is account-scoped, not region-scoped -
    // Cloudflare has no concept of AWS regions, so this always passes
    // "auto". See docs/adr/0010-hosting-vercel-neon-r2.md.
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async putFile(key: string, data: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentTypeFor(key),
      })
    );
  }

  async getFile(key: string): Promise<Buffer | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      );
      const bytes = await result.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch (err) {
      if ((err as S3ServiceException).name === "NoSuchKey") return null;
      throw err;
    }
  }
}

// R2 wins when configured (production); local filesystem is the fallback
// for zero-account local dev. Toggled on R2_ACCOUNT_ID's presence alone -
// if that's set, the other three R2_* vars are required and its absence
// is treated as local dev, never as "storage half-configured, fall
// through silently."
function buildStorageDriver(): StorageDriver {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) {
    return new LocalStorageDriver(process.env.LOCAL_STORAGE_DIR ?? "./storage");
  }

  const bucket = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2_ACCOUNT_ID is set but R2_BUCKET_NAME/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY are not - refusing to silently fall back to local disk storage in what looks like a production environment."
    );
  }

  return new R2StorageDriver(accountId, bucket, accessKeyId, secretAccessKey);
}

export const storage: StorageDriver = buildStorageDriver();

/** Public URL a client should use to fetch a stored file. */
export function fileUrl(key: string): string {
  return `/api/files/${key}`;
}
