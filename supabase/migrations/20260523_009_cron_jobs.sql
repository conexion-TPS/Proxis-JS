-- Cron jobs para Edge Functions
-- Requiere extensiones pg_cron y pg_net (habilitadas en Supabase por defecto)
--
-- IMPORTANTE: Reemplaza <PROJECT_REF> con el ref de tu proyecto Supabase
-- y <SERVICE_ROLE_KEY> con tu service_role key.
--
-- Alternativa más segura: configura los cron jobs desde el dashboard de Supabase
-- en Project Settings → Edge Functions → Cron Jobs.

-- proxis-monitor: lunes y miércoles 11:00 UTC (8:00 AM Chile verano / 8:00 AM Chile invierno = 11/12 UTC)
-- Ya gestionado vía Supabase dashboard

-- proxis-analyzer: domingos 22:00 UTC
-- Descomentar y ajustar cuando el proyecto esté en producción:
/*
SELECT cron.schedule(
  'proxis-analyzer-semanal',
  '0 22 * * 0',
  $$
  SELECT net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/proxis-analyzer',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);
*/

-- Nota: Para configurar current_setting vars en Supabase:
-- ALTER DATABASE postgres SET "app.supabase_url" = 'https://<PROJECT_REF>.supabase.co';
-- ALTER DATABASE postgres SET "app.service_role_key" = '<SERVICE_ROLE_KEY>';
