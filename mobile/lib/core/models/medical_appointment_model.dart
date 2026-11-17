import 'package:flutter/foundation.dart';

/// Modelo de dominio para una cita médica o solicitud de agendamiento ciudadano.
@immutable
class MedicalAppointmentModel {
  const MedicalAppointmentModel({
    required this.id,
    required this.code,
    required this.patientId,
    required this.patientName,
    required this.specialty,
    required this.preferredDate,
    required this.timeSlot,
    required this.reason,
    required this.status,
    required this.createdAt,
    this.doctorName,
  });

  factory MedicalAppointmentModel.fromJson(Map<String, dynamic> json) {
    return MedicalAppointmentModel(
      id: (json['id'] ?? json['referenceId'] ?? '').toString(),
      code: (json['code'] ?? 'CITA-001').toString(),
      patientId: (json['patientId'] ?? '').toString(),
      patientName: (json['patientName'] ?? 'Paciente').toString(),
      specialty: (json['specialty'] ?? json['noteType'] ?? 'Medicina General').toString(),
      preferredDate: (json['preferredDate'] ?? json['occurredAt'] ?? '').toString(),
      timeSlot: (json['timeSlot'] ?? 'Mañana (08:00 - 12:00)').toString(),
      reason: (json['reason'] ?? json['content'] ?? json['description'] ?? 'Consulta médica').toString(),
      status: (json['status'] ?? 'PROGRAMADA').toString(),
      createdAt: DateTime.tryParse((json['createdAt'] ?? json['occurredAt'] ?? '').toString()) ?? DateTime.now(),
      doctorName: json['doctorName'] as String?,
    );
  }

  final String id;
  final String code;
  final String patientId;
  final String patientName;
  final String specialty;
  final String preferredDate;
  final String timeSlot;
  final String reason;
  final String status;
  final DateTime createdAt;
  final String? doctorName;

  String get statusLabel => switch (status.toUpperCase()) {
        'APPROVED' || 'CONFIRMED' || 'PROGRAMADA' => 'Programada',
        'DRAFT' || 'PENDING' || 'SOLICITADA' => 'En confirmación',
        'COMPLETED' || 'ATENDIDA' => 'Atendida',
        'VOIDED' || 'CANCELED' => 'Cancelada',
        _ => status,
      };
}
