export const dynamic = "force-dynamic";

import { AppShell } from "@/components/shell/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let shellUser: {
    email: string;
    fullName: string;
    role: "admin" | "member";
  } | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .maybeSingle();

    shellUser = {
      email: user.email || "",
      fullName: profile?.full_name || user.user_metadata.full_name || user.email || "Member",
      role: profile?.role === "admin" ? "admin" : "member",
    };
  }

  return (
    <AppShell user={shellUser}>
      {children}
    </AppShell>
  );
}
