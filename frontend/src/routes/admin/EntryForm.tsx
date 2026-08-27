import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import ImageManager from "../../components/admin/ImageManager";
import { api } from "../../api/client";
import type { EntryDetail } from "../../api/types";

const field =
  "w-full rounded-sm border border-stock/20 bg-surface px-3 py-2.5 text-stock " +
  "placeholder:text-stock/55";
const label = "block text-xs tracking-wide text-stock/60 uppercase";

function today(): string {
  // Local date, not toISOString() -- that converts to UTC and can hand back
  // yesterday for anyone east of Greenwich.
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Fetches when editing, then hands off. The inner form is remounted via key
 *  whenever the entry changes, so its state initialises from the entry instead
 *  of being pushed in by an effect -- that pattern costs an extra render and
 *  leaves a window where the form shows the previous entry's values. */
export default function EntryForm() {
  const { slug } = useParams<{ slug: string }>();
  const isEdit = Boolean(slug);

  const existing = useQuery({
    queryKey: ["entry", slug],
    queryFn: () => api.getEntry(slug!),
    enabled: isEdit,
    retry: false,
  });

  if (isEdit && existing.isPending) {
    return <p className="py-24 text-center text-stock/55">Loading…</p>;
  }
  if (isEdit && existing.isError) {
    return (
      <section className="py-24 text-center">
        <p className="text-stock/60">No entry with that address.</p>
        <Link to="/admin" className="mt-4 inline-block text-sm underline underline-offset-4">
          Back to the studio
        </Link>
      </section>
    );
  }

  return <Form key={existing.data?.id ?? "new"} entry={existing.data ?? null} />;
}

function Form({ entry }: { entry: EntryDetail | null }) {
  const isEdit = entry !== null;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [title, setTitle] = useState(entry?.title ?? "");
  const [artDate, setArtDate] = useState(entry?.art_date ?? today());
  const [description, setDescription] = useState(entry?.description ?? "");
  const [tags, setTags] = useState(entry?.tags.map((t) => t.name).join(", ") ?? "");
  const [slugField, setSlugField] = useState(entry?.slug ?? "");

  const body = () => ({
    title: title.trim(),
    art_date: artDate,
    description: description.trim() || null,
    tags: tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (entry) {
        return api.updateEntry(entry.id, {
          ...body(),
          ...(slugField !== entry.slug ? { slug: slugField } : {}),
        });
      }
      return api.createEntry(body());
    },
    onSuccess: (entry) => {
      qc.invalidateQueries();
      // New entries go straight to their own edit page, which is where the
      // uploader lives -- an entry with no images is not finished.
      navigate(`/admin/e/${entry.slug}`, { replace: true });
    },
  });

  const remove = useMutation({
    mutationFn: () => api.deleteEntry(entry!.id),
    onSuccess: () => {
      qc.invalidateQueries();
      navigate("/admin", { replace: true });
    },
  });

  return (
    <section className="mx-auto max-w-xl">
      <h1 className="font-hand text-4xl text-stock">
        {isEdit ? "Edit entry" : "New entry"}
      </h1>

      <form
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div>
          <label htmlFor="title" className={label}>
            Title
          </label>
          <input
            id="title"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`${field} mt-1.5`}
            placeholder="What is it called?"
          />
        </div>

        <div>
          <label htmlFor="art_date" className={label}>
            When you made it
          </label>
          <input
            id="art_date"
            type="date"
            required
            value={artDate}
            onChange={(e) => setArtDate(e.target.value)}
            className={`${field} mt-1.5`}
          />
          <p className="mt-1.5 text-xs text-stock/55">
            This is what the gallery sorts by, not the day you upload it.
          </p>
        </div>

        <div>
          <label htmlFor="description" className={label}>
            Notes <span className="normal-case">(optional)</span>
          </label>
          <textarea
            id="description"
            rows={4}
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${field} mt-1.5 resize-y`}
          />
        </div>

        <div>
          <label htmlFor="tags" className={label}>
            Tags <span className="normal-case">(optional)</span>
          </label>
          <input
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className={`${field} mt-1.5`}
            placeholder="collage, paper, studies"
          />
          <p className="mt-1.5 text-xs text-stock/55">
            Separated by commas. New ones are created as you type them; tags left
            with no entries are removed on their own.
          </p>
        </div>

        {isEdit && (
          <details className="rounded-sm border border-stock/10 px-3 py-2">
            <summary className="cursor-pointer text-xs text-stock/55">Address</summary>
            <input
              value={slugField}
              onChange={(e) => setSlugField(e.target.value)}
              className={`${field} mt-3`}
            />
            <p className="mt-1.5 text-xs text-stock/55">
              Renaming the entry does not change this, so old links keep working.
              Change it only if you need to.
            </p>
          </details>
        )}

        {save.isError && (
          <p role="alert" className="text-sm text-accent-rust">
            {(save.error as Error).message}
          </p>
        )}

        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={save.isPending || title.trim().length === 0}
            className="rounded-full bg-stock px-6 py-2.5 text-sm font-medium text-canvas
                       disabled:opacity-40"
          >
            {save.isPending ? "Saving…" : isEdit ? "Save" : "Create"}
          </button>
          <Link to="/admin" className="text-sm text-stock/60 hover:text-stock/80">
            Cancel
          </Link>

          {isEdit && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Delete this entry and all its images? This cannot be undone."))
                  remove.mutate();
              }}
              className="ml-auto text-sm text-accent-rust/70 hover:text-accent-rust"
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </button>
          )}
        </div>
      </form>

      {/* Only on an entry that exists -- there is nothing to attach images to
          until it has been created. */}
      {entry && <ImageManager entry={entry} />}
    </section>
  );
}
