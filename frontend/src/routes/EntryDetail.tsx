import { Link, useParams } from "react-router-dom";

export default function EntryDetail() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <section className="flex min-h-[60dvh] flex-col justify-center">
      <h1 className="font-hand text-4xl text-stock">{slug}</h1>
      <p className="mt-3 text-stock/50">
        The full entry, images and lightbox arrive in step 8.
      </p>
      <Link
        to="/gallery"
        className="mt-8 text-sm text-stock/55 underline underline-offset-4 hover:text-stock/85"
      >
        Back to the wall
      </Link>
    </section>
  );
}
