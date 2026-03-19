"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type DashboardEvent = {
  id: string;
  title: string;
  eventDate: string;
  location: string;
  attendingCount: number;
};

type DashboardPost = {
  id: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorRole: "admin" | "member";
};

type DashboardStats = {
  totalMembers: number;
  upcomingEvents: number;
  totalPosts: number;
};

const POST_IMAGE_BUCKET = "post-images";

function formatEventDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}


function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function AdminDashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    upcomingEvents: 0,
    totalPosts: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState<DashboardEvent[]>([]);
  const [recentPosts, setRecentPosts] = useState<DashboardPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementImage, setAnnouncementImage] = useState<File | null>(null);
  const [fileResetKey, setFileResetKey] = useState(0);
  const [isPostingAnnouncement, setIsPostingAnnouncement] = useState(false);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError(authError?.message || "Could not load your account.");
      setIsLoading(false);
      return;
    }

    setViewerId(user.id);

    const nowIso = new Date().toISOString();

    const [membersResult, eventsCountResult, postsCountResult, eventsResult, postsResult] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .gte("event_date", nowIso),
      supabase.from("posts").select("id", { count: "exact", head: true }),
      supabase
        .from("events")
        .select("id, title, event_date, location")
        .gte("event_date", nowIso)
        .order("event_date", { ascending: true })
        .limit(6),
      supabase
        .from("posts")
        .select("id, author_id, content, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const firstError =
      membersResult.error ||
      eventsCountResult.error ||
      postsCountResult.error ||
      eventsResult.error ||
      postsResult.error;

    if (firstError) {
      setError(firstError.message);
      setIsLoading(false);
      return;
    }

    const eventRows = eventsResult.data || [];
    const eventIds = eventRows.map((event) => event.id);

    const { data: rsvpRows, error: rsvpError } = eventIds.length
      ? await supabase
          .from("event_rsvps")
          .select("event_id, status")
          .in("event_id", eventIds)
      : { data: [], error: null };

    if (rsvpError) {
      setError(rsvpError.message);
      setIsLoading(false);
      return;
    }

    const attendeesByEvent = new Map<string, number>();
    (rsvpRows || []).forEach((rsvp) => {
      if (rsvp.status === "attending") {
        attendeesByEvent.set(rsvp.event_id, (attendeesByEvent.get(rsvp.event_id) || 0) + 1);
      }
    });

    const mappedEvents: DashboardEvent[] = eventRows.map((event) => ({
      id: event.id,
      title: event.title,
      eventDate: event.event_date,
      location: event.location,
      attendingCount: attendeesByEvent.get(event.id) || 0,
    }));

    const postRows = postsResult.data || [];
    const authorIds = Array.from(new Set(postRows.map((post) => post.author_id)));

    const { data: profiles, error: profilesError } = authorIds.length
      ? await supabase.from("profiles").select("id, full_name, role").in("id", authorIds)
      : { data: [], error: null };

    if (profilesError) {
      setError(profilesError.message);
      setIsLoading(false);
      return;
    }

    const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));

    const mappedPosts: DashboardPost[] = postRows.map((post) => {
      const profile = profileMap.get(post.author_id);
      return {
        id: post.id,
        content: post.content,
        createdAt: post.created_at,
        authorName: profile?.full_name || "Community member",
        authorRole: profile?.role === "admin" ? "admin" : "member",
      };
    });

    setStats({
      totalMembers: membersResult.count || 0,
      upcomingEvents: eventsCountResult.count || 0,
      totalPosts: postsCountResult.count || 0,
    });
    setUpcomingEvents(mappedEvents);
    setRecentPosts(mappedPosts);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [loadDashboard]);

  async function handlePostAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!viewerId || isPostingAnnouncement) {
      return;
    }

    const trimmedText = announcementText.trim();
    if (!trimmedText) {
      setError("Write a message for your announcement.");
      return;
    }

    setIsPostingAnnouncement(true);
    setError(null);
    setNotice(null);

    let imageUrl: string | null = null;

    if (announcementImage) {
      const safeFileName = sanitizeFileName(announcementImage.name);
      const objectPath = `${viewerId}/${Date.now()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from(POST_IMAGE_BUCKET)
        .upload(objectPath, announcementImage, { upsert: false });

      if (uploadError) {
        setError(`Image upload failed: ${uploadError.message}`);
        setIsPostingAnnouncement(false);
        return;
      }

      const { data } = supabase.storage.from(POST_IMAGE_BUCKET).getPublicUrl(objectPath);
      imageUrl = data.publicUrl;
    }

    const { error: insertError } = await supabase.from("posts").insert({
      author_id: viewerId,
      content: trimmedText,
      image_url: imageUrl,
    });

    if (insertError) {
      setError(insertError.message);
      setIsPostingAnnouncement(false);
      return;
    }

    setAnnouncementText("");
    setAnnouncementImage(null);
    setFileResetKey((value) => value + 1);
    setNotice("Announcement published to the community feed.");
    setIsPostingAnnouncement(false);

    await loadDashboard();
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 rounded-2xl bg-surface-elevated" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-24 rounded-2xl bg-surface-elevated" />
          <div className="h-24 rounded-2xl bg-surface-elevated" />
          <div className="h-24 rounded-2xl bg-surface-elevated" />
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-8 max-w-5xl mx-auto px-4 py-8">
      <header className="border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Dashboard</h1>
        <p className="mt-2 text-sm text-muted">Manage your community portal.</p>
      </header>

      {error && <div className="rounded-lg bg-red-500/10 p-4 text-xs text-red-500">{error}</div>}
      {notice && <div className="rounded-lg bg-accent/10 p-4 text-xs text-accent">{notice}</div>}

      <div className="grid gap-6 sm:grid-cols-3">
        {[
          { label: "Members", value: stats.totalMembers },
          { label: "Upcoming Events", value: stats.upcomingEvents },
          { label: "Total Posts", value: stats.totalPosts },
        ].map((stat) => (
          <article key={stat.label} className="rounded-2xl border border-border bg-surface p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{stat.value}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/admin/events/new"
          className="rounded-xl border border-border bg-surface px-6 py-4 text-sm font-bold text-accent transition-colors hover:border-accent"
        >
          + Create Event
        </Link>
        <Link
          href="/admin/members"
          className="rounded-xl border border-border bg-surface px-6 py-4 text-sm font-bold text-foreground transition-colors hover:border-accent"
        >
          Manage Roles
        </Link>
      </div>

      <form onSubmit={handlePostAnnouncement} className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-lg font-bold text-foreground">Post Announcement</h2>
        <textarea
          value={announcementText}
          onChange={(e) => setAnnouncementText(e.target.value)}
          placeholder="Share an update..."
          rows={3}
          required
          className="mt-4 w-full bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
        />
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
          <input
            key={fileResetKey}
            type="file"
            accept="image/*"
            onChange={(e) => setAnnouncementImage(e.target.files?.[0] || null)}
            className="text-[10px] text-muted file:mr-3 file:rounded-full file:border-0 file:bg-surface-elevated file:px-3 file:py-1 file:text-[10px] file:font-bold file:text-foreground"
          />
          <button
            type="submit"
            disabled={isPostingAnnouncement}
            className="rounded-full bg-accent px-6 py-2 text-xs font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPostingAnnouncement ? "..." : "Publish Announcement"}
          </button>
        </div>
      </form>

      <div className="grid gap-8 lg:grid-cols-2">
        <article className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Upcoming Events</h2>
          <div className="space-y-3">
            {!upcomingEvents.length ? (
              <p className="text-xs text-muted italic">No events scheduled.</p>
            ) : (
              upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
                  <div>
                    <p className="text-sm font-bold text-foreground">{event.title}</p>
                    <p className="text-[10px] text-muted">{formatEventDate(event.eventDate)}</p>
                  </div>
                  <Link href={`/admin/events/${event.id}/edit`} className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline">
                    Edit
                  </Link>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Recent Activity</h2>
          <div className="space-y-3">
            {!recentPosts.length ? (
              <p className="text-xs text-muted italic">No activity yet.</p>
            ) : (
              recentPosts.map((post) => (
                <div key={post.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-bold text-foreground">{post.authorName}</p>
                    {post.authorRole === "admin" && (
                      <span className="text-[8px] font-bold uppercase tracking-widest text-accent">Admin</span>
                    )}
                  </div>
                  <p className="line-clamp-1 text-xs text-muted">{post.content}</p>
                </div>
              ))
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
