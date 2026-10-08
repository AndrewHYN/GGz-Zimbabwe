import "server-only";
export async function serverList<T>(
  path: string,
): Promise<{ items: T[]; unavailable: boolean }> {
  const base = (
    process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000"
  ).replace(/\/$/, "");
  try {
    const response = await fetch(base + path, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Service unavailable");
    const data = await response.json();
    const items = Array.isArray(data) ? data : data.results;
    if (!Array.isArray(items)) throw new Error("Invalid response");
    return { items, unavailable: false };
  } catch {
    return { items: [], unavailable: true };
  }
}
