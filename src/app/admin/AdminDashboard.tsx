"use client";

import { useState, type FormEvent } from "react";

interface AdminPostcard {
  slug: string;
  status: "SUBMITTED" | "READY";
  senderName: string;
  recipientName: string;
  message: string;
  photoUrl: string;
  createdAt: string;
}

// One fixed, typed query against /api/graphql (docs/adr/0013-graphql-admin-api.md).
// Uploads stay on the REST route below; only the list read moved.
const POSTCARDS_QUERY = /* GraphQL */ `
  query AdminPostcards($first: Int!, $after: String) {
    postcards(first: $first, after: $after) {
      edges {
        node {
          slug
          status
          senderName
          recipientName
          message
          photoUrl
          createdAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const PAGE_SIZE = 20;

interface PostcardsQueryResult {
  data?: {
    postcards: {
      edges: Array<{ node: AdminPostcard }>;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  } | null;
  errors?: Array<{ message: string }>;
}

export default function AdminDashboard() {
  const [secret, setSecret] = useState("");
  const [postcards, setPostcards] = useState<AdminPostcard[] | null>(null);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // after === undefined loads the first page and replaces the list (unlock,
  // and the refresh after an upload); a cursor appends the next page.
  async function loadPostcards(secretToUse: string, after?: string) {
    setError(null);
    const res = await fetch("/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-secret": secretToUse },
      body: JSON.stringify({ query: POSTCARDS_QUERY, variables: { first: PAGE_SIZE, after: after ?? null } }),
    });
    if (res.status === 401) {
      setError("Wrong admin secret");
      setPostcards(null);
      return;
    }
    const body: PostcardsQueryResult | null = res.ok ? await res.json() : null;
    const page = body?.data?.postcards;
    if (!page || body?.errors?.length) {
      setError("Failed to load postcards");
      if (!after) setPostcards(null);
      return;
    }
    const nodes = page.edges.map((e) => e.node);
    setPostcards((prev) => (after && prev ? [...prev, ...nodes] : nodes));
    setEndCursor(page.pageInfo.endCursor);
    setHasNextPage(page.pageInfo.hasNextPage);
  }

  async function handleLoadMore() {
    if (!endCursor) return;
    setLoadingMore(true);
    try {
      await loadPostcards(secret, endCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    loadPostcards(secret);
  }

  if (!postcards) {
    return (
      <form onSubmit={handleUnlock} className="flex max-w-sm flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Admin secret
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
          />
        </label>
        <button className="rounded bg-orange-500 px-4 py-2 font-semibold text-black">
          Unlock
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {postcards.length === 0 && <p className="text-sm text-zinc-400">No submissions yet.</p>}
      {postcards.map((p) => (
        <PostcardRow key={p.slug} postcard={p} secret={secret} onChanged={() => loadPostcards(secret)} />
      ))}
      {hasNextPage && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="self-start rounded border border-zinc-700 px-4 py-2 text-sm disabled:opacity-50"
        >
          {loadingMore ? "Loading..." : "Load more"}
        </button>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

function PostcardRow({
  postcard,
  secret,
  onChanged,
}: {
  postcard: AdminPostcard;
  secret: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  async function handleAssetUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setRowError(null);
    const formData = new FormData(event.currentTarget);

    try {
      const res = await fetch(`/api/admin/postcards/${postcard.slug}/assets`, {
        method: "POST",
        headers: { "x-admin-secret": secret },
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) {
        setRowError(body.error ?? "Upload failed");
      } else {
        onChanged();
      }
    } catch {
      setRowError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 p-4">
      <div className="flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of a user-uploaded image with unknown dimensions */}
        <img src={postcard.photoUrl} alt="" className="h-24 w-24 rounded object-cover" />
        <div className="flex-1">
          <p className="font-medium">
            {postcard.senderName} → {postcard.recipientName}
          </p>
          <p className="mt-1 text-sm text-zinc-400">{postcard.message}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
            {postcard.status} · {postcard.slug}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <a className="underline" href={`/api/postcards/${postcard.slug}/print/front`}>
          Download front
        </a>
        <a className="underline" href={`/api/postcards/${postcard.slug}/print/back`}>
          Download back
        </a>
        <a className="underline" href={`/postcard/${postcard.slug}`} target="_blank" rel="noreferrer">
          View AR page
        </a>
      </div>

      {postcard.status === "SUBMITTED" && (
        <form onSubmit={handleAssetUpload} className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <input type="file" name="targetMind" accept=".mind" required className="text-xs" />
          <input type="file" name="video" accept="video/mp4" required className="text-xs" />
          <button
            disabled={busy}
            className="rounded bg-orange-500 px-3 py-1.5 font-semibold text-black disabled:opacity-50"
          >
            {busy ? "Uploading..." : "Attach AR assets"}
          </button>
        </form>
      )}
      {rowError && <p className="mt-2 text-sm text-red-400">{rowError}</p>}
    </div>
  );
}
