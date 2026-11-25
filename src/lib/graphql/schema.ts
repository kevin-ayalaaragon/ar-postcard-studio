import SchemaBuilder from "@pothos/core";
import ComplexityPlugin from "@pothos/plugin-complexity";
import RelayPlugin from "@pothos/plugin-relay";
import { GraphQLError } from "graphql";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  decodeCursor,
  encodeCursor,
  getPostcardBySlug,
  listPostcards,
  toAdminPostcard,
  type AdminPostcard,
} from "@/lib/postcards";

// Read-only, admin-only GraphQL schema (docs/adr/0013-graphql-admin-api.md).
// Code-first with Pothos so the TypeScript types and the SDL cannot drift;
// the printed SDL is checked in as schema.graphql (npm run schema:print).
//
// Deliberately absent: mutations, subscriptions, the Relay `node`/`nodes`
// fields, and DataLoader (one table, no relations, so no N+1 to batch).

// Caps checked from the query's shape before any root resolver runs, so an
// over-limit request never reaches the database. A connection costs
// 1 + first * (cost of its selection); the widest legal request, one
// postcards(first: 50) page selecting every field, costs 951. Two such pages
// in one request exceed the limit. breadth counts every selection in the
// document, which stops alias amplification (60 x postcard(slug) is 120).
export const COMPLEXITY_LIMITS = { complexity: 1000, depth: 6, breadth: 40 } as const;

const builder = new SchemaBuilder<{
  Objects: { Postcard: AdminPostcard };
  Scalars: { DateTime: { Input: Date; Output: Date } };
  DefaultFieldNullability: false;
  DefaultEdgesNullability: { list: false; items: false };
  DefaultNodeNullability: false;
}>({
  plugins: [ComplexityPlugin, RelayPlugin],
  defaultFieldNullability: false,
  relay: {
    // No Relay `node`/`nodes` root fields: there is one type and it is
    // looked up by slug.
    nodeQueryOptions: false,
    nodesQueryOptions: false,
    // The connection field already multiplies its selection by `first`;
    // without this, edges would add the default list multiplier (10) on top.
    edgesFieldOptions: { nullable: { list: false, items: false }, complexity: { field: 1, multiplier: 1 } },
    nodeFieldOptions: { nullable: false },
    // The Relay plugin always adds before/last; say so in the SDL.
    beforeArgOptions: { description: "Not supported: forward pagination only." },
    lastArgOptions: { description: "Not supported: forward pagination only." },
  },
  complexity: {
    defaultComplexity: 1,
    defaultListMultiplier: 10,
    limit: COMPLEXITY_LIMITS,
  },
});

builder.scalarType("DateTime", {
  description: "ISO-8601 timestamp (UTC).",
  serialize: (value) => value.toISOString(),
  parseValue: (value) => {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new GraphQLError("Invalid DateTime");
    return date;
  },
});

const PostcardStatus = builder.enumType("PostcardStatus", {
  values: {
    SUBMITTED: { description: "Photo and message received; waiting on AR assets." },
    READY: { description: "Target and video attached; viewer and print files are live." },
  } as const,
});

const Postcard = builder.objectRef<AdminPostcard>("Postcard").implement({
  description:
    "A submitted postcard, admin view. Includes sender PII (senderName, message), unlike the public GET /api/postcards/{slug}. Files are exposed as URLs only, never storage paths.",
  fields: (t) => ({
    slug: t.exposeString("slug"),
    status: t.field({ type: PostcardStatus, resolve: (p) => p.status }),
    senderName: t.exposeString("senderName"),
    recipientName: t.exposeString("recipientName"),
    message: t.exposeString("message"),
    photoUrl: t.exposeString("photoUrl"),
    photoWidthPx: t.exposeInt("photoWidthPx"),
    photoHeightPx: t.exposeInt("photoHeightPx"),
    targetMindUrl: t.exposeString("targetMindUrl", { nullable: true }),
    videoUrl: t.exposeString("videoUrl", { nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
  }),
});

builder.queryType({
  fields: (t) => ({
    postcards: t.connection(
      {
        type: Postcard,
        description: `Postcards, newest first. first defaults to ${DEFAULT_PAGE_SIZE}, max ${MAX_PAGE_SIZE}. Forward pagination only: last/before are rejected.`,
        args: {
          status: t.arg({ type: PostcardStatus, required: false }),
        },
        // Cost scales with the page size the caller asks for.
        complexity: (args) => ({
          field: 1,
          multiplier: Math.min(args.first ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
        }),
        resolve: async (_root, args) => {
          if (args.last != null || args.before != null) {
            throw new GraphQLError("Backward pagination (last/before) is not supported.");
          }
          const first = args.first ?? DEFAULT_PAGE_SIZE;
          if (first < 1 || first > MAX_PAGE_SIZE) {
            throw new GraphQLError(`first must be between 1 and ${MAX_PAGE_SIZE}.`);
          }
          const after = args.after != null ? decodeCursor(args.after) : undefined;
          if (after === null) {
            throw new GraphQLError("Invalid cursor.");
          }

          const page = await listPostcards({ status: args.status ?? undefined, first, after });
          const edges = page.rows.map((row) => ({
            cursor: encodeCursor(row),
            node: toAdminPostcard(row),
          }));
          return {
            edges,
            pageInfo: {
              hasNextPage: page.hasNextPage,
              hasPreviousPage: false,
              startCursor: edges[0]?.cursor ?? null,
              endCursor: edges.at(-1)?.cursor ?? null,
            },
          };
        },
      },
      { name: "PostcardConnection" },
      { name: "PostcardEdge" }
    ),
    postcard: t.field({
      type: Postcard,
      nullable: true,
      description: "One postcard by slug, or null if none exists. Admin-only, includes sender PII.",
      args: { slug: t.arg.string({ required: true }) },
      resolve: async (_root, { slug }) => {
        const row = await getPostcardBySlug(slug);
        return row ? toAdminPostcard(row) : null;
      },
    }),
  }),
});

export const schema = builder.toSchema();
