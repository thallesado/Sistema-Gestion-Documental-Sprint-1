package com.lta.gestdocum.backend.dto;

import java.time.Instant;
import java.util.List;

public record BillingOverviewResponse(String subscriptionStatus, long trialDaysRemaining, Instant trialEndsAt,
                                      Instant currentPeriodEnd, List<BillingInvoiceResponse> invoices,
                                      boolean stripeManaged) { }
