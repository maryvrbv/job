// Push notifications about new relevant vacancies.
//
// Called by pg_cron at 12:00 and 20:00 Moscow time with the x-cron-secret header:
// counts vacancies rated «Высокий»/«Средний» that appeared since the previous run and,
// if there are any, pushes one message to every subscribed device. Zero means silence.
// Called from the app with the user's session and {"test": true}: sends a test push.
//
// Keys live in the app_secrets table (no RLS policies, so only the service role reads it).
import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import webpush from "npm:web-push@3.6.7";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function message(uae: number, ru: number): string | null {
  const parts = [];
  if (uae > 0) parts.push(`в ОАЭ ${uae} ${plural(uae, "вакансия", "вакансии", "вакансий")} для тебя`);
  if (ru > 0) parts.push(`в России ${ru} ${plural(ru, "вакансия", "вакансии", "вакансий")}`);
  if (!parts.length) return null;
  return `Маша, ты крутой дизайнер, ${parts.join(", ")}. Ты им очень нужна. Откликнись, пожалуйста`;
}

async function secrets() {
  const { data, error } = await sb.from("app_secrets").select("name,value");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.name, r.value]));
}

async function pushAll(s: Record<string, string>, payload: object) {
  webpush.setVapidDetails(s.vapid_subject, s.vapid_public, s.vapid_private);
  const { data: subs } = await sb.from("push_subscriptions").select("endpoint,subscription");
  let sent = 0;
  for (const row of subs ?? []) {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify(payload), { TTL: 6 * 3600 });
      sent++;
    } catch (e) {
      // the browser dropped this subscription: forget it
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await sb.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const s = await secrets();
    const body = await req.json().catch(() => ({}));

    if (req.headers.get("x-cron-secret") === s.cron_secret) {
      const { data: last } = await sb.from("notify_log").select("sent_at").order("sent_at", { ascending: false }).limit(1);
      const since = last?.[0]?.sent_at ?? new Date(Date.now() - 12 * 3600e3).toISOString();
      const now = new Date().toISOString();
      const { data: jobs, error } = await sb.from("jobs").select("market")
        .gt("created_at", since).in("fit", ["Высокий", "Средний"]).eq("status", "Не откликалась");
      if (error) throw error;
      const uae = jobs.filter((j) => j.market === "uae").length, ru = jobs.filter((j) => j.market === "ru").length;
      const text = message(uae, ru);
      const sent = text ? await pushAll(s, { title: "Новые вакансии", body: text, url: "/" }) : 0;
      await sb.from("notify_log").insert({ sent_at: now, uae, ru, devices: sent });
      return json({ uae, ru, sent, text });
    }

    // From the app: only a signed-in user may ask for a test push
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: user } = await sb.auth.getUser(token);
    if (!user?.user) return json({ error: "unauthorized" }, 401);
    if (body.test) {
      const text = message(3, 2)!;
      const sent = await pushAll(s, { title: "Проверка уведомлений", body: text, url: "/" });
      return json({ sent });
    }
    return json({ error: "nothing to do" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
