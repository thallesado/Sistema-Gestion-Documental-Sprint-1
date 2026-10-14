package com.lta.gestdocum.backend.dto;

/**
 * Métricas reales de digitalización del tenant. Los promedios son null mientras
 * no exista ninguna extracción exitosa, para que la interfaz no muestre cifras inventadas.
 */
public record OcrStatsResponse(
        long total,
        long successful,
        long failed,
        long indexed,
        long reviewed,
        long accepted,
        long rejected,
        Double acceptanceRate,
        Double averageConfidence,
        Double averageProcessingSeconds) {
}
