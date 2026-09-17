import SubmitForm from "./SubmitForm";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">AR Postcard Studio</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Upload a photo and write a message. We&apos;ll pair it with an AR
          animation you can print as a postcard - point a phone camera at the
          printed photo and the video plays right on top of it.
        </p>
      </div>
      <SubmitForm />
    </main>
  );
}
