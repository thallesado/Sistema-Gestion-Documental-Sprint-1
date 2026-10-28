package com.lta.gestdocum.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lta.gestdocum.backend.dto.AuditExternalAnchor;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;

/**
 * Optional webhook-style sink (JDK HttpClient, no extra dependencies). Publishes with POST (or PUT for
 * presigned object-store URLs). If a read URL is configured, GET {readUrl}?scope=... must return the
 * anchor JSON object or an array of them; 404/204 means "nothing published".
 */
public class AuditAnchorHttpSink implements AuditAnchorPublisher {

    private static final ObjectMapper JSON = new ObjectMapper();

    private final URI publishUrl;
    private final URI readUrl;
    private final String method;
    private final String authHeader;
    private final Duration timeout;
    private final HttpClient client;

    public AuditAnchorHttpSink(URI publishUrl, URI readUrl, String method, String authHeader, Duration timeout) {
        requireHttp(publishUrl);
        if (readUrl != null) {
            requireHttp(readUrl);
        }
        this.publishUrl = publishUrl;
        this.readUrl = readUrl;
        this.method = "PUT".equalsIgnoreCase(method) ? "PUT" : "POST";
        this.authHeader = authHeader == null || authHeader.isBlank() ? null : authHeader;
        this.timeout = timeout;
        this.client = HttpClient.newBuilder().connectTimeout(timeout).followRedirects(HttpClient.Redirect.NEVER).build();
    }

    private static void requireHttp(URI uri) {
        String scheme = uri.getScheme();
        if (scheme == null || !(scheme.equalsIgnoreCase("http") || scheme.equalsIgnoreCase("https")) || uri.getHost() == null) {
            throw new IllegalArgumentException("External anchor URL must be http(s)");
        }
    }

    @Override
    public String destination() {
        return "http:" + publishUrl.getScheme() + "://" + publishUrl.getHost()
                + (publishUrl.getPort() > 0 ? ":" + publishUrl.getPort() : "");
    }

    @Override
    public String kind() {
        return "http";
    }

    @Override
    public boolean supportsLookup() {
        return readUrl != null;
    }

    @Override
    public void publish(AuditExternalAnchor anchor) {
        try {
            HttpRequest.Builder b = HttpRequest.newBuilder(publishUrl).timeout(timeout)
                    .header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(anchor), StandardCharsets.UTF_8));
            if (authHeader != null) {
                b.header("Authorization", authHeader);
            }
            HttpResponse<Void> r = client.send(b.build(), HttpResponse.BodyHandlers.discarding());
            if (r.statusCode() / 100 != 2) {
                throw new AuditAnchorPublishException("External anchor endpoint " + destination() + " answered HTTP " + r.statusCode());
            }
        } catch (IOException e) {
            throw new AuditAnchorPublishException("External anchor endpoint " + destination() + " unreachable: " + e.getClass().getSimpleName(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AuditAnchorPublishException("Interrupted publishing to " + destination(), e);
        }
    }

    @Override
    public Optional<AuditExternalAnchor> latest(String scope) {
        if (readUrl == null) {
            return AuditAnchorPublisher.super.latest(scope);
        }
        String sep = readUrl.getRawQuery() == null ? "?" : "&";
        URI uri = URI.create(readUrl + sep + "scope=" + URLEncoder.encode(scope, StandardCharsets.UTF_8));
        try {
            HttpRequest.Builder b = HttpRequest.newBuilder(uri).timeout(timeout).GET();
            if (authHeader != null) {
                b.header("Authorization", authHeader);
            }
            HttpResponse<String> r = client.send(b.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (r.statusCode() == 404 || r.statusCode() == 204) {
                return Optional.empty();
            }
            if (r.statusCode() / 100 != 2) {
                throw new AuditAnchorPublishException("External anchor read endpoint " + destination() + " answered HTTP " + r.statusCode());
            }
            JsonNode root = JSON.readTree(r.body());
            AuditExternalAnchor best = null;
            Iterable<JsonNode> items = root.isArray() ? root : java.util.List.of(root);
            for (JsonNode n : items) {
                AuditExternalAnchor a = JSON.treeToValue(n, AuditExternalAnchor.class);
                if (a.scope() != null && a.scope().equals(scope) && a.recordHash() != null
                        && (best == null || a.chainSeq() >= best.chainSeq())) {
                    best = a;
                }
            }
            return Optional.ofNullable(best);
        } catch (IOException e) {
            throw new AuditAnchorPublishException("External anchor read endpoint " + destination() + " unreachable: " + e.getClass().getSimpleName(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AuditAnchorPublishException("Interrupted reading from " + destination(), e);
        }
    }
}
