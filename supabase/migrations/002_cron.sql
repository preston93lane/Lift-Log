-- Every 5 seconds, ping the sender, but only when a push is actually due (so idle time costs nothing).
select cron.schedule('lift-push-due', '5 seconds', $$
  select net.http_post(
    url := 'https://jspnmcweqzzeliqiznxb.supabase.co/functions/v1/lift-push?op=send-due',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-lift-key', (select v from public.lift_config where k = 'app_key')),
    body := '{}'::jsonb)
  where exists (select 1 from public.lift_push_queue where not sent and fire_at <= now())
$$);
-- Daily self-ping so the free-plan project is never idle for a week.
select cron.schedule('lift-keepalive', '17 12 * * *', $$
  select net.http_get(
    url := 'https://jspnmcweqzzeliqiznxb.supabase.co/functions/v1/lift-push?op=ping',
    headers := jsonb_build_object('x-lift-key', (select v from public.lift_config where k = 'app_key')))
$$);
