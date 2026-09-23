export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errors?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

async function fetchWithTimeout(url: string, options: RequestInit, ms = 20000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  headers.set("X-Requested-With", "XMLHttpRequest");
  // fetch() only defaults string bodies to text/plain; Django's JSON auth
  // API reads request.body exclusively for application/json content types.
  if (typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (method !== "GET" && method !== "HEAD") {
    await fetchWithTimeout("/api/csrf/", { credentials: "include" });
    const token = getCookie("csrftoken");
    if (token) headers.set("X-CSRFToken", token);
  }

  const response = await fetchWithTimeout(path, { ...options, headers, credentials: "include" });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data.error === "string" && data.error
        ? data.error
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status, data?.errors);
  }

  return data as T;
}

export function dispatchAuthChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ggz:auth-changed"));
  }
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const fieldMessages = error.errors ? Object.values(error.errors).flat().join(" ") : "";
    return fieldMessages || error.message;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return "The server is taking too long to respond. Check your connection and try again.";
  }
  return fallback;
}
