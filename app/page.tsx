import MusicLibrary from "@/components/MusicLibrary";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-neutral-800 to-black p-4 md:p-8 pt-16">
      <div className="max-w-screen-xl mx-auto">
        <MusicLibrary />
      </div>
    </main>
  );
}