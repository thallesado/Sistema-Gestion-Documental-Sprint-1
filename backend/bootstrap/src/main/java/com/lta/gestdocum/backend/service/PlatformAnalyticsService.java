package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.ReportPageResponse;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;

/**
 * Indicadores y reportes transversales para el administrador de la plataforma SaaS: tenants,
 * suscripciones, pagos e ingresos. Solo cuentas de plataforma (sin tenant); las consultas leen
 * todas las organizaciones con el usuario de conexión, igual que el listado global de tenants.
 * Los costos son una estimación de comisiones de procesamiento según las tasas configuradas.
 */
@Service
public class PlatformAnalyticsService {
    private static final int MAX_EXPORT_ROWS = 100_000;
    private static final List<String> TENANT_STATUSES = List.of("TRIAL", "ACTIVE", "PAST_DUE", "EXPIRED", "SUSPENDED", "CANCELED");
    private static final List<String> PAYMENT_STATUSES = List.of("PENDING", "COMPLETED", "FAILED");
    private static final List<String> PAYMENT_METHODS = List.of("STRIPE_CARD", "BANK_QR", "CRYPTO_USDT");

    private final NamedParameterJdbcTemplate db;
    private final AuthenticatedUserContext context;
    private final BigDecimal cardPercent;
    private final BigDecimal cardFixed;
    private final BigDecimal qrPercent;
    private final BigDecimal cryptoPercent;

    public PlatformAnalyticsService(NamedParameterJdbcTemplate db, AuthenticatedUserContext context,
                                    @Value("${app.billing.fees.stripe-card-percent:2.9}") BigDecimal cardPercent,
                                    @Value("${app.billing.fees.stripe-card-fixed:0.30}") BigDecimal cardFixed,
                                    @Value("${app.billing.fees.bank-qr-percent:0}") BigDecimal qrPercent,
                                    @Value("${app.billing.fees.crypto-usdt-percent:1.0}") BigDecimal cryptoPercent) {
        this.db = db; this.context = context;
        this.cardPercent = cardPercent; this.cardFixed = cardFixed; this.qrPercent = qrPercent; this.cryptoPercent = cryptoPercent;
    }

    // ------------------------------------------------------------------- dashboard

