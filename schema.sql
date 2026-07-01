-- Run this in the Supabase SQL editor. Safe to re-run (idempotent).

create extension if not exists pgcrypto;

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_locked boolean not null default false,
  created_at timestamptz not null default now()
);
-- create table if not exists is a no-op on an existing table, so add the
-- column explicitly for projects that ran the original (pre-auth) schema.
alter table folders add column if not exists is_locked boolean not null default false;

create table if not exists links (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references folders(id) on delete cascade,
  title text not null,
  url text not null,
  note text,
  created_at timestamptz not null default now()
);

-- Password hash lives in its own table with no anon access at all, so it can
-- never be read directly (only checked via the SECURITY DEFINER functions
-- below). folders.is_locked is just a public "this one has a password" flag.
create table if not exists folder_locks (
  folder_id uuid primary key references folders(id) on delete cascade,
  password_hash text not null
);

create table if not exists favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid not null references folders(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, folder_id)
);

-- auth.users isn't exposed over the API, so mirror the bit we need to show
-- ("created by ...") into a public table kept in sync by a trigger.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null
);
insert into profiles (id, email)
  select id, email from auth.users
  on conflict (id) do nothing;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function handle_new_user();

alter table folders add column if not exists created_by uuid references profiles(id) on delete set null;

-- No login for browsing/editing tabs and links: anyone with the anon key can
-- read/write. Fine for a guild-internal tool, not for a public listing.
alter table folders enable row level security;
alter table links enable row level security;
alter table folder_locks enable row level security;
alter table favorites enable row level security;
alter table profiles enable row level security;

drop policy if exists "folders_all" on folders;
create policy "folders_all" on folders for all using (true) with check (true);

drop policy if exists "profiles_select_all" on profiles;
create policy "profiles_select_all" on profiles for select using (true);

-- Links: open for unlocked folders. Locked folders can only be read through
-- the get_folder_links() function below (which checks the password first).
drop policy if exists "links_all" on links;
drop policy if exists "links_select_unlocked" on links;
drop policy if exists "links_write" on links;
drop policy if exists "links_update" on links;
drop policy if exists "links_delete" on links;
-- Checks folders.is_locked (openly readable) rather than folder_locks: a
-- subquery against folder_locks would run as `anon` too, which has zero
-- policies on it, so "not exists(...)" would be vacuously true and leak
-- every locked folder's links.
create policy "links_select_unlocked" on links for select
  using (not exists (select 1 from folders where folders.id = links.folder_id and folders.is_locked));
create policy "links_write" on links for insert with check (true);
create policy "links_update" on links for update using (true) with check (true);
create policy "links_delete" on links for delete using (true);

-- folder_locks: zero anon policies on purpose — no direct select/insert/update/delete.
-- All access goes through the functions below.

drop policy if exists "favorites_select_own" on favorites;
drop policy if exists "favorites_insert_own" on favorites;
drop policy if exists "favorites_delete_own" on favorites;
create policy "favorites_select_own" on favorites for select using (auth.uid() = user_id);
create policy "favorites_insert_own" on favorites for insert with check (auth.uid() = user_id);
create policy "favorites_delete_own" on favorites for delete using (auth.uid() = user_id);

-- Set or clear a folder's password. Passing an empty/null password removes the lock.
create or replace function set_folder_password(p_folder_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_password is null or length(trim(p_password)) = 0 then
    delete from folder_locks where folder_id = p_folder_id;
    update folders set is_locked = false where id = p_folder_id;
  else
    insert into folder_locks (folder_id, password_hash)
    values (p_folder_id, crypt(p_password, gen_salt('bf')))
    on conflict (folder_id) do update set password_hash = excluded.password_hash;
    update folders set is_locked = true where id = p_folder_id;
  end if;
end;
$$;
grant execute on function set_folder_password(uuid, text) to anon;

-- Returns true if the password matches (or the folder isn't locked at all).
create or replace function unlock_folder(p_folder_id uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select password_hash into v_hash from folder_locks where folder_id = p_folder_id;
  if v_hash is null then
    return true;
  end if;
  return v_hash = crypt(coalesce(p_password, ''), v_hash);
end;
$$;
grant execute on function unlock_folder(uuid, text) to anon;

-- Reads a locked folder's links after re-checking the password server-side.
create or replace function get_folder_links(p_folder_id uuid, p_password text)
returns setof links
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not unlock_folder(p_folder_id, p_password) then
    return;
  end if;
  return query select * from links where folder_id = p_folder_id order by created_at asc;
end;
$$;
grant execute on function get_folder_links(uuid, text) to anon;
