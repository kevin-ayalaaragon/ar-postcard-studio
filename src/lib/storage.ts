import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Storage abstraction: every route talks to `storage`, never to `fs`
// directly. Dev uses the local filesystem below; production swaps this
// module for an S3-compatible client (Cloudflare R2 / AWS S3) without
// touching any caller. See docs/adr/0005-file-storage.md.
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

export const storage: StorageDriver = new LocalStorageDriver(
  process.env.LOCAL_STORAGE_DIR ?? "./storage"
);

/** Public URL a client should use to fetch a stored file. */
export function fileUrl(key: string): string {
  return `/api/files/${key}`;
}
