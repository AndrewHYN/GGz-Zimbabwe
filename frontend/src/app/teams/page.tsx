import Link from "next/link";

interface Team {
  id: string;
  name: string;
  tag: string;
  game_name?: string | null;
  slug: string;
  member_count: number;
  wins: number;
  losses?: number;
  status: string;
}

async function fetchTeams(): Promise<Team[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000"}/api/teams/`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.results ?? data;
}

export default async function TeamsPage() {
  const teams = await fetchTeams();

  return (
    <div className="max-w-[1536px] mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ggz-text-primary">Teams</h1>
        <Link
          href="/teams/create"
          className="bg-ggz-amber text-black font-semibold px-5 py-2 rounded-[var(--radius-lg)] hover:opacity-90 transition"
        >
          Create Team
        </Link>
      </div>

      {teams.length === 0 ? (
        <div className="bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] p-8 text-center">
          <p className="text-ggz-text-muted">
            No teams found. Create the first one!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/teams/${team.slug}`}
              className="block bg-ggz-bg-1 border border-ggz-border rounded-[var(--radius-lg)] p-5 hover:border-ggz-amber/40 transition"
            >
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-lg font-bold text-ggz-text-primary">
                  {team.name}
                </h2>
                <span className="text-xs font-mono text-ggz-text-muted bg-ggz-bg-2 px-1.5 py-0.5 rounded">
                  {team.tag}
                </span>
              </div>
              <p className="text-sm text-ggz-text-secondary mb-2">
                {team.game_name || "Any game"}
              </p>
              <div className="flex gap-4 text-sm text-ggz-text-muted">
                <span>{team.member_count} member{team.member_count !== 1 && "s"}</span>
                <span>{team.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
