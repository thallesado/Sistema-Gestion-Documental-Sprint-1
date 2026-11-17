package com.lta.gestdocum.backend.service;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.AndroidNotification;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.Notification;
import com.lta.gestdocum.backend.config.PushProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Envío real con Firebase Admin SDK (FCM HTTP v1). Si no hay credenciales válidas, queda desactivado
 * y registra una única advertencia; nunca lanza excepciones al arrancar.
 */
@Component
public class FirebasePushMessageSender implements PushMessageSender {

    private static final Logger log = LoggerFactory.getLogger(FirebasePushMessageSender.class);
    /** Canal de Android creado por la app móvil para los avisos de tareas (mobile/lib/core/notifications). */
    static final String ANDROID_CHANNEL_ID = "workflow_tasks";
    private static final String APP_NAME = "nexodocs-push";

    private final FirebaseMessaging messaging;

    public FirebasePushMessageSender(PushProperties properties) {
        this.messaging = createMessaging(properties);
    }

    @Override
    public boolean isConfigured() {
        return messaging != null;
    }

    @Override
    public PushOutcome send(String token, PushMessage message) {
        Message.Builder builder = Message.builder()
                .setToken(token)
                .setNotification(Notification.builder().setTitle(message.title()).setBody(message.body()).build())
                .setAndroidConfig(AndroidConfig.builder()
                        .setPriority(AndroidConfig.Priority.HIGH)
                        .setNotification(AndroidNotification.builder().setChannelId(ANDROID_CHANNEL_ID).build())
                        .build())
                .putAllData(message.data());
        try {
            messaging.send(builder.build());
            return PushOutcome.SENT;
        } catch (FirebaseMessagingException exception) {
            MessagingErrorCode code = exception.getMessagingErrorCode();
            if (code == MessagingErrorCode.UNREGISTERED || code == MessagingErrorCode.INVALID_ARGUMENT) {
                return PushOutcome.INVALID_TOKEN;
            }
            // Sin token ni contenido en el registro: solo el código de error de FCM.
            log.warn("FCM rechazó un aviso push (código {})", code);
            return PushOutcome.FAILED;
        } catch (RuntimeException exception) {
            log.warn("Error inesperado al enviar un aviso push ({})", exception.getClass().getSimpleName());
            return PushOutcome.FAILED;
        }
    }

    private static FirebaseMessaging createMessaging(PushProperties properties) {
        if (!properties.credentialsConfigured()) {
            log.warn("Avisos push desactivados: no hay FIREBASE_CREDENTIALS_PATH ni FIREBASE_CREDENTIALS_JSON. "
                    + "La app sigue funcionando con el sondeo de avisos.");
            return null;
        }
        try {
            byte[] json = properties.credentialsJson().isEmpty()
                    ? Files.readAllBytes(Path.of(properties.credentialsPath()))
                    : properties.credentialsJson().getBytes(StandardCharsets.UTF_8);
            GoogleCredentials credentials = GoogleCredentials.fromStream(new ByteArrayInputStream(json));
            FirebaseApp app = FirebaseApp.getApps().stream()
                    .filter(existing -> APP_NAME.equals(existing.getName()))
                    .findFirst()
                    .orElseGet(() -> FirebaseApp.initializeApp(
                            FirebaseOptions.builder().setCredentials(credentials).build(), APP_NAME));
            return FirebaseMessaging.getInstance(app);
        } catch (Exception exception) {
            // No se registra el mensaje de la excepción: puede contener la ruta o fragmentos del JSON.
            log.warn("Avisos push desactivados: las credenciales de Firebase no se pudieron cargar ({})",
                    exception.getClass().getSimpleName());
            return null;
        }
    }
}