    @Transactional(readOnly = true)
    public Map<String, Object> dashboard() {
        requirePlatformAccount();
        MapSqlParameterSource p = feeParams();
        Map<String, Object> result = new LinkedHashMap<>();

        Map<String, Object> kpi = new LinkedHashMap<>(db.queryForMap("""
                select count(*) as total_tenants,
                  count(*) filter (where t.subscription_status = 'ACTIVE') as active_tenants,
                  count(*) filter (where t.subscription_status = 'TRIAL') as trial_tenants,
                  count(*) filter (where t.subscription_status = 'PAST_DUE') as past_due_tenants,
                  count(*) filter (where t.subscription_status in ('EXPIRED','CANCELED')) as churned_tenants,
                  count(*) filter (where t.subscription_status = 'SUSPENDED') as suspended_tenants,
                  count(*) filter (where t.created_at >= now() - interval '30 days') as new_tenants_30d,
                  count(*) filter (where t.stripe_subscription_id is not null) as stripe_subscriptions,
                  coalesce(sum(case when t.subscription_status in ('ACTIVE','PAST_DUE') then
                    case when t.billing_cycle_v2 = 'ANNUAL' then pl.price_yearly / 12 else pl.price_monthly end end), 0) as mrr_usd
                from tenants t left join plans pl on pl.id = t.plan_id
                """, p));
        kpi.putAll(db.queryForMap("""
                select coalesce(sum(amount_usd), 0) as revenue_total_usd,
                  coalesce(sum(amount_usd) filter (where completed_at >= now() - interval '30 days'), 0) as revenue_30d_usd,
                  coalesce(sum(amount_usd) filter (where completed_at >= now() - interval '60 days'
                    and completed_at < now() - interval '30 days'), 0) as revenue_prev_30d_usd,
                  coalesce(sum(%1$s), 0) as fees_total_usd,
                  coalesce(sum(%1$s) filter (where completed_at >= now() - interval '30 days'), 0) as fees_30d_usd,
                  count(*) as payments_total,
                  count(distinct tenant_id) as paying_tenants
                from billing_transactions where status = 'COMPLETED'
                """.formatted(feeSql("")), p));
        kpi.putAll(db.queryForMap("""
                select count(*) filter (where status = 'FAILED') as failed_payments_30d,
                  count(*) filter (where status = 'PENDING') as pending_payments_30d
                from billing_transactions where created_at >= now() - interval '30 days'
                """, p));
        kpi.putAll(db.queryForMap("""
                select count(*) filter (where status in ('PENDING','PROVISIONING')) as pending_signups,
                  count(*) filter (where status = 'FAILED') as failed_signups
                from tenant_signups where created_at >= now() - interval '30 days'
                """, p));
        BigDecimal mrr = decimal(kpi.get("mrr_usd"));
        BigDecimal revenue = decimal(kpi.get("revenue_total_usd"));
        BigDecimal fees = decimal(kpi.get("fees_total_usd"));
        BigDecimal revenue30 = decimal(kpi.get("revenue_30d_usd"));
        BigDecimal fees30 = decimal(kpi.get("fees_30d_usd"));
        kpi.put("mrr_usd", money(mrr));
        kpi.put("arr_usd", money(mrr.multiply(BigDecimal.valueOf(12))));
        kpi.put("revenue_total_usd", money(revenue));
        kpi.put("fees_total_usd", money(fees));
        kpi.put("net_total_usd", money(revenue.subtract(fees)));
        kpi.put("revenue_30d_usd", money(revenue30));
        kpi.put("fees_30d_usd", money(fees30));
        kpi.put("net_30d_usd", money(revenue30.subtract(fees30)));
        kpi.put("revenue_prev_30d_usd", money(decimal(kpi.get("revenue_prev_30d_usd"))));
        long paying = number(kpi.get("paying_tenants"));
        kpi.put("arpa_usd", paying == 0 ? BigDecimal.ZERO : money(revenue.divide(BigDecimal.valueOf(paying), 2, RoundingMode.HALF_UP)));
        result.put("kpis", camel(kpi));

        result.put("monthly", db.queryForList("""
                with months as (
                  select generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') as month
                )
                select to_char(m.month, 'YYYY-MM') as month,
                  coalesce((select sum(amount_usd) from billing_transactions b where b.status = 'COMPLETED'
                    and date_trunc('month', b.completed_at) = m.month), 0) as revenue,
                  coalesce((select sum(%s) from billing_transactions b where b.status = 'COMPLETED'
                    and date_trunc('month', b.completed_at) = m.month), 0) as fees,
                  (select count(*) from tenants t where date_trunc('month', t.created_at) = m.month) as new_tenants
                from months m order by m.month
                """.formatted(feeSql("b.")), p).stream().map(PlatformAnalyticsService::camel).toList());

        result.put("tenantsByStatus", db.queryForList("""
                select subscription_status::text as label, count(*) as value from tenants group by 1 order by 2 desc
                """, p).stream().map(PlatformAnalyticsService::camel).toList());
        result.put("tenantsByPlan", db.queryForList("""
                select coalesce(pl.name, 'Sin plan') as label, count(*) as value
                from tenants t left join plans pl on pl.id = t.plan_id group by 1 order by 2 desc
                """, p).stream().map(PlatformAnalyticsService::camel).toList());
        result.put("revenueByPlan", db.queryForList("""
                select coalesce(pl.name, 'Sin plan') as label, sum(b.amount_usd) as value
                from billing_transactions b left join plans pl on pl.id = b.plan_id
                where b.status = 'COMPLETED' group by 1 order by 2 desc
                """, p).stream().map(PlatformAnalyticsService::camel).toList());
        result.put("revenueByMethod", db.queryForList("""
                select payment_method as label, sum(amount_usd) as value
                from billing_transactions where status = 'COMPLETED' group by 1 order by 2 desc
                """, p).stream().map(PlatformAnalyticsService::camel).toList());

        result.put("tenants", db.queryForList(tenantSelect() + " order by t.created_at desc limit 200",
                p).stream().map(PlatformAnalyticsService::camel).toList());
        result.put("recentPayments", db.queryForList(paymentSelect() + " order by b.created_at desc limit 12",
                p).stream().map(PlatformAnalyticsService::camel).toList());
        result.put("feeRates", Map.of("stripeCardPercent", cardPercent, "stripeCardFixed", cardFixed,
                "bankQrPercent", qrPercent, "cryptoUsdtPercent", cryptoPercent));
        return result;
    }

    // --------------------------------------------------------------------- reportes

    @Transactional(readOnly = true)
    public ReportPageResponse<Map<String, Object>> report(String type, Map<String, String> filters, int page, int size) {
        requirePlatformAccount();
        Query query = query(type, filters);
        int safeSize = Math.max(1, Math.min(size, 200));
        int safePage = Math.max(1, page);
        Long total = db.queryForObject("select count(*) from (" + query.sql() + ") q", query.params(), Long.class);
        MapSqlParameterSource params = query.params().addValue("limit", safeSize).addValue("offset", (safePage - 1) * safeSize);
        List<Map<String, Object>> rows = db.queryForList(query.sql() + " " + query.order() + " limit :limit offset :offset", params)
                .stream().map(PlatformAnalyticsService::reportRow).toList();
        return ReportPageResponse.of(rows, total == null ? 0 : total, safePage, safeSize);
    }

