import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <section className="rounded-2xl border border-border bg-surface p-8 shadow-2xl">
      <h1 className="text-3xl font-bold tracking-tight text-foreground font-serif">Create account</h1>
      <p className="mt-2 text-sm text-muted">Join the Guruji Bay Area community.</p>
      <div className="mt-8">
        <RegisterForm />
      </div>
    </section>
  );
}
