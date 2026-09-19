const API_BASE = process.env.NEXT_PUBLIC_DJANGO_URL || "http://localhost:8000";

class ApiClient {
  private baseUrl: string;
  private csrfToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
    return null;
  }

  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    
    try {
      const response = await fetch(`${this.baseUrl}/accounts/login/`, {
        credentials: "include",
      });
      const html = await response.text();
      const match = html.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/);
      if (match) {
        this.csrfToken = match[1];
        return this.csrfToken;
      }
    } catch {
      // Fall back to cookie
    }

    const cookieToken = this.getCookie("csrftoken");
    if (cookieToken) {
      this.csrfToken = cookieToken;
      return this.csrfToken;
    }

    throw new Error("Unable to obtain CSRF token");
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = endpoint.startsWith("http") ? endpoint : `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      "X-Requested-With": "XMLHttpRequest",
      ...(options.headers as Record<string, string>),
    };

    if (options.method && options.method !== "GET") {
      const token = await this.getCsrfToken();
      headers["X-CSRFToken"] = token;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `API error: ${response.status}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const body = data instanceof FormData ? data : data ? JSON.stringify(data) : undefined;
    const headers: Record<string, string> = data instanceof FormData ? {} : { "Content-Type": "application/json" };
    return this.request<T>(endpoint, { method: "POST", body, headers });
  }

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  async checkAuth(): Promise<{ authenticated: boolean; user?: { id: number; username: string; email: string }; profile?: { gamer_tag: string; avatar: string | null } }> {
    try {
      const data = await this.get<{ authenticated: boolean; user?: { id: number; username: string; email: string }; profile?: { gamer_tag: string; avatar: string | null } }>("/api/profiles/me/");
      return data;
    } catch {
      return { authenticated: false };
    }
  }
}

export const api = new ApiClient(API_BASE);
export default api;