    @Transactional(readOnly = true)
    public ReportService.CsvExport exportCsv(String type, Map<String, String> filters) {
        requirePlatformAccount();
        Query query = query(type, filters);
        Long total = db.queryForObject("select count(*) from (" + query.sql() + ") q", query.params(), Long.class);
        if (total != null && total > MAX_EXPORT_ROWS) throw new ReportService.ExportTooLargeException(total, MAX_EXPORT_ROWS);
        List<Map<String, Object>> rows = db.queryForList(query.sql() + " " + query.order(), query.params())
                .stream().map(PlatformAnalyticsService::reportRow).toList();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (PrintWriter writer = new PrintWriter(out, true, StandardCharsets.UTF_8)) {
            writer.write('﻿'); // BOM para Excel
            writer.println(String.join(",", query.headers().values()));
            for (Map<String, Object> row : rows) {
                StringJoiner line = new StringJoiner(",");
                for (String key : query.headers().keySet()) {
                    Object cell = row.get(key);
                    line.add(cell instanceof Number ? String.valueOf(cell) : "\"" + ReportService.escape(cell == null ? "" : String.valueOf(cell)) + "\"");
                }
                writer.println(line);
            }
        }
        return new ReportService.CsvExport(out.toByteArray(), total == null ? 0 : total);
    }

    private record Query(String sql, String order, MapSqlParameterSource params, LinkedHashMap<String, String> headers) { }

    private Query query(String type, Map<String, String> filters) {
        LocalDate from = date(filters.get("dateFrom"), "dateFrom");
        LocalDate to = date(filters.get("dateTo"), "dateTo");
        if (from.isAfter(to)) throw new IllegalArgumentException("La fecha Desde no puede ser posterior a la fecha Hasta");
        MapSqlParameterSource p = feeParams()
                .addValue("from", OffsetDateTime.of(from.atStartOfDay(), ZoneOffset.UTC))
                .addValue("to", OffsetDateTime.of(to.plusDays(1).atStartOfDay(), ZoneOffset.UTC));
        String status = trimToNull(filters.get("status"));
        String kind = trimToNull(filters.get("type"));
        String search = trimToNull(filters.get("search"));
        StringBuilder where = new StringBuilder();
        LinkedHashMap<String, String> headers = new LinkedHashMap<>();
        switch (type) {
            case "tenants" -> {
                where.append(" where t.created_at >= :from and t.created_at < :to");
                if (status != null) {
                    if (!TENANT_STATUSES.contains(status)) throw new IllegalArgumentException("Estado de tenant no válido");
                    where.append(" and t.subscription_status::text = :status"); p.addValue("status", status);
                }
                if (kind != null) { where.append(" and upper(pl.code) = upper(:plan)"); p.addValue("plan", kind); }
                if (search != null) {
                    where.append(" and (t.name ilike :search or t.code ilike :search or t.email ilike :search)");
                    p.addValue("search", "%" + search + "%");
                }
                headers.put("tenant", "Organización"); headers.put("code", "Código"); headers.put("plan", "Plan");
                headers.put("status", "Estado"); headers.put("cycle", "Ciclo"); headers.put("users", "Usuarios");
                headers.put("documents", "Documentos"); headers.put("totalPaid", "Total pagado (USD)");
                headers.put("mrr", "MRR (USD)"); headers.put("createdAt", "Alta"); headers.put("periodEnd", "Fin de período");
                return new Query("select * from (" + tenantSelect() + where + ") r", "order by r.created_at desc", p, headers);
            }
            case "payments" -> {
                where.append(" where b.created_at >= :from and b.created_at < :to");
                if (status != null) {
                    if (!PAYMENT_STATUSES.contains(status)) throw new IllegalArgumentException("Estado de pago no válido");
                    where.append(" and b.status = :status"); p.addValue("status", status);
                }
                if (kind != null) {
                    if (!PAYMENT_METHODS.contains(kind)) throw new IllegalArgumentException("Método de pago no válido");
                    where.append(" and b.payment_method = :method"); p.addValue("method", kind);
                }
                if (search != null) {
                    where.append(" and (t.name ilike :search or b.external_reference ilike :search)");
                    p.addValue("search", "%" + search + "%");
                }
                headers.put("date", "Fecha"); headers.put("tenant", "Organización"); headers.put("plan", "Plan");
                headers.put("method", "Método"); headers.put("status", "Estado"); headers.put("cycle", "Ciclo");
                headers.put("amount", "Monto (USD)"); headers.put("fee", "Costo estimado (USD)");
                headers.put("net", "Neto (USD)"); headers.put("reference", "Referencia");
                return new Query("select * from (" + paymentSelect() + where + ") r", "order by r.created_at desc", p, headers);
            }
            default -> throw new IllegalArgumentException("Tipo de reporte de plataforma no soportado: " + type);
        }
    }

