export default function EventDetailLoading() {
  return (
    <section className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-56 animate-pulse rounded-2xl border border-amber-100 bg-white" />
      <div className="h-72 animate-pulse rounded-2xl border border-amber-100 bg-white" />
    </section>
  );
}
