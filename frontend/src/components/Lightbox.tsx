import { useCallback, useEffect, useRef, useState } from "react";

import type { Image } from "../api/types";

interface Props {
  images: Image[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

/** Minimum horizontal travel before a drag counts as a swipe. Below this it
 *  is almost always a tap or a scroll that wandered. */
const SWIPE_THRESHOLD = 50;

export default function Lightbox({ images, index, onClose, onIndexChange }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const image = images[index];
  const go = useCallback(
    (delta: number) => {
      const next = (index + delta + images.length) % images.length;
      onIndexChange(next);
      setAnnouncement(`Image ${next + 1} of ${images.length}`);
    },
    [index, images.length, onIndexChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Tab") {
        // Only one focusable thing in here, so keep Tab from wandering out
        // into the page behind the overlay.
        e.preventDefault();
        dialog.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  useEffect(() => {
    // Freeze the page behind, then hand focus to the dialog so screen readers
    // and the keyboard both land inside it.
    const previous = document.body.style.overflow;
    const restoreFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      restoreFocus?.focus();
    };
  }, []);

  if (!image) return null;

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={image.alt_text || "Image viewer"}
      tabIndex={-1}
      onClick={onClose}
      onTouchStart={(e) => {
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        if (!start) return;
        const dx = e.changedTouches[0].clientX - start.x;
        const dy = e.changedTouches[0].clientY - start.y;
        // Ignore mostly-vertical drags so a scroll gesture does not page.
        if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
          go(dx < 0 ? 1 : -1);
        }
        touchStart.current = null;
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-well/95 p-4 sm:p-10"
    >
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-5 text-2xl text-stock/60 hover:text-stock"
      >
        ×
      </button>

      {images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            className="absolute left-2 z-10 px-4 py-8 text-3xl text-stock/55 hover:text-stock sm:left-6"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next image"
            onClick={(e) => { e.stopPropagation(); go(1); }}
            className="absolute right-2 z-10 px-4 py-8 text-3xl text-stock/55 hover:text-stock sm:right-6"
          >
            ›
          </button>
        </>
      )}

      {/* The polaroid straightens and scales up here: no rotation, and the
          frame is thinner than on the wall so the image itself dominates. */}
      <figure
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-5xl bg-stock p-2.5 pb-0 shadow-polaroid-lift"
      >
        <img
          src={image.url_medium}
          alt={image.alt_text ?? ""}
          width={image.width}
          height={image.height}
          className="max-h-[75dvh] w-auto object-contain"
        />
        <figcaption className="flex items-baseline justify-between gap-4 px-1 py-3 text-ink">
          <span className="font-hand text-base">{image.alt_text || " "}</span>
          {images.length > 1 && (
            <span className="shrink-0 text-[0.65rem] tracking-wide text-ink/65 uppercase">
              {index + 1} / {images.length}
            </span>
          )}
        </figcaption>
      </figure>
    </div>
  );
}
