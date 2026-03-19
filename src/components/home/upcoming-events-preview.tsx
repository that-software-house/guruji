"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type UpcomingEvent = {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  location: string;
  imageUrl: string | null;
};

function formatEventDate(iso: string) {
  const date = new Date(iso);
  return {
    month: date.toLocaleString('default', { month: 'short' }),
    day: date.getDate(),
  };
}

export function UpcomingEventsPreview() {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadEvents() {
      setIsLoading(true);
      setError(null);
      const { data, error: loadError } = await supabase
        .from("events")
        .select("id, title, description, event_date, location, image_url")
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true })
        .limit(3);

      if (!isMounted) return;
      if (loadError) {
        setError(loadError.message);
        setIsLoading(false);
        return;
      }
      setEvents((data || []).map(e => ({
        id: e.id,
        title: e.title,
        description: e.description,
        eventDate: e.event_date,
        location: e.location,
        imageUrl: e.image_url,
      })));
      setIsLoading(false);
    }
    void loadEvents();
    return () => { isMounted = false; };
  }, [supabase]);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl bg-surface-elevated" />
        ))}
      </div>
    );
  }

  if (error) return <p className="text-xs text-red-500">{error}</p>;
  if (!events.length) return <p className="text-xs text-muted italic">No upcoming events.</p>;

  return (
    <div className="space-y-4">
      {events.map((event) => {
        const date = formatEventDate(event.eventDate);
        return (
          <Link
            key={event.id}
            href={`/events/${event.id}`}
            className="group flex items-center gap-4 transition-colors hover:bg-surface-elevated -mx-2 px-2 py-2 rounded-xl"
          >
            <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-elevated border border-border group-hover:border-accent">
              <span className="text-[8px] font-bold uppercase tracking-widest text-accent">{date.month}</span>
              <span className="text-sm font-bold text-foreground">{date.day}</span>
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-xs font-bold text-foreground group-hover:text-accent">
                {event.title}
              </h3>
              <p className="truncate text-[10px] text-muted">{event.location}</p>
            </div>
          </Link>
        );
      })}
      <Link
        href="/events"
        className="block pt-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-foreground text-center"
      >
        View full calendar
      </Link>
    </div>
  );
}
