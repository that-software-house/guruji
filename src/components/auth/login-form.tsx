"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
          className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-sm text-foreground transition-colors focus:border-accent focus:outline-none"
        />
      </div>

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-full bg-accent py-3 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isLoading ? "Signing in..." : "Sign in"}
      </button>

      <p className="text-center text-xs text-muted">
        New here?{" "}
        <Link className="font-bold text-accent" href="/register">
          Create an account
        </Link>
      </p>
    </form>
  );
}
