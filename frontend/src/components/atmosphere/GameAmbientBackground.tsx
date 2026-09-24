import Image from "next/image";

const API_BASE = process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000";

interface AmbientGame {
  cover_art_url?: string | null;
}

async function getAmbientArt(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/api/games/`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json();
    const games: AmbientGame[] = Array.isArray(data) ? data : data.games || data.results || [];
    const urls = games.map((game) => game.cover_art_url).filter((url): url is string => Boolean(url));
    return [...new Set(urls)].slice(0, 2);
  } catch {
    return [];
  }
}

export async function GameAmbientBackground() {
  const images = await getAmbientArt();

  return (
    <div className="ggz-ambient" aria-hidden="true">
      <div className="ggz-ambient__glow" />
      {images[0] && (
        <Image
          src={images[0]}
          alt=""
          fill
          sizes="100vw"
          unoptimized
          className="ggz-ambient__layer ggz-ambient__layer-a"
          decoding="async"
        />
      )}
      {images[1] && (
        <Image
          src={images[1]}
          alt=""
          fill
          sizes="100vw"
          unoptimized
          loading="lazy"
          className="ggz-ambient__layer ggz-ambient__layer-b"
          decoding="async"
        />
      )}
      <div className="ggz-ambient__veil" />
    </div>
  );
}
