export const dynamic = "force-dynamic";

import { EventsPage } from "@/components/events/events-page";

export default function EventsRoutePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Upcoming Events</h1>
        <span className="text-xs font-medium uppercase tracking-widest text-muted">All Events</span>
      </div>
      <EventsPage />
    </div>
  );
}
