import { AdminEventForm } from "@/components/admin/admin-event-form";

type EditAdminEventPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditAdminEventPage({ params }: EditAdminEventPageProps) {
  const { id } = await params;
  return <AdminEventForm mode="edit" eventId={id} />;
}
