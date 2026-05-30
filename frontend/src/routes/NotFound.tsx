import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    // Centred in the viewport rather than pinned to the top. A dozen words of
    // text with a screen of empty space under it reads as a broken page.
    // 60dvh accounts for the header already above us in the layout.
    <section className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
      <h1 className="font-hand text-4xl text-stock">Nothing here</h1>
      <p className="mt-3 text-stock/60">That page does not exist.</p>
      <div className="mt-8 flex items-center gap-5 text-sm">
        <Link
          to="/gallery"
          className="rounded-full bg-stock px-5 py-2.5 text-canvas transition-transform
                     duration-200 hover:-translate-y-0.5 motion-reduce:transform-none"
        >
          See the wall
        </Link>
        <Link to="/" className="text-stock/55 underline underline-offset-4 hover:text-stock/85">
          Back to the start
        </Link>
      </div>
    </section>
  );
}
