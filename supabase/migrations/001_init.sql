-- Lift Log schema. Access is gated by a shared key the app sends in the `x-lift-key` header.
-- The key itself lives only in public.lift_config (row k = 'app_key'); it is NOT in this repo.

create table if not exists public.lift_config (k text primary key, v text not null);
alter table public.lift_config enable row level security;          -- no policies: only the service role can read it

create table if not exists public.lift_docs (
  collection text not null, id text not null, data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(), primary key (collection, id));
create table if not exists public.lift_push_subs (
  endpoint text primary key, sub jsonb not null, created_at timestamptz not null default now());
create table if not exists public.lift_push_queue (
  id text primary key, fire_at timestamptz not null, title text not null default 'Lift Log',
  body text not null default '', tag text not null default 'lift', sent boolean not null default false);

create schema if not exists private;
create or replace function private.lift_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lift_config
    where k = 'app_key' and v = coalesce((nullif(current_setting('request.headers', true), '')::json) ->> 'x-lift-key', ''))
$$;
revoke all on function private.lift_ok() from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.lift_ok() to anon, authenticated;

alter table public.lift_docs enable row level security;
alter table public.lift_push_subs enable row level security;
alter table public.lift_push_queue enable row level security;
drop policy if exists lift_key on public.lift_docs;
drop policy if exists lift_key on public.lift_push_subs;
drop policy if exists lift_key on public.lift_push_queue;
create policy lift_key on public.lift_docs for all to anon, authenticated using (private.lift_ok()) with check (private.lift_ok());
create policy lift_key on public.lift_push_subs for all to anon, authenticated using (private.lift_ok()) with check (private.lift_ok());
create policy lift_key on public.lift_push_queue for all to anon, authenticated using (private.lift_ok()) with check (private.lift_ok());

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
