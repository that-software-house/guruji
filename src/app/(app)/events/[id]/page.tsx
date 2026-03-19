export const dynamic = "force-dynamic";

import { EventDetailPage } from "@/components/events/event-detail-page";

type EventDetailRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EventDetailRoute({ params }: EventDetailRouteProps) {
  const { id } = await params;
  return <EventDetailPage eventId={id} />;
}
