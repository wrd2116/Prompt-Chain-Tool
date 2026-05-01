import Link from "next/link";
import { redirect } from "next/navigation";
import { signInWithGoogle } from "@/app/actions";
import { isAdminRow } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_superadmin, is_matrix_admin")
      .eq("id", user.id)
      .maybeSingle();
    if (isAdminRow(profile)) redirect("/flavors");
    redirect("/unauthorized");
  }

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Sign in</h1>
      <p className="muted">
        Superadmin or matrix admin only.{" "}
        <Link href="/">Home</Link>
      </p>
      <form action={signInWithGoogle} className="panel">
        <button type="submit">Continue with Google</button>
      </form>
    </main>
  );
}
