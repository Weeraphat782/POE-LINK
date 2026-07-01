import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import {
  createFolder,
  updateFolder,
  removeFolderPassword,
  deleteFolder,
  toggleFavorite,
} from "@/lib/actions";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: actionError } = await searchParams;

  const { data: folders, error } = await supabase
    .from("folders")
    .select("id,name,is_locked,created_at,links(count),profiles(email)")
    .order("created_at", { ascending: true });

  const authedSupabase = await createServerSupabase();
  const {
    data: { user },
  } = await authedSupabase.auth.getUser();

  let favoriteIds = new Set<string>();
  if (user) {
    const { data: favorites } = await authedSupabase
      .from("favorites")
      .select("folder_id")
      .eq("user_id", user.id);
    favoriteIds = new Set(favorites?.map((f) => f.folder_id));
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Tabs
      </h1>
      <p className="mt-1 text-sm text-muted">
        One tab per category — armour, weapons, waystones, whatever the guild needs.
        Open a tab to see the links dropped in it. Give a tab a password to keep it
        personal, and star tabs to find them fast in your account.
      </p>

      {error && (
        <p className="mt-6 rounded border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          Could not load tabs: {error.message}. Have you run schema.sql and set
          the Supabase env vars?
        </p>
      )}
      {actionError === "wrong-password" && (
        <p className="mt-6 rounded border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          Wrong current password — that tab is locked.
        </p>
      )}

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {folders?.map((folder) => {
          const count = (folder.links as { count: number }[])?.[0]?.count ?? 0;
          const isFavorite = favoriteIds.has(folder.id);
          // folders.created_by -> profiles.id is many-to-one, so PostgREST
          // embeds it as a single object, not an array.
          const creatorEmail = (folder.profiles as unknown as { email: string } | null)?.email;
          return (
            <div
              key={folder.id}
              className="group relative rounded border border-panel-border bg-panel p-4 transition-colors hover:border-gold"
            >
              <div className="absolute right-2 top-2 flex items-center gap-2">
                <form action={toggleFavorite}>
                  <input type="hidden" name="folderId" value={folder.id} />
                  <button
                    type="submit"
                    aria-label={isFavorite ? "Unstar tab" : "Star tab"}
                    className={
                      isFavorite
                        ? "text-xs text-gold-bright"
                        : "text-xs text-muted opacity-0 transition-opacity hover:text-gold-bright group-hover:opacity-100"
                    }
                  >
                    {isFavorite ? "★" : "☆"}
                  </button>
                </form>
                <details className="relative">
                  <summary
                    aria-label={`Edit tab ${folder.name}`}
                    className="cursor-pointer list-none text-xs text-muted opacity-0 transition-opacity hover:text-gold-bright group-hover:opacity-100 [&::-webkit-details-marker]:hidden"
                  >
                    ✎
                  </summary>
                  <form
                    action={updateFolder}
                    className="absolute right-0 top-5 z-10 flex w-48 flex-col gap-2 rounded border border-panel-border bg-panel p-2 shadow-lg"
                  >
                    <input type="hidden" name="id" value={folder.id} />
                    {folder.is_locked && (
                      <input
                        type="password"
                        name="currentPassword"
                        placeholder="Current password"
                        required
                        autoFocus
                        className="w-full border-b border-panel-border bg-transparent pb-1 text-xs text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
                      />
                    )}
                    <input
                      type="text"
                      name="name"
                      defaultValue={folder.name}
                      required
                      className="w-full border-b border-panel-border bg-transparent pb-1 text-sm text-foreground focus:border-gold focus:outline-none"
                    />
                    <input
                      type="password"
                      name="password"
                      placeholder={folder.is_locked ? "New password…" : "Set a password (optional)"}
                      className="w-full border-b border-panel-border bg-transparent pb-1 text-xs text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
                    />
                    <div className="mt-1 flex items-center justify-between">
                      <button
                        type="submit"
                        className="text-xs uppercase tracking-wide text-gold hover:text-gold-bright"
                      >
                        Save
                      </button>
                      {folder.is_locked && (
                        <button
                          type="submit"
                          formAction={removeFolderPassword}
                          className="text-[10px] uppercase tracking-wide text-muted hover:text-foreground"
                        >
                          Remove pw
                        </button>
                      )}
                      <button
                        type="submit"
                        formAction={deleteFolder}
                        className="text-xs uppercase tracking-wide text-muted hover:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </form>
                </details>
              </div>
              <Link href={`/folder/${folder.id}`} className="block">
                <span className="block truncate pr-4 font-medium text-foreground">
                  {folder.is_locked && <span className="mr-1 text-muted">🔒</span>}
                  {folder.name}
                </span>
                <span className="mt-1 block text-xs text-muted">
                  {count} link{count === 1 ? "" : "s"}
                  {creatorEmail && <> · by {creatorEmail.split("@")[0]}</>}
                </span>
              </Link>
            </div>
          );
        })}

        <form
          action={createFolder}
          className="flex flex-col justify-between gap-2 rounded border border-dashed border-panel-border p-4"
        >
          <input
            type="text"
            name="name"
            placeholder="New tab name…"
            required
            className="w-full border-b border-panel-border bg-transparent pb-1 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
          />
          <input
            type="password"
            name="password"
            placeholder="Password (optional)"
            className="w-full border-b border-panel-border bg-transparent pb-1 text-xs text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
          />
          <button
            type="submit"
            className="self-start text-xs uppercase tracking-wide text-gold hover:text-gold-bright"
          >
            + Add tab
          </button>
        </form>
      </div>
    </div>
  );
}
