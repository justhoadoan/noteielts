create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  last_export_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.word_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  word text not null check (char_length(word) between 1 and 120),
  part_of_speech text not null check (char_length(part_of_speech) between 1 and 40),
  definition text not null check (char_length(definition) between 1 and 1000),
  example text not null default '' check (char_length(example) <= 1500),
  note text not null default '' check (char_length(note) <= 2000),
  added_date date not null,
  source_name text not null default '' check (char_length(source_name) <= 120),
  source_url text not null default '' check (char_length(source_url) <= 500),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index word_entries_active_unique on public.word_entries
  (user_id, lower(btrim(word)), lower(btrim(part_of_speech)), lower(btrim(definition)))
  where deleted_at is null;
create index word_entries_user_date on public.word_entries (user_id, added_date desc);

create table public.review_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid not null references public.word_entries(id) on delete cascade,
  remembered boolean not null,
  last_reviewed_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);

create or replace function public.check_review_owner() returns trigger
language plpgsql as $$
begin
  if not exists (select 1 from public.word_entries where id = new.entry_id and user_id = new.user_id) then
    raise exception 'Review entry belongs to another user';
  end if;
  return new;
end;
$$;
create trigger review_owner before insert or update on public.review_states
  for each row execute function public.check_review_owner();

alter table public.profiles enable row level security;
alter table public.word_entries enable row level security;
alter table public.review_states enable row level security;

create policy "own profiles" on public.profiles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own entries" on public.word_entries for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own review states" on public.review_states for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.create_profile();
