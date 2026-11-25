// Lift Log home-screen widget for the free Scriptable app (https://scriptable.app).
// Setup: paste this whole file into a new Scriptable script, run it once in the app and paste your Lift Log key
// when asked. Then add a Scriptable widget to your Home Screen (small or medium), long-press it → Edit Widget,
// and choose this script. Tapping the widget opens Lift Log.

const URL_BASE = "https://jspnmcweqzzeliqiznxb.supabase.co/rest/v1/lift_docs";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzcG5tY3dlcXp6ZWxpcWl6bnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMTYyMzksImV4cCI6MjEwODc5MjIzOX0.XY_-9L5u_e7oYh_C4_Jz8-WPSGpiHyWFHiSMW2yVTq8";
const APP_URL = "https://preston93lane.github.io/Lift-Log/";
const KEY_NAME = "liftlog.key";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const pad = n => String(n).padStart(2, "0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayName = d => DAYS[(d.getDay() + 6) % 7];
const weekStart = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const fmtK = n => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e4 ? Math.round(n / 1000) + "k" : String(Math.round(n));

// Pure summary (no Scriptable APIs), so it can be tested anywhere.
function summarize(workouts, config, now = new Date()) {
  const sched = (config && config.schedule) || {};
  const isTraining = d => { const s = sched[dayName(d)] || ""; return !!s && !/^rest/i.test(s); };
  const done = new Set(workouts.map(w => w.date));
  let streak = 0; const d = new Date(now); d.setHours(12);
  for (let i = 0; i < 400; i++, d.setDate(d.getDate() - 1)) {
    if (done.has(ymd(d))) { streak++; continue; }
    if (i === 0 || !isTraining(d)) continue;
    break;
  }
  const ws = ymd(weekStart(now)), week = workouts.filter(w => w.date >= ws);
  const today = sched[dayName(now)] || "";
  const sorted = workouts.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return {
    today: today.replace(/:.*/, "") || "Free day", doneToday: done.has(ymd(now)), streak,
    weekSessions: week.length, weekVolume: week.reduce((a, w) => a + (Number(w.volume) || 0), 0),
    last: sorted[0] ? { date: sorted[0].date, name: sorted[0].routine || sorted[0].activity || "Workout" } : null,
  };
}

async function getKey() {
  if (Keychain.contains(KEY_NAME)) return Keychain.get(KEY_NAME);
  if (config.runsInWidget) return null;
  const a = new Alert(); a.title = "Lift Log key"; a.message = "Paste the key you use in the Lift Log app.";
  a.addSecureTextField("Key"); a.addAction("Save"); a.addCancelAction("Cancel");
  if ((await a.present()) !== 0) return null;
  const k = a.textFieldValue(0).trim(); if (k) Keychain.set(KEY_NAME, k); return k || null;
}
async function load(key) {
  const get = async q => { const r = new Request(`${URL_BASE}?${q}`); r.headers = { apikey: ANON, Authorization: `Bearer ${ANON}`, "x-lift-key": key }; return r.loadJSON(); };
  const [ws, cfg] = await Promise.all([
    get("select=date:data->>date,kind:data->>kind,volume:data->>volume,routine:data->>routine,activity:data->>activity&collection=eq.workouts&limit=1000"),
    get("select=data&collection=eq.config&id=eq.main"),
  ]);
  if (!Array.isArray(ws)) throw new Error("Bad key or no connection");
  return summarize(ws, cfg && cfg[0] && cfg[0].data);
}

function build(s, err) {
  const w = new ListWidget(); w.url = APP_URL;
  w.backgroundColor = new Color("#0e1013"); w.setPadding(14, 14, 14, 14);
  const blue = new Color("#3d7bff"), gold = new Color("#f5b400"), muted = new Color("#8a93a2"), white = Color.white();
  const head = w.addText("LIFT LOG"); head.font = Font.heavySystemFont(11); head.textColor = blue;
  if (err || !s) { w.addSpacer(6); const t = w.addText(err || "Run the script in Scriptable to add your key."); t.font = Font.systemFont(12); t.textColor = muted; return w; }
  w.addSpacer(4);
  const t = w.addText(s.doneToday ? "✓ Done today" : s.today); t.font = Font.boldSystemFont(17); t.textColor = s.doneToday ? new Color("#2fc46b") : white; t.lineLimit = 1; t.minimumScaleFactor = .6;
  w.addSpacer(6);
  const row = w.addStack(); row.centerAlignContent();
  const n = row.addText(`${s.streak}`); n.font = Font.heavySystemFont(26); n.textColor = gold;
  row.addSpacer(6);
  const l = row.addText(s.streak === 1 ? "day streak 🔥" : "days streak 🔥"); l.font = Font.systemFont(12); l.textColor = muted;
  w.addSpacer(4);
  const wk = w.addText(`${s.weekSessions} this week${s.weekVolume ? " · " + fmtK(s.weekVolume) + " lb" : ""}`); wk.font = Font.systemFont(12); wk.textColor = white;
  if (s.last && config.widgetFamily !== "small") { const lt = w.addText(`Last: ${s.last.name} · ${s.last.date.slice(5)}`); lt.font = Font.systemFont(11); lt.textColor = muted; lt.lineLimit = 1; }
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  return w;
}

if (typeof module !== "undefined" && module.exports) module.exports = { summarize };   // for tests outside Scriptable
else {
  let s = null, err = null;
  try { const key = await getKey(); if (key) s = await load(key); } catch (e) { err = "Can't reach Lift Log right now."; }
  const w = build(s, err);
  if (config.runsInWidget) Script.setWidget(w); else await w.presentMedium();
  Script.complete();
}
