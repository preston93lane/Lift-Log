# Lift Log

A workout tracker that installs to the iPhone Home Screen. Log a set, tap ✓, and a rest timer starts. With the
screen off or another app open, a push notification tells you when the rest is over (your music keeps playing).

- `index.html`, `sw.js`, `manifest.webmanifest`, `icons/`: the app (static; hosted on GitHub Pages).
- `supabase/migrations/001_init.sql`: tables and access rules. `002_cron.sql`: the 5-second "send due pushes" job.
- `supabase/functions/lift-push/`: edge function that sends the Web Push notifications.

Access is gated by a private key the app sends with every request; the key lives only in the database and on your phone.
In `index.html`, `CFG.anon` is the project's public (publishable) key, which is safe to publish.
