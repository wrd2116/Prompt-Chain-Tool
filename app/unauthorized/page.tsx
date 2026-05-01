import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main style={{ maxWidth: 520, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Access denied</h1>
      <p className="muted">
        This tool requires <code>profiles.is_superadmin</code> or{" "}
        <code>profiles.is_matrix_admin</code>.
      </p>
      <p>
        <Link href="/login">Back to sign in</Link>
      </p>
    </main>
  );
}
