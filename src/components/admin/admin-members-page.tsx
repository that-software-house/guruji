"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type MemberRecord = {
  id: string;
  full_name: string;
  role: "admin" | "member";
  created_at: string;
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(iso));
}

export function AdminMembersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const { data, error: membersError } = await supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .order("full_name", { ascending: true });

    if (membersError) {
      setError(membersError.message);
      setIsLoading(false);
      return;
    }

    setMembers((data || []) as MemberRecord[]);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadMembers();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [loadMembers]);

  async function promoteToAdmin(memberId: string) {
    if (activeMemberId) {
      return;
    }

    setActiveMemberId(memberId);
    setError(null);
    setNotice(null);

    const { error: updateError } = await supabase.from("profiles").update({ role: "admin" }).eq("id", memberId);

    if (updateError) {
      setError(updateError.message);
      setActiveMemberId(null);
      return;
    }

    setMembers((current) => current.map((member) => (member.id === memberId ? { ...member, role: "admin" } : member)));
    setNotice("Member role updated to admin.");
    setActiveMemberId(null);
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 rounded-2xl bg-surface-elevated" />
        <div className="h-64 rounded-2xl bg-surface-elevated" />
      </div>
    );
  }

  return (
    <section className="space-y-8 max-w-5xl mx-auto px-4 py-8">
      <header className="border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Member Management</h1>
        <p className="mt-2 text-sm text-muted">Manage roles and permissions.</p>
      </header>

      {error && <div className="rounded-lg bg-red-500/10 p-4 text-xs text-red-500">{error}</div>}
      {notice && <div className="rounded-lg bg-accent/10 p-4 text-xs text-accent">{notice}</div>}

      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-8 bg-surface-elevated px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-muted">
          <p>Member</p>
          <p>Role</p>
          <p>Action</p>
        </div>

        <ul className="divide-y divide-border">
          {members.map((member) => (
            <li key={member.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-8 px-6 py-4">
              <div>
                <p className="text-sm font-bold text-foreground">{member.full_name}</p>
                <p className="text-[10px] text-muted">Joined {formatDate(member.created_at)}</p>
              </div>

              <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest ${
                member.role === "admin" ? "bg-accent/20 text-accent" : "bg-surface-elevated text-muted"
              }`}>
                {member.role}
              </span>

              <div className="w-24 flex justify-end">
                {member.role !== "admin" ? (
                  <button
                    onClick={() => promoteToAdmin(member.id)}
                    disabled={activeMemberId === member.id}
                    className="text-[10px] font-bold uppercase tracking-widest text-accent hover:underline disabled:opacity-50"
                  >
                    {activeMemberId === member.id ? "..." : "Make Admin"}
                  </button>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted opacity-50">Admin</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Link href="/admin" className="inline-block text-xs font-bold uppercase tracking-widest text-muted hover:text-foreground">
        ← Dashboard
      </Link>
    </section>
  );
}
