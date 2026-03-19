"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function RegisterForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsLoading(true);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (signUpError) {
      setIsLoading(false);
      setError(signUpError.message);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: data.user.id,
        full_name: fullName,
        role: "member",
      });

      if (profileError) {
        setIsLoading(false);
        setError(profileError.message);
        return;
      }
    }

    setIsLoading(false);

    if (data.session) {
      router.push("/");
      router.refresh();
      return;
    }

    setNotice("Check your email to confirm your account.");
    router.push("/login");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-widest text-muted" htmlFor="fullName">
          Full name
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          required
          className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-sm text-foreground transition-colors focus:border-accent focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-widest text-muted" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-sm text-foreground transition-colors focus:border-accent focus:outline-none"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-widest text-muted" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
          className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-sm text-foreground transition-colors focus:border-accent focus:outline-none"
        />
      </div>

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
      {notice && <p className="text-xs text-emerald-500 font-medium">{notice}</p>}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-full bg-accent py-3 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isLoading ? "Creating..." : "Create account"}
      </button>

      <p className="text-center text-xs text-muted">
        Already have an account?{" "}
        <Link className="font-bold text-accent" href="/login">
          Sign in
        </Link>
      </p>
    </form>
  );
}
