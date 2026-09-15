# LoveKit connect backend — setup (your 10-minute job)

The app code is ready; only the database needs a home. You (the human) do
this once — I can't create accounts for you.

## Steps

1. **Create a project** at supabase.com → New project → name `lovekit` →
   free tier is fine. Save the database password somewhere safe.
2. **Run the schema:** left sidebar → SQL Editor → New query → paste the
   entire `supabase/schema.sql` from this repo → Run. Expect "Success, no
   rows returned" (twice — tables, then policies).
3. **Enable anonymous sign-ins:** Authentication → Sign In / Up → enable
   **Anonymous**. (This is how installs get an identity with NO phone/email.)
4. **Enable Realtime for delivery:** Database → Replication → find `inbox` →
   toggle it on. (Without this, messages arrive on next app open instead of
   instantly — still E2EE, just slower.)
5. **Copy credentials:** Project Settings → API → copy the **Project URL**
   and the **`anon` `public` key**. Send both to me (chat is fine — the anon
   key is public by design; RLS + E2EE do the real protecting).

## NEVER do these

- ❌ NEVER put the **`service_role` (secret) key** in the app. It bypasses
  all RLS. It lives nowhere in this repo, keep it that way.
- ❌ NEVER disable RLS or add permissive `using (true)` write policies.
- ❌ NEVER store plaintext messages — the client encrypts before insert.

## Verify it worked

```sql
-- should return 0 rows for a stranger, and your own rows for you:
select * from profiles;
```

Phase 3 (pairing UI + chat) starts the moment you hand me the URL + anon key.
