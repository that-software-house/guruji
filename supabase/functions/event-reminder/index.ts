import { createClient } from "npm:@supabase/supabase-js@2";

type ReminderTarget = {
  event_id: string;
  event_title: string;
  event_date: string;
  event_location: string;
  user_id: string;
  email: string;
  full_name: string | null;
};

type ReminderPayload = {
  hoursAhead?: number;
  windowMinutes?: number;
  dryRun?: boolean;
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

async function sendReminderEmail({
  resendApiKey,
  from,
  to,
  target,
}: {
  resendApiKey: string;
  from: string;
  to: string;
  target: ReminderTarget;
}) {
  const attendeeName = target.full_name || "Community Member";
  const eventDateLabel = formatEventDate(target.event_date);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: `Reminder: ${target.event_title} is in 24 hours`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
          <h2 style="margin-bottom: 12px;">Event reminder</h2>
          <p>Hi ${attendeeName},</p>
          <p>This is a reminder that <strong>${target.event_title}</strong> is happening in about 24 hours.</p>
          <p>
            <strong>Date:</strong> ${eventDateLabel}<br />
            <strong>Location:</strong> ${target.event_location}
          </p>
          <p>We look forward to seeing you there.</p>
          <p>Guruji Bay Area Team</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend request failed (${response.status}): ${details}`);
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const reminderFrom = Deno.env.get("REMINDER_FROM_EMAIL") || "Guruji Bay Area <noreply@guruji.local>";

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, {
      error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables",
    });
  }

  if (!resendApiKey) {
    return jsonResponse(500, {
      error: "Missing RESEND_API_KEY environment variable",
    });
  }

  const payload = ((await request.json().catch(() => ({}))) || {}) as ReminderPayload;
  const hoursAhead = typeof payload.hoursAhead === "number" ? payload.hoursAhead : 24;
  const windowMinutes = typeof payload.windowMinutes === "number" ? payload.windowMinutes : 30;
  const dryRun = Boolean(payload.dryRun);

  const now = new Date();
  const reminderCenter = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  const windowStart = new Date(reminderCenter.getTime() - (windowMinutes / 2) * 60 * 1000);
  const windowEnd = new Date(reminderCenter.getTime() + (windowMinutes / 2) * 60 * 1000);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase.rpc("get_event_reminder_targets", {
    window_start: windowStart.toISOString(),
    window_end: windowEnd.toISOString(),
  });

  if (error) {
    return jsonResponse(500, {
      error: "Failed to load reminder targets",
      details: error.message,
    });
  }

  const targets = (data || []) as ReminderTarget[];

  if (!targets.length) {
    return jsonResponse(200, {
      sent: 0,
      skipped: 0,
      failed: 0,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      message: "No reminder targets found for this window",
    });
  }

  if (dryRun) {
    return jsonResponse(200, {
      dryRun: true,
      targetCount: targets.length,
      sampleTargets: targets.slice(0, 5),
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    });
  }

  const successful: ReminderTarget[] = [];
  const failures: Array<{ target: ReminderTarget; reason: string }> = [];

  for (const target of targets) {
    try {
      await sendReminderEmail({
        resendApiKey,
        from: reminderFrom,
        to: target.email,
        target,
      });
      successful.push(target);
    } catch (sendError) {
      failures.push({
        target,
        reason: sendError instanceof Error ? sendError.message : "Unknown error",
      });
    }
  }

  if (successful.length) {
    const { error: insertError } = await supabase.from("event_reminder_logs").upsert(
      successful.map((target) => ({
        event_id: target.event_id,
        user_id: target.user_id,
        reminder_type: "24h",
        sent_at: new Date().toISOString(),
      })),
      {
        onConflict: "event_id,user_id,reminder_type",
        ignoreDuplicates: true,
      },
    );

    if (insertError) {
      return jsonResponse(500, {
        error: "Emails sent but logging failed",
        details: insertError.message,
        sent: successful.length,
        failed: failures.length,
      });
    }
  }

  return jsonResponse(200, {
    sent: successful.length,
    failed: failures.length,
    failures: failures.map(({ target, reason }) => ({
      eventId: target.event_id,
      userId: target.user_id,
      email: target.email,
      reason,
    })),
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  });
});
