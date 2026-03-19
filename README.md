# Guruji Bay Area Portal

Community portal built with Next.js + Supabase.

## Features

- Member auth (register/login/logout)
- Member feed with images, likes, comments, and realtime new-post toast notifications
- Events listing, details, and RSVP state
- Admin portal:
  - Dashboard metrics
  - Create/edit/delete events
  - Post announcements to the feed (with Admin badge)
  - Member role management (`member` -> `admin`)
- Email reminder backend for events (24h reminders via Supabase Edge Function + Resend)

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- Supabase (Auth, Postgres, RLS, Storage, Realtime, Edge Functions)

## Prerequisites

- Node.js 20+
- npm
- Supabase project (URL + anon key)
- Supabase CLI (for migrations/functions)

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Apply database migrations:

```bash
supabase db push
```

4. Run app:

```bash
npm run dev
```

5. Open `http://localhost:3000`

## Supabase Storage Buckets

Migrations create and configure these public buckets:

- `post-images`
- `event-images`

## Event Reminder Emails (24h)

Edge function path: `supabase/functions/event-reminder/index.ts`

Deploy:

```bash
supabase functions deploy event-reminder
```

Set secrets:

```bash
supabase secrets set RESEND_API_KEY=your_resend_key
supabase secrets set REMINDER_FROM_EMAIL="Guruji Bay Area <no-reply@yourdomain.com>"
```

Trigger manually (example):

```bash
curl -X POST "https://<project-ref>.functions.supabase.co/event-reminder" \
  -H "Authorization: Bearer <service-role-or-function-token>" \
  -H "Content-Type: application/json" \
  -d '{"hoursAhead":24,"windowMinutes":30}'
```

Recommended: schedule this endpoint every 15 minutes from Supabase scheduled jobs or external cron.

## Vercel Deployment

1. Push this repo to GitHub.
2. Import project in Vercel.
3. Add env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.

## Notes

- `/admin/*` is restricted to users whose `profiles.role = 'admin'`.
- New users default to `member` via DB trigger.
- Event reminder function logs sent reminders in `event_reminder_logs` to avoid duplicate 24h sends.
