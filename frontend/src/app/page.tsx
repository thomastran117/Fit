import { HomeSessionPanel } from "@/components/home/home-session-panel";

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(96,165,250,0.18),_transparent_42%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-6 py-16 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-6xl items-center justify-center">
        <HomeSessionPanel />
      </div>
    </main>
  );
}
