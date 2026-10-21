package com.nexodocs.model;

import java.util.Date;
import java.util.UUID;
import java.math.BigDecimal;

/**
 * Entidad UML generada para Enterprise Architect: Permission
 * Mapea la tabla relacional: permissions
 */
public class Permission {

    private Long id;
    private String code;
    private String module;
    private String action;
    private String description;
    private String criticality;
    private Boolean isActive;
    private Date createdAt;

    public Permission() {
    }

    public Long getId() {
        return this.id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCode() {
        return this.code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getModule() {
        return this.module;
    }

    public void setModule(String module) {
        this.module = module;
    }

    public String getAction() {
        return this.action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getDescription() {
        return this.description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCriticality() {
        return this.criticality;
    }

    public void setCriticality(String criticality) {
        this.criticality = criticality;
    }

    public Boolean getIsActive() {
        return this.isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public Date getCreatedAt() {
        return this.createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

}
