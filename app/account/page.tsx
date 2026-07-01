import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { signOut } from "@/lib/auth-actions";

export default async function AccountPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: favorites } = await supabase
    .from("favorites")
    .select("folder_id, folders(id,name,is_locked,links(count))")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Your account
          </h1>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="text-xs uppercase tracking-wide text-muted hover:text-red-400"
          >
            Sign out
          </button>
        </form>
      </div>

      <h2 className="mt-8 text-sm uppercase tracking-wide text-muted">
        Starred tabs
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {favorites?.map((favorite) => {
          const folder = favorite.folders as unknown as {
            id: string;
            name: string;
            is_locked: boolean;
            links: { count: number }[];
          } | null;
          if (!folder) return null;
          const count = folder.links?.[0]?.count ?? 0;
          return (
            <li key={folder.id}>
              <Link
                href={`/folder/${folder.id}`}
                className="flex items-center justify-between rounded border border-panel-border bg-panel px-4 py-3 hover:border-gold"
              >
                <span className="text-foreground">
                  {folder.is_locked && <span className="mr-1 text-muted">🔒</span>}
                  {folder.name}
                </span>
                <span className="text-xs text-muted">
                  {count} link{count === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          );
        })}
        {favorites?.length === 0 && (
          <li className="rounded border border-dashed border-panel-border px-4 py-6 text-center text-sm text-muted">
            No starred tabs yet — star one from the tab list.
          </li>
        )}
      </ul>
    </div>
  );
}
