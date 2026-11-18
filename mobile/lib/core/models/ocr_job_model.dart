/// Modelo de dominio para trabajos de OCR / Digitalización.
class OcrJobModel {
  const OcrJobModel({
    required this.id,
    required this.status,
    this.fileName,
    this.fileSizeBytes,
    this.extractedText,
    this.confidence,
    this.errorMessage,
    this.createdAt,
    this.completedAt,
    this.rawJson = const {},
  });

  factory OcrJobModel.fromJson(Map<String, dynamic> json) {
    return OcrJobModel(
      id: json['id'] as String? ?? json['jobId'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      fileName: json['fileName'] as String? ?? json['filename'] as String?,
      fileSizeBytes: json['fileSizeBytes'] as int?,
      extractedText: json['extractedText'] as String? ?? json['text'] as String?,
      confidence: (json['confidence'] as num?)?.toDouble(),
      errorMessage: json['errorMessage'] as String? ?? json['error'] as String?,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'] as String) : null,
      completedAt: json['completedAt'] != null ? DateTime.tryParse(json['completedAt'] as String) : null,
      rawJson: json,
    );
  }

  final String id;
  final String status;
  final String? fileName;
  final int? fileSizeBytes;
  final String? extractedText;
  final double? confidence;
  final String? errorMessage;
  final DateTime? createdAt;
  final DateTime? completedAt;
  final Map<String, dynamic> rawJson;

  dynamic operator [](String key) => rawJson[key];

  bool get isCompleted => status.toUpperCase() == 'COMPLETED' || status.toUpperCase() == 'SUCCESS';
  bool get isProcessing => status.toUpperCase() == 'PROCESSING' || status.toUpperCase() == 'IN_PROGRESS';
  bool get isFailed => status.toUpperCase() == 'FAILED' || status.toUpperCase() == 'ERROR';
  bool get isPending => status.toUpperCase() == 'PENDING';

  Map<String, dynamic> toJson() => rawJson.isNotEmpty
      ? rawJson
      : {
          'id': id,
          'status': status,
          'fileName': fileName,
          'fileSizeBytes': fileSizeBytes,
          'extractedText': extractedText,
          'confidence': confidence,
          'errorMessage': errorMessage,
        };
}
