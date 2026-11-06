package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.DocumentSearchFilters;
import com.lta.gestdocum.backend.model.*;
import jakarta.persistence.criteria.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import java.time.LocalDate;
import java.util.*;

final class DocumentSearchSpecification {
    private DocumentSearchSpecification() { }

    static Specification<Document> build(UUID tenant, UUID user, String scope, String text,
            Document.DocumentStatus status, DocumentSearchFilters f, ComponentFormAccess access) {
        if (f.dateFrom() != null && f.dateTo() != null && f.dateFrom().isAfter(f.dateTo())) {
            throw new IllegalArgumentException("La fecha inicial no puede ser posterior a la final");
        }
        if (provided(f.archiveState()) && !Set.of("ACTIVE", "HISTORICAL").contains(f.archiveState())) {
            throw new IllegalArgumentException("Archivo debe ser ACTIVE o HISTORICAL");
        }
        requireVisible(access, "departamento", f.department());
        requireVisible(access, "especialidad", f.specialty());
        requireVisible(access, "proceso", f.process());
        requireVisible(access, "responsable", f.responsible());
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("tenantId"), tenant));
            predicates.add(cb.isNull(root.get("deletedAt")));
            if ("mine".equals(scope)) predicates.add(cb.or(cb.equal(root.get("authorId"), user), cb.equal(root.get("responsibleId"), user)));
            if ("shared".equals(scope)) predicates.add(cb.notEqual(root.get("authorId"), user));
            if (status != null) predicates.add(cb.equal(root.get("status"), status));
            if ("HISTORICAL".equals(f.archiveState())) predicates.add(cb.equal(root.get("status"), Document.DocumentStatus.ARCHIVED));
            if ("ACTIVE".equals(f.archiveState())) predicates.add(cb.not(root.get("status").in(
                    Document.DocumentStatus.ARCHIVED, Document.DocumentStatus.TRASHED, Document.DocumentStatus.VOIDED)));
            if (provided(text)) {
                List<Predicate> matches = new ArrayList<>();
                Map.of("nombre", "name", "descripcion", "description", "codigo", "code",
                        "especialidad", "specialty", "proceso", "institutionalProcess").forEach((component, field) -> {
                    if (access.visible(component)) matches.add(contains(cb, root.get(field), text));
                });
                predicates.add(cb.or(matches.toArray(Predicate[]::new)));
            }
            if (f.documentTypeId() != null) predicates.add(cb.equal(root.get("documentTypeId"), f.documentTypeId()));
            if (provided(f.category())) {
                var typeQuery = query.subquery(UUID.class);
                var type = typeQuery.from(DocumentType.class);
                var category = typeQuery.from(DocumentCategory.class);
                typeQuery.select(type.get("id")).where(cb.equal(type.get("tenantId"), tenant),
                        cb.equal(category.get("tenantId"), tenant), cb.equal(type.get("categoryId"), category.get("id")),
                        contains(cb, category.get("name"), f.category()));
                predicates.add(root.get("documentTypeId").in(typeQuery));
            }
            if (provided(f.department())) {
                var sub = query.subquery(UUID.class); var department = sub.from(TenantDepartment.class);
                sub.select(department.get("id")).where(cb.equal(department.get("tenantId"), tenant), contains(cb, department.get("name"), f.department()));
                predicates.add(root.get("departmentId").in(sub));
            }
            if (provided(f.specialty())) predicates.add(contains(cb, root.get("specialty"), f.specialty()));
            if (provided(f.process())) predicates.add(contains(cb, root.get("institutionalProcess"), f.process()));
            if (provided(f.responsible())) {
                var sub = query.subquery(UUID.class); var person = sub.from(User.class);
                var name = cb.concat(cb.concat(cb.coalesce(person.get("firstName"), ""), " "), cb.coalesce(person.get("lastName"), ""));
                sub.select(person.get("id")).where(cb.equal(person.get("tenantId"), tenant), contains(cb, name, f.responsible()));
                predicates.add(root.get("responsibleId").in(sub));
            }
            Expression<LocalDate> created = cb.function("date", LocalDate.class, root.get("createdAt"));
            Expression<LocalDate> date = access.visible("emision") ? cb.coalesce(root.<LocalDate>get("issueDate"), created) : created;
            if (f.dateFrom() != null) predicates.add(cb.greaterThanOrEqualTo(date, f.dateFrom()));
            if (f.dateTo() != null) predicates.add(cb.lessThanOrEqualTo(date, f.dateTo()));
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static boolean provided(String text) { return text != null && !text.isBlank(); }
    private static void requireVisible(ComponentFormAccess access, String field, String value) {
        if (provided(value) && !access.visible(field)) throw new AccessDeniedException("No puedes filtrar por un campo oculto");
    }
    private static Predicate contains(CriteriaBuilder cb, Expression<String> field, String text) {
        String escaped = text.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return cb.like(cb.lower(cb.coalesce(field, "")), "%" + escaped + "%", '\\');
    }
}
