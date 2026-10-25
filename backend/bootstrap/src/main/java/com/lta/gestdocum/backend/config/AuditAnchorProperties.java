package com.lta.gestdocum.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** External audit-anchor settings (env vars documented in infrastructure/.env.example). */
@Component
public class AuditAnchorProperties {

    private final String filePath;
    private final String httpUrl;
    private final String httpReadUrl;
    private final String httpMethod;
    private final String httpAuthHeader;
    private final long httpTimeoutMs;
    private final String cron;

    public AuditAnchorProperties(
            @Value("${nexodocs.audit.external-anchor.file-path:}") String filePath,
            @Value("${nexodocs.audit.external-anchor.http.url:}") String httpUrl,
            @Value("${nexodocs.audit.external-anchor.http.read-url:}") String httpReadUrl,
            @Value("${nexodocs.audit.external-anchor.http.method:POST}") String httpMethod,
            @Value("${nexodocs.audit.external-anchor.http.auth-header:}") String httpAuthHeader,
            @Value("${nexodocs.audit.external-anchor.http.timeout-ms:5000}") long httpTimeoutMs,
            @Value("${nexodocs.audit.external-anchor.cron:0 */15 * * * *}") String cron) {
        this.filePath = filePath == null ? "" : filePath.trim();
        this.httpUrl = httpUrl == null ? "" : httpUrl.trim();
        this.httpReadUrl = httpReadUrl == null ? "" : httpReadUrl.trim();
        this.httpMethod = httpMethod;
        this.httpAuthHeader = httpAuthHeader == null ? "" : httpAuthHeader;
        this.httpTimeoutMs = httpTimeoutMs;
        this.cron = cron;
    }

    public String getFilePath() { return filePath; }
    public String getHttpUrl() { return httpUrl; }
    public String getHttpReadUrl() { return httpReadUrl; }
    public String getHttpMethod() { return httpMethod; }
    /** Secret: never log it. */
    public String getHttpAuthHeader() { return httpAuthHeader; }
    public long getHttpTimeoutMs() { return httpTimeoutMs; }
    public String getCron() { return cron; }
}
