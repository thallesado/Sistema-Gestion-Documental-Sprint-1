package com.lta.gestdocum.backend.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/** Extracts bounded text from the exact PDF version selected by the user. */
@Component
public class TranslationSourceExtractor {
    static final int MAX_BYTES = 25 * 1024 * 1024;
    static final int MAX_PAGES = 10;
    static final int MAX_CHARACTERS = 20_000;

    public record Source(String text, int pages, String checksum) { }

    public Source extract(byte[] bytes, String mimeType, String expectedChecksum) {
        if (!"application/pdf".equals(mimeType))
            throw new IllegalArgumentException("Solo se admiten PDF con texto seleccionable");
        if (bytes == null || bytes.length == 0 || bytes.length > MAX_BYTES)
            throw new IllegalArgumentException("El archivo esta vacio o supera el limite permitido");
        String actual = sha256(bytes);
        if (expectedChecksum == null || !MessageDigest.isEqual(
                actual.getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                expectedChecksum.getBytes(java.nio.charset.StandardCharsets.US_ASCII)))
            throw new IllegalArgumentException("El archivo no coincide con la version seleccionada");
        try (var document = Loader.loadPDF(bytes)) {
            if (document.isEncrypted()) throw new IllegalArgumentException("No se admiten PDF cifrados");
            int pages = document.getNumberOfPages();
            if (pages < 1 || pages > MAX_PAGES)
                throw new IllegalArgumentException("El PDF debe tener entre 1 y 10 paginas");
            var stripper = new PDFTextStripper();
            var buffer = new StringBuilder();
            var bounded = new java.io.Writer() {
                @Override public void write(char[] chars, int offset, int length) throws IOException {
                    if (buffer.length() + length > MAX_CHARACTERS) throw new IOException("TEXT_LIMIT");
                    buffer.append(chars, offset, length);
                }
                @Override public void flush() { }
                @Override public void close() { }
            };
            stripper.writeText(document, bounded);
            String text = buffer.toString().strip();
            if (text.isBlank()) throw new IllegalArgumentException("El PDF no contiene texto seleccionable; requiere OCR autorizado");
            if (text.length() > MAX_CHARACTERS)
                throw new IllegalArgumentException("El texto supera 20000 caracteres");
            return new Source(text, pages, actual);
        } catch (InvalidPasswordException exception) {
            throw new IllegalArgumentException("No se admiten PDF protegidos con contrasena");
        } catch (IOException exception) {
            throw new IllegalArgumentException("No se pudo leer el PDF");
        }
    }

    static String sha256(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
}
