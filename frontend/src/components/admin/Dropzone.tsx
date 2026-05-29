import { useRef, useState } from "react";

import { api, ApiError } from "../../api/client";

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
// Browsers disagree about HEIC: some report image/heic, others report an empty
// type. Fall back to the extension so a phone photo is not rejected before it
// is even sent -- the server checks magic bytes either way.
const ACCEPT_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 20;

interface Upload {
  name: string;
  percent: number;
  error?: string;
}

interface Props {
  entryId: string;
  existingCount: number;
  onUploaded: () => void;
}

export default function Dropzone({ entryId, existingCount, onUploaded }: Props) {
  const [over, setOver] = useState(false);
  const [queue, setQueue] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const room = MAX_FILES - existingCount;

  async function send(files: File[]) {
    if (files.length === 0) return;

    // Checked here for instant feedback, and again on the server by magic
    // bytes -- the type the browser reports is only a hint.
    const checked = files.slice(0, room).map((file) => {
      const looksRight = ACCEPT.includes(file.type) || ACCEPT_EXT.test(file.name);
      if (!looksRight) return { file, error: "Not a JPEG, PNG, WebP or HEIC" };
      if (file.size > MAX_BYTES) return { file, error: "Larger than 25 MB" };
      return { file, error: undefined as string | undefined };
    });

    setQueue(checked.map((c) => ({ name: c.file.name, percent: 0, error: c.error })));
    setBusy(true);

    // Sequential, not parallel: twenty concurrent uploads would saturate the
    // link and make every progress bar crawl at once.
    for (let i = 0; i < checked.length; i++) {
      const { file, error } = checked[i];
      if (error) continue;
      try {
        const result = await api.uploadImage(entryId, file, (percent) =>
          setQueue((q) => q.map((u, j) => (j === i ? { ...u, percent } : u))),
        );
        // The server reports per-file failures in the body rather than as a
        // status code, so a 201 does not on its own mean this file worked.
        const failure = result.failed[0];
        if (failure) {
          setQueue((q) => q.map((u, j) => (j === i ? { ...u, error: failure.error } : u)));
        }
      } catch (e) {
        const message = e instanceof ApiError ? e.message : "Upload failed";
        setQueue((q) => q.map((u, j) => (j === i ? { ...u, error: message } : u)));
      }
    }

    setBusy(false);
    onUploaded();
    // Leave failures on screen; clear the successes after a beat.
    setTimeout(() => setQueue((q) => q.filter((u) => u.error)), 1200);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          send(Array.from(e.dataTransfer.files));
        }}
        className={`rounded-sm border-2 border-dashed p-8 text-center transition-colors ${
          over ? "border-accent-amber bg-surface/60" : "border-stock/15"
        }`}
      >
        <p className="text-sm text-stock/60">
          {room <= 0 ? (
            <>This entry is full &mdash; {MAX_FILES} images is the limit.</>
          ) : (
            <>Drop images here, or</>
          )}
        </p>

        {room > 0 && (
          <>
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy}
              className="mt-3 rounded-full border border-stock/25 px-4 py-2 text-sm
                         text-stock/80 hover:border-stock/50 disabled:opacity-40"
            >
              {busy ? "Uploading…" : "Choose files"}
            </button>
            <p className="mt-3 text-xs text-stock/30">
              JPEG, PNG, WebP or HEIC · up to 25 MB each · {room} slot
              {room === 1 ? "" : "s"} left
            </p>
          </>
        )}

        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT.join(",")}
          className="sr-only"
          onChange={(e) => {
            send(Array.from(e.target.files ?? []));
            e.target.value = ""; // so picking the same file twice still fires
          }}
        />
      </div>

      {queue.length > 0 && (
        <ul className="mt-4 space-y-2" aria-live="polite">
          {queue.map((u, i) => (
            <li key={`${u.name}-${i}`} className="text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-stock/70">{u.name}</span>
                <span className={u.error ? "text-accent-rust" : "text-stock/40"}>
                  {u.error ?? `${u.percent}%`}
                </span>
              </div>
              {!u.error && (
                <div className="mt-1 h-0.5 w-full bg-well">
                  <div
                    className="h-full bg-accent-teal transition-[width] duration-150"
                    style={{ width: `${u.percent}%` }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
