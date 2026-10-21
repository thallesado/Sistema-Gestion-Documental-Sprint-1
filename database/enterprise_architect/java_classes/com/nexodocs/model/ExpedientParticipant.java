package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: ExpedientParticipant
 * Mapea la tabla relacional: expedient_participants
 */
public class ExpedientParticipant {

    private UUID tenantId;
    private UUID expedientId;
    private UUID userId;
    private String participantRole;
    private Date addedAt;

    // Relaciones de asociacion UML (Claves Foraneas)
    private Expedient expedient;
    private User user;

    public ExpedientParticipant() {
    }

    public UUID getTenantId() {
        return this.tenantId;
    }

    public void setTenantId(UUID tenantId) {
        this.tenantId = tenantId;
    }

    public UUID getExpedientId() {
        return this.expedientId;
    }

    public void setExpedientId(UUID expedientId) {
        this.expedientId = expedientId;
    }

    public UUID getUserId() {
        return this.userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public String getParticipantRole() {
        return this.participantRole;
    }

    public void setParticipantRole(String participantRole) {
        this.participantRole = participantRole;
    }

    public Date getAddedAt() {
        return this.addedAt;
    }

    public void setAddedAt(Date addedAt) {
        this.addedAt = addedAt;
    }

    public Expedient getExpedient() {
        return this.expedient;
    }

    public void setExpedient(Expedient expedient) {
        this.expedient = expedient;
    }

    public User getUser() {
        return this.user;
    }

    public void setUser(User user) {
        this.user = user;
    }

}
