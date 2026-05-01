"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  captionTexts,
  generateCaptions,
  generatePresignedUrl,
  putToPresignedUrl,
  registerImageUrl,
} from "@/lib/pipeline";
import { createClient } from "@/lib/supabase/server";

function appOrigin() {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (u) return u;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${appOrigin()}/auth/callback` },
  });
  if (error) throw new Error(error.message);
  if (data.url) redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createFlavor(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const description = String(formData.get("description") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  if (!description || !slug) throw new Error("Description and slug required");

  const { data, error } = await supabase
    .from("humor_flavors")
    .insert({
      description,
      slug,
      created_by_user_id: user.id,
      modified_by_user_id: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/flavors");
  redirect(`/flavors/${data.id}`);
}

export async function updateFlavor(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = Number(formData.get("id"));
  const description = String(formData.get("description") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim();
  const isPinned = formData.get("is_pinned") === "on";
  if (!description || !slug) throw new Error("Description and slug required");

  const { error } = await supabase
    .from("humor_flavors")
    .update({
      description,
      slug,
      is_pinned: isPinned,
      modified_by_user_id: user.id,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/flavors");
  revalidatePath(`/flavors/${id}`);
}

export async function deleteFlavor(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = Number(formData.get("id"));
  await supabase.from("captions").delete().eq("humor_flavor_id", id);
  await supabase.from("humor_flavor_steps").delete().eq("humor_flavor_id", id);
  const { error } = await supabase.from("humor_flavors").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/flavors");
  redirect("/flavors");
}

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function buildUniqueFlavorSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  requested: string
) {
  const base = normalizeSlug(requested) || "flavor-copy";
  let candidate = base;
  let i = 2;
  while (true) {
    const { data, error } = await supabase
      .from("humor_flavors")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return candidate;
    candidate = `${base}-${i}`;
    i += 1;
  }
}

export async function duplicateFlavor(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const sourceFlavorId = Number(formData.get("id"));
  const requestedSlug = String(formData.get("new_slug") ?? "").trim();

  const { data: sourceFlavor, error: flavorError } = await supabase
    .from("humor_flavors")
    .select("id, slug, description, is_pinned")
    .eq("id", sourceFlavorId)
    .maybeSingle();
  if (flavorError || !sourceFlavor) {
    throw new Error(flavorError?.message ?? "Flavor not found");
  }

  const uniqueSlug = await buildUniqueFlavorSlug(
    supabase,
    requestedSlug || `${sourceFlavor.slug}-copy`
  );

  const { data: createdFlavor, error: createFlavorError } = await supabase
    .from("humor_flavors")
    .insert({
      slug: uniqueSlug,
      description: sourceFlavor.description,
      is_pinned: false,
      created_by_user_id: user.id,
      modified_by_user_id: user.id,
    })
    .select("id")
    .single();
  if (createFlavorError || !createdFlavor) {
    throw new Error(createFlavorError?.message ?? "Could not duplicate flavor");
  }

  const { data: sourceSteps, error: stepsError } = await supabase
    .from("humor_flavor_steps")
    .select(
      "order_by, llm_temperature, llm_input_type_id, llm_output_type_id, llm_model_id, humor_flavor_step_type_id, llm_system_prompt, llm_user_prompt, description"
    )
    .eq("humor_flavor_id", sourceFlavorId)
    .order("order_by", { ascending: true });
  if (stepsError) throw new Error(stepsError.message);

  if ((sourceSteps ?? []).length > 0) {
    const rows = (sourceSteps ?? []).map((s) => ({
      humor_flavor_id: createdFlavor.id,
      order_by: s.order_by,
      llm_temperature: s.llm_temperature,
      llm_input_type_id: s.llm_input_type_id,
      llm_output_type_id: s.llm_output_type_id,
      llm_model_id: s.llm_model_id,
      humor_flavor_step_type_id: s.humor_flavor_step_type_id,
      llm_system_prompt: s.llm_system_prompt,
      llm_user_prompt: s.llm_user_prompt,
      description: s.description,
      created_by_user_id: user.id,
      modified_by_user_id: user.id,
    }));
    const { error: copyStepsError } = await supabase
      .from("humor_flavor_steps")
      .insert(rows);
    if (copyStepsError) throw new Error(copyStepsError.message);
  }

  revalidatePath("/flavors");
  revalidatePath(`/flavors/${sourceFlavorId}`);
  redirect(`/flavors/${createdFlavor.id}`);
}

export async function createStep(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const humorFlavorId = Number(formData.get("humor_flavor_id"));

  const { data: rows } = await supabase
    .from("humor_flavor_steps")
    .select("order_by")
    .eq("humor_flavor_id", humorFlavorId)
    .order("order_by", { ascending: false })
    .limit(1);

  const nextOrder = (rows?.[0]?.order_by ?? 0) + 1;

  const { error } = await supabase.from("humor_flavor_steps").insert({
    humor_flavor_id: humorFlavorId,
    order_by: nextOrder,
    llm_temperature: Number(formData.get("llm_temperature") ?? 0.7),
    llm_input_type_id: Number(formData.get("llm_input_type_id") ?? 1),
    llm_output_type_id: Number(formData.get("llm_output_type_id") ?? 1),
    llm_model_id: Number(formData.get("llm_model_id") ?? 1),
    humor_flavor_step_type_id: Number(
      formData.get("humor_flavor_step_type_id") ?? 1
    ),
    llm_system_prompt: String(formData.get("llm_system_prompt") ?? ""),
    llm_user_prompt: String(formData.get("llm_user_prompt") ?? ""),
    description: String(formData.get("step_description") ?? "") || null,
    created_by_user_id: user.id,
    modified_by_user_id: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/flavors/${humorFlavorId}`);
}

