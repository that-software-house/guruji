"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type AdminEventFormProps = {
  mode: "create" | "edit";
  eventId?: string;
};

type SewaRequirementDraft = {
  id?: string;
  clientKey: string;
  category: string;
  title: string;
  description: string;
  requiredSlots: string;
  amountUsd: string;
  unitLabel: string;
  notes: string;
  sortOrder: string;
};

type PersistedSewaRequirement = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  required_slots: number;
  amount_usd: number | string | null;
  unit_label: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
};

const EVENT_IMAGE_BUCKET = "event-images";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isoToLocalInput(iso: string) {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function localInputToIso(localValue: string) {
  return new Date(localValue).toISOString();
}

function makeClientKey() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createRequirementDraft(partial: Partial<SewaRequirementDraft> = {}): SewaRequirementDraft {
  return {
    id: partial.id,
    clientKey: partial.clientKey || makeClientKey(),
    category: partial.category || "",
    title: partial.title || "",
    description: partial.description || "",
    requiredSlots: partial.requiredSlots || "",
    amountUsd: partial.amountUsd || "",
    unitLabel: partial.unitLabel || "",
    notes: partial.notes || "",
    sortOrder: partial.sortOrder || "0",
  };
}

function mapPersistedRequirementToDraft(item: PersistedSewaRequirement): SewaRequirementDraft {
  return createRequirementDraft({
    id: item.id,
    category: item.category,
    title: item.title,
    description: item.description || "",
    requiredSlots: String(item.required_slots),
    amountUsd: item.amount_usd == null ? "" : String(item.amount_usd),
    unitLabel: item.unit_label || "",
    notes: item.notes || "",
    sortOrder: String(item.sort_order),
  });
}

export function AdminEventForm({ mode, eventId }: AdminEventFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [viewerId, setViewerId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [requirements, setRequirements] = useState<SewaRequirementDraft[]>([]);

  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setError(null);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (authError || !user) {
        setError(authError?.message || "Could not load your account.");
        setIsLoading(false);
        return;
      }

      setViewerId(user.id);

      if (mode !== "edit" || !eventId) {
        setIsLoading(false);
        return;
      }

      const [eventResult, requirementResult] = await Promise.all([
        supabase
          .from("events")
          .select("title, description, event_date, location, image_url")
          .eq("id", eventId)
          .maybeSingle(),
        supabase
          .from("event_sewa_requirements")
          .select("id, category, title, description, required_slots, amount_usd, unit_label, notes, sort_order, created_at")
          .eq("event_id", eventId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);

      if (!isMounted) {
        return;
      }

      if (eventResult.error) {
        setError(eventResult.error.message);
        setIsLoading(false);
        return;
      }

      if (!eventResult.data) {
        setError("Event not found.");
        setIsLoading(false);
        return;
      }

      if (requirementResult.error) {
        setError(requirementResult.error.message);
        setIsLoading(false);
        return;
      }

      const event = eventResult.data;
      setTitle(event.title);
      setDescription(event.description);
      setEventDate(isoToLocalInput(event.event_date));
      setLocation(event.location);
      setExistingImageUrl(event.image_url);
      setRequirements((requirementResult.data as PersistedSewaRequirement[]).map(mapPersistedRequirementToDraft));
      setIsLoading(false);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [eventId, mode, supabase]);

  async function uploadImageIfNeeded() {
    if (!imageFile || !viewerId) {
      return existingImageUrl;
    }

    const safeFileName = sanitizeFileName(imageFile.name);
    const objectPath = `${viewerId}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from(EVENT_IMAGE_BUCKET)
      .upload(objectPath, imageFile, { upsert: false });

    if (uploadError) {
      throw new Error(`Image upload failed: ${uploadError.message}`);
    }

    const { data } = supabase.storage.from(EVENT_IMAGE_BUCKET).getPublicUrl(objectPath);
    return data.publicUrl;
  }

  function updateRequirement(clientKey: string, field: keyof SewaRequirementDraft, value: string) {
    setRequirements((current) =>
      current.map((row) => {
        if (row.clientKey !== clientKey) {
          return row;
        }

        return {
          ...row,
          [field]: value,
        };
      }),
    );
  }

  function addRequirement() {
    setRequirements((current) => [...current, createRequirementDraft({ sortOrder: String(current.length) })]);
  }

  function removeRequirement(clientKey: string) {
    setRequirements((current) => current.filter((row) => row.clientKey !== clientKey));
  }

  async function reloadRequirements(targetEventId: string) {
    const { data, error: reloadError } = await supabase
      .from("event_sewa_requirements")
      .select("id, category, title, description, required_slots, amount_usd, unit_label, notes, sort_order, created_at")
      .eq("event_id", targetEventId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (reloadError) {
      throw new Error(reloadError.message);
    }

    setRequirements((data as PersistedSewaRequirement[]).map(mapPersistedRequirementToDraft));
  }

  async function saveRequirements(targetEventId: string) {
    if (!viewerId) {
      throw new Error("Could not identify the current admin user.");
    }

    const activeRows = requirements.filter((row) => {
      return Boolean(
        row.category.trim() ||
          row.title.trim() ||
          row.description.trim() ||
          row.requiredSlots.trim() ||
          row.amountUsd.trim() ||
          row.unitLabel.trim() ||
          row.notes.trim(),
      );
    });

    const normalized = activeRows.map((row) => {
      const titleValue = row.title.trim();
      const categoryValue = row.category.trim();
      const slotValue = Number(row.requiredSlots);
      const sortOrderValue = Number(row.sortOrder || "0");
      const amountRaw = row.amountUsd.trim();
      const amountValue = amountRaw ? Number(amountRaw) : null;

      if (!titleValue) {
        throw new Error("Each sewa requirement must have a title.");
      }

      if (!categoryValue) {
        throw new Error(`Requirement \"${titleValue}\" must have a category.`);
      }

      if (!Number.isFinite(slotValue) || slotValue < 1) {
        throw new Error(`Requirement \"${titleValue}\" must have required slots of at least 1.`);
      }

      if (amountRaw && (!Number.isFinite(amountValue) || amountValue == null || amountValue < 0)) {
        throw new Error(`Requirement \"${titleValue}\" has an invalid amount.`);
      }

      return {
        id: row.id,
        event_id: targetEventId,
        category: categoryValue,
        title: titleValue,
        description: row.description.trim() || null,
        required_slots: Math.floor(slotValue),
        amount_usd: amountValue == null ? null : Math.round(amountValue * 100) / 100,
        unit_label: row.unitLabel.trim() || null,
        notes: row.notes.trim() || null,
        sort_order: Number.isFinite(sortOrderValue) ? Math.floor(sortOrderValue) : 0,
        created_by: viewerId,
      };
    });

    if (mode === "edit") {
      const { data: existingRows, error: existingError } = await supabase
        .from("event_sewa_requirements")
        .select("id")
        .eq("event_id", targetEventId);

      if (existingError) {
        throw new Error(existingError.message);
      }

      const existingIds = (existingRows || []).map((row) => row.id);
      const incomingIds = normalized
        .map((row) => row.id)
        .filter((id): id is string => Boolean(id));
      const idsToDelete = existingIds.filter((id) => !incomingIds.includes(id));

      if (idsToDelete.length) {
        const { error: deleteError } = await supabase.from("event_sewa_requirements").delete().in("id", idsToDelete);

        if (deleteError) {
          throw new Error(deleteError.message);
        }
      }
    }

    const rowsToUpdate = normalized.filter((row): row is typeof row & { id: string } => Boolean(row.id));

    if (rowsToUpdate.length) {
      const updateResults = await Promise.all(
        rowsToUpdate.map((row) =>
          supabase
            .from("event_sewa_requirements")
            .update({
              category: row.category,
              title: row.title,
              description: row.description,
              required_slots: row.required_slots,
              amount_usd: row.amount_usd,
              unit_label: row.unit_label,
              notes: row.notes,
              sort_order: row.sort_order,
            })
            .eq("id", row.id),
        ),
      );

      const updateError = updateResults.find((result) => result.error)?.error;
      if (updateError) {
        throw new Error(updateError.message);
      }
    }

    const rowsToInsert = normalized
      .filter((row) => !row.id)
      .map((row) => ({
        event_id: row.event_id,
        category: row.category,
        title: row.title,
        description: row.description,
        required_slots: row.required_slots,
        amount_usd: row.amount_usd,
        unit_label: row.unit_label,
        notes: row.notes,
        sort_order: row.sort_order,
        created_by: row.created_by,
      }));

    if (rowsToInsert.length) {
      const { error: insertError } = await supabase.from("event_sewa_requirements").insert(rowsToInsert);

      if (insertError) {
        throw new Error(insertError.message);
      }
    }
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!viewerId || isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      const imageUrl = await uploadImageIfNeeded();

      if (mode === "create") {
        const { data: inserted, error: createError } = await supabase
          .from("events")
          .insert({
            title: title.trim(),
            description: description.trim(),
            event_date: localInputToIso(eventDate),
            location: location.trim(),
            image_url: imageUrl,
            created_by: viewerId,
          })
          .select("id")
          .single();

        if (createError || !inserted) {
          throw new Error(createError?.message || "Could not create event.");
        }

        await saveRequirements(inserted.id);

        router.push(`/admin/events/${inserted.id}/edit`);
        router.refresh();
        return;
      }

      if (!eventId) {
        throw new Error("Missing event ID for edit mode.");
      }

      const { error: updateError } = await supabase
        .from("events")
        .update({
          title: title.trim(),
          description: description.trim(),
          event_date: localInputToIso(eventDate),
          location: location.trim(),
          image_url: imageUrl,
        })
        .eq("id", eventId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      await saveRequirements(eventId);
      await reloadRequirements(eventId);

      setNotice("Event updated.");
      setExistingImageUrl(imageUrl);
      setImageFile(null);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save event.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteEvent() {
    if (!eventId || isDeleting) {
      return;
    }

    const confirmed = window.confirm("Delete this event?");
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    setNotice(null);

    const { error: deleteError } = await supabase.from("events").delete().eq("id", eventId);

    if (deleteError) {
      setError(deleteError.message);
      setIsDeleting(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 rounded-2xl bg-surface-elevated" />
        <div className="h-64 rounded-2xl bg-surface-elevated" />
      </div>
    );
  }

  return (
    <section className="space-y-8 max-w-5xl mx-auto px-4 py-8">
      <header className="border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{mode === "create" ? "Create Event" : "Edit Event"}</h1>
        <p className="mt-2 text-sm text-muted">Update event details and requirements.</p>
      </header>

      {error && <div className="rounded-lg bg-red-500/10 p-4 text-xs text-red-500">{error}</div>}
      {notice && <div className="rounded-lg bg-accent/10 p-4 text-xs text-accent">{notice}</div>}

      <form onSubmit={handleSave} className="space-y-8">
        <div className="space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted" htmlFor="event-title">Title</label>
            <input
              id="event-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-transparent border-b border-border py-2 text-sm text-foreground focus:border-accent focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted" htmlFor="event-description">Description</label>
            <textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              className="w-full bg-transparent border border-border rounded-xl p-4 text-sm text-foreground focus:border-accent focus:outline-none"
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted" htmlFor="event-date">Date & Time</label>
              <input
                id="event-date"
                type="datetime-local"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
                className="w-full bg-transparent border-b border-border py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted" htmlFor="event-location">Location</label>
              <input
                id="event-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                className="w-full bg-transparent border-b border-border py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-muted" htmlFor="event-image">Cover Image</label>
            <input
              id="event-image"
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="text-[10px] text-muted file:mr-3 file:rounded-full file:border-0 file:bg-surface-elevated file:px-3 file:py-1 file:text-[10px] file:font-bold file:text-foreground"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Sewa Requirements</h2>
            <button
              type="button"
              onClick={addRequirement}
              className="text-[10px] font-bold uppercase tracking-widest text-accent hover:underline"
            >
              + Add Requirement
            </button>
          </div>

          <div className="space-y-4">
            {requirements.map((row, index) => (
              <div key={row.clientKey} className="rounded-2xl border border-border bg-surface p-6 space-y-4 relative">
                <button
                  type="button"
                  onClick={() => removeRequirement(row.clientKey)}
                  className="absolute top-4 right-4 text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline"
                >
                  Remove
                </button>
                
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Requirement {index + 1}</p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-widest text-muted">Category</label>
                    <input
                      type="text"
                      value={row.category}
                      onChange={(e) => updateRequirement(row.clientKey, "category", e.target.value)}
                      placeholder="e.g. Food"
                      className="w-full bg-transparent border-b border-border py-1 text-xs text-foreground focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-widest text-muted">Title</label>
                    <input
                      type="text"
                      value={row.title}
                      onChange={(e) => updateRequirement(row.clientKey, "title", e.target.value)}
                      placeholder="e.g. Langar Sewa"
                      className="w-full bg-transparent border-b border-border py-1 text-xs text-foreground focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-widest text-muted">Slots</label>
                    <input
                      type="number"
                      value={row.requiredSlots}
                      onChange={(e) => updateRequirement(row.clientKey, "requiredSlots", e.target.value)}
                      className="w-full bg-transparent border-b border-border py-1 text-xs text-foreground focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-widest text-muted">Amount (USD)</label>
                    <input
                      type="number"
                      value={row.amountUsd}
                      onChange={(e) => updateRequirement(row.clientKey, "amountUsd", e.target.value)}
                      className="w-full bg-transparent border-b border-border py-1 text-xs text-foreground focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-widest text-muted">Unit</label>
                    <input
                      type="text"
                      value={row.unitLabel}
                      onChange={(e) => updateRequirement(row.clientKey, "unitLabel", e.target.value)}
                      placeholder="per slot"
                      className="w-full bg-transparent border-b border-border py-1 text-xs text-foreground focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-widest text-muted">Order</label>
                    <input
                      type="number"
                      value={row.sortOrder}
                      onChange={(e) => updateRequirement(row.clientKey, "sortOrder", e.target.value)}
                      className="w-full bg-transparent border-b border-border py-1 text-xs text-foreground focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-8 border-t border-border">
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-accent px-8 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? "..." : mode === "create" ? "Create Event" : "Save Changes"}
            </button>
            <Link href="/admin" className="text-xs font-bold uppercase tracking-widest text-muted hover:text-foreground">
              Cancel
            </Link>
          </div>

          {mode === "edit" && (
            <button
              type="button"
              onClick={handleDeleteEvent}
              disabled={isDeleting}
              className="text-xs font-bold uppercase tracking-widest text-red-500 hover:underline"
            >
              {isDeleting ? "..." : "Delete Event"}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
