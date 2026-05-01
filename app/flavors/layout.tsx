import Link from "next/link";
import { signOut } from "@/app/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireAdmin } from "@/lib/auth";

export default async function FlavorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <>
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "0.75rem 1rem",
        }}
      >
        <div
          className="row"
          style={{ justifyContent: "space-between", maxWidth: 960, margin: "0 auto" }}
        >
          <nav className="row">
            <Link href="/flavors">Humor flavors</Link>
          </nav>
          <div className="row">
            <ThemeToggle />
            <form action={signOut}>
              <button type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "1rem" }}>
        {children}
      </div>
    </>
  );
}
