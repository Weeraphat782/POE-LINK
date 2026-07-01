"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import { createClient as createServerSupabase, getUser } from "@/lib/supabase-server";
import { unlockCookieName } from "@/lib/unlock-cookie";

// Also returns true for folders that aren't locked at all, so unlocked tabs
// stay editable with zero friction.
async function requireCurrentPassword(id: string, formData: FormData) {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const { data: ok } = await supabase.rpc("unlock_folder", {
    p_folder_id: id,
    p_password: currentPassword,
  });
  if (!ok) redirect("/?error=wrong-password");
}

export async function createFolder(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  if (!name) return;

  const user = await getUser();

  const { data: folder } = await supabase
    .from("folders")
    .insert({ name, created_by: user?.id ?? null })
    .select("id")
    .single();

  if (folder && password) {
    await supabase.rpc("set_folder_password", {
      p_folder_id: folder.id,
      p_password: password,
    });
  }
  revalidatePath("/");
}

export async function updateFolder(formData: FormData) {
  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  if (!name) return;
  await requireCurrentPassword(id, formData);

  await supabase.from("folders").update({ name }).eq("id", id);
  // Blank password field means "leave it as is" — use removeFolderPassword to clear one.
  if (password) {
    await supabase.rpc("set_folder_password", { p_folder_id: id, p_password: password });
  }
  revalidatePath("/");
  revalidatePath(`/folder/${id}`);
}

export async function removeFolderPassword(formData: FormData) {
  const id = String(formData.get("id"));
  await requireCurrentPassword(id, formData);

  await supabase.rpc("set_folder_password", { p_folder_id: id, p_password: "" });
  revalidatePath("/");
  revalidatePath(`/folder/${id}`);
}

export async function deleteFolder(formData: FormData) {
  const id = String(formData.get("id"));
  await requireCurrentPassword(id, formData);

  await supabase.from("folders").delete().eq("id", id);
  revalidatePath("/");
}

export async function unlockFolder(formData: FormData) {
  const folderId = String(formData.get("folderId"));
  const password = String(formData.get("password") ?? "");

  const { data: ok } = await supabase.rpc("unlock_folder", {
    p_folder_id: folderId,
    p_password: password,
  });

  if (!ok) redirect(`/folder/${folderId}?error=wrong-password`);

  const cookieStore = await cookies();
  cookieStore.set(unlockCookieName(folderId), password, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(`/folder/${folderId}`);
}

export async function createLink(formData: FormData) {
  const folderId = String(formData.get("folderId"));
  const title = String(formData.get("title") ?? "").trim();
  let url = String(formData.get("url") ?? "").trim();
  if (!title || !url) return;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const note = String(formData.get("note") ?? "").trim() || null;
  await supabase.from("links").insert({ folder_id: folderId, title, url, note });
  revalidatePath(`/folder/${folderId}`);
}

export async function deleteLink(formData: FormData) {
  const id = String(formData.get("id"));
  const folderId = String(formData.get("folderId"));
  await supabase.from("links").delete().eq("id", id);
  revalidatePath(`/folder/${folderId}`);
}

export async function toggleFavorite(formData: FormData) {
  const folderId = String(formData.get("folderId"));
  // The page already knows whether this folder is favorited when it renders
  // the star button, so trust that instead of re-querying it here — cuts
  // this action from 3 round trips (select, then insert/delete) to 1.
  const wasFavorite = formData.get("wasFavorite") === "1";
  const user = await getUser();
  if (!user) redirect("/login");

  const supabaseAuthed = await createServerSupabase();
  if (wasFavorite) {
    await supabaseAuthed
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("folder_id", folderId);
  } else {
    await supabaseAuthed
      .from("favorites")
      .upsert({ user_id: user.id, folder_id: folderId }, { onConflict: "user_id,folder_id" });
  }
  revalidatePath("/");
  revalidatePath("/account");
  revalidatePath(`/folder/${folderId}`);
}
