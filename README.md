# Lift Log

A workout tracker that installs to the iPhone Home Screen. Enter weight, reps and effort, tap ✓, and the rest timer
starts. With the screen off or another app open, a push notification tells you when the rest is over and what the
next set is (your music keeps playing). Interval/HIIT timers ping at every phase change.

- `index.html`, `sw.js`, `manifest.webmanifest`, `icons/`: the app (static; hosted on GitHub Pages from `main`).
- `supabase/migrations/`: tables, access rules, the 5-second "send due pushes" job and a daily keep-alive ping.
- `supabase/functions/lift-push/`: edge function that sends the Web Push notifications.
- `widget/LiftLog-widget.js`: Home Screen widget for the free Scriptable app (today's plan, streak, this week).
- Weekly export: a Claude scheduled task copies the history (progress by week, workouts, every set) into the
  "Lift Log history" Google Sheet. The History tab also has a CSV export button.

Access is gated by a private key the app sends with every request; the key lives only in the database and on your phone.
`CFG.anon` in `index.html` is the project's public (publishable) key, which is safe to publish.
