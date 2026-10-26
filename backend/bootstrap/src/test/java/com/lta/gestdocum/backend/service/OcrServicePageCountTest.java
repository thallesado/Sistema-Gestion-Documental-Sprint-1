package com.lta.gestdocum.backend.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** S2: el conteo de páginas de un PDF no se infla con /Count de marcadores ni con valores fabricados. */
class OcrServicePageCountTest {

    private static int count(String pdf) {
        return OcrService.countPages(pdf.getBytes(StandardCharsets.ISO_8859_1), "application/pdf");
    }

    @Test
    @DisplayName("Un PDF de una página con un árbol de marcadores grande cuenta una página")
    void outlineCountsAreIgnored() {
        String pdf = "%PDF-1.7\n"
                + "1 0 obj<</Type /Catalog /Pages 2 0 R /Outlines 5 0 R>>endobj\n"
                + "2 0 obj<</Type /Pages /Kids [3 0 R] /Count 1>>endobj\n"
                + "3 0 obj<</Type /Page /Parent 2 0 R>>endobj\n"
                + "5 0 obj<</Type /Outlines /First 6 0 R /Count 40>>endobj\n"
                + "6 0 obj<</Title (Capitulo) /Parent 5 0 R /Count 30>>endobj";
        assertEquals(1, count(pdf));
    }

    @Test
    @DisplayName("Sin hojas visibles se usa el /Count del nodo raíz de páginas, no el de los marcadores")
    void rootCountIsUsedWhenLeavesAreNotVisible() {
        String pdf = "%PDF-1.7\n"
                + "2 0 obj<</Type /Pages /Kids [10 0 R 11 0 R] /Count 7>>endobj\n"
                + "5 0 obj<</Type /Outlines /Count 50>>endobj";
        assertEquals(7, count(pdf));
    }

    @Test
    @DisplayName("Un nodo intermedio de páginas (con /Parent) no se toma como raíz")
    void intermediateNodesAreNotRoots() {
        String pdf = "%PDF-1.7\n"
                + "2 0 obj<</Type /Pages /Kids [3 0 R 4 0 R] /Count 5>>endobj\n"
                + "3 0 obj<</Type /Pages /Parent 2 0 R /Kids [] /Count 90>>endobj";
        assertEquals(5, count(pdf));
    }

    @Test
    @DisplayName("Un /Count fabricado enorme queda acotado")
    void craftedCountIsCapped() {
        String pdf = "%PDF-1.7\n2 0 obj<</Type /Pages /Kids [] /Count 999999>>endobj";
        assertEquals(OcrService.MAX_COUNTED_PAGES, count(pdf));
    }

    @Test
    @DisplayName("Las hojas visibles mandan sobre un /Count declarado mayor")
    void visibleLeavesWinOverLargerDeclaredCount() {
        String pdf = "%PDF-1.4\n1 0 obj<</Type /Pages /Count 900>>endobj\n"
                + "2 0 obj<</Type /Page>>endobj\n3 0 obj<</Type /Page>>endobj";
        assertEquals(2, count(pdf));
    }
}
