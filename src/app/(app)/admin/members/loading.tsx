export default function AdminMembersLoading() {
  return (
    <section className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-24 animate-pulse rounded-2xl border border-amber-100 bg-white" />
      <div className="h-80 animate-pulse rounded-2xl border border-amber-100 bg-white" />
    </section>
  );
}
