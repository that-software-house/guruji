import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <section className="rounded-2xl border border-border bg-surface p-8 shadow-2xl">
      <h1 className="text-3xl font-bold tracking-tight text-foreground font-serif">Welcome back</h1>
      <p className="mt-2 text-sm text-muted">Sign in to your member portal.</p>
      <div className="mt-8">
        <LoginForm />
      </div>
    </section>
  );
}
