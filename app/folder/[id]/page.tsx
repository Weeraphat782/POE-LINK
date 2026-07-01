import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createClient as createServerSupabase, getUser } from "@/lib/supabase-server";
import { createLink, deleteLink, unlockFolder, toggleFavorite } from "@/lib/actions";
import { unlockCookieName } from "@/lib/unlock-cookie";
import type { Link as PoeLink } from "@/lib/types";

export default async function FolderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error: unlockError } = await searchParams;

  const [{ data: folder }, user] = await Promise.all([
    supabase.from("folders").select("id,name,is_locked,profiles(email)").eq("id", id).single(),
    getUser(),
  ]);

  if (!folder) notFound();

  let isFavorite = false;
  if (user) {
    const authedSupabase = await createServerSupabase();
    const { data: favorite } = await authedSupabase
      .from("favorites")
      .select("folder_id")
      .eq("user_id", user.id)
      .eq("folder_id", id)
      .maybeSingle();
    isFavorite = !!favorite;
  }

  let links: PoeLink[] = [];
  let unlocked = true;

  if (folder.is_locked) {
    const cookieStore = await cookies();
    const savedPassword = cookieStore.get(unlockCookieName(id))?.value;
    unlocked = false;
    if (savedPassword) {
      // get_folder_links() already re-checks the password internally, so try
      // it first and only make the extra unlock_folder round trip if the
      // result is ambiguous (empty could mean "wrong password" or "correct
      // password, empty folder").
      const { data } = await supabase.rpc("get_folder_links", {
        p_folder_id: id,
        p_password: savedPassword,
      });
      const rows = (data as PoeLink[] | null) ?? [];
      if (rows.length > 0) {
        unlocked = true;
        links = rows;
      } else {
        const { data: ok } = await supabase.rpc("unlock_folder", {
          p_folder_id: id,
          p_password: savedPassword,
        });
        unlocked = !!ok;
      }
    }
  } else {
    const { data } = await supabase
      .from("links")
      .select("id,folder_id,title,url,note,created_at")
      .eq("folder_id", id)
      .order("created_at", { ascending: true });
    links = (data as PoeLink[] | null) ?? [];
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-xs uppercase tracking-wide text-muted hover:text-gold-bright">
          ← All tabs
        </Link>
        <form action={toggleFavorite}>
          <input type="hidden" name="folderId" value={id} />
          <input type="hidden" name="wasFavorite" value={isFavorite ? "1" : ""} />
          <button
            type="submit"
            aria-label={isFavorite ? "Unstar tab" : "Star tab"}
            className={isFavorite ? "text-gold-bright" : "text-muted hover:text-gold-bright"}
          >
            {isFavorite ? "★" : "☆"}
          </button>
        </form>
      </div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        {folder.is_locked && <span className="mr-1 text-muted">🔒</span>}
        {folder.name}
      </h1>
      {(folder.profiles as unknown as { email: string } | null)?.email && (
        <p className="mt-1 text-xs text-muted">
          Created by {(folder.profiles as unknown as { email: string }).email.split("@")[0]}
        </p>
      )}

      {folder.is_locked && !unlocked ? (
        <form
          action={unlockFolder}
          className="mt-8 flex flex-col gap-3 rounded border border-panel-border bg-panel p-4"
        >
          <input type="hidden" name="folderId" value={id} />
          <label className="text-xs uppercase tracking-wide text-muted">
            This tab is locked — enter its password
          </label>
          <input
            type="password"
            name="password"
            required
            autoFocus
            className="border-b border-panel-border bg-transparent pb-1 text-sm text-foreground focus:border-gold focus:outline-none"
          />
          {unlockError && (
            <p className="text-xs text-red-400">Wrong password.</p>
          )}
          <button
            type="submit"
            className="self-start text-xs uppercase tracking-wide text-gold hover:text-gold-bright"
          >
            Unlock
          </button>
        </form>
      ) : (
        <>
          <ul className="mt-8 flex flex-col gap-2">
            {links.map((link) => (
              <li
                key={link.id}
                className="flex items-center justify-between gap-3 rounded border border-panel-border bg-panel px-4 py-3"
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1"
                >
                  <span className="block truncate font-medium text-gold-bright hover:underline">
                    {link.title}
                  </span>
                  {link.note && (
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {link.note}
                    </span>
                  )}
                </a>
                <form action={deleteLink}>
                  <input type="hidden" name="id" value={link.id} />
                  <input type="hidden" name="folderId" value={id} />
                  <button
                    type="submit"
                    aria-label={`Delete ${link.title}`}
                    className="text-xs text-muted hover:text-red-400"
                  >
                    ✕
                  </button>
                </form>
              </li>
            ))}
            {links.length === 0 && (
              <li className="rounded border border-dashed border-panel-border px-4 py-6 text-center text-sm text-muted">
                No links yet. Drop the first one below.
              </li>
            )}
          </ul>

          <form
            action={createLink}
            className="mt-8 flex flex-col gap-3 rounded border border-panel-border bg-panel p-4"
          >
            <input type="hidden" name="folderId" value={id} />
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-muted">
                Title
              </label>
              <input
                type="text"
                name="title"
                required
                placeholder="e.g. Best rolling armour bases"
                className="border-b border-panel-border bg-transparent pb-1 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-muted">
                URL
              </label>
              <input
                type="text"
                name="url"
                required
                placeholder="poe2db.tw/..."
                className="border-b border-panel-border bg-transparent pb-1 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-muted">
                Note (optional)
              </label>
              <input
                type="text"
                name="note"
                placeholder="why this link is worth clicking"
                className="border-b border-panel-border bg-transparent pb-1 text-sm text-foreground placeholder:text-muted focus:border-gold focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="self-start text-xs uppercase tracking-wide text-gold hover:text-gold-bright"
            >
              + Add link
            </button>
          </form>
        </>
      )}
    </div>
  );
}
