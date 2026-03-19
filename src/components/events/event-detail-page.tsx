"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type EventRecord = {
  id: string;
  title: string;
  description: string;
  event_date: string;
  location: string;
  image_url: string | null;
};

type SewaRequirement = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  required_slots: number;
  amount_usd: number | string | null;
  unit_label: string | null;
  notes: string | null;
  sort_order: number;
};

type SewaSignup = {
  requirement_id: string;
  user_id: string;
  quantity: number;
};

function formatEventDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatUsd(value: number | string | null) {
  if (value == null) {
    return null;
  }

  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

type EventDetailPageProps = {
  eventId: string;
};

export function EventDetailPage({ eventId }: EventDetailPageProps) {
  const supabase = useMemo(() => createClient(), []);
  const pathname = usePathname();
  const router = useRouter();
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [attendingCount, setAttendingCount] = useState(0);
  const [myStatus, setMyStatus] = useState<"attending" | "not_attending" | null>(null);
  const [requirements, setRequirements] = useState<SewaRequirement[]>([]);
  const [sewaSignups, setSewaSignups] = useState<SewaSignup[]>([]);
  const [activeRequirementId, setActiveRequirementId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function redirectToLogin() {
    const nextPath = pathname || `/events/${eventId}`;
    router.push(`/login?redirectedFrom=${encodeURIComponent(nextPath)}`);
  }

  const reloadSewaSignups = useCallback(
    async (requirementIds: string[]) => {
      if (!requirementIds.length) {
        setSewaSignups([]);
        return;
      }

      const { data, error: loadError } = await supabase
        .from("event_sewa_signups")
        .select("requirement_id, user_id, quantity")
        .in("requirement_id", requirementIds);

      if (loadError) {
        throw new Error(loadError.message);
      }

      setSewaSignups(data || []);
    },
    [supabase],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      setViewerId(user?.id || null);

      const { data: eventRow, error: eventError } = await supabase
        .from("events")
        .select("id, title, description, event_date, location, image_url")
        .eq("id", eventId)
        .maybeSingle();

      if (!isMounted) {
        return;
      }
      if (eventError) {
        setError(eventError.message);
        setIsLoading(false);
        return;
      }

      if (!eventRow) {
        setEvent(null);
        setAttendingCount(0);
        setMyStatus(null);
        setRequirements([]);
        setSewaSignups([]);
        setIsLoading(false);
        return;
      }

      const [rsvpResult, requirementsResult] = await Promise.all([
        supabase.from("event_rsvps").select("user_id, status").eq("event_id", eventId),
        supabase
          .from("event_sewa_requirements")
          .select("id, category, title, description, required_slots, amount_usd, unit_label, notes, sort_order")
          .eq("event_id", eventId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);

      if (!isMounted) {
        return;
      }

      if (rsvpResult.error) {
        setError(rsvpResult.error.message);
        setIsLoading(false);
        return;
      }

      if (requirementsResult.error) {
        setError(requirementsResult.error.message);
        setIsLoading(false);
        return;
      }

      let attending = 0;
      let nextStatus: "attending" | "not_attending" | null = null;
      (rsvpResult.data || []).forEach((rsvp) => {
        if (rsvp.status === "attending") {
          attending += 1;
        }
        if (user && rsvp.user_id === user.id) {
          nextStatus = rsvp.status;
        }
      });

      const loadedRequirements = (requirementsResult.data || []) as SewaRequirement[];

      try {
        await reloadSewaSignups(loadedRequirements.map((item) => item.id));
      } catch (signupLoadError) {
        setError(signupLoadError instanceof Error ? signupLoadError.message : "Could not load sewa signups.");
        setIsLoading(false);
        return;
      }

      setEvent(eventRow);
      setAttendingCount(attending);
      setMyStatus(nextStatus);
      setRequirements(loadedRequirements);
      setIsLoading(false);
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [eventId, reloadSewaSignups, supabase]);

  async function handleToggleRsvp() {
    if (!viewerId) {
      redirectToLogin();
      return;
    }
    if (!event || isUpdating) {
      return;
    }

    const previousStatus = myStatus;
    const nextStatus = previousStatus === "attending" ? "not_attending" : "attending";
    const delta =
      previousStatus === "attending" && nextStatus === "not_attending"
        ? -1
        : previousStatus !== "attending" && nextStatus === "attending"
          ? 1
          : 0;

    setIsUpdating(true);
    setError(null);
    setMyStatus(nextStatus);
    setAttendingCount((value) => Math.max(0, value + delta));

    const { error: upsertError } = await supabase.from("event_rsvps").upsert(
      {
        event_id: event.id,
        user_id: viewerId,
        status: nextStatus,
      },
      { onConflict: "event_id,user_id" },
    );

    if (upsertError) {
      setMyStatus(previousStatus);
      setAttendingCount((value) => Math.max(0, value - delta));
      setError(upsertError.message);
    }

    setIsUpdating(false);
  }

  function getClaimedSlots(requirementId: string) {
    return sewaSignups
      .filter((item) => item.requirement_id === requirementId)
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }

  function getMySlots(requirementId: string) {
    if (!viewerId) {
      return 0;
    }

    const mine = sewaSignups.find((item) => item.requirement_id === requirementId && item.user_id === viewerId);
    return mine ? Number(mine.quantity || 0) : 0;
  }

  async function changeSewaSlots(requirementId: string, delta: 1 | -1) {
    if (!viewerId) {
      redirectToLogin();
      return;
    }

    if (activeRequirementId) {
      return;
    }

    const requirement = requirements.find((item) => item.id === requirementId);
    if (!requirement) {
      return;
    }

    const claimed = getClaimedSlots(requirementId);
    const mine = getMySlots(requirementId);

    if (delta > 0 && claimed >= requirement.required_slots) {
      setError("All slots for this sewa are already claimed.");
      return;
    }

    const nextQuantity = Math.max(0, mine + delta);

    if (nextQuantity === mine) {
      return;
    }

    setActiveRequirementId(requirementId);
    setError(null);

    if (nextQuantity === 0) {
      const { error: deleteError } = await supabase
        .from("event_sewa_signups")
        .delete()
        .eq("requirement_id", requirementId)
        .eq("user_id", viewerId);

      if (deleteError) {
        setError(deleteError.message);
        setActiveRequirementId(null);
        return;
      }
    } else {
      const { error: upsertError } = await supabase.from("event_sewa_signups").upsert(
        {
          requirement_id: requirementId,
          user_id: viewerId,
          quantity: nextQuantity,
        },
        { onConflict: "requirement_id,user_id" },
      );

      if (upsertError) {
        setError(upsertError.message);
        setActiveRequirementId(null);
        return;
      }
    }

    try {
      await reloadSewaSignups(requirements.map((item) => item.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not refresh sewa signups.");
    }

    setActiveRequirementId(null);
  }

  if (isLoading) {
    return (
      <section className="space-y-4 animate-pulse" aria-busy="true" aria-live="polite">
        <div className="h-8 w-32 rounded-lg bg-surface-elevated" />
        <div className="h-72 rounded-2xl bg-surface-elevated" />
        <div className="h-56 rounded-2xl bg-surface-elevated" />
      </section>
    );
  }

  if (!event) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-10 text-center">
        <h1 className="text-2xl font-bold text-foreground">Event not found</h1>
        <p className="mt-2 text-sm text-muted">This event may have been removed or is no longer available.</p>
        <Link
          href="/events"
          className="mt-6 inline-flex rounded-full border border-border px-5 py-2 text-xs font-bold uppercase tracking-widest text-muted transition-colors hover:border-border-strong hover:text-foreground"
        >
          Back to events
        </Link>
      </section>
    );
  }

  const isAttending = myStatus === "attending";

  // Group requirements by category
  const categorized = requirements.reduce<Record<string, SewaRequirement[]>>((acc, req) => {
    const key = req.category || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(req);
    return acc;
  }, {});

  return (
    <section className="space-y-6 mx-auto max-w-6xl px-4 py-6 md:px-6 lg:px-8">
      <Link href="/events" className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted transition-colors hover:text-foreground">
        ← Back to Events
      </Link>

      {/* Event Hero Card */}
      <article className="overflow-hidden rounded-2xl border border-border bg-surface">
        {event.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.image_url} alt={event.title} className="h-64 w-full object-contain sm:h-80" />
        ) : (
          <div className="h-64 w-full bg-gradient-to-br from-surface-elevated to-surface sm:h-80" />
        )}

        <div className="space-y-5 p-6">
          <header>
            <h1 className="text-3xl font-bold leading-tight text-foreground">{event.title}</h1>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-accent">
              {formatEventDate(event.event_date)}
            </p>
            <p className="mt-1 text-sm text-muted">{event.location}</p>
          </header>

          <p className="whitespace-pre-wrap text-sm leading-7 text-muted">{event.description}</p>

          {/* RSVP Row */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-elevated p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
              {attendingCount} {attendingCount === 1 ? "person" : "people"} attending
            </p>
            <button
              type="button"
              onClick={handleToggleRsvp}
              disabled={isUpdating}
              className={`rounded-full px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                viewerId
                  ? isAttending
                    ? "bg-accent text-black hover:opacity-90"
                    : "bg-surface-elevated border border-border text-foreground hover:border-border-strong"
                  : "border border-border text-muted hover:border-border-strong hover:text-foreground"
              }`}
            >
              {isUpdating ? "Saving..." : viewerId ? (isAttending ? "Attending" : "RSVP") : "Login to RSVP"}
            </button>
          </div>
        </div>
      </article>

      {/* Sewa Signups Section */}
      <section className="rounded-2xl border border-border bg-surface p-6">
        <header className="mb-5">
          <h2 className="text-xl font-bold text-foreground">Sewa Signups</h2>
          <p className="mt-1 text-xs text-muted">Volunteer or sponsor a sewa slot for this event.</p>
        </header>

        {!requirements.length ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted">No sewa requirements have been added yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(categorized).map(([category, items]) => (
              <div key={category}>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-accent">{category}</p>
                <div className="space-y-3">
                  {items.map((requirement) => {
                    const claimedSlots = getClaimedSlots(requirement.id);
                    const mySlots = getMySlots(requirement.id);
                    const remainingSlots = Math.max(0, requirement.required_slots - claimedSlots);
                    const isBusy = activeRequirementId === requirement.id;
                    const amountLabel = formatUsd(requirement.amount_usd);
                    const fillPercent = Math.min(100, Math.round((claimedSlots / requirement.required_slots) * 100));

                    return (
                      <article key={requirement.id} className="rounded-xl border border-border bg-surface-elevated p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-foreground">{requirement.title}</h3>
                            {requirement.description ? (
                              <p className="mt-1 text-xs leading-relaxed text-muted">{requirement.description}</p>
                            ) : null}
                            {requirement.notes ? (
                              <p className="mt-1 text-[10px] text-muted italic">{requirement.notes}</p>
                            ) : null}
                          </div>
                          <div className="shrink-0 rounded-lg border border-border bg-surface px-3 py-1.5 text-center">
                            <span className="block text-sm font-bold text-foreground">{claimedSlots}/{requirement.required_slots}</span>
                            <span className="text-[9px] uppercase tracking-widest text-muted">claimed</span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface">
                          <div
                            className="h-full rounded-full bg-accent transition-all"
                            style={{ width: `${fillPercent}%` }}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted">
                          {amountLabel ? (
                            <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-bold text-foreground">
                              {amountLabel}
                              {requirement.unit_label ? ` ${requirement.unit_label}` : " / slot"}
                            </span>
                          ) : null}
                          <span>{remainingSlots} slot{remainingSlots !== 1 ? "s" : ""} remaining</span>
                          {mySlots > 0 ? (
                            <span className="font-bold text-accent">You claimed {mySlots}</span>
                          ) : null}
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          {viewerId ? (
                            <>
                              <button
                                type="button"
                                onClick={() => changeSewaSlots(requirement.id, -1)}
                                disabled={isBusy || mySlots < 1}
                                className="rounded-full border border-border px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted transition-colors hover:border-border-strong hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Release 1
                              </button>
                              <button
                                type="button"
                                onClick={() => changeSewaSlots(requirement.id, 1)}
                                disabled={isBusy || remainingSlots < 1}
                                className="rounded-full bg-accent px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {isBusy ? "..." : "Claim 1"}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={redirectToLogin}
                              className="rounded-full border border-border px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted transition-colors hover:border-border-strong hover:text-foreground"
                            >
                              Login to claim
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      ) : null}
    </section>
  );
}
