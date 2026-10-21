\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(726394, 46);

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

SELECT EXISTS (
  SELECT 1 FROM app.schema_migrations WHERE version = '046_tenant_settings_and_regionalization'
) AS already_applied \gset

\if :already_applied
  \echo '046_tenant_settings_and_regionalization ya aplicada'
\else
  -- E2: Marca y regionalización en tenants
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'USD';
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS timezone varchar(50) NOT NULL DEFAULT 'America/La_Paz';
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS date_format varchar(20) NOT NULL DEFAULT 'YYYY-MM-DD';
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS default_language varchar(10) NOT NULL DEFAULT 'es';

  -- Preferencias de idioma y obligatoriedad de cambio de contraseña en usuarios
  ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language varchar(10) NOT NULL DEFAULT 'es';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

  -- Permisos de actualización para el rol de aplicación nexodocs_app
  GRANT UPDATE (currency, timezone, date_format, default_language) ON tenants TO nexodocs_app;
  GRANT UPDATE (preferred_language, must_change_password) ON users TO nexodocs_app;

  -- A2: Función segura para actualizar contadores de uso mensual del tenant
  CREATE OR REPLACE FUNCTION app.record_tenant_monthly_usage(
    p_tenant_id uuid,
    p_documents int DEFAULT 0,
    p_storage_bytes bigint DEFAULT 0,
    p_ocr_pages int DEFAULT 0
  ) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  DECLARE
    current_month date := date_trunc('month', now())::date;
  BEGIN
    INSERT INTO public.tenant_usage_monthly (
      tenant_id, year_month, api_calls, ocr_pages, documents_created, storage_bytes, updated_at
    ) VALUES (
      p_tenant_id, current_month, 0, GREATEST(0, p_ocr_pages), GREATEST(0, p_documents), GREATEST(0, p_storage_bytes), now()
    )
    ON CONFLICT (tenant_id, year_month)
    DO UPDATE SET
      documents_created = public.tenant_usage_monthly.documents_created + GREATEST(0, p_documents),
      storage_bytes = public.tenant_usage_monthly.storage_bytes + GREATEST(0, p_storage_bytes),
      ocr_pages = public.tenant_usage_monthly.ocr_pages + GREATEST(0, p_ocr_pages),
      updated_at = now();
  END;
  $$;

  ALTER FUNCTION app.record_tenant_monthly_usage(uuid, int, bigint, int) OWNER TO nexodocs_security;
  REVOKE ALL ON FUNCTION app.record_tenant_monthly_usage(uuid, int, bigint, int) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION app.record_tenant_monthly_usage(uuid, int, bigint, int) TO nexodocs_app;

  INSERT INTO app.schema_migrations(version) VALUES ('046_tenant_settings_and_regionalization');
  \echo '046_tenant_settings_and_regionalization aplicada exitosamente'
\endif

COMMIT;
