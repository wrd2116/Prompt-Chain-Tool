import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createStep,
  deleteFlavor,
  deleteStep,
  moveStep,
  runPipelineTestUrl,
  runPipelineUpload,
  updateFlavor,
  updateStep,
} from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

function testUrls() {
  const raw = process.env.IMAGE_TEST_URLS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default async function FlavorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const idStr = params.id;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const supabase = await createClient();
  const { data: flavor } = await supabase
    .from("humor_flavors")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!flavor) notFound();

  const { data: steps } = await supabase
    .from("humor_flavor_steps")
    .select("*")
    .eq("humor_flavor_id", id)
    .order("order_by", { ascending: true });

  const { data: captions } = await supabase
    .from("captions")
    .select("id, content, created_datetime_utc, image_id")
    .eq("humor_flavor_id", id)
    .order("created_datetime_utc", { ascending: false })
    .limit(50);

  const urls = testUrls();
  const stepList = steps ?? [];

  return (
    <>
      <p className="muted">
        <Link href="/flavors">← All flavors</Link>
      </p>
      <h1>{flavor.slug}</h1>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Flavor</h2>
        <form action={updateFlavor}>
          <input type="hidden" name="id" value={id} />
          <label>
            Description
            <input
              name="description"
              type="text"
              required
              defaultValue={flavor.description ?? ""}
            />
          </label>
          <label>
            Slug
            <input
              name="slug"
              type="text"
              required
              defaultValue={flavor.slug ?? ""}
            />
          </label>
          <label className="row" style={{ alignItems: "center" }}>
            <input
              type="checkbox"
              name="is_pinned"
              defaultChecked={!!flavor.is_pinned}
            />{" "}
            Pinned
          </label>
          <button type="submit">Save</button>
        </form>
        <form action={deleteFlavor} style={{ marginTop: "1rem" }}>
          <input type="hidden" name="id" value={id} />
          <button type="submit">Delete flavor</button>
        </form>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Steps ({stepList.length})</h2>
        {stepList.map((s, i) => (
          <details
            key={s.id}
            className="panel"
            style={{ marginBottom: "0.5rem" }}
          >
            <summary>
              #{s.order_by} · step {i + 1}{" "}
              <span className="muted">(id {s.id})</span>
            </summary>
            <div className="row" style={{ marginBottom: "0.5rem" }}>
              <form action={moveStep}>
                <input type="hidden" name="flavor_id" value={id} />
                <input type="hidden" name="step_id" value={s.id} />
                <input type="hidden" name="delta" value="-1" />
                <button type="submit" disabled={i === 0}>
                  Up
                </button>
              </form>
              <form action={moveStep}>
                <input type="hidden" name="flavor_id" value={id} />
                <input type="hidden" name="step_id" value={s.id} />
                <input type="hidden" name="delta" value="1" />
                <button type="submit" disabled={i === stepList.length - 1}>
                  Down
                </button>
              </form>
              <form action={deleteStep}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="humor_flavor_id" value={id} />
                <button type="submit">Delete</button>
              </form>
            </div>
            <form action={updateStep}>
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="humor_flavor_id" value={id} />
              <label>
                order_by
                <input
                  name="order_by"
                  type="number"
                  required
                  defaultValue={s.order_by}
                />
              </label>
              <label>
                llm_temperature
                <input
                  name="llm_temperature"
                  type="number"
                  step="0.01"
                  required
                  defaultValue={s.llm_temperature ?? 0.7}
                />
              </label>
              <label>
                llm_input_type_id
                <input
                  name="llm_input_type_id"
                  type="number"
                  required
                  defaultValue={s.llm_input_type_id ?? 1}
                />
              </label>
              <label>
                llm_output_type_id
                <input
                  name="llm_output_type_id"
                  type="number"
                  required
                  defaultValue={s.llm_output_type_id ?? 1}
                />
              </label>
              <label>
                llm_model_id
                <input
                  name="llm_model_id"
                  type="number"
                  required
                  defaultValue={s.llm_model_id ?? 1}
                />
              </label>
              <label>
                humor_flavor_step_type_id
                <input
                  name="humor_flavor_step_type_id"
                  type="number"
                  required
                  defaultValue={s.humor_flavor_step_type_id ?? 1}
                />
              </label>
              <label>
                Step description (optional)
                <input
                  name="step_description"
                  type="text"
                  defaultValue={s.description ?? ""}
                />
              </label>
              <label>
                System prompt
                <textarea
                  name="llm_system_prompt"
                  required
                  defaultValue={s.llm_system_prompt ?? ""}
                />
              </label>
              <label>
                User prompt
                <textarea
                  name="llm_user_prompt"
                  required
                  defaultValue={s.llm_user_prompt ?? ""}
                />
              </label>
              <button type="submit">Save step</button>
            </form>
          </details>
        ))}

        <h3>New step</h3>
        <form action={createStep}>
          <input type="hidden" name="humor_flavor_id" value={id} />
          <label>
            llm_temperature
            <input name="llm_temperature" type="number" step="0.01" defaultValue={0.7} />
          </label>
          <label>
            llm_input_type_id
            <input name="llm_input_type_id" type="number" defaultValue={1} />
          </label>
          <label>
            llm_output_type_id
            <input name="llm_output_type_id" type="number" defaultValue={1} />
          </label>
          <label>
            llm_model_id
            <input name="llm_model_id" type="number" defaultValue={1} />
          </label>
          <label>
            humor_flavor_step_type_id
            <input
              name="humor_flavor_step_type_id"
              type="number"
              defaultValue={1}
            />
          </label>
          <label>
            Step description (optional)
            <input name="step_description" type="text" />
          </label>
          <label>
            System prompt
            <textarea name="llm_system_prompt" required />
          </label>
          <label>
            User prompt
            <textarea name="llm_user_prompt" required />
          </label>
          <button type="submit">Add step</button>
        </form>
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Test pipeline</h2>
        <p className="muted">
          Uses your Supabase JWT against{" "}
          <code>{process.env.NEXT_PUBLIC_PIPELINE_API_URL ?? "api.almostcrackd.ai"}</code>.
          Saves rows to <code>captions</code> with this{" "}
          <code>humor_flavor_id</code>.
        </p>
        <form action={runPipelineUpload}>
          <input type="hidden" name="humor_flavor_id" value={id} />
          <label>
            Image file
            <input name="file" type="file" accept="image/*" required />
          </label>
          <button type="submit">Upload &amp; generate</button>
        </form>
        {urls.length > 0 && (
          <>
            <h3>Preset URLs</h3>
            <ul style={{ paddingLeft: "1.2rem" }}>
              {urls.map((u) => (
                <li key={u} style={{ marginBottom: "0.35rem" }}>
                  <form action={runPipelineTestUrl} className="row">
                    <input type="hidden" name="humor_flavor_id" value={id} />
                    <input type="hidden" name="url" value={u} />
                    <button type="submit">Run</button>
                    <span className="muted" style={{ wordBreak: "break-all" }}>
                      {u}
                    </span>
                  </form>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Captions (latest 50)</h2>
        {!captions?.length ? (
          <p className="muted">None for this flavor yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Image</th>
                <th>Content</th>
              </tr>
            </thead>
            <tbody>
              {captions.map((c) => (
                <tr key={c.id}>
                  <td className="muted">
                    {c.created_datetime_utc
                      ? new Date(c.created_datetime_utc).toLocaleString()
                      : "—"}
                  </td>
                  <td className="muted">{c.image_id?.slice(0, 8) ?? "—"}…</td>
                  <td>{c.content}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
