/// Modelo de dominio para pacientes en la extensión clínica de NexoDocs.
class PatientModel {
  const PatientModel({
    required this.id,
    required this.name,
    this.documentId,
    this.age,
    this.bloodType,
    this.lastVisit,
    this.diagnosis,
    this.insurance,
    this.rawJson = const {},
  });

  factory PatientModel.fromJson(Map<String, dynamic> json) {
    // GET /patients (PatientResponse) envía firstName/lastName/documentNumber; name/documentId/ci
    // se mantienen para datos armados en la app y respuestas anteriores.
    final fullName = [json['firstName'], json['lastName']]
        .whereType<String>()
        .map((part) => part.trim())
        .where((part) => part.isNotEmpty)
        .join(' ');
    return PatientModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? (fullName.isEmpty ? 'Sin nombre' : fullName),
      documentId: json['documentId'] as String? ?? json['documentNumber'] as String? ?? json['ci'] as String?,
      age: json['age'] as int?,
      bloodType: json['bloodType'] as String?,
      lastVisit: json['lastVisit'] as String?,
      diagnosis: json['diagnosis'] as String?,
      insurance: json['insurance'] as String?,
      rawJson: json,
    );
  }

  final String id;
  final String name;
  final String? documentId;
  final int? age;
  final String? bloodType;
  final String? lastVisit;
  final String? diagnosis;
  final String? insurance;
  final Map<String, dynamic> rawJson;

  String get fullName => name;
  String get documentNumber => documentId ?? '';
  String get documentType => 'CI';
  String? get bloodGroup => bloodType;

  dynamic operator [](String key) => rawJson[key];

  Map<String, dynamic> toJson() => rawJson.isNotEmpty
      ? rawJson
      : {
          'id': id,
          'name': name,
          'documentId': documentId,
          'age': age,
          'bloodType': bloodType,
          'lastVisit': lastVisit,
          'diagnosis': diagnosis,
          'insurance': insurance,
        };
}
