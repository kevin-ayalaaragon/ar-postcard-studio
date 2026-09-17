import AdminDashboard from "./AdminDashboard";

export default function AdminPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Attach a compiled <code>.mind</code> target and an <code>.mp4</code>{" "}
          animation to each submission, then download the print-ready front
          and back.
        </p>
      </div>
      <AdminDashboard />
    </main>
  );
}
