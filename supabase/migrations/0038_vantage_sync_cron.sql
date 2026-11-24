-- Schedule the nightly Vantage refresh (/api/cron/vantage-sync) on pg_cron,
-- the driver that actually authenticates in production (run_cron_endpoint
-- sends the DB-held cron secret; Vercel Cron only works if CRON_SECRET is set).
--
-- 10:30 UTC = 3:30 a.m. Arizona, after the other nightly jobs and before
-- anyone opens the portal. Idempotent: re-running replaces the job.
--
-- Retiring the route means unscheduling this job too:
--   select cron.unschedule('vantage-sync');

select cron.unschedule(jobid) from cron.job where jobname = 'vantage-sync';

select cron.schedule(
  'vantage-sync',
  '30 10 * * *',
  $$select public.run_cron_endpoint('/api/cron/vantage-sync')$$
);
