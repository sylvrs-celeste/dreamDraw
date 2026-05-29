import { useParams } from "react-router-dom";

export default function EntryDetail() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <section>
      <h1 className="font-hand text-3xl">{slug}</h1>
      <p className="text-stock/60">Images and lightbox arrive in step 8.</p>
    </section>
  );
}
