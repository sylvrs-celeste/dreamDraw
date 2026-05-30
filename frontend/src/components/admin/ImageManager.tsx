import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import Dropzone from "./Dropzone";
import { api } from "../../api/client";
import type { EntryDetail, Image } from "../../api/types";

interface Props {
  entry: EntryDetail;
}

export default function ImageManager({ entry }: Props) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries();

  // Local copy so reordering feels instant. The server is told afterwards.
  const [order, setOrder] = useState<Image[] | null>(null);
  const images = order ?? entry.images;

  const persistOrder = useMutation({
    mutationFn: async (next: Image[]) => {
      // Only the rows whose position actually changed need writing.
      await Promise.all(
        next.map((img, i) =>
          img.sort_order === i ? null : api.updateImage(img.id, { sort_order: i }),
        ),
      );
    },
    onSuccess: () => {
      setOrder(null);
      refresh();
    },
  });

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    persistOrder.mutate(next);
  };

  const setAlt = useMutation({
    mutationFn: ({ id, alt }: { id: string; alt: string }) =>
      api.updateImage(id, { alt_text: alt.trim() || null }),
    onSuccess: refresh,
  });

  const setCover = useMutation({
    mutationFn: (imageId: string) => api.updateEntry(entry.id, { cover_image_id: imageId }),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (imageId: string) => api.deleteImage(imageId),
    onSuccess: () => {
      setOrder(null);
      refresh();
    },
  });

  const coverId = entry.cover_image?.id;

  return (
    <section className="mt-12">
      <h2 className="font-hand text-2xl text-stock">Images</h2>
      <p className="mt-1 mb-5 text-xs text-stock/55">
        The first image is the cover unless you choose another. Order here is the
        order they appear on the entry.
      </p>

      <Dropzone entryId={entry.id} existingCount={images.length} onUploaded={refresh} />

      {images.length > 0 && (
        <ul className="mt-6 space-y-3">
          {images.map((img, i) => (
            <li
              key={img.id}
              className="flex items-start gap-4 rounded-sm border border-stock/10 p-3"
            >
              <img
                src={img.url_thumb}
                alt=""
                className="h-20 w-20 shrink-0 rounded-sm bg-well/40 object-cover"
              />

              <div className="min-w-0 flex-1">
                <label className="sr-only" htmlFor={`alt-${img.id}`}>
                  Alt text for image {i + 1}
                </label>
                <input
                  id={`alt-${img.id}`}
                  defaultValue={img.alt_text ?? ""}
                  placeholder="Describe this image"
                  onBlur={(e) => {
                    if (e.target.value.trim() !== (img.alt_text ?? "")) {
                      setAlt.mutate({ id: img.id, alt: e.target.value });
                    }
                  }}
                  className="w-full rounded-sm border border-stock/15 bg-surface px-2.5 py-1.5
                             text-sm text-stock placeholder:text-stock/55"
                />
                <p className="mt-1.5 text-xs text-stock/55">
                  Read aloud to anyone who cannot see the image. Worth writing.
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  {coverId === img.id ? (
                    <span className="text-accent-amber">Cover</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCover.mutate(img.id)}
                      className="text-stock/60 hover:text-stock/80"
                    >
                      Make cover
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this image?")) remove.mutate(img.id);
                    }}
                    className="text-accent-rust/60 hover:text-accent-rust"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Buttons rather than drag handles. Native HTML5 drag is
                  unusable with a keyboard or a screen reader, and reordering
                  is not optional decoration. */}
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  aria-label={`Move image ${i + 1} up`}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  className="rounded-sm border border-stock/15 px-2 py-0.5 text-stock/60
                             hover:border-stock/40 disabled:opacity-20"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move image ${i + 1} down`}
                  disabled={i === images.length - 1}
                  onClick={() => move(i, i + 1)}
                  className="rounded-sm border border-stock/15 px-2 py-0.5 text-stock/60
                             hover:border-stock/40 disabled:opacity-20"
                >
                  ↓
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
