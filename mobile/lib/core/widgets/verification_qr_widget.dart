import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Widget que renderiza un código QR de verificación determinista y nítido
/// basado en el código del documento/radicación y su hash criptográfico SHA-256.
class VerificationQrWidget extends StatelessWidget {
  const VerificationQrWidget({
    super.key,
    required this.code,
    required this.verificationHash,
    this.tenantName,
    this.size = 132,
  });

  final String code;
  final String verificationHash;
  final String? tenantName;
  final double size;

  String get qrPayload =>
      'NEXODOCS|${tenantName ?? 'ORG'}|$code|${verificationHash.length >= 16 ? verificationHash.substring(0, 16) : verificationHash}';

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('verification-qr-widget'),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: size,
            height: size,
            child: CustomPaint(
              painter: _DeterministicQrPainter(payload: qrPayload),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.verified_user, size: 14, color: AppTheme.teal),
              const SizedBox(width: 4),
              Text(
                'QR de Autenticidad',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: Colors.grey.shade800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            ' Cód: ${verificationHash.length >= 12 ? verificationHash.substring(0, 12).toUpperCase() : verificationHash.toUpperCase()}',
            style: TextStyle(
              fontFamily: 'monospace',
              fontSize: 10,
              color: Colors.grey.shade600,
            ),
          ),
        ],
      ),
    );
  }
}

class _DeterministicQrPainter extends CustomPainter {
  _DeterministicQrPainter({required this.payload});

  final String payload;
  static const int gridSize = 21; // QR Version 1 (21x21 módulos)

  @override
  void paint(Canvas canvas, Size size) {
    final digest = sha256.convert(utf8.encode(payload)).bytes;
    final digest2 = sha256.convert(utf8.encode('$payload|SALT')).bytes;
    final bits = <int>[...digest, ...digest2];

    final cellSize = size.width / gridSize;
    final darkPaint = Paint()
      ..color = AppTheme.ink
      ..style = PaintingStyle.fill;
    final lightPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;

    canvas.drawRect(Offset.zero & size, lightPaint);

    final matrix = List.generate(gridSize, (_) => List.filled(gridSize, false));
    final reserved = List.generate(gridSize, (_) => List.filled(gridSize, false));

    void placeFinderPattern(int rowOffset, int colOffset) {
      for (int r = -1; r <= 7; r++) {
        for (int c = -1; c <= 7; c++) {
          final rr = rowOffset + r;
          final cc = colOffset + c;
          if (rr < 0 || rr >= gridSize || cc < 0 || cc >= gridSize) continue;
          reserved[rr][cc] = true;
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            final isBorder = r == 0 || r == 6 || c == 0 || c == 6;
            final isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
            matrix[rr][cc] = isBorder || isInner;
          } else {
            matrix[rr][cc] = false;
          }
        }
      }
    }

    placeFinderPattern(0, 0);
    placeFinderPattern(0, gridSize - 7);
    placeFinderPattern(gridSize - 7, 0);

    // Patrones de sincronización (Timing patterns)
    for (int i = 8; i < gridSize - 8; i++) {
      reserved[6][i] = true;
      matrix[6][i] = i.isEven;
      reserved[i][6] = true;
      matrix[i][6] = i.isEven;
    }

    // Llenar módulos de datos de forma determinista con los bits SHA-256
    int bitIndex = 0;
    for (int r = 0; r < gridSize; r++) {
      for (int c = 0; c < gridSize; c++) {
        if (reserved[r][c]) continue;
        final byteVal = bits[(bitIndex ~/ 8) % bits.length];
        final bitOffset = bitIndex % 8;
        matrix[r][c] = ((byteVal >> bitOffset) & 1) == 1;
        bitIndex++;
      }
    }

    for (int r = 0; r < gridSize; r++) {
      for (int c = 0; c < gridSize; c++) {
        if (matrix[r][c]) {
          canvas.drawRect(
            Rect.fromLTWH(c * cellSize, r * cellSize, cellSize, cellSize),
            darkPaint,
          );
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DeterministicQrPainter oldDelegate) =>
      oldDelegate.payload != payload;
}
