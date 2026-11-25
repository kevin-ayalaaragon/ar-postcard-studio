import { describe, expect, it } from "vitest";
import { lexicographicSortSchema, printSchema } from "graphql";
import { schema } from "@/lib/graphql/schema";

// The checked-in schema.graphql is the reviewable contract for /api/graphql.
// This fails when the code-first schema changes without regenerating it.
// `npm run schema:print` regenerates the file (it runs this test with -u).
describe("GraphQL schema contract", () => {
  it("matches the checked-in schema.graphql", async () => {
    const sdl = printSchema(lexicographicSortSchema(schema));
    await expect(sdl, "schema.graphql is stale: run `npm run schema:print` and commit it").toMatchFileSnapshot(
      "../schema.graphql"
    );
  });

  it("is read-only: no mutations, no subscriptions, no Relay node lookup", () => {
    expect(schema.getMutationType()).toBeFalsy();
    expect(schema.getSubscriptionType()).toBeFalsy();
    const fields = Object.keys(schema.getQueryType()!.getFields()).sort();
    expect(fields).toEqual(["postcard", "postcards"]);
  });

  it("never exposes storage paths", () => {
    const sdl = printSchema(schema);
    expect(sdl).not.toMatch(/photoPath|targetMindPath|videoPath/);
  });
});
