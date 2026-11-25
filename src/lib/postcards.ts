import type { Postcard, PostcardStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fileUrl } from "@/lib/storage";

// Read-side data access for postcards, shared by the REST admin list and the
// GraphQL API (docs/adr/0013-graphql-admin-api.md). Callers get URLs built
// with fileUrl(), never raw storage paths.

export type { PostcardStatus };

/** Admin view of a postcard. Includes sender PII; never return it from a public route. */
export interface AdminPostcard {
  id: string;
  slug: string;
  status: PostcardStatus;
  senderName: string;
  recipientName: string;
  message: string;
  photoUrl: string;
  photoWidthPx: number;
  photoHeightPx: number;
  targetMindUrl: string | null;
  videoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toAdminPostcard(p: Postcard): AdminPostcard {
  return {
    id: p.id,
    slug: p.slug,
    status: p.status,
    senderName: p.senderName,
    recipientName: p.recipientName,
    message: p.message,
    photoUrl: fileUrl(p.photoPath),
    photoWidthPx: p.photoWidthPx,
    photoHeightPx: p.photoHeightPx,
    targetMindUrl: p.targetMindPath ? fileUrl(p.targetMindPath) : null,
    videoUrl: p.videoPath ? fileUrl(p.videoPath) : null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// Newest first. id breaks ties between rows created in the same millisecond,
// so the order is total and a keyset cursor never skips or repeats a row.
const ORDER = [{ createdAt: "desc" as const }, { id: "desc" as const }];

/**
 * Every postcard, newest first, unpaginated. The REST admin list uses this,
 * and the MCP tool list_pending_postcards filters that full array in memory,
 * so this must stay unpaginated (pinned by tests/api-routes.test.ts).
 */
export function listAllPostcards(): Promise<Postcard[]> {
  return prisma.postcard.findMany({ orderBy: ORDER });
}

export function getPostcardBySlug(slug: string): Promise<Postcard | null> {
  return prisma.postcard.findUnique({ where: { slug } });
}

/** Position of a row in the (createdAt desc, id desc) order. */
export interface PostcardCursor {
  createdAt: Date;
  id: string;
}

export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 20;

export interface ListPostcardsArgs {
  status?: PostcardStatus;
  first: number;
  after?: PostcardCursor;
}

export interface PostcardPage {
  rows: Postcard[];
  hasNextPage: boolean;
}

/**
 * Keyset pagination over (createdAt desc, id desc). Fetches first+1 rows and
 * uses the extra one only to compute hasNextPage. Prisma's own `cursor`
 * option needs a unique field and would order by id alone, so the
 * "strictly after this row" condition is written out as a where clause.
 */
export async function listPostcards({ status, first, after }: ListPostcardsArgs): Promise<PostcardPage> {
  const take = Math.min(Math.max(Math.trunc(first), 1), MAX_PAGE_SIZE);
  const where = {
    ...(status ? { status } : {}),
    ...(after
      ? {
          OR: [
            { createdAt: { lt: after.createdAt } },
            { createdAt: after.createdAt, id: { lt: after.id } },
          ],
        }
      : {}),
  };
  const rows = await prisma.postcard.findMany({ where, orderBy: ORDER, take: take + 1 });
  return { rows: rows.slice(0, take), hasNextPage: rows.length > take };
}

/** Opaque cursor: base64url of "<ISO createdAt>|<id>". */
export function encodeCursor(p: Pick<Postcard, "createdAt" | "id">): string {
  return Buffer.from(`${p.createdAt.toISOString()}|${p.id}`).toString("base64url");
}

/** Returns null for anything that is not a cursor this module produced. */
export function decodeCursor(cursor: string): PostcardCursor | null {
  const raw = Buffer.from(cursor, "base64url").toString("utf8");
  const sep = raw.indexOf("|");
  if (sep < 0) return null;
  const createdAt = new Date(raw.slice(0, sep));
  const id = raw.slice(sep + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) return null;
  return { createdAt, id };
}
