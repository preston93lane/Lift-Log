-- Every 5 seconds, ping the sender, but only when a push is actually due (so idle time costs nothing).
-- Replace PROJECT_REF before running.
select cron.schedule('lift-push-due', '5 seconds', $$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/lift-push?op=send-due',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-lift-key', (select v from public.lift_config where k = 'app_key')),
    body := '{}'::jsonb)
  where exists (select 1 from public.lift_push_queue where not sent and fire_at <= now())
$$);
