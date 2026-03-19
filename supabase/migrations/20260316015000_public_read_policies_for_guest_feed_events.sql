-- THA-32: allow guest read-only access to feed + events data
-- Keeps write operations authenticated via existing insert/update/delete policies.

drop policy if exists "Authenticated users can read profiles" on public.profiles;
drop policy if exists "Public can read profiles" on public.profiles;
create policy "Public can read profiles"
on public.profiles
for select
to public
using (true);

drop policy if exists "Authenticated users can read posts" on public.posts;
drop policy if exists "Public can read posts" on public.posts;
create policy "Public can read posts"
on public.posts
for select
to public
using (true);

drop policy if exists "Authenticated users can read likes" on public.post_likes;
drop policy if exists "Public can read likes" on public.post_likes;
create policy "Public can read likes"
on public.post_likes
for select
to public
using (true);

drop policy if exists "Authenticated users can read comments" on public.post_comments;
drop policy if exists "Public can read comments" on public.post_comments;
create policy "Public can read comments"
on public.post_comments
for select
to public
using (true);

drop policy if exists "Authenticated users can read events" on public.events;
drop policy if exists "Public can read events" on public.events;
create policy "Public can read events"
on public.events
for select
to public
using (true);

drop policy if exists "Authenticated users can read rsvps" on public.event_rsvps;
drop policy if exists "Public can read rsvps" on public.event_rsvps;
create policy "Public can read rsvps"
on public.event_rsvps
for select
to public
using (true);
