/// Modelo de dominio para documentos en NexoDocs.
/// Cumple con Principio de Responsabilidad Única (SRP) e inmutabilidad.
class DocumentModel {
  const DocumentModel({
    required this.id,
    required this.name,
    required this.code,
    required this.currentVersion,
    required this.status,
    this.documentTypeName,
    this.folderId,
    this.authorName,
    this.createdAt,
    this.updatedAt,
    this.fileSize,
    this.rawJson = const {},
  });

  factory DocumentModel.fromJson(Map<String, dynamic> json) {
    return DocumentModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? 'Sin nombre',
      code: json['code'] as String? ?? '',
      currentVersion: json['currentVersion'] as int? ?? (json['version'] as int? ?? 1),
      status: json['status'] as String? ?? 'DRAFT',
      documentTypeName: json['documentTypeName'] as String? ?? json['type'] as String?,
      folderId: json['folderId'] as String?,
      authorName: json['authorName'] as String? ?? json['createdBy'] as String?,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'] as String) : null,
      updatedAt: json['updatedAt'] != null ? DateTime.tryParse(json['updatedAt'] as String) : null,
      fileSize: json['fileSize'] as String? ?? json['size'] as String?,
      rawJson: json,
    );
  }

  final String id;
  final String name;
  final String code;
  final int currentVersion;
  final String status;
  final String? documentTypeName;
  final String? folderId;
  final String? authorName;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final String? fileSize;
  final Map<String, dynamic> rawJson;

  /// Permite interoperabilidad progresiva con código existente `doc['campo']`.
  dynamic operator [](String key) => rawJson[key];

  bool get isApproved => status.toUpperCase() == 'APPROVED' || status.toUpperCase() == 'APROBADO';
  bool get isReview => status.toUpperCase() == 'IN_REVIEW' || status.toUpperCase() == 'EN_REVISION';
  bool get isDraft => status.toUpperCase() == 'DRAFT' || status.toUpperCase() == 'BORRADOR';
  bool get isRejected => status.toUpperCase() == 'REJECTED' || status.toUpperCase() == 'RECHAZADO';
  bool get isCurrent => status.toUpperCase() == 'CURRENT';

  Map<String, dynamic> toJson() => rawJson.isNotEmpty
      ? rawJson
      : {
          'id': id,
          'name': name,
          'code': code,
          'currentVersion': currentVersion,
          'status': status,
          'documentTypeName': documentTypeName,
          'folderId': folderId,
          'authorName': authorName,
          'createdAt': createdAt?.toIso8601String(),
          'updatedAt': updatedAt?.toIso8601String(),
          'fileSize': fileSize,
        };
}

/// Versión específica de un documento.
class DocumentVersionModel {
  const DocumentVersionModel({
    required this.id,
    required this.versionNumber,
    required this.fileName,
    this.fileSizeBytes,
    this.contentType,
    this.changeReason,
    this.sha256,
    this.createdAt,
    this.uploadedBy,
    this.rawJson = const {},
  });

  factory DocumentVersionModel.fromJson(Map<String, dynamic> json) {
    return DocumentVersionModel(
      id: json['id'] as String? ?? '',
      versionNumber: json['versionNumber'] as int? ?? 1,
      fileName: json['fileName'] as String? ?? 'archivo',
      fileSizeBytes: json['fileSizeBytes'] as int? ?? json['sizeBytes'] as int?,
      contentType: json['contentType'] as String? ?? json['mimeType'] as String?,
      changeReason: json['changeReason'] as String?,
      sha256: json['checksumSha256'] as String? ?? json['sha256'] as String?,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'] as String) : null,
      uploadedBy: json['uploadedBy'] as String?,
      rawJson: json,
    );
  }

  final String id;
  final int versionNumber;
  final String fileName;
  final int? fileSizeBytes;
  final String? contentType;
  final String? changeReason;
  final String? sha256;
  final DateTime? createdAt;
  final String? uploadedBy;
  final Map<String, dynamic> rawJson;

  dynamic operator [](String key) => rawJson[key];

  String get formattedSize {
    if (fileSizeBytes == null) return '';
    final kb = fileSizeBytes! / 1024;
    if (kb < 1024) return '${kb.toStringAsFixed(1)} KB';
    final mb = kb / 1024;
    return '${mb.toStringAsFixed(1)} MB';
  }

  Map<String, dynamic> toJson() => rawJson.isNotEmpty
      ? rawJson
      : {
          'id': id,
          'versionNumber': versionNumber,
          'fileName': fileName,
          'fileSizeBytes': fileSizeBytes,
          'contentType': contentType,
          'changeReason': changeReason,
          'sha256': sha256,
          'createdAt': createdAt?.toIso8601String(),
          'uploadedBy': uploadedBy,
        };
}
