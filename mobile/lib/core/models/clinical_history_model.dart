import 'package:flutter/foundation.dart';

/// Alergia registrada en la historia clínica.
@immutable
class ClinicalAllergyModel {
  const ClinicalAllergyModel({
    required this.allergen,
    required this.severity,
    this.reaction,
    this.status = 'ACTIVE',
  });

  factory ClinicalAllergyModel.fromJson(Map<String, dynamic> json) {
    return ClinicalAllergyModel(
      allergen: json['allergen'] as String? ?? json['substance'] as String? ?? 'No especificada',
      severity: (json['severity'] as String? ?? 'MODERATE').toUpperCase(),
      reaction: json['reaction'] as String?,
      status: json['status'] as String? ?? 'ACTIVE',
    );
  }

  final String allergen;
  final String severity;
  final String? reaction;
  final String status;

  // El backend y la web usan LOW/MEDIUM/HIGH (ver allergySeverities); SEVERE/MODERATE se aceptan por compatibilidad.
  bool get isSevere => severity == 'HIGH' || severity == 'SEVERE';
  bool get isModerate => severity == 'MEDIUM' || severity == 'MODERATE';
}

/// Medicamento actual prescrito al paciente.
@immutable
class ClinicalMedicationModel {
  const ClinicalMedicationModel({
    required this.medicationName,
    required this.dosage,
    this.frequency,
    this.status = 'ACTIVE',
  });

  factory ClinicalMedicationModel.fromJson(Map<String, dynamic> json) {
    return ClinicalMedicationModel(
      medicationName: json['medicationName'] as String? ?? json['name'] as String? ?? '',
      dosage: json['dosage'] as String? ?? '',
      frequency: json['frequency'] as String?,
      status: json['status'] as String? ?? 'ACTIVE',
    );
  }

  final String medicationName;
  final String dosage;
  final String? frequency;
  final String status;
}

/// Diagnóstico de base (CIE-10 o equivalente).
@immutable
class ClinicalDiagnosisModel {
  const ClinicalDiagnosisModel({
    required this.code,
    required this.description,
    this.status = 'ACTIVE',
    this.diagnosedAt,
  });

  factory ClinicalDiagnosisModel.fromJson(Map<String, dynamic> json) {
    return ClinicalDiagnosisModel(
      code: json['code'] as String? ?? json['cieCode'] as String? ?? '',
      description: json['description'] as String? ?? json['name'] as String? ?? '',
      status: json['status'] as String? ?? 'ACTIVE',
      diagnosedAt: json['diagnosedAt'] != null
          ? DateTime.tryParse(json['diagnosedAt'].toString())
          : null,
    );
  }

  final String code;
  final String description;
  final String status;
  final DateTime? diagnosedAt;
}

/// Nota médica o nota de evolución clínica inmutable.
@immutable
class MedicalNoteModel {
  const MedicalNoteModel({
    required this.id,
    required this.clinicalHistoryId,
    required this.noteType,
    required this.content,
    required this.status,
    required this.createdAt,
    this.authorName,
  });

  factory MedicalNoteModel.fromJson(Map<String, dynamic> json) {
    return MedicalNoteModel(
      id: json['id'] as String? ?? '',
      clinicalHistoryId: json['clinicalHistoryId'] as String? ?? '',
      noteType: json['noteType'] as String? ?? json['type'] as String? ?? 'EVOLUCIÓN',
      content: json['content'] as String? ?? '',
      status: json['status'] as String? ?? 'APPROVED',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      authorName: json['authorName'] as String?,
    );
  }

  final String id;
  final String clinicalHistoryId;
  final String noteType;
  final String content;
  final String status;
  final DateTime createdAt;
  final String? authorName;
}

/// Modelo de dominio completo para la Historia Clínica del Paciente (Clean Architecture).
@immutable
class ClinicalHistoryModel {
  const ClinicalHistoryModel({
    required this.id,
    required this.code,
    required this.patientId,
    required this.patientLabel,
    this.bloodType,
    this.pathologicalAntecedents,
    this.nonPathologicalAntecedents,
    this.familyAntecedents,
    this.chronicConditions,
    this.observations,
    this.allergies = const [],
    this.currentMedications = const [],
    this.baseDiagnoses = const [],
    this.recentNotes = const [],
    this.createdAt,
    this.updatedAt,
  });

  factory ClinicalHistoryModel.fromJson(Map<String, dynamic> json) {
    final rawAllergies = json['allergies'] as List<dynamic>? ?? [];
    final rawMeds = json['currentMedications'] as List<dynamic>? ?? [];
    final rawDiagnoses = json['baseDiagnoses'] as List<dynamic>? ?? [];
    final rawNotes = json['recentNotes'] as List<dynamic>? ?? [];

    return ClinicalHistoryModel(
      id: json['id'] as String? ?? json['clinicalHistoryId'] as String? ?? '',
      code: json['code'] as String? ?? json['historyCode'] as String? ?? 'HC-SIN-CÓDIGO',
      patientId: json['patientId'] as String? ?? '',
      patientLabel: json['patientLabel'] as String? ?? json['patientName'] as String? ?? '',
      bloodType: json['bloodType'] as String?,
      pathologicalAntecedents: json['pathologicalAntecedents'] as String?,
      nonPathologicalAntecedents: json['nonPathologicalAntecedents'] as String?,
      familyAntecedents: json['familyAntecedents'] as String?,
      chronicConditions: json['chronicConditions'] as String?,
      observations: json['observations'] as String?,
      allergies: rawAllergies
          .map((a) => ClinicalAllergyModel.fromJson(a as Map<String, dynamic>))
          .toList(),
      currentMedications: rawMeds
          .map((m) => ClinicalMedicationModel.fromJson(m as Map<String, dynamic>))
          .toList(),
      baseDiagnoses: rawDiagnoses
          .map((d) => ClinicalDiagnosisModel.fromJson(d as Map<String, dynamic>))
          .toList(),
      recentNotes: rawNotes
          .map((n) => MedicalNoteModel.fromJson(n as Map<String, dynamic>))
          .toList(),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())
          : null,
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString())
          : null,
    );
  }

  final String id;
  final String code;
  final String patientId;
  final String patientLabel;
  final String? bloodType;
  final String? pathologicalAntecedents;
  final String? nonPathologicalAntecedents;
  final String? familyAntecedents;
  final String? chronicConditions;
  final String? observations;
  final List<ClinicalAllergyModel> allergies;
  final List<ClinicalMedicationModel> currentMedications;
  final List<ClinicalDiagnosisModel> baseDiagnoses;
  final List<MedicalNoteModel> recentNotes;
  final DateTime? createdAt;
  final DateTime? updatedAt;
}
