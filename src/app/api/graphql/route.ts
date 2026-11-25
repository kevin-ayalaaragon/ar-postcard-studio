import { createYoga } from "graphql-yoga";
import { isAuthorizedAdmin } from "@/lib/admin-auth";
import { schema } from "@/lib/graphql/schema";

// Read-only, admin-only GraphQL endpoint beside the REST routes - see
// docs/adr/0013-graphql-admin-api.md.
//
// Same gate as /mcp (src/app/mcp/route.ts): isAuthorizedAdmin() runs before
// Yoga sees the request, so an unauthenticated caller gets a bare 401 and
// nothing is parsed, validated or resolved.
//
// - Operations are POST only. GET never executes a query: in development it
//   serves the GraphiQL page (static HTML, no data - queries from it are
//   POSTs that still need the x-admin-secret header, set in GraphiQL's
//   Headers tab); everywhere else GET is 405.
// - maskedErrors: unexpected resolver errors (e.g. a database failure)
//   reach the client as "Unexpected error."; only deliberate GraphQLErrors
//   (bad cursor, first out of range) keep their message.
// - batching off: one operation per request, so the complexity limit in
//   src/lib/graphql/schema.ts bounds the cost of a request.
// - No CSRF plugin: the custom x-admin-secret header already forces a CORS
//   preflight, which a cross-site form or simple request cannot pass.
const isDev = process.env.NODE_ENV === "development";

const yoga = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
  maskedErrors: true,
  batching: false,
  graphiql: isDev,
  landingPage: false,
});

export async function POST(request: Request): Promise<Response> {
  if (!isAuthorizedAdmin(request)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return yoga.handleRequest(request, {});
}

export async function GET(request: Request): Promise<Response> {
  const wantsGraphiQL =
    isDev &&
    !new URL(request.url).searchParams.has("query") &&
    (request.headers.get("accept") ?? "").includes("text/html");
  if (wantsGraphiQL) {
    return yoga.handleRequest(request, {});
  }
  return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
}
