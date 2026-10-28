package com.lta.gestdocum.backend.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.util.Set;

/**
 * Vigencia y horario de acceso de un usuario (personalización, migración 060). Los días son ISO
 * (1 = lunes ... 7 = domingo); vacío equivale a todos. Una franja con fin anterior al inicio cruza
 * la medianoche y el día que cuenta es el de inicio. Todo se evalúa en la zona horaria del tenant.
 */
public record UserAccessPolicy(LocalDate expiresOn, Set<Integer> weekdays, LocalTime startTime, LocalTime endTime) {

    public static final UserAccessPolicy UNRESTRICTED = new UserAccessPolicy(null, Set.of(), null, null);

    public UserAccessPolicy {
        weekdays = weekdays == null ? Set.of() : Set.copyOf(weekdays);
    }

    /** Motivo del rechazo, o null si el acceso está permitido en ese instante. */
    public String denialReason(ZonedDateTime now) {
        if (expiresOn != null && now.toLocalDate().isAfter(expiresOn)) {
            return "El acceso de este usuario venció el " + expiresOn;
        }
        if (!weekdays.isEmpty() || startTime != null) {
            if (!inSchedule(now)) return "El acceso de este usuario está fuera del horario permitido";
        }
        return null;
    }

    public boolean restricted() {
        return expiresOn != null || !weekdays.isEmpty() || startTime != null;
    }

    private boolean inSchedule(ZonedDateTime now) {
        LocalTime time = now.toLocalTime();
        DayOfWeek day = now.getDayOfWeek();
        if (startTime == null || endTime == null) return allows(day);
        if (startTime.isBefore(endTime)) {
            return allows(day) && !time.isBefore(startTime) && time.isBefore(endTime);
        }
        // Franja nocturna, p. ej. 22:00-06:00: la parte de madrugada pertenece al día anterior.
        if (!time.isBefore(startTime)) return allows(day);
        return time.isBefore(endTime) && allows(day.minus(1));
    }

    private boolean allows(DayOfWeek day) {
        return weekdays.isEmpty() || weekdays.contains(day.getValue());
    }
}
