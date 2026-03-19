create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'member');
create type public.rsvp_status as enum ('attending', 'not_attending');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  role public.app_role not null default 'member',
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  event_date timestamptz not null,
  location text not null,
  image_url text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.rsvp_status not null,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create or replace function public.is_admin(input_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = input_user_id
      and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'member'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;

create policy "Authenticated users can read profiles"
on public.profiles
for select
to authenticated
using (true);

create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Admins can update all profiles"
on public.profiles
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "Authenticated users can read posts"
on public.posts
for select
to authenticated
using (true);

create policy "Users can create own posts"
on public.posts
for insert
to authenticated
with check (auth.uid() = author_id);

create policy "Users can update own posts"
on public.posts
for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "Users can delete own posts"
on public.posts
for delete
to authenticated
using (auth.uid() = author_id);

create policy "Authenticated users can read likes"
on public.post_likes
for select
to authenticated
using (true);

create policy "Users can manage own likes"
on public.post_likes
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Authenticated users can read comments"
on public.post_comments
for select
to authenticated
using (true);

create policy "Users can create own comments"
on public.post_comments
for insert
to authenticated
with check (auth.uid() = author_id);

create policy "Users can update own comments"
on public.post_comments
for update
to authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "Users can delete own comments"
on public.post_comments
for delete
to authenticated
using (auth.uid() = author_id);

create policy "Authenticated users can read events"
on public.events
for select
to authenticated
using (true);

create policy "Admins can create events"
on public.events
for insert
to authenticated
with check (public.is_admin(auth.uid()) and auth.uid() = created_by);

create policy "Admins can update events"
on public.events
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "Admins can delete events"
on public.events
for delete
to authenticated
using (public.is_admin(auth.uid()));

create policy "Authenticated users can read rsvps"
on public.event_rsvps
for select
to authenticated
using (true);

create policy "Users can insert own rsvp"
on public.event_rsvps
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own rsvp"
on public.event_rsvps
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own rsvp"
on public.event_rsvps
for delete
to authenticated
using (auth.uid() = user_id);
