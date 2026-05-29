import type { EntryDetail, EntryPage, SessionStatus, TagWithCount } from "./types";

/** Relative on purpose. Vite proxies /api in dev and CloudFront routes it in
 *  production, so the frontend never needs to know where the API lives. */
const BASE = "/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    // Without this the session cookie is not sent and every write 401s.
    credentials: "same-origin",
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });

  if (!response.ok) {
    // FastAPI puts the reason in `detail`; fall back to the status text when
    // the body is not JSON at all, which is what a proxy error looks like.
    let detail = response.statusText;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* not json */
    }
    throw new ApiError(response.status, detail);
  }

  return response.status === 204 ? (undefined as T) : response.json();
}

export interface ListParams {
  tag?: string;
  sort?: "asc" | "desc";
  page?: number;
  perPage?: number;
}

export const api = {
  listEntries(params: ListParams = {}) {
    const q = new URLSearchParams();
    if (params.tag) q.set("tag", params.tag);
    if (params.sort) q.set("sort", params.sort);
    if (params.page) q.set("page", String(params.page));
    if (params.perPage) q.set("per_page", String(params.perPage));
    const query = q.toString();
    return request<EntryPage>(`/entries${query ? `?${query}` : ""}`);
  },

  getEntry(slug: string) {
    return request<EntryDetail>(`/entries/${encodeURIComponent(slug)}`);
  },

  listTags() {
    return request<TagWithCount[]>("/tags");
  },

  session() {
    return request<SessionStatus>("/auth/me");
  },

  login(password: string) {
    return request<SessionStatus>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },

  logout() {
    return request<{ message: string }>("/auth/logout", { method: "POST" });
  },
};
