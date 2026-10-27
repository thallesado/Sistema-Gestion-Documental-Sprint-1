package com.lta.gestdocum.backend.service;

import com.lta.gestdocum.backend.dto.PublicContactRequest;
import com.lta.gestdocum.backend.dto.PublicContactResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/** Envía al buzón comercial los mensajes del formulario público «Contáctanos». */
@Service
public class PublicContactService {
    private static final Logger log = LoggerFactory.getLogger(PublicContactService.class);
    private static final Map<String, String> TOPICS = Map.of(
            "VENTAS", "Ventas y planes", "SOPORTE", "Soporte técnico", "DEMO", "Demostración",
            "ALIANZAS", "Alianzas", "OTRO", "Otro");

    private final JavaMailSender mailSender;
    private final String mailFrom;
    private final String contactEmail;

    public PublicContactService(ObjectProvider<JavaMailSender> mailSenderProvider,
                                @Value("${app.mail-from:diegoastetepaz@gmail.com}") String mailFrom,
                                @Value("${app.contact-email:}") String contactEmail) {
        this.mailSender = mailSenderProvider.getIfAvailable();
        this.mailFrom = mailFrom;
        // Sin buzón propio, los mensajes llegan a la misma cuenta que envía los correos del sistema.
        this.contactEmail = contactEmail == null || contactEmail.isBlank() ? mailFrom : contactEmail.trim();
    }

    public PublicContactResponse send(PublicContactRequest request) {
        if (mailSender == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "El envío de correos no está configurado");
        }
        String topic = TOPICS.getOrDefault(request.topic(), "Otro");
        String name = singleLine(request.name());
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(mailFrom);
        message.setTo(contactEmail);
        message.setReplyTo(request.email().trim());
        message.setSubject("[NexoDocs · " + topic + "] Mensaje de " + name);
        message.setText("Nuevo mensaje desde el formulario de contacto de NexoDocs\n\n"
                + "Nombre: " + name + "\n"
                + "Correo: " + request.email().trim() + "\n"
                + "Organización: " + blankToDash(request.organization()) + "\n"
                + "Teléfono: " + blankToDash(request.phone()) + "\n"
                + "Motivo: " + topic + "\n\n"
                + request.message().trim() + "\n\n"
                + "Responde a este correo para contestar directamente a " + name + ".");
        try {
            mailSender.send(message);
        } catch (MailException exception) {
            log.warn("No se pudo enviar el mensaje de contacto de {}: {}", request.email(), exception.getMessage());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "No pudimos enviar tu mensaje en este momento. Inténtalo nuevamente más tarde.");
        }
        return new PublicContactResponse("¡Gracias, " + name + "! Recibimos tu mensaje y te responderemos a " + request.email().trim() + ".");
    }

    /** Evita saltos de línea en el asunto (inyección de cabeceras). */
    private static String singleLine(String value) {
        return value.replaceAll("[\r\n]+", " ").trim();
    }

    private static String blankToDash(String value) {
        return value == null || value.isBlank() ? "—" : singleLine(value);
    }
}
