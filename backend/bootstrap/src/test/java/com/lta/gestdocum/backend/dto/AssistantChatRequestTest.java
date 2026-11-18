package com.lta.gestdocum.backend.dto;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AssistantChatRequestTest {
    private final ObjectMapper mapper = new ObjectMapper()
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

    @Test
    void acceptsBrowserErrorTimestampWithoutRetainingIt() throws Exception {
        var request = mapper.readValue("""
                {"message":"Como indexo un documento?","context":{
                  "route":"/documents","recentRoutes":[],"permissions":[],
                  "lastError":{"status":400,"method":"POST","url":"/api/v1/documents",
                               "at":"2026-11-18T19:43:03.303Z"}}}
                """, AssistantChatRequest.class);

        assertEquals(400, request.context().lastError().status());
        assertEquals("POST", request.context().lastError().method());
        assertEquals("/api/v1/documents", request.context().lastError().url());
        assertFalse(mapper.valueToTree(request).path("context").path("lastError").has("at"));
    }

    @Test
    void continuesRejectingOtherUnexpectedErrorFields() {
        assertThrows(UnrecognizedPropertyException.class, () -> mapper.readValue("""
                {"message":"Ayuda","context":{"lastError":{
                  "status":400,"method":"POST","url":"/api/v1/documents",
                  "body":"unexpected payload"}}}
                """, AssistantChatRequest.class));
    }
}
