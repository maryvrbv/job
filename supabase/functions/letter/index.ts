// Writes a cover letter for one vacancy and saves it on the job row.
// Called from the app with the signed-in user's token; the Anthropic key stays server-side.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

// Same text as ingest/profile.md; kept in this one file so the function can be pasted into the dashboard editor.
const PROFILE = "Факты о Маше Воробьевой (используй только их, ничего не придумывай):\n- Senior Product Designer, 9+ лет в продуктовом дизайне (B2C и B2B): e-commerce, телеком, финтех, ритейл, HR-tech.\n- Альфа-Банк (май 2025 — сейчас): с нуля строит новый e-commerce продукт внутри банка: мультиселлерная корзина, видеолента, профиль, офлайн-оплата BNPL; от исследования до запуска.\n- МегаФон (2023–2025): редизайн выбора тарифа для сайта и приложения, 17 млн MAU: конверсия в покупку +44% (с 9% до 13%), подключения домашнего интернета +72%, время выбора −17%. Голосовой помощник «Ева»: пользователи +6% в месяц, отключения −3% в месяц. До UI — CJM, JTBD, гипотезы и метрики успеха.\n- X5 / приложение «Пятёрочка» (2020–2023, 10 млн MAU): программа лояльности X5 Клуб (баллы, карта, персональные предложения, сторис), средний чек +8%; UX- и A/B-тесты с UX-лабораторией; система метрик на базе Google HEART; развивала дизайн-систему в команде из 4 дизайнеров. Руководила двумя дизайнерами при рефакторинге дизайн-системы HR-сервисов.\n- MedAcoustica (2018–2020): с нуля job board для врачей в Германии, Австрии и Швейцарии. Сбер (2016–2018): дашборды для руководителей, стоимость подготовки отчётов −87%.\n- Образование: CalArts (UX/UI), магистратура ВШЭ по бизнес-информатике.\n- AI-native: каждый день работает с Claude Code; сама собрала портфолио на HTML/CSS/JS с деплоем через GitHub, подключила Google Analytics и Microsoft Clarity; прототипирует в коде.\n- Москва; переезжает в Дубай (ОАЭ), готова выйти сразу, нужна рабочая виза, на собеседования может прилететь без визы.\n- Ищет: Senior/Lead продуктовый дизайн. В ОАЭ — любой формат (переезд). В России — только удалённая работа. Ожидания в России от ~280 тыс. ₽.\n";

const MODEL = Deno.env.get("CLAUDE_MODEL") || "claude-opus-5-5";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TR: Record<string, string> = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" };
// link tags stay Latin-only so analytics reports read cleanly: «Яндекс» → yandeks
const slug = (s: string) => (s.toLowerCase().replace(/[а-яё]/g, (c) => TR[c]).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "co").slice(0, 30);

function prompt(job: Record<string, string>): string {
  const desc = (job.description || "").slice(0, 4000);
  if (job.market === "uae") {
    const tag = "li-" + slug(job.company);
    return `Write a cover letter from Maria for this job. English, 130–180 words, warm and confident, no clichés ("excited to apply", "passionate", "thrilled" are banned). Greeting "Hi ${job.company} team,"; why this role in 1–2 sentences, referring to concrete things from the description; 2–3 most relevant achievements with numbers; one line: relocating to Dubai, available immediately; then exactly "Portfolio: https://marydis.com/index-en.html?from=${tag}"; sign-off "Best regards,\nMaria Vorobyeva". Plain text only, no placeholders, no invented facts.

Job: ${job.title} at ${job.company}. Domain: ${job.domain}. Level: ${job.level}. Why it fits: ${job.why}
Description:
${desc || "(no description)"}`;
  }
  const tag = "hh-" + slug(job.company);
  return `Напиши сопроводительное письмо от Маши на эту вакансию. Русский, 110–160 слов. Тон тёплый и живой, без канцелярита и клише; начинай с «Здравствуйте!». Почему именно эта вакансия — 1–2 предложения; 2–3 самых подходящих результата с цифрами; строки портфолио ровно такие:
Портфолио

Открывается из России: https://mariadis.gitverse.site/?from=${tag}
Может понадобиться VPN: https://marydis.com/?from=${tag}
Заверши фразой «Буду рада обсудить вакансию 🐱» и подписью «Маша Воробьева». Про переезд в ОАЭ не пиши. Только простой текст, без плейсхолдеров и выдуманных фактов.

Вакансия: ${job.title}, компания ${job.company}. Сфера: ${job.domain}. Уровень: ${job.level}. Формат: ${job.work_format}. Почему подходит: ${job.why}${desc ? "\nОписание:\n" + desc : ""}`;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { job_id } = await req.json();
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: job, error } = await db.from("jobs").select("*").eq("id", job_id).single();
    if (error || !job) return json({ error: "Вакансия не найдена или нет доступа" }, 404);

    const client = new Anthropic();
    // deno-lint-ignore no-explicit-any
    const resp: any = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: PROFILE,
      messages: [{ role: "user", content: prompt(job) }],
    } as any);
    if (resp.stop_reason === "refusal") return json({ error: "Claude отказался писать письмо для этой вакансии" }, 422);
    const letter = resp.content.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("").trim();

    const upd = await db.from("jobs").update({ letter }).eq("id", job_id);
    if (upd.error) return json({ error: upd.error.message }, 500);
    return json({ letter });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
