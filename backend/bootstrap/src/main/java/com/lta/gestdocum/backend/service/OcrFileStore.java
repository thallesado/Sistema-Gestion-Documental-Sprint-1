package com.lta.gestdocum.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

/** Guarda en disco el archivo original de cada digitalización, aislado por tenant. */
@Component
public class OcrFileStore {

    private final Path root;

    public OcrFileStore(@Value("${app.storage.local-path:./data/storage}") String storagePath) {
        this.root = Path.of(storagePath).toAbsolutePath().normalize();
    }

    /** Devuelve la ruta relativa guardada en ocr_jobs.original_file_path. */
    public String save(UUID tenantId, UUID jobId, byte[] content) {
        Path relative = Path.of("ocr", tenantId.toString(), jobId.toString());
        Path target = resolve(relative.toString());
        Path temporary = target.resolveSibling(target.getFileName() + ".uploading");
        try {
            Files.createDirectories(target.getParent());
            Files.write(temporary, content);
            Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException exception) {
            try {
                Files.deleteIfExists(temporary);
            } catch (IOException ignored) {
                // best effort
            }
            throw new UncheckedIOException("No se pudo guardar el archivo de la digitalización", exception);
        }
        return relative.toString().replace('\\', '/');
    }

    public Path resolve(String relativePath) {
        Path target = root.resolve(relativePath).normalize();
        if (!target.startsWith(root)) {
            throw new IllegalArgumentException("Ruta de archivo inválida");
        }
        return target;
    }

    public void delete(String relativePath) {
        try {
            Files.deleteIfExists(resolve(relativePath));
        } catch (IOException ignored) {
            // best effort: un huérfano no debe ocultar el error original
        }
    }
}
