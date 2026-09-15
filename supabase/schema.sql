-- LoveKit connect backend (Phase 3 — APPLY ONLY to your own Supabase project).
-- Run in order in the Supabase SQL editor, then follow supabase/README.md.
-- Design: server stores public keys + CIPHERTEXT envelopes only. Plaintext
-- never touches these tables; RLS ties every row to an anonymous user.

-- 1. Directory: LoveKit ID -> public key. Public keys are PUBLIC by design
--    (anyone may look one up to start pairing); owners can only touch rows
--    whose owner matches their anonymous auth uid.
create table if not exists profiles (
  id text primary key check (id ~ '^[a-z]+-[a-z]+-[0-9]{2}$'),
  public_key jsonb not null,
  owner uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 2. Inbox: sealed envelopes addressed to an ID. Anyone authenticated may
--    deliver; only the owner reads/deletes. Clients delete on receipt, so
--    the server holds undelivered ciphertext and nothing else.
create table if not exists inbox (
  id bigint generated always as identity primary key,
  to_id text not null references profiles (id) on delete cascade,
  envelope jsonb not null check (octet_length(envelope::text) <= 12000),
  created_at timestamptz not null default now()
);
create index if not exists inbox_to_id_idx on inbox (to_id, id);

alter table profiles enable row level security;
alter table inbox enable row level security;

-- Directory is world-readable (public keys must be look-up-able for pairing).
create policy "profiles readable by anyone"
  on profiles for select using (true);

-- Claim an ID once; thereafter only the owner edits it.
create policy "claim id once"
  on profiles for insert with check (owner = auth.uid());

create policy "owners edit own profile"
  on profiles for update using (owner = auth.uid()) with check (owner = auth.uid());

-- Deliver to anyone, read/delete only your own inbox.
create policy "deliver to any inbox"
  on inbox for insert with check (auth.uid() is not null);

create policy "read own inbox"
  on inbox for select using (
    exists (select 1 from profiles p where p.id = inbox.to_id and p.owner = auth.uid())
  );

create policy "delete own inbox"
  on inbox for delete using (
    exists (select 1 from profiles p where p.id = inbox.to_id and p.owner = auth.uid())
  );
