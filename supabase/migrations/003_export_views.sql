-- Flattened history for the weekly Google Sheets export. Lives in the private schema (not exposed to the app's API).
create or replace view private.lift_sets_v as
select (w.data->>'date')::date as date,
       coalesce(w.data->>'routine', 'Workout') as workout,
       coalesce(w.data->>'location', '') as location,
       e.value->>'name' as exercise,
       coalesce(e.value->>'variation', '') as variation,
       s.ord::int as set_no,
       case coalesce(s.value->>'t', '') when 'w' then 'warm-up' when 'd' then 'drop' when 'f' then 'failure' else 'normal' end as set_type,
       nullif((s.value->>'w')::numeric, 0) as weight_lb,
       (s.value->>'r')::numeric as reps_or_sec,
       (s.value->>'rpe')::numeric as rpe,
       case when coalesce(s.value->>'t', '') <> 'w' and (s.value->>'w')::numeric > 0 and (s.value->>'r')::numeric > 0
            then round((s.value->>'w')::numeric * (1 + least((s.value->>'r')::numeric + greatest(0, 10 - coalesce((s.value->>'rpe')::numeric, 10)), 12) / 30.0))
       end as est_1rm_lb,
       w.id as workout_id
from public.lift_docs w
cross join lateral jsonb_array_elements(coalesce(w.data->'exercises', '[]'::jsonb)) e
cross join lateral jsonb_array_elements(coalesce(e.value->'sets', '[]'::jsonb)) with ordinality s(value, ord)
where w.collection = 'workouts' and coalesce(w.data->>'kind', 'strength') <> 'cardio';

create or replace view private.lift_workouts_v as
select (data->>'date')::date as date,
       coalesce(data->>'kind', 'strength') as kind,
       coalesce(data->>'routine', data->>'activity', 'Workout') as name,
       coalesce((data->>'durationMin')::numeric, (data->>'minutes')::numeric,
                round(((data->>'endedAt')::numeric - (data->>'startedAt')::numeric) / 60000)) as minutes,
       coalesce((data->>'setsDone')::int, 0) as sets,
       coalesce((data->>'volume')::numeric, 0) as volume_lb,
       coalesce((select string_agg(p, '; ') from jsonb_array_elements_text(coalesce(data->'prs', '[]'::jsonb)) p), '') as records,
       coalesce(data->>'notes', '') as notes
from public.lift_docs where collection = 'workouts';

create or replace view private.lift_progress_v as
select date_trunc('week', date)::date as week_of,
       exercise || case when variation <> '' then ' · ' || variation else '' end as lift,
       max(est_1rm_lb) as best_est_1rm_lb,
       max(weight_lb) filter (where set_type <> 'warm-up') as heaviest_lb,
       count(*) filter (where set_type <> 'warm-up') as working_sets,
       round(sum(coalesce(weight_lb, 0) * reps_or_sec) filter (where set_type <> 'warm-up')) as volume_lb
from private.lift_sets_v
group by 1, 2;

revoke all on private.lift_sets_v, private.lift_workouts_v, private.lift_progress_v from anon, authenticated;
