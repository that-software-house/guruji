export default function EventsLoading() {
  return (
    <section className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-40 animate-pulse rounded-2xl border border-amber-100 bg-white" />
      <div className="h-64 animate-pulse rounded-2xl border border-amber-100 bg-white" />
    </section>
  );
}
