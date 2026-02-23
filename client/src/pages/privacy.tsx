import { Link } from "wouter";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800/50 py-4">
        <div className="container mx-auto px-4 max-w-3xl flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-white">JengaTrack</Link>
          <Link href="/" className="text-sm text-zinc-400 hover:text-white">Back to home</Link>
        </div>
      </header>
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <p className="text-zinc-400 leading-relaxed">
          This page is a placeholder. Add your privacy policy content here.
        </p>
        <p className="mt-6">
          <Link href="/" className="text-[#22c55e] hover:underline">Return to home</Link>
        </p>
      </main>
    </div>
  );
}
