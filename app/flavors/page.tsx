import Link from "next/link";
import { createFlavor } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

export default async function FlavorsPage() {
  const supabase = await createClient();
  const { data: flavors } = await supabase
    .from("humor_flavors")
    .select("id, slug, description, is_pinned")
    .order("id", { ascending: false });

  return (
    <>
      <h1>Humor flavors</h1>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>New flavor</h2>
        <form action={createFlavor}>
          <label>
            Description
            <input name="description" type="text" required />
          </label>
          <label>
            Slug
            <input name="slug" type="text" required placeholder="my-flavor" />
          </label>
          <button type="submit">Create</button>
        </form>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>All</h2>
        {!flavors?.length ? (
          <p className="muted">None yet.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {flavors.map((f) => (
              <li key={f.id} style={{ marginBottom: "0.35rem" }}>
                <Link href={`/flavors/${f.id}`}>
                  <strong>{f.slug}</strong>
                  {f.is_pinned ? " · pinned" : ""}
                </Link>
                <span className="muted"> — {f.description}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
