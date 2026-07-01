# The Stash

Guild link board for Path of Exile 2 — tabs (folders) hold links (build guides,
"what to buy" pages) for each gear category. No login; anyone with the URL can
create tabs and drop links.

## Setup

1. Create a Supabase project.
2. Run [schema.sql](schema.sql) in the Supabase SQL editor.
3. Copy `.env.local.example` to `.env.local` and fill in your project URL and
   anon key (Project Settings → API).
4. `npm run dev`

## Notes

- Tables have open RLS policies (anon key can read/write everything). That's
  fine for a private guild link, not for a public listing — don't index it.
