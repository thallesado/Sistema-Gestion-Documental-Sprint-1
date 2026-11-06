package com.lta.gestdocum.backend.service;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** Completes an authenticated Stripe callback in the already selected tenant database. */
@Service
public class StripePaymentCompletionService {
    private final EntityManager entityManager;

    public StripePaymentCompletionService(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Transactional
    public boolean complete(UUID transactionId, String paymentIntent) {
        Object result = entityManager.createNativeQuery(
                        "select app.complete_stripe_payment(cast(:transactionId as uuid), :paymentIntent)")
                .setParameter("transactionId", transactionId)
                .setParameter("paymentIntent", paymentIntent)
                .getSingleResult();
        return result instanceof Boolean completed && completed;
    }
}