export async function updateStep(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = Number(formData.get("id"));
  const humorFlavorId = Number(formData.get("humor_flavor_id"));

  const { error } = await supabase
    .from("humor_flavor_steps")
    .update({
      order_by: Number(formData.get("order_by")),
      llm_temperature: Number(formData.get("llm_temperature")),
      llm_input_type_id: Number(formData.get("llm_input_type_id")),
      llm_output_type_id: Number(formData.get("llm_output_type_id")),
      llm_model_id: Number(formData.get("llm_model_id")),
      humor_flavor_step_type_id: Number(
        formData.get("humor_flavor_step_type_id")
      ),
      llm_system_prompt: String(formData.get("llm_system_prompt") ?? ""),
      llm_user_prompt: String(formData.get("llm_user_prompt") ?? ""),
      description: String(formData.get("step_description") ?? "") || null,
      modified_by_user_id: user.id,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/flavors/${humorFlavorId}`);
}

export async function deleteStep(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = Number(formData.get("id"));
  const humorFlavorId = Number(formData.get("humor_flavor_id"));
  const { error } = await supabase
    .from("humor_flavor_steps")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/flavors/${humorFlavorId}`);
}

export async function moveStep(formData: FormData) {
  const { supabase } = await requireAdmin();
  const flavorId = Number(formData.get("flavor_id"));
  const stepId = Number(formData.get("step_id"));
  const delta = Number(formData.get("delta")) as -1 | 1;

  const { data: steps } = await supabase
    .from("humor_flavor_steps")
    .select("id, order_by")
    .eq("humor_flavor_id", flavorId)
    .order("order_by", { ascending: true });

  if (!steps?.length) return;

  const idx = steps.findIndex((s) => s.id === stepId);
  const j = idx + delta;
  if (idx < 0 || j < 0 || j >= steps.length) return;

  const a = steps[idx];
  const b = steps[j];
  await supabase
    .from("humor_flavor_steps")
    .update({ order_by: b.order_by })
    .eq("id", a.id);
  await supabase
    .from("humor_flavor_steps")
    .update({ order_by: a.order_by })
    .eq("id", b.id);

  revalidatePath(`/flavors/${flavorId}`);
}

async function pipelineOnce(
  accessToken: string,
  buffer: ArrayBuffer,
  contentType: string,
  humorFlavorId: number
) {
  const { presignedUrl, cdnUrl } = await generatePresignedUrl(
    accessToken,
    contentType
  );
  await putToPresignedUrl(presignedUrl, buffer, contentType);
  const { imageId } = await registerImageUrl(accessToken, cdnUrl);
  const raw = await generateCaptions(accessToken, imageId, humorFlavorId);
  return { imageId, texts: captionTexts(raw) };
}

async function assertFlavorHasSteps(
  supabase: Awaited<ReturnType<typeof createClient>>,
  humorFlavorId: number
) {
  const { data, error } = await supabase
    .from("humor_flavor_steps")
    .select("id")
    .eq("humor_flavor_id", humorFlavorId)
    .limit(1);

  if (error) throw new Error(error.message);
  if (!data?.length) {
    throw new Error(
      "This humor flavor has no steps. Add at least one step before running the pipeline test."
    );
  }
}

export async function runPipelineUpload(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Missing session token");

  const humorFlavorId = Number(formData.get("humor_flavor_id"));
  await assertFlavorHasSteps(supabase, humorFlavorId);
  const file = formData.get("file") as File | null;
  if (!file?.size) throw new Error("Choose an image file");

  const buf = await file.arrayBuffer();
  const ct = file.type || "image/jpeg";

  const { imageId, texts } = await pipelineOnce(token, buf, ct, humorFlavorId);
  if (!texts.length)
    throw new Error("Pipeline returned no caption text (check API response)");

  for (const content of texts) {
    const { error } = await supabase.from("captions").insert({
      content,
      humor_flavor_id: humorFlavorId,
      image_id: imageId,
      profile_id: user.id,
      is_public: false,
      is_featured: false,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/flavors/${humorFlavorId}`);
}

export async function runPipelineTestUrl(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Missing session token");

  const humorFlavorId = Number(formData.get("humor_flavor_id"));
  await assertFlavorHasSteps(supabase, humorFlavorId);
  const url = String(formData.get("url") ?? "").trim();
  if (!url) throw new Error("Missing image URL");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch image failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  const ct = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";

  const { imageId, texts } = await pipelineOnce(token, buf, ct, humorFlavorId);
  if (!texts.length)
    throw new Error("Pipeline returned no caption text (check API response)");

  for (const content of texts) {
    const { error } = await supabase.from("captions").insert({
      content,
      humor_flavor_id: humorFlavorId,
      image_id: imageId,
      profile_id: user.id,
      is_public: false,
      is_featured: false,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/flavors/${humorFlavorId}`);
}
