import type {
  EntryDetail,
  EntryPage,
  Image,
  SessionStatus,
  TagWithCount,
  UploadResult,
} from "./types";

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

  createEntry(body: EntryInput) {
    return request<EntryDetail>("/entries", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateEntry(id: string, body: Partial<EntryInput> & { cover_image_id?: string | null }) {
    return request<EntryDetail>(`/entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  deleteEntry(id: string) {
    return request<void>(`/entries/${id}`, { method: "DELETE" });
  },

  updateImage(id: string, body: { alt_text?: string | null; sort_order?: number }) {
    return request<Image>(`/images/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  deleteImage(id: string) {
    return request<void>(`/images/${id}`, { method: "DELETE" });
  },

  /** Upload with per-file progress.
   *
   *  XMLHttpRequest rather than fetch: fetch still has no way to observe
   *  upload progress, and a 25 MB file with no feedback looks like a hang.
   *  One request per file so a failure is isolated and each gets its own bar.
   */
  uploadImage(
    entryId: string,
    file: File,
    onProgress: (percent: number) => void,
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("files", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE}/entries/${entryId}/images`);
      xhr.withCredentials = true;

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve(JSON.parse(xhr.responseText));
        } else {
          let detail = xhr.statusText;
          try {
            detail = JSON.parse(xhr.responseText).detail ?? detail;
          } catch {
            /* not json */
          }
          reject(new ApiError(xhr.status, detail));
        }
      });

      xhr.addEventListener("error", () => reject(new ApiError(0, "Network error")));
      xhr.addEventListener("abort", () => reject(new ApiError(0, "Upload cancelled")));
      xhr.send(form);
    });
  },
};

export interface EntryInput {
  title: string;
  art_date: string;
  description?: string | null;
  tags?: string[];
  slug?: string | null;
}
