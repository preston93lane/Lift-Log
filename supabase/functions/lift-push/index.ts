// Sends "rest over" Web Push notifications. Deployed with verify_jwt = false; it checks the app key itself.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-lift-key, apikey, authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function config(): Promise<Record<string, string>> {
  const { data } = await sb.from("lift_config").select("k,v");
  return Object.fromEntries((data ?? []).map((r: { k: string; v: string }) => [r.k, r.v]));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const op = new URL(req.url).searchParams.get("op") ?? "";
  let c = await config();
  if (!c.app_key || req.headers.get("x-lift-key") !== c.app_key) return json({ error: "unauthorized" }, 401);

  // The push signing keys are created once, here, and never leave the database (only the public half is shared).
  if (!c.vapid_public || !c.vapid_private) {
    const k = webpush.generateVAPIDKeys();
    await sb.from("lift_config").upsert([{ k: "vapid_public", v: k.publicKey }, { k: "vapid_private", v: k.privateKey }]);
    c = await config();
  }
  if (op === "vapid") return json({ key: c.vapid_public });

  if (op === "send-due") {
    // Anything more than 2 minutes overdue is stale (phone was offline, etc.): drop it instead of buzzing late.
    await sb.from("lift_push_queue").delete().lt("fire_at", new Date(Date.now() - 120_000).toISOString());
    // Claim due rows atomically so overlapping runs never send twice.
    const { data: due } = await sb.from("lift_push_queue").update({ sent: true }).eq("sent", false).lte("fire_at", new Date().toISOString()).select();
    if (!due?.length) return json({ sent: 0 });
    const { data: subs } = await sb.from("lift_push_subs").select("endpoint,sub");
    webpush.setVapidDetails("mailto:push@example.com", c.vapid_public, c.vapid_private);
    let sent = 0;
    for (const row of due) {
      for (const s of subs ?? []) {
        try {
          await webpush.sendNotification(s.sub, JSON.stringify({ title: row.title, body: row.body, tag: row.tag }), { TTL: 60, urgency: "high" });
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await sb.from("lift_push_subs").delete().eq("endpoint", s.endpoint);
          else console.error("push failed", code);
        }
      }
    }
    return json({ sent });
  }
  return json({ ok: true });
});
