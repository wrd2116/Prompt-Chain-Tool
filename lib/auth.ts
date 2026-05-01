import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export function isAdminRow(
  p: { is_superadmin?: unknown; is_matrix_admin?: unknown } | null
) {
  if (!p) return false;
  const t = (v: unknown) =>
    v === true || v === 1 || String(v).toLowerCase() === "true";
  return t(p.is_superadmin) || t(p.is_matrix_admin);
}

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin, is_matrix_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!isAdminRow(profile)) redirect("/unauthorized");
  return { supabase, user };
}
