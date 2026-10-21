import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/upload_rules.dart';
import '../../core/widgets/state_views.dart';

class ScanDocumentPage extends StatefulWidget {
  const ScanDocumentPage({super.key, required this.api, this.initialJobId});

  final AuthApi api;
  final String? initialJobId;

  @override
  State<ScanDocumentPage> createState() => _ScanDocumentPageState();
}

class _ScanDocumentPageState extends State<ScanDocumentPage> with SingleTickerProviderStateMixin {
  final ImagePicker _picker = ImagePicker();
  late final TabController _tabController;

  File? _selectedFile;
  bool _isProcessing = false;
  int _elapsedSeconds = 0;
  Timer? _timer;

  Map<String, dynamic>? _currentJob;
  String? _errorMessage;
  bool _actionBusy = false;

  List<Map<String, dynamic>> _recentJobs = [];
  bool _loadingRecent = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadRecentJobs();
    if (widget.initialJobId != null) {
      _loadJob(widget.initialJobId!);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _tabController.dispose();
    super.dispose();
  }

  void _startTimer() {
    _timer?.cancel();
    _elapsedSeconds = 0;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _elapsedSeconds++);
    });
  }

  void _stopTimer() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final picked = await _picker.pickImage(
        source: source,
        maxWidth: 2048,
        maxHeight: 2048,
        imageQuality: 85,
      );
      if (picked == null) return;

      final file = File(picked.path);
      final size = await file.length();
      if (size > UploadRules.maxBytes) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('La imagen supera el límite permitido de 25 MB.')),
        );
        return;
      }

      setState(() {
        _selectedFile = file;
        _currentJob = null;
        _errorMessage = null;
      });

      await _processImage();
    } catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = 'No se pudo acceder a la cámara o imagen: $e');
    }
  }

  Future<void> _processImage() async {
    if (_selectedFile == null) return;

    setState(() {
      _isProcessing = true;
      _errorMessage = null;
    });
    _startTimer();

    try {
      final fileName = _selectedFile!.path.split(Platform.pathSeparator).last;
      final result = await widget.api.ocr.processFile(
        filePath: _selectedFile!.path,
        fileName: fileName,
      );

      if (!mounted) return;
      setState(() {
        _currentJob = result;
        if (result['status'] == 'FAILED') {
          _errorMessage = result['errorMessage'] as String? ?? 'La extracción OCR falló al procesar el archivo.';
        }
      });
      _loadRecentJobs();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = e.message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _errorMessage = 'Error inesperado al conectar con el servidor OCR: $e');
    } finally {
      _stopTimer();
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  Future<void> _loadJob(String id) async {
    setState(() {
      _isProcessing = true;
      _errorMessage = null;
    });
    try {
      final job = await widget.api.ocr.getJob(id);
      if (mounted) {
        setState(() {
          _currentJob = job;
          _selectedFile = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  Future<void> _loadRecentJobs() async {
    setState(() => _loadingRecent = true);
    try {
      final list = await widget.api.ocr.recentJobs();
      if (mounted) setState(() => _recentJobs = list);
    } catch (_) {
      // informativo
    } finally {
      if (mounted) setState(() => _loadingRecent = false);
    }
  }

  Future<void> _validateCurrentJob() async {
    final jobId = _currentJob?['id'] as String?;
    if (jobId == null) return;

    setState(() => _actionBusy = true);
    try {
      final updated = await widget.api.ocr.validate(jobId);
      if (!mounted) return;
      setState(() => _currentJob = updated);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xff065f46),
          content: Text('✓ Digitalización validada exitosamente.'),
        ),
      );
      _loadRecentJobs();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(backgroundColor: const Color(0xff991b1b), content: Text('Error: ${e.message}')),
      );
    } finally {
      if (mounted) setState(() => _actionBusy = false);
    }
  }

  Future<void> _rejectCurrentJob() async {
    final jobId = _currentJob?['id'] as String?;
    if (jobId == null) return;

    final reasonController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Rechazar digitalización'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Indique el motivo por el cual la extracción no es válida:'),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              decoration: const InputDecoration(
                hintText: 'Ej. Imagen ilegible o datos incompletos',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xffdc2626)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Rechazar'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() => _actionBusy = true);
    try {
      final updated = await widget.api.ocr.reject(jobId, reason: reasonController.text);
      if (!mounted) return;
      setState(() => _currentJob = updated);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Digitalización marcada como rechazada.')),
      );
      _loadRecentJobs();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(backgroundColor: const Color(0xff991b1b), content: Text('Error: ${e.message}')),
      );
    } finally {
      if (mounted) setState(() => _actionBusy = false);
    }
  }

  Future<void> _openIndexModal() async {
    final jobId = _currentJob?['id'] as String?;
    if (jobId == null) return;

    final types = await widget.api.ocr.documentTypes();
    if (!mounted) return;

    if (types.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No hay tipos documentales configurados en la organización.')),
      );
      return;
    }

    String selectedTypeId = types.first['id'] as String;
    final nameCtrl = TextEditingController(text: _currentJob?['documentType'] ?? 'Documento Digitalizado');
    final codeCtrl = TextEditingController();
    final descCtrl = TextEditingController(text: _currentJob?['extractedSummary'] ?? '');

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Indexar en Repositorio', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    IconButton(onPressed: () => Navigator.pop(ctx, false), icon: const Icon(Icons.close)),
                  ],
                ),
                const SizedBox(height: 12),
                const Text('Tipo documental *', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  initialValue: selectedTypeId,
                  isExpanded: true,
                  decoration: const InputDecoration(border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
                  items: [
                    for (final t in types)
                      DropdownMenuItem(
                        value: t['id'] as String,
                        child: Text(t['name'] as String? ?? 'Tipo sin nombre'),
                      ),
                  ],
                  onChanged: (val) {
                    if (val != null) setModalState(() => selectedTypeId = val);
                  },
                ),
                const SizedBox(height: 12),
                const Text('Nombre del documento', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 6),
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(hintText: 'Título descriptivo'),
                ),
                const SizedBox(height: 12),
                const Text('Código documental (opcional)', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 6),
                TextField(
                  controller: codeCtrl,
                  decoration: const InputDecoration(hintText: 'Auto-generado si se deja en blanco'),
                ),
                const SizedBox(height: 12),
                const Text('Descripción / Resumen', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 6),
                TextField(
                  controller: descCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(hintText: 'Detalles del documento'),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(backgroundColor: AppTheme.teal),
                    onPressed: () => Navigator.pop(ctx, true),
                    icon: const Icon(Icons.check_circle_outline),
                    label: const Text('Confirmar e Indexar Documento', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    if (confirmed != true) return;

    setState(() => _actionBusy = true);
    try {
      final updated = await widget.api.ocr.index(
        jobId,
        documentTypeId: selectedTypeId,
        name: nameCtrl.text.trim().isEmpty ? null : nameCtrl.text.trim(),
        code: codeCtrl.text.trim().isEmpty ? null : codeCtrl.text.trim(),
        description: descCtrl.text.trim().isEmpty ? null : descCtrl.text.trim(),
      );

      if (!mounted) return;
      setState(() => _currentJob = updated);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Color(0xff065f46),
          content: Text('✓ ¡Documento indexado con éxito! Ya está disponible en el repositorio web.'),
        ),
      );
      _loadRecentJobs();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(backgroundColor: const Color(0xff991b1b), content: Text('Error al indexar: ${e.message}')),
      );
    } finally {
      if (mounted) setState(() => _actionBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Digitalización con Cámara', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppTheme.teal,
          labelColor: AppTheme.tealDark,
          tabs: const [
            Tab(icon: Icon(Icons.camera_alt_outlined), text: 'Escanear'),
            Tab(icon: Icon(Icons.history), text: 'Historial Reciente'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildScanTab(),
          _buildHistoryTab(),
        ],
      ),
    );
  }

  Widget _buildScanTab() {
    if (_isProcessing) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(
                width: 64,
                height: 64,
                child: CircularProgressIndicator(strokeWidth: 3, color: AppTheme.teal),
              ),
              const SizedBox(height: 24),
              const Text(
                'Analizando documento con IA (Gemini)...',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.ink),
              ),
              const SizedBox(height: 8),
              Text(
                'Extrayendo texto, tipo y entidades (${_elapsedSeconds}s transcurridos)',
                style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
              ),
            ],
          ),
        ),
      );
    }

    if (_errorMessage != null) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xfffef2f2),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xfff87171)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.error_outline, color: Color(0xff991b1b), size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Fallo en la digitalización', style: TextStyle(color: Color(0xff991b1b), fontWeight: FontWeight.bold, fontSize: 15)),
                      const SizedBox(height: 4),
                      Text(_errorMessage!, style: const TextStyle(color: Color(0xff7f1d1d), fontSize: 13)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              if (_selectedFile != null)
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _processImage,
                    icon: const Icon(Icons.refresh),
                    label: const Text('Reintentar'),
                  ),
                ),
              if (_selectedFile != null) const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: AppTheme.teal),
                  onPressed: () => _pickImage(ImageSource.camera),
                  icon: const Icon(Icons.camera_alt),
                  label: const Text('Nueva Foto'),
                ),
              ),
            ],
          ),
        ],
      );
    }

    if (_currentJob != null) {
      return _buildJobResultView();
    }

    return _buildCapturePrompt();
  }

  Widget _buildCapturePrompt() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Card(
          elevation: 0,
          color: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: AppTheme.line),
          ),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: AppTheme.mint.withValues(alpha: 0.5),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.document_scanner, size: 44, color: AppTheme.teal),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Captura de Documentos',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.ink),
                ),
                const SizedBox(height: 8),
                Text(
                  'Fotografía un documento físico para extraer automáticamente su contenido, clasificarlo e indexarlo en el repositorio.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13, height: 1.4),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: AppTheme.teal,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () => _pickImage(ImageSource.camera),
                    icon: const Icon(Icons.camera_alt, size: 22),
                    label: const Text('Usar Cámara Nativa', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.teal,
                      side: const BorderSide(color: AppTheme.teal),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () => _pickImage(ImageSource.gallery),
                    icon: const Icon(Icons.photo_library_outlined),
                    label: const Text('Seleccionar de Galería'),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        const Text('Recomendaciones para mejor precisión:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.ink)),
        const SizedBox(height: 10),
        _tipItem(Icons.wb_sunny_outlined, 'Buena iluminación: Evita sombras directas sobre el texto.'),
        _tipItem(Icons.crop_free, 'Encuadre plano: Asegúrate de que las 4 esquinas sean visibles.'),
        _tipItem(Icons.compress, 'Tamaño optimizado: La app comprime la foto automáticamente para no exceder 25 MB.'),
      ],
    );
  }

  Widget _tipItem(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: AppTheme.teal),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: TextStyle(fontSize: 12, color: Colors.grey.shade700))),
        ],
      ),
      );
  }

  Widget _buildJobResultView() {
    final job = _currentJob!;
    final status = job['status'] as String? ?? 'UNKNOWN';
    final docType = job['documentType'] as String? ?? 'OTRO';
    final confidence = (job['confidence'] as num?)?.toDouble() ?? 0.0;
    final patientName = job['patientName'] as String?;
    final patientDni = job['patientDocumentNumber'] as String?;
    final doctorName = job['doctorName'] as String?;
    final issueDate = job['issueDate'] as String?;
    final summary = job['extractedSummary'] as String?;

    final bool needsReview = docType.toUpperCase() == 'OTRO' || confidence < 0.70 || status == 'REQUIRES_VALIDATION';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_selectedFile != null) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              height: 180,
              width: double.infinity,
              child: Image.file(_selectedFile!, fit: BoxFit.cover),
            ),
          ),
          const SizedBox(height: 14),
        ],

        // Alerta de revisión
        if (needsReview && status != 'INDEXED' && status != 'REJECTED')
          Container(
            padding: const EdgeInsets.all(14),
            margin: const EdgeInsets.only(bottom: 14),
            decoration: BoxDecoration(
              color: const Color(0xfffffbeb),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xfff59e0b)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.warning_amber_rounded, color: Color(0xffb45309), size: 24),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Revisión humana requerida', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xff92400e), fontSize: 14)),
                      const SizedBox(height: 2),
                      Text(
                        docType.toUpperCase() == 'OTRO'
                            ? 'El tipo documental se identificó como "OTRO". Verifica los datos antes de validar.'
                            : 'La confianza de extracción es baja (${(confidence * 100).toStringAsFixed(0)}%). Verifica los campos antes de validar.',
                        style: const TextStyle(color: Color(0xffb45309), fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

        // Tarjeta de estado y metadatos
        Card(
          elevation: 0,
          color: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: AppTheme.line)),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Resultado del Escaneo', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    StatusBadge(_statusLabel(status), tone: _statusTone(status)),
                  ],
                ),
                const Divider(height: 24),
                _fieldRow('Tipo Documental', docType, isHighlight: true),
                _fieldRow('Confianza del Modelo', '${(confidence * 100).toStringAsFixed(1)}%'),
                if (patientName != null && patientName.isNotEmpty)
                  _fieldRow('Paciente', '$patientName ${patientDni != null ? '($patientDni)' : ''}'),
                if (doctorName != null && doctorName.isNotEmpty)
                  _fieldRow('Médico Tratante', doctorName),
                if (issueDate != null && issueDate.isNotEmpty)
                  _fieldRow('Fecha de Emisión', issueDate),
                if (summary != null && summary.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  const Text('Resumen extraído:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Colors.grey)),
                  const SizedBox(height: 4),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: AppTheme.canvas, borderRadius: BorderRadius.circular(8)),
                    child: Text(summary, style: const TextStyle(fontSize: 12, height: 1.4)),
                  ),
                ],
              ],
            ),
          ),
        ),

        const SizedBox(height: 20),

        // Barra de acciones
        if (status == 'REQUIRES_VALIDATION') ...[
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xffb91c1c),
                    side: const BorderSide(color: Color(0xfff87171)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: _actionBusy ? null : _rejectCurrentJob,
                  icon: const Icon(Icons.thumb_down_outlined, size: 20),
                  label: const Text('Rechazar'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppTheme.teal,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: _actionBusy ? null : _validateCurrentJob,
                  icon: _actionBusy
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.thumb_up_outlined, size: 20),
                  label: const Text('Validar'),
                ),
              ),
            ],
          ),
        ] else if (status == 'VALIDATED') ...[
          Container(
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(color: const Color(0xffd1fae5), borderRadius: BorderRadius.circular(8)),
            child: const Row(
              children: [
                Icon(Icons.check_circle, color: Color(0xff065f46), size: 20),
                SizedBox(width: 8),
                Expanded(child: Text('Documento validado. Listo para indexar en el repositorio.', style: TextStyle(color: Color(0xff065f46), fontSize: 12, fontWeight: FontWeight.w600))),
              ],
            ),
          ),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: AppTheme.teal),
              onPressed: _actionBusy ? null : _openIndexModal,
              icon: _actionBusy
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.folder_shared_outlined),
              label: const Text('Indexar en Repositorio', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
            ),
          ),
        ] else if (status == 'INDEXED') ...[
          Container(
            padding: const EdgeInsets.all(14),
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(color: const Color(0xffecfdf5), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xff34d399))),
            child: Row(
              children: [
                const Icon(Icons.task_alt, color: Color(0xff059669), size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('¡Documento Indexado!', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xff065f46))),
                      const SizedBox(height: 2),
                      Text('ID Documento: ${job['documentId'] ?? ''}', style: TextStyle(fontSize: 11, color: Colors.grey.shade700)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: OutlinedButton.icon(
              onPressed: () {
                setState(() {
                  _currentJob = null;
                  _selectedFile = null;
                });
              },
              icon: const Icon(Icons.camera_alt),
              label: const Text('Escanear Otro Documento'),
            ),
          ),
        ],
      ],
    );
  }

  Widget _fieldRow(String label, String value, {bool isHighlight = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 140, child: Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade600))),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isHighlight ? FontWeight.bold : FontWeight.w600,
                color: isHighlight ? AppTheme.tealDark : AppTheme.ink,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryTab() {
    if (_loadingRecent) {
      return const Center(child: CircularProgressIndicator(color: AppTheme.teal));
    }
    if (_recentJobs.isEmpty) {
      return RefreshIndicator(
        onRefresh: _loadRecentJobs,
        child: const EmptyStateView(message: 'No hay digitalizaciones registradas aún.', icon: Icons.history_edu),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadRecentJobs,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _recentJobs.length,
        separatorBuilder: (_, _) => const SizedBox(height: 10),
        itemBuilder: (ctx, i) {
          final job = _recentJobs[i];
          final status = job['status'] as String? ?? 'UNKNOWN';
          final type = job['documentType'] as String? ?? 'Documento';
          final date = job['createdAt'] as String? ?? '';
          final shortDate = date.length >= 10 ? date.substring(0, 10) : date;
          final fileName = job['originalFilename'] as String? ?? job['fileName'] as String? ?? 'archivo';

          return Card(
            elevation: 0,
            color: Colors.white,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: AppTheme.line)),
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              leading: CircleAvatar(
                backgroundColor: AppTheme.mint,
                child: const Icon(Icons.description, color: AppTheme.teal, size: 22),
              ),
              title: Text(type, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              subtitle: Text('$fileName • $shortDate', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              trailing: StatusBadge(_statusLabel(status), tone: _statusTone(status)),
              onTap: () {
                setState(() {
                  _currentJob = job;
                  _selectedFile = null;
                });
                _tabController.animateTo(0);
              },
            ),
          );
        },
      ),
    );
  }

  String _statusLabel(String status) => switch (status) {
    'REQUIRES_VALIDATION' => 'Por validar',
    'VALIDATED' => 'Validado',
    'INDEXED' => 'Indexado',
    'REJECTED' => 'Rechazado',
    'FAILED' => 'Fallido',
    _ => status,
  };

  BadgeTone _statusTone(String status) => switch (status) {
    'INDEXED' => BadgeTone.success,
    'VALIDATED' => BadgeTone.info,
    'REQUIRES_VALIDATION' => BadgeTone.warning,
    'REJECTED' || 'FAILED' => BadgeTone.danger,
    _ => BadgeTone.neutral,
  };
}
