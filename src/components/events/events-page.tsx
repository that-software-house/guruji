"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type RSVPRecord = {
  event_id: string;
  user_id: string;
  status: "attending" | "not_attending";
};

type EventViewModel = {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  location: string;
  imageUrl: string | null;
  attendingCount: number;
  myStatus: "attending" | "not_attending" | null;
};

function formatEventDate(iso: string) {
  const date = new Date(iso);
  return {
    month: date.toLocaleString('default', { month: 'short' }),
    day: date.getDate(),
    full: new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date)
  };
}

export function EventsPage() {
  const supabase = useMemo(() => createClient(), []);
  const pathname = usePathname();
  const router = useRouter();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventViewModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRsvpId, setActiveRsvpId] = useState<string | null>(null);

  function redirectToLogin() {
    const nextPath = pathname || "/events";
    router.push(`/login?redirectedFrom=${encodeURIComponent(nextPath)}`);
  }

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!isMounted) return;
      setViewerId(user?.id || null);

      const now = new Date().toISOString();
      const { data: eventRows, error: eventsError } = await supabase
        .from("events")
        .select("id, title, description, event_date, location, image_url")
        .gte("event_date", now)
        .order("event_date", { ascending: true });

      if (!isMounted) return;
      if (eventsError) {
        setError(eventsError.message);
        setIsLoading(false);
        return;
      }

      const eventIds = (eventRows || []).map((row) => row.id);
      const { data: rsvpRows, error: rsvpError } = eventIds.length
        ? await supabase.from("event_rsvps").select("event_id, user_id, status").in("event_id", eventIds)
        : { data: [] as RSVPRecord[], error: null };

      if (!isMounted) return;
      if (rsvpError) {
        setError(rsvpError.message);
        setIsLoading(false);
        return;
      }

      const attendeeCounts = new Map<string, number>();
      const myStatusMap = new Map<string, "attending" | "not_attending">();
      (rsvpRows || []).forEach((rsvp) => {
        if (rsvp.status === "attending") attendeeCounts.set(rsvp.event_id, (attendeeCounts.get(rsvp.event_id) || 0) + 1);
        if (user && rsvp.user_id === user.id) myStatusMap.set(rsvp.event_id, rsvp.status);
      });

      const mappedEvents: EventViewModel[] = (eventRows || []).map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        eventDate: event.event_date,
        location: event.location,
        imageUrl: event.image_url,
        attendingCount: attendeeCounts.get(event.id) || 0,
        myStatus: myStatusMap.get(event.id) || null,
      }));

      setEvents(mappedEvents);
      setIsLoading(false);
    }
    loadData();
    return () => { isMounted = false; };
  }, [supabase]);

  async function toggleRsvp(eventId: string) {
    if (!viewerId) { redirectToLogin(); return; }
    if (activeRsvpId) return;

    const targetEvent = events.find((event) => event.id === eventId);
    if (!targetEvent) return;

    const previousStatus = targetEvent.myStatus;
    const nextStatus = previousStatus === "attending" ? "not_attending" : "attending";

    setActiveRsvpId(eventId);
    setError(null);

    setEvents((current) => current.map((event) => {
      if (event.id !== eventId) return event;
      const attendingDelta = (previousStatus === "attending" && nextStatus === "not_attending") ? -1 : (previousStatus !== "attending" && nextStatus === "attending") ? 1 : 0;
      return { ...event, myStatus: nextStatus, attendingCount: Math.max(0, event.attendingCount + attendingDelta) };
    }));

    const { error: upsertError } = await supabase.from("event_rsvps").upsert({ event_id: eventId, user_id: viewerId, status: nextStatus }, { onConflict: "event_id,user_id" });

    if (upsertError) {
      setEvents((current) => current.map((event) => {
        if (event.id !== eventId) return event;
        const rollbackDelta = (previousStatus === "attending" && nextStatus === "not_attending") ? 1 : (previousStatus !== "attending" && nextStatus === "attending") ? -1 : 0;
        return { ...event, myStatus: previousStatus, attendingCount: Math.max(0, event.attendingCount + rollbackDelta) };
      }));
      setError(upsertError.message);
    }
    setActiveRsvpId(null);
  }

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="aspect-[4/5] rounded-2xl bg-surface-elevated" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-500">{error}</div>
      )}

      {!events.length && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-muted">No upcoming events scheduled.</p>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => {
          const isAttending = event.myStatus === "attending";
          const rsvpIsBusy = activeRsvpId === event.id;
          const date = formatEventDate(event.eventDate);

          return (
            <article key={event.id} className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-border-strong">
              <div className="relative aspect-video w-full overflow-hidden">
                {event.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={event.imageUrl} alt={event.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-surface-elevated to-surface" />
                )}
                
                {/* Date Badge Overlay */}
                <div className="absolute left-4 top-4 flex flex-col items-center justify-center rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur-md">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent">{date.month}</span>
                  <span className="text-lg font-bold text-white">{date.day}</span>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <div className="flex-1 space-y-2">
                  <h2 className="text-lg font-bold leading-tight text-foreground">{event.title}</h2>
                  <p className="text-xs text-muted">{event.location}</p>
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted">{event.description}</p>
                </div>

                <div className="mt-6 flex items-center justify-between pt-4 border-t border-border">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{event.attendingCount} Attending</span>
                  <div className="flex items-center gap-2">
                    <Link href={`/events/${event.id}`} className="text-[10px] font-bold uppercase tracking-widest text-foreground hover:text-accent">
                      Details
                    </Link>
                    <button
                      onClick={() => toggleRsvp(event.id)}
                      disabled={rsvpIsBusy}
                      className={`rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                        isAttending
                          ? "bg-accent text-black"
                          : "bg-surface-elevated text-foreground hover:bg-border"
                      } disabled:opacity-50`}
                    >
                      {rsvpIsBusy ? "..." : isAttending ? "Attending" : "RSVP"}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
