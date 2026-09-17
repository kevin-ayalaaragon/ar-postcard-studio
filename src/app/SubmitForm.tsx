"use client";

import { useState, type FormEvent } from "react";

type SubmitResult = { slug: string } | { error: string } | null;

export default function SubmitForm() {
  const [result, setResult] = useState<SubmitResult>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);

    const formData = new FormData(event.currentTarget);

    try {
      const res = await fetch("/api/postcards", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) {
        setResult({ error: body.error ?? "Something went wrong" });
      } else {
        setResult({ slug: body.slug });
        event.currentTarget.reset();
      }
    } catch {
      setResult({ error: "Network error - please try again" });
    } finally {
      setSubmitting(false);
    }
  }

  if (result && "slug" in result) {
    return (
      <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 p-6 text-emerald-100">
        <h2 className="text-lg font-semibold">Got it!</h2>
        <p className="mt-2 text-sm leading-relaxed">
          Your photo and message are saved. Once the AR animation is attached
          you&apos;ll be able to view it at:
        </p>
        <code className="mt-2 block break-all rounded bg-black/30 px-3 py-2 text-xs">
          /postcard/{result.slug}
        </code>
        <button
          className="mt-4 text-sm underline underline-offset-2"
          onClick={() => setResult(null)}
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Your name
        <input
          name="senderName"
          required
          maxLength={80}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Recipient&apos;s name
        <input
          name="recipientName"
          required
          maxLength={80}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Message
        <textarea
          name="message"
          required
          maxLength={500}
          rows={4}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Photo (JPEG, PNG, or WebP - this is the exact image that gets tracked
        by the AR animation, so use the final version)
        <input
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-full bg-orange-500 px-5 py-3 font-semibold text-black disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Create my postcard"}
      </button>

      {result && "error" in result && (
        <p className="text-sm text-red-400">{result.error}</p>
      )}
    </form>
  );
}
