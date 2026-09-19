export default function ProfilePage({ params }: { params: { gamerTag: string } }) {
  return (
    <div className="max-w-[1536px] mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">@{params.gamerTag}</h1>
      <p className="text-ggz-muted">Player profiles coming soon.</p>
    </div>
  );
}
