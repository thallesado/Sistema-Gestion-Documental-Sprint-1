package com.lta.gestdocum.backend.service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.Test;
import java.io.ByteArrayOutputStream;
import static org.junit.jupiter.api.Assertions.*;

class TranslationSourceExtractorTest {
    private final TranslationSourceExtractor extractor = new TranslationSourceExtractor();

    private byte[] pdf(int pages, boolean withText) throws Exception {
        try (var document = new PDDocument(); var out = new ByteArrayOutputStream()) {
            for (int i = 0; i < pages; i++) {
                var page = new PDPage(); document.addPage(page);
                if (withText) try (var content = new PDPageContentStream(document, page)) {
                    content.beginText(); content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                    content.newLineAtOffset(50, 700); content.showText("Synthetic contract number 123"); content.endText();
                }
            }
            document.save(out); return out.toByteArray();
        }
    }

    @Test void extractsOnlyTheVerifiedVersion() throws Exception {
        byte[] data = pdf(1, true);
        var result = extractor.extract(data, "application/pdf", TranslationSourceExtractor.sha256(data));
        assertTrue(result.text().contains("Synthetic contract number 123"));
        assertEquals(1, result.pages());
        assertThrows(IllegalArgumentException.class, () -> extractor.extract(data, "application/pdf", "incorrect"));
    }

    @Test void rejectsScannedUnsupportedAndOversizedDocuments() throws Exception {
        byte[] empty = pdf(1, false), longPdf = pdf(11, true);
        assertThrows(IllegalArgumentException.class, () -> extractor.extract(empty, "application/pdf", TranslationSourceExtractor.sha256(empty)));
        assertThrows(IllegalArgumentException.class, () -> extractor.extract(longPdf, "application/pdf", TranslationSourceExtractor.sha256(longPdf)));
        assertThrows(IllegalArgumentException.class, () -> extractor.extract(empty, "image/png", TranslationSourceExtractor.sha256(empty)));
    }
    @Test void generatedTranslationPreservesAccentsAndPaginates() throws Exception {
        String paragraph="Informaci\u00f3n cl\u00ednica: coraz\u00f3n, ni\u00f1o, Fran\u00e7ais, Portugu\u00eas. ".repeat(200);
        byte[] bytes=DocumentTranslationService.generateTranslatedPdf("Traducci\u00f3n revisada","DOC-1","es","fr",java.util.List.of(paragraph));
        try(var document=org.apache.pdfbox.Loader.loadPDF(bytes)){
            assertTrue(document.getNumberOfPages()>1);
            String text=new org.apache.pdfbox.text.PDFTextStripper().getText(document);
            assertTrue(text.contains("coraz\u00f3n"));assertTrue(text.contains("ni\u00f1o"));
            assertEquals(200,text.split("Informaci\u00f3n",-1).length-1);
        }
    }

    @Test void unsupportedCharactersFailInsteadOfDisappearing() {
        assertThrows(IllegalArgumentException.class,()->DocumentTranslationService.generateTranslatedPdf("Test","DOC-1","en","es",java.util.List.of("Unsupported \u4e2d")));
    }
}
