"use client";

import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Announcement = {
  id: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  authorName: string;
};

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AnnouncementsPreview() {
  const supabase = useMemo(() => createClient(), []);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);

      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "admin");

      if (!isMounted) return;

      const adminIds = (adminProfiles || []).map((p) => p.id);
      if (!adminIds.length) {
        setAnnouncements([]);
        setIsLoading(false);
        return;
      }

      const profileMap = new Map(
        (adminProfiles || []).map((p) => [p.id, p.full_name || "Admin"]),
      );

      const { data: posts } = await supabase
        .from("posts")
        .select("id, content, image_url, created_at, author_id")
        .in("author_id", adminIds)
        .order("created_at", { ascending: false })
        .limit(3);

      if (!isMounted) return;

      setAnnouncements(
        (posts || []).map((post) => ({
          id: post.id,
          content: post.content,
          imageUrl: post.image_url,
          createdAt: post.created_at,
          authorName: profileMap.get(post.author_id) ?? "Admin",
        })),
      );
      setIsLoading(false);
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-surface-elevated" />
        ))}
      </div>
    );
  }

  if (!announcements.length) {
    return (
      <p className="text-xs text-muted italic">No announcements yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {announcements.map((item) => (
        <div
          key={item.id}
          className="rounded-xl border border-accent/20 bg-accent/5 px-3 py-3"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-accent">
              {item.authorName}
            </span>
            <span className="text-[10px] text-muted">
              {formatRelativeTime(item.createdAt)}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-foreground/90 line-clamp-3">
            {item.content}
          </p>
        </div>
      ))}
    </div>
  );
}
