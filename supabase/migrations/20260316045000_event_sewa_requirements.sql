-- THA-34: event sewa requirements + member signups

create table if not exists public.event_sewa_requirements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  category text not null,
  title text not null,
  description text,
  required_slots integer not null check (required_slots > 0),
  amount_usd numeric(10,2),
  unit_label text,
  notes text,
  sort_order integer not null default 0,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (amount_usd is null or amount_usd >= 0)
);

create index if not exists event_sewa_requirements_event_idx
  on public.event_sewa_requirements (event_id, sort_order, created_at);

create table if not exists public.event_sewa_signups (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.event_sewa_requirements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requirement_id, user_id)
);

create index if not exists event_sewa_signups_requirement_idx
  on public.event_sewa_signups (requirement_id);

create index if not exists event_sewa_signups_user_idx
  on public.event_sewa_signups (user_id);

create or replace function public.touch_event_sewa_signups_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists event_sewa_signups_touch_updated_at on public.event_sewa_signups;
create trigger event_sewa_signups_touch_updated_at
before update on public.event_sewa_signups
for each row execute procedure public.touch_event_sewa_signups_updated_at();

alter table public.event_sewa_requirements enable row level security;
alter table public.event_sewa_signups enable row level security;

drop policy if exists "Public can read sewa requirements" on public.event_sewa_requirements;
create policy "Public can read sewa requirements"
on public.event_sewa_requirements
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can create sewa requirements" on public.event_sewa_requirements;
create policy "Admins can create sewa requirements"
on public.event_sewa_requirements
for insert
to authenticated
with check (public.is_admin(auth.uid()) and auth.uid() = created_by);

drop policy if exists "Admins can update sewa requirements" on public.event_sewa_requirements;
create policy "Admins can update sewa requirements"
on public.event_sewa_requirements
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Admins can delete sewa requirements" on public.event_sewa_requirements;
create policy "Admins can delete sewa requirements"
on public.event_sewa_requirements
for delete
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "Public can read sewa signups" on public.event_sewa_signups;
create policy "Public can read sewa signups"
on public.event_sewa_signups
for select
to anon, authenticated
using (true);

drop policy if exists "Users can create own sewa signups" on public.event_sewa_signups;
create policy "Users can create own sewa signups"
on public.event_sewa_signups
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own sewa signups" on public.event_sewa_signups;
create policy "Users can update own sewa signups"
on public.event_sewa_signups
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own sewa signups" on public.event_sewa_signups;
create policy "Users can delete own sewa signups"
on public.event_sewa_signups
for delete
to authenticated
using (auth.uid() = user_id);