    private String tenantSelect() {
        return """
                select t.id, t.name as tenant, t.code, coalesce(pl.name, 'Sin plan') as plan, pl.code as plan_code,
                  t.subscription_status::text as status, t.billing_cycle_v2 as cycle, t.created_at,
                  t.current_period_end as period_end, t.trial_ends_at, t.stripe_subscription_id is not null as stripe_managed,
                  (select count(*) from users u where u.tenant_id = t.id and u.deleted_at is null) as users,
                  (select count(*) from documents d where d.tenant_id = t.id and d.deleted_at is null) as documents,
                  coalesce((select sum(b.amount_usd) from billing_transactions b where b.tenant_id = t.id and b.status = 'COMPLETED'), 0) as total_paid,
                  (select max(b.completed_at) from billing_transactions b where b.tenant_id = t.id and b.status = 'COMPLETED') as last_payment_at,
                  case when t.subscription_status in ('ACTIVE','PAST_DUE') then
                    case when t.billing_cycle_v2 = 'ANNUAL' then round(pl.price_yearly / 12, 2) else pl.price_monthly end else 0 end as mrr
                from tenants t left join plans pl on pl.id = t.plan_id
                """;
    }

    private String paymentSelect() {
        return """
                select b.id, b.created_at, b.completed_at, t.name as tenant, coalesce(pl.name, 'Sin plan') as plan,
                  b.payment_method as method, b.status, b.billing_period as cycle, b.amount_usd as amount,
                  round(case when b.status = 'COMPLETED' then %1$s else 0 end, 2) as fee,
                  round(case when b.status = 'COMPLETED' then b.amount_usd - %1$s else 0 end, 2) as net,
                  b.external_reference as reference
                from billing_transactions b join tenants t on t.id = b.tenant_id left join plans pl on pl.id = b.plan_id
                """.formatted(feeSql("b."));
    }

    /** Comisión estimada por pago según el método; las tasas vienen de app.billing.fees.*. */
    private static String feeSql(String alias) {
        return "(case " + alias + "payment_method"
                + " when 'STRIPE_CARD' then " + alias + "amount_usd * :cardPercent / 100 + :cardFixed"
                + " when 'BANK_QR' then " + alias + "amount_usd * :qrPercent / 100"
                + " when 'CRYPTO_USDT' then " + alias + "amount_usd * :cryptoPercent / 100 else 0 end)";
    }

    private MapSqlParameterSource feeParams() {
        return new MapSqlParameterSource().addValue("cardPercent", cardPercent).addValue("cardFixed", cardFixed)
                .addValue("qrPercent", qrPercent).addValue("cryptoPercent", cryptoPercent);
    }

    private void requirePlatformAccount() {
        if (context.require().tenantId() != null) {
            throw new AccessDeniedException("El panel de plataforma requiere una cuenta de administración global");
        }
    }

    // ------------------------------------------------------------------- utilidades

    private static Map<String, Object> reportRow(Map<String, Object> row) {
        Map<String, Object> out = camel(row);
        for (String key : List.of("createdAt", "completedAt", "periodEnd", "trialEndsAt", "lastPaymentAt")) {
            Object value = out.get(key);
            if (value != null) out.put(key, String.valueOf(value).substring(0, Math.min(10, String.valueOf(value).length())));
        }
        if (out.containsKey("completedAt") || out.containsKey("method")) out.put("date", out.get("createdAt"));
        return out;
    }

    private static Map<String, Object> camel(Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>();
        row.forEach((key, value) -> {
            StringBuilder name = new StringBuilder();
            boolean upper = false;
            for (char c : key.toCharArray()) {
                if (c == '_') { upper = true; continue; }
                name.append(upper ? Character.toUpperCase(c) : c);
                upper = false;
            }
            out.put(name.toString(), value instanceof java.sql.Timestamp ts ? ts.toInstant().toString() : value);
        });
        return out;
    }

    private static LocalDate date(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException("El filtro " + name + " es obligatorio");
        try { return LocalDate.parse(value.trim().substring(0, Math.min(10, value.trim().length()))); }
        catch (RuntimeException exception) { throw new IllegalArgumentException("Fecha inválida en " + name); }
    }

    private static String trimToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private static BigDecimal decimal(Object value) { return value == null ? BigDecimal.ZERO : new BigDecimal(value.toString()); }

    private static long number(Object value) { return value == null ? 0 : Long.parseLong(value.toString()); }

    private static BigDecimal money(BigDecimal value) { return value.setScale(2, RoundingMode.HALF_UP); }
}
