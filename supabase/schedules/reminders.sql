-- OPTIONAL: Run AFTER deploying notifications and configuring its secrets.
-- Replace REPLACE_WITH_CRON_SECRET with the same CRON_SECRET set for Edge Functions.
-- The live value is stored in Vault, not in the cron command.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select vault.create_secret('REPLACE_WITH_CRON_SECRET','lexi_cron_secret');
select cron.schedule('lexi-intelligent-reminders','*/15 * * * *',$job$
  select net.http_post(
    url := 'https://pgxbzcsplpjtbvmtifta.supabase.co/functions/v1/notifications',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='lexi_cron_secret' limit 1)),
    body := '{"action":"dispatch"}'::jsonb
  );
$job$);
