export const dynamic = "force-dynamic";

import { FeedPage } from "@/components/feed/feed-page";

export default function MemberFeedPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Community Feed</h1>
        <span className="text-xs font-medium uppercase tracking-widest text-muted">Latest Updates</span>
      </div>
      <FeedPage />
    </div>
  );
}
