export const dynamic = "force-dynamic";

import { FeedPage } from "@/components/feed/feed-page";
import { AnnouncementsPreview } from "@/components/home/announcements-preview";
import { UpcomingEventsPreview } from "@/components/home/upcoming-events-preview";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 lg:px-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Main Content: Feed */}
        <div className="flex-1 space-y-8">
          {/* Mobile-only Announcements */}
          <div className="lg:hidden">
            <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
                <h2 className="text-xs font-bold uppercase tracking-widest text-accent">Announcements</h2>
              </div>
              <AnnouncementsPreview />
            </div>
          </div>

          {/* Mobile-only Upcoming Events Strip */}
          <div className="lg:hidden">
            <UpcomingEventsPreview />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h1 className="text-xl font-bold tracking-tight text-foreground">Community Feed</h1>
              <span className="text-xs font-medium text-muted uppercase tracking-widest">Latest Updates</span>
            </div>
            <FeedPage />
          </div>
        </div>

        {/* Right Sidebar: Upcoming Events (Desktop) */}
        <aside className="hidden w-[350px] shrink-0 lg:block lg:sticky lg:top-8">
          <div className="space-y-6">
            {/* Announcements — shown first so users see them immediately */}
            <div className="rounded-2xl border border-accent/20 bg-accent/5 p-6">
              <div className="mb-4 flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c3 3 9 3 12 0v-5" />
                </svg>
                <h2 className="text-sm font-bold uppercase tracking-widest text-accent">Announcements</h2>
              </div>
              <AnnouncementsPreview />
            </div>

            <div className="rounded-2xl border border-border bg-surface p-6">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Upcoming</h2>
              </div>
              <UpcomingEventsPreview />
            </div>
            
            <div className="rounded-2xl border border-border bg-surface p-6">
               <h3 className="text-sm font-bold text-foreground">About Guruji Bay Area</h3>
               <p className="mt-2 text-sm leading-relaxed text-muted">
                 A modern digital home for seva, satsang, and community updates.
                 Stay connected with every event in our community portal.
               </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
