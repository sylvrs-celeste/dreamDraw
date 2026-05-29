import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="text-center">
      <h1 className="font-hand text-4xl">Nothing here</h1>
      <p className="mt-2 text-stock/60">That page does not exist.</p>
      <Link to="/" className="mt-6 inline-block underline underline-offset-4">
        Back to the gallery
      </Link>
    </section>
  );
}
