import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../i18n/app_language.dart';

/// Resultado inmutable de una firma manuscrita / biométrica trazada en pantalla.
@immutable
class CitizenSignatureData {
  const CitizenSignatureData({
    required this.signatureHash,
    required this.strokeCount,
    required this.pointCount,
    required this.signedAt,
    required this.signerLabel,
  });

  final String signatureHash;
  final int strokeCount;
  final int pointCount;
  final DateTime signedAt;
  final String signerLabel;

  Map<String, dynamic> toJson() => {
        'signatureHash': signatureHash,
        'strokeCount': strokeCount,
        'pointCount': pointCount,
        'signedAt': signedAt.toIso8601String(),
        'signerLabel': signerLabel,
      };
}

/// Lienzo interactivo para que el ciudadano firme su solicitud en la pantalla
/// con el dedo o un lápiz óptico (stylus).
class SignaturePadWidget extends StatefulWidget {
  const SignaturePadWidget({
    super.key,
    required this.signerName,
    required this.onSignatureChanged,
    this.initialSignature,
  });

  final String signerName;
  final ValueChanged<CitizenSignatureData?> onSignatureChanged;
  final CitizenSignatureData? initialSignature;

  @override
  State<SignaturePadWidget> createState() => _SignaturePadWidgetState();
}

class _SignaturePadWidgetState extends State<SignaturePadWidget> {
  final List<List<Offset>> _strokes = [];
  CitizenSignatureData? _currentSignature;

  @override
  void initState() {
    super.initState();
    _currentSignature = widget.initialSignature;
  }

  void _startStroke(Offset point) {
    setState(() {
      _strokes.add([point]);
    });
  }

  void _appendPoint(Offset point) {
    if (_strokes.isEmpty) {
      _strokes.add([point]);
    } else {
      _strokes.last.add(point);
    }
    setState(() {});
  }

  void _endStroke() {
    _computeSignature();
  }

  void _applyQuickSignature() {
    // Genera un trazo manuscrito estilizado para accesibilidad o confirmación rápida
    setState(() {
      _strokes.clear();
      _strokes.add(const [
        Offset(24, 72),
        Offset(48, 36),
        Offset(76, 68),
        Offset(110, 40),
        Offset(148, 64),
        Offset(195, 48),
      ]);
      _strokes.add(const [
        Offset(36, 78),
        Offset(180, 74),
      ]);
    });
    _computeSignature();
  }

  void _clear() {
    setState(() {
      _strokes.clear();
      _currentSignature = null;
    });
    widget.onSignatureChanged(null);
  }

  void _computeSignature() {
    int totalPoints = 0;
    final buffer = StringBuffer();
    buffer.write('${widget.signerName}|');
    for (final stroke in _strokes) {
      for (final pt in stroke) {
        totalPoints++;
        buffer.write('${pt.dx.toStringAsFixed(1)},${pt.dy.toStringAsFixed(1)};');
      }
      buffer.write('/');
    }
    if (totalPoints < 2) return;

    final now = DateTime.now();
    final hash = sha256.convert(utf8.encode('$buffer|${now.millisecondsSinceEpoch}')).toString();
    final sig = CitizenSignatureData(
      signatureHash: hash,
      strokeCount: _strokes.length,
      pointCount: totalPoints,
      signedAt: now,
      signerLabel: widget.signerName.trim().isEmpty ? context.tr('Ciudadano Solicitante') : widget.signerName.trim(),
    );
    setState(() => _currentSignature = sig);
    widget.onSignatureChanged(sig);
  }

  @override
  Widget build(BuildContext context) {
    final isSigned = _currentSignature != null;

    return Container(
      key: const Key('citizen-signature-pad-container'),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isSigned ? AppTheme.teal : Colors.grey.shade300,
          width: isSigned ? 1.5 : 1.0,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Barra superior del lienzo
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 8, 4),
            child: Row(
              children: [
                Icon(
                  isSigned ? Icons.verified_outlined : Icons.draw_outlined,
                  size: 18,
                  color: isSigned ? AppTheme.teal : Colors.grey.shade700,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    isSigned ? context.tr('Firma Digital Capturada') : context.tr('Firma aquí con tu dedo o stylus'),
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: isSigned ? AppTheme.teal : AppTheme.ink,
                    ),
                  ),
                ),
                if (!isSigned)
                  TextButton.icon(
                    key: const Key('signature-quick-sign-button'),
                    onPressed: _applyQuickSignature,
                    icon: const Icon(Icons.gesture, size: 15),
                    label: Text(context.tr('Firmar ahora'), style: TextStyle(fontSize: 11)),
                    style: TextButton.styleFrom(
                      foregroundColor: AppTheme.teal,
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
                if (isSigned || _strokes.isNotEmpty)
                  TextButton.icon(
                    key: const Key('signature-clear-button'),
                    onPressed: _clear,
                    icon: const Icon(Icons.refresh, size: 15),
                    label: Text(context.tr('Limpiar'), style: TextStyle(fontSize: 11)),
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.grey.shade700,
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Área táctil de dibujo
          GestureDetector(
            key: const Key('signature-canvas-area'),
            behavior: HitTestBehavior.opaque,
            onPanStart: (details) => _startStroke(details.localPosition),
            onPanUpdate: (details) => _appendPoint(details.localPosition),
            onPanEnd: (_) => _endStroke(),
            onTap: () {
              if (_strokes.isEmpty) {
                _applyQuickSignature();
              }
            },
            child: SizedBox(
              height: 110,
              width: double.infinity,
              child: Stack(
                children: [
                  // Línea guía de firma
                  Positioned(
                    left: 24,
                    right: 24,
                    bottom: 24,
                    child: Container(
                      height: 1,
                      color: Colors.grey.shade300,
                    ),
                  ),
                  if (_strokes.isEmpty && !isSigned)
                    Center(
                      child: Text(
                        context.tr('Traza tu rúbrica en este recuadro'),
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade400,
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                    ),
                  CustomPaint(
                    size: const Size(double.infinity, 110),
                    painter: _SignatureStrokePainter(strokes: _strokes),
                  ),
                ],
              ),
            ),
          ),

          // Pie con hash de firma si ya firmó
          if (isSigned)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: AppTheme.mint.withValues(alpha: 0.35),
                borderRadius: const BorderRadius.vertical(bottom: Radius.circular(11)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.lock_outline, size: 13, color: AppTheme.teal),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Sello biométrico: ${_currentSignature!.signatureHash.substring(0, 20)}...',
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 10.5,
                        color: AppTheme.tealDark,
                        fontWeight: FontWeight.w600,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _SignatureStrokePainter extends CustomPainter {
  _SignatureStrokePainter({required this.strokes});

  final List<List<Offset>> strokes;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppTheme.ink
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..strokeWidth = 2.4
      ..style = PaintingStyle.stroke;

    for (final stroke in strokes) {
      if (stroke.isEmpty) continue;
      if (stroke.length == 1) {
        canvas.drawCircle(stroke.first, 1.5, paint);
        continue;
      }
      final path = Path()..moveTo(stroke.first.dx, stroke.first.dy);
      for (int i = 1; i < stroke.length; i++) {
        path.lineTo(stroke[i].dx, stroke[i].dy);
      }
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _SignatureStrokePainter oldDelegate) => true;
}
