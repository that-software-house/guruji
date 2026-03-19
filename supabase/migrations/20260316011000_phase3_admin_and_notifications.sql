insert into storage.buckets (id, name, public)
values
  ('post-images', 'post-images', true),
  ('event-images', 'event-images', true)
on conflict (id) do nothing;

drop policy if exists "Public can view community images" on storage.objects;
create policy "Public can view community images"
on storage.objects
for select
to public
using (bucket_id in ('post-images', 'event-images'));

drop policy if exists "Authenticated users can upload community images" on storage.objects;
create policy "Authenticated users can upload community images"
on storage.objects
for insert
to authenticated
with check (bucket_id in ('post-images', 'event-images'));

drop policy if exists "Users can update own community images" on storage.objects;
create policy "Users can update own community images"
on storage.objects
for update
to authenticated
using (bucket_id in ('post-images', 'event-images') and owner = auth.uid())
with check (bucket_id in ('post-images', 'event-images') and owner = auth.uid());

drop policy if exists "Users can delete own community images" on storage.objects;
create policy "Users can delete own community images"
on storage.objects
for delete
to authenticated
using (bucket_id in ('post-images', 'event-images') and owner = auth.uid());

create table if not exists public.event_reminder_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_type text not null default '24h',
  sent_at timestamptz not null default now(),
  unique (event_id, user_id, reminder_type)
);

alter table public.event_reminder_logs enable row level security;

create or replace function public.get_event_reminder_targets(window_start timestamptz, window_end timestamptz)
returns table (
  event_id uuid,
  event_title text,
  event_date timestamptz,
  event_location text,
  user_id uuid,
  email text,
  full_name text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    e.id as event_id,
    e.title as event_title,
    e.event_date,
    e.location as event_location,
    p.id as user_id,
    u.email,
    p.full_name
  from public.events e
  inner join public.event_rsvps rsvp
    on rsvp.event_id = e.id
   and rsvp.status = 'attending'
  inner join public.profiles p
    on p.id = rsvp.user_id
  inner join auth.users u
    on u.id = p.id
  left join public.event_reminder_logs logs
    on logs.event_id = e.id
   and logs.user_id = p.id
   and logs.reminder_type = '24h'
  where e.event_date >= window_start
    and e.event_date < window_end
    and logs.id is null
    and u.email is not null;
$$;

revoke all on function public.get_event_reminder_targets(timestamptz, timestamptz) from public;
grant execute on function public.get_event_reminder_targets(timestamptz, timestamptz) to service_role;
