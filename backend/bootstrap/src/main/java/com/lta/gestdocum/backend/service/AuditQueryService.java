package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.AuditEventFilter;
import com.lta.gestdocum.backend.dto.AuditEventResponse;
import com.lta.gestdocum.backend.repository.AuditEventRepository;
import com.lta.gestdocum.backend.security.AuthenticatedUserContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AuditQueryService implements AuditQueryUseCase {
    private static final int MAX_PAGE_SIZE = 100;
    private static final Map<String, String> SORTABLE_FIELDS = Map.of(
            "occurredAt", "occurredAt",
            "action", "action",
            "entityType", "entityType",
            "result", "result");

    private final AuditEventRepository repository;
    private final AuthenticatedUserContext context;

    public AuditQueryService(AuditEventRepository repository, AuthenticatedUserContext context) {
        this.repository = repository;
        this.context = context;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditEventResponse> list(AuditEventFilter filters, Pageable pageable) {
        UUID tenantId = context.require().tenantId();
        if (tenantId == null) {
            throw new com.lta.gestdocum.backend.exception.TenantRequiredException();
        }
        context.establishDatabaseContext();
        return repository.findAll(specification(tenantId, filters), safePageable(pageable))
                .map(AuditEventResponse::from);
    }

    private Specification<com.lta.gestdocum.backend.model.AuditEvent> specification(
            UUID tenantId, AuditEventFilter filters) {
        return (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(builder.equal(root.get("tenantId"), tenantId));
            if (filters.action() != null) {
                predicates.add(builder.equal(root.get("action"), filters.action()));
            }
            if (filters.entityType() != null) {
                predicates.add(builder.equal(root.get("entityType"), filters.entityType()));
            }
            if (filters.result() != null) {
                predicates.add(builder.equal(root.get("result"), filters.result()));
            }
            if (filters.from() != null) {
                predicates.add(builder.greaterThanOrEqualTo(root.get("occurredAt"), filters.from()));
            }
            if (filters.to() != null) {
                predicates.add(builder.lessThanOrEqualTo(root.get("occurredAt"), filters.to()));
            }
            return builder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private Pageable safePageable(Pageable requested) {
        int page = Math.max(requested.getPageNumber(), 0);
        int size = Math.min(Math.max(requested.getPageSize(), 1), MAX_PAGE_SIZE);
        List<Sort.Order> orders = new ArrayList<>();
        requested.getSort().forEach(order -> {
            String property = SORTABLE_FIELDS.get(order.getProperty());
            if (property != null) {
                orders.add(new Sort.Order(order.getDirection(), property));
            }
        });
        if (orders.isEmpty()) {
            orders.add(Sort.Order.desc("occurredAt"));
            orders.add(Sort.Order.desc("id"));
        }
        return PageRequest.of(page, size, Sort.by(orders));
    }
}
