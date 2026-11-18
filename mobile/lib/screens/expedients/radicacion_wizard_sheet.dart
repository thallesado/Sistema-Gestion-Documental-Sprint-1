import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/models/expedient_model.dart';
import '../../core/models/radicacion_model.dart';
import '../../core/models/radicacion_receipt_model.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/utils/ocr_field_extractor.dart';
import '../../core/utils/upload_rules.dart';
import '../../core/widgets/signature_pad_widget.dart';
import '../documents/upload_version_sheet.dart';
import 'expedient_detail_sheet.dart';
import 'radicacion_receipt_sheet.dart';
import '../../core/i18n/app_language.dart';

/// Abre la hoja modal para radicar una solicitud formal o PQRS ciudadana.
Future<RadicacionResultModel?> showRadicacionWizardSheet(
  BuildContext context,
  AuthApi api, {
  UploadPicker picker = pickWithDevice,
  OcrRadicacionPreFill? initialOcrPreFill,
}) {
  return showModalBottomSheet<RadicacionResultModel>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => RadicacionWizardSheet(
      api: api,
      picker: picker,
      initialOcrPreFill: initialOcrPreFill,
    ),
  );
}

/// Formulario guiado móvil (Wizard) para radicación digital directa con soporte OCR y firma ciudadana.
class RadicacionWizardSheet extends StatefulWidget {
  const RadicacionWizardSheet({
    super.key,
    required this.api,
    this.picker = pickWithDevice,
    this.initialOcrPreFill,
    this.initialCitizenEmail,
    this.initialCitizenName,
  });

  final AuthApi api;
  final UploadPicker picker;
  final OcrRadicacionPreFill? initialOcrPreFill;
  final String? initialCitizenEmail;
  final String? initialCitizenName;

  @override
  State<RadicacionWizardSheet> createState() => _RadicacionWizardSheetState();
}

class _RadicacionWizardSheetState extends State<RadicacionWizardSheet> {
  int currentStep = 1;
  final _step1FormKey = GlobalKey<FormState>();
  final _step2FormKey = GlobalKey<FormState>();

  // Paso 1: Tipo y Datos del Solicitante
  RadicacionType selectedType = RadicacionType.peticion;
  final nameController = TextEditingController();
  String selectedDocType = 'CC';
  final docNumberController = TextEditingController();
  final emailController = TextEditingController();
  final phoneController = TextEditingController();

  // Paso 2: Asunto y Descripción
  final titleController = TextEditingController();
  final descriptionController = TextEditingController();
  String? selectedExpedientTypeId;
  List<ExpedientTypeModel> expedientTypes = [];
  bool loadingTypes = true;

  // Paso 3: Documento de soporte y Firma Digital
  PickedUpload? pickedAttachment;
  CitizenSignatureData? citizenSignature;
  String? uploadError;
  bool submitting = false;
  String? submitError;
  bool ocrScanning = false;
  String? ocrAppliedLabel;

  @override
  void initState() {
    super.initState();
    if (widget.initialCitizenEmail != null && widget.initialCitizenEmail!.isNotEmpty) {
      emailController.text = widget.initialCitizenEmail!;
    }
    if (widget.initialCitizenName != null && widget.initialCitizenName!.isNotEmpty) {
      nameController.text = widget.initialCitizenName!;
    }
    if (widget.initialOcrPreFill != null) {
      _applyOcrPreFill(widget.initialOcrPreFill!);
    }
    _loadExpedientTypes();
  }

  void _applyOcrPreFill(OcrRadicacionPreFill preFill) {
    selectedType = preFill.radicacionType;
    if (preFill.citizenName.isNotEmpty) {
      nameController.text = preFill.citizenName;
    }
    if (const ['CC', 'TI', 'CE', 'NIT', 'PASAPORTE'].contains(preFill.citizenDocType)) {
      selectedDocType = preFill.citizenDocType;
    }
    if (preFill.citizenDocNumber.isNotEmpty) {
      docNumberController.text = preFill.citizenDocNumber;
    }
    if (preFill.subject.isNotEmpty) {
      titleController.text = preFill.subject;
    }
    if (preFill.description.isNotEmpty) {
      descriptionController.text = preFill.description;
    }
    if (preFill.scannedFilePath != null && preFill.scannedFileName != null) {
      pickedAttachment = PickedUpload(
        path: preFill.scannedFilePath!,
        name: preFill.scannedFileName!,
        sizeBytes: preFill.scannedFileSize ?? 1024,
        isImage: true,
      );
    }
    ocrAppliedLabel = preFill.detectedDocumentClass;
  }

  @override
  void dispose() {
    nameController.dispose();
    docNumberController.dispose();
    emailController.dispose();
    phoneController.dispose();
    titleController.dispose();
    descriptionController.dispose();
    super.dispose();
  }

  Future<void> _loadExpedientTypes() async {
    try {
      final types = await widget.api.expedients.getTypes();
      if (!mounted) return;
      setState(() {
        expedientTypes = types;
        if (types.isNotEmpty) {
          selectedExpedientTypeId = types.first.id;
        }
        loadingTypes = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => loadingTypes = false);
    }
  }

  Future<void> _scanWithOcrForAutofill() async {
    setState(() {
      ocrScanning = true;
      submitError = null;
    });
    try {
      final file = await widget.picker(UploadOrigin.camera);
      if (file == null || !mounted) {
        if (mounted) setState(() => ocrScanning = false);
        return;
      }
      final job = await widget.api.ocr.processFile(
        filePath: file.path,
        fileName: file.name,
      );
      if (!mounted) return;
      final preFill = OcrFieldExtractor.extractFromJob(
        job,
        filePath: file.path,
        fileName: file.name,
        fileSize: file.sizeBytes,
      );
      setState(() {
        _applyOcrPreFill(preFill);
        ocrScanning = false;
      });
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          submitError = e.message;
          ocrScanning = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          submitError = 'No se pudo procesar el escaneo OCR: $e';
          ocrScanning = false;
        });
      }
    }
  }

  Future<void> _pickAttachment(UploadOrigin origin) async {
    setState(() => uploadError = null);
    try {
      final file = await widget.picker(origin);
      if (file == null || !mounted) return;
      if (file.sizeBytes > UploadRules.maxBytes) {
        setState(() => uploadError = context.tr('El archivo supera el límite permitido de 25 MB.'));
        return;
      }
      final mime = UploadRules.mimeFor(file.name);
      if (mime == null) {
        setState(() => uploadError = context.tr('Formato no permitido. Usa PDF, JPG, PNG o DOCX.'));
        return;
      }
      setState(() => pickedAttachment = file);
    } catch (e) {
      if (mounted) setState(() => uploadError = 'No se pudo seleccionar el archivo: $e');
    }
  }

  void _nextStep() {
    if (currentStep == 1) {
      if (!_step1FormKey.currentState!.validate()) return;
      setState(() => currentStep = 2);
    } else if (currentStep == 2) {
      if (!_step2FormKey.currentState!.validate()) return;
      if (selectedExpedientTypeId == null) {
        setState(() => submitError = context.tr('Selecciona una categoría o tipo de expediente.'));
        return;
      }
      setState(() {
        submitError = null;
        currentStep = 3;
      });
    }
  }

  void _prevStep() {
    if (currentStep > 1) {
      setState(() => currentStep--);
    }
  }

  Future<void> _submitRadicacion() async {
    setState(() {
      submitting = true;
      submitError = null;
    });

    try {
      final request = RadicacionRequestModel(
        type: selectedType,
        title: titleController.text.trim(),
        description: descriptionController.text.trim(),
        expedientTypeId: selectedExpedientTypeId ?? 'default-type',
        citizen: RadicacionCitizenModel(
          name: nameController.text.trim(),
          docType: selectedDocType,
          docNumber: docNumberController.text.trim(),
          email: emailController.text.trim(),
          phone: phoneController.text.trim(),
        ),
        attachment: pickedAttachment != null
            ? RadicacionAttachmentModel(
                path: pickedAttachment!.path,
                name: pickedAttachment!.name,
                sizeBytes: pickedAttachment!.sizeBytes,
                isImage: pickedAttachment!.isImage,
              )
            : null,
        signatureHash: citizenSignature?.signatureHash,
      );

      final result = await widget.api.expedients.radicarSolicitud(request);

      if (!mounted) return;
      Navigator.of(context).pop(result);
    } on ApiException catch (e) {
      if (mounted) setState(() => submitError = e.message);
    } catch (e) {
      if (mounted) setState(() => submitError = tr('Error al radicar solicitud: {error}', {'error': e}));
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          title: Text(context.tr('Buzón de Radicación Digital'), style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
          backgroundColor: Colors.white,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => Navigator.of(context).pop(),
          ),
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(40),
            child: _stepProgressIndicator(),
          ),
        ),
        body: ListView(
          controller: scrollController,
          padding: EdgeInsets.fromLTRB(20, 16, 20, bottomInset + 24),
          children: [
            if (submitting || ocrScanning) const LinearProgressIndicator(color: AppTheme.teal),
            if (ocrAppliedLabel != null)
              Container(
                key: const Key('radicacion-ocr-applied-banner'),
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppTheme.mint.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppTheme.teal.withValues(alpha: 0.4)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.auto_awesome, size: 18, color: AppTheme.teal),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        tr('Campos autocompletados por OCR ({fields})', {'fields': ocrAppliedLabel}),
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.tealDark),
                      ),
                    ),
                  ],
                ),
              ),
            if (submitError != null)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Text(submitError!, style: TextStyle(color: Colors.red.shade800, fontSize: 13)),
              ),
            if (currentStep == 1) _step1() else if (currentStep == 2) _step2() else _step3(),
          ],
        ),
        bottomNavigationBar: _navigationBar(),
      ),
    );
  }

  Widget _stepProgressIndicator() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Row(
        children: [
          _stepDot(1, context.tr('Solicitud')),
          _stepLine(currentStep >= 2),
          _stepDot(2, context.tr('Detalle')),
          _stepLine(currentStep >= 3),
          _stepDot(3, context.tr('Soporte')),
        ],
      ),
    );
  }

  Widget _stepDot(int step, String label) {
    final isActive = currentStep == step;
    final isDone = currentStep > step;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircleAvatar(
          radius: 12,
          backgroundColor: isDone ? AppTheme.teal : (isActive ? AppTheme.mint : Colors.grey.shade200),
          child: isDone
              ? const Icon(Icons.check, size: 14, color: Colors.white)
              : Text('$step', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: isActive ? AppTheme.teal : Colors.grey.shade600)),
        ),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(fontSize: 12, fontWeight: isActive ? FontWeight.bold : FontWeight.normal, color: isActive ? AppTheme.ink : Colors.grey.shade600)),
      ],
    );
  }

  Widget _stepLine(bool active) {
    return Expanded(
      child: Container(
        height: 2,
        margin: const EdgeInsets.symmetric(horizontal: 6),
        color: active ? AppTheme.teal : Colors.grey.shade200,
      ),
    );
  }

  // --- PASO 1: Tipo y Datos del Solicitante ---
  Widget _step1() {
    return Form(
      key: _step1FormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Acción rápida de autocompletado OCR para evitar tecleo manual
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              key: const Key('radicacion-ocr-autofill-button'),
              onPressed: ocrScanning ? null : _scanWithOcrForAutofill,
              icon: const Icon(Icons.document_scanner_outlined, size: 17),
              label: Text(
                ocrScanning ? context.tr('Escaneando documento...') : context.tr('Escanear cédula / factura (OCR)'),
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              ),
              style: TextButton.styleFrom(
                foregroundColor: AppTheme.teal,
                visualDensity: VisualDensity.compact,
              ),
            ),
          ),
          Text(context.tr('Tipo de radicación / PQRS'), style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.ink)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: RadicacionType.values.map((t) {
              final isSel = selectedType == t;
              return ChoiceChip(
                key: Key('radicacion-type-${t.code}'),
                label: Text(t.label),
                selected: isSel,
                onSelected: (_) => setState(() => selectedType = t),
                selectedColor: AppTheme.mint,
                backgroundColor: Colors.grey.shade100,
                labelStyle: TextStyle(color: isSel ? AppTheme.teal : Colors.grey.shade800, fontWeight: isSel ? FontWeight.bold : FontWeight.normal),
                side: BorderSide(color: isSel ? AppTheme.teal : Colors.grey.shade300),
              );
            }).toList(),
          ),
          const SizedBox(height: 8),
          Text(selectedType.description, style: TextStyle(fontSize: 12, color: Colors.grey.shade600, fontStyle: FontStyle.italic)),
          const SizedBox(height: 18),
          Text(context.tr('Datos del solicitante'), style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.ink)),
          const SizedBox(height: 10),
          TextFormField(
            key: const Key('radicacion-citizen-name'),
            controller: nameController,
            decoration: InputDecoration(labelText: context.tr('Nombre completo o Razón Social *')),
            validator: (val) => val == null || val.trim().isEmpty ? context.tr('Ingresa tu nombre') : null,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              SizedBox(
                width: 120,
                child: DropdownButtonFormField<String>(
                  initialValue: selectedDocType,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: context.tr('Tipo Doc.'),
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'CC', child: Text('CC')),
                    DropdownMenuItem(value: 'TI', child: Text('TI')),
                    DropdownMenuItem(value: 'CE', child: Text('CE')),
                    DropdownMenuItem(value: 'NIT', child: Text('NIT')),
                    DropdownMenuItem(value: 'PASAPORTE', child: Text('PAS')),
                  ],
                  onChanged: (v) => setState(() => selectedDocType = v ?? 'CC'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextFormField(
                  key: const Key('radicacion-citizen-doc'),
                  controller: docNumberController,
                  decoration: InputDecoration(labelText: context.tr('Número de documento *')),
                  keyboardType: TextInputType.text,
                  validator: (val) => val == null || val.trim().isEmpty ? context.tr('Número obligatorio') : null,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextFormField(
            key: const Key('radicacion-citizen-email'),
            controller: emailController,
            decoration: InputDecoration(labelText: context.tr('Correo electrónico de contacto *')),
            keyboardType: TextInputType.emailAddress,
            validator: (val) => val == null || !val.contains('@') ? context.tr('Ingresa un correo válido') : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            key: const Key('radicacion-citizen-phone'),
            controller: phoneController,
            decoration: InputDecoration(labelText: context.tr('Teléfono de contacto')),
            keyboardType: TextInputType.phone,
          ),
        ],
      ),
    );
  }

  // --- PASO 2: Asunto y Descripción ---
  Widget _step2() {
    return Form(
      key: _step2FormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(context.tr('Detalle de la solicitud'), style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.ink)),
          const SizedBox(height: 12),
          TextFormField(
            key: const Key('radicacion-title-input'),
            controller: titleController,
            decoration: InputDecoration(
              labelText: context.tr('Asunto de la solicitud *'),
              hintText: context.tr('Ej. Solicitud de certificado de paz y salvo'),
            ),
            validator: (val) => val == null || val.trim().isEmpty ? context.tr('Ingresa el asunto') : null,
          ),
          const SizedBox(height: 14),
          if (loadingTypes)
            const Center(child: Padding(padding: EdgeInsets.all(8), child: CircularProgressIndicator(color: AppTheme.teal)))
          else if (expedientTypes.isNotEmpty)
            DropdownButtonFormField<String>(
              key: const Key('radicacion-expedient-type-select'),
              initialValue: selectedExpedientTypeId,
              decoration: InputDecoration(labelText: context.tr('Tipo de trámite / expediente *')),
              items: expedientTypes.map((t) => DropdownMenuItem(value: t.id, child: Text(t.name))).toList(),
              onChanged: (v) => setState(() => selectedExpedientTypeId = v),
            ),
          const SizedBox(height: 14),
          TextFormField(
            key: const Key('radicacion-description-input'),
            controller: descriptionController,
            decoration: InputDecoration(
              labelText: context.tr('Descripción detallada de la solicitud *'),
              hintText: context.tr('Explica con claridad los hechos o petición...'),
            ),
            maxLines: 5,
            validator: (val) => val == null || val.trim().length < 10 ? context.tr('Describe la solicitud (mínimo 10 caracteres)') : null,
          ),
        ],
      ),
    );
  }

  // --- PASO 3: Soporte, Resumen y Firma Digital ---
  Widget _step3() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(context.tr('Documento de soporte (Opcional)'), style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.ink)),
        const SizedBox(height: 6),
        Text(context.tr('Puedes adjuntar un documento PDF o tomar una fotografía como evidencia de tu solicitud.'), style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
        const SizedBox(height: 14),
        if (pickedAttachment == null) ...[
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  key: const Key('radicacion-pick-camera'),
                  onPressed: submitting ? null : () => _pickAttachment(UploadOrigin.camera),
                  icon: const Icon(Icons.camera_alt_outlined, size: 18),
                  label: Text(context.tr('Tomar foto')),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.teal,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  key: const Key('radicacion-pick-file'),
                  onPressed: submitting ? null : () => _pickAttachment(UploadOrigin.file),
                  icon: const Icon(Icons.attach_file, size: 18),
                  label: Text(context.tr('Documento')),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.teal,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ),
          if (uploadError != null) ...[
            const SizedBox(height: 8),
            Text(uploadError!, style: TextStyle(color: Colors.red.shade700, fontSize: 12)),
          ],
        ] else ...[
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10), side: BorderSide(color: AppTheme.teal.withValues(alpha: 0.4))),
            color: AppTheme.mint.withValues(alpha: 0.2),
            child: ListTile(
              leading: Icon(pickedAttachment!.isImage ? Icons.image : Icons.picture_as_pdf, color: AppTheme.teal),
              title: Text(pickedAttachment!.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              subtitle: Text(formatBytes(pickedAttachment!.sizeBytes)),
              trailing: IconButton(
                icon: const Icon(Icons.close, color: Colors.grey),
                onPressed: submitting ? null : () => setState(() => pickedAttachment = null),
              ),
            ),
          ),
        ],
        const SizedBox(height: 18),
        Text(context.tr('Resumen de radicación'), style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.ink)),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.grey.shade50,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _summaryRow(context.tr('Tipo:'), selectedType.label),
              _summaryRow('Solicitante:', '${nameController.text.trim()} ($selectedDocType ${docNumberController.text.trim()})'),
              _summaryRow('Contacto:', emailController.text.trim()),
              _summaryRow('Asunto:', titleController.text.trim()),
              _summaryRow(context.tr('Soporte:'), pickedAttachment != null ? pickedAttachment!.name : context.tr('Sin archivo adjunto')),
              _summaryRow(context.tr('Firma:'), citizenSignature != null ? context.tr('Rúbrica digital registrada') : context.tr('Pendiente o sello de ventanilla')),
            ],
          ),
        ),
        const SizedBox(height: 18),
        Text(context.tr('Firma Digital del Solicitante'), style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.ink)),
        const SizedBox(height: 6),
        SignaturePadWidget(
          signerName: nameController.text.trim(),
          initialSignature: citizenSignature,
          onSignatureChanged: (sig) => setState(() => citizenSignature = sig),
        ),
      ],
    );
  }

  Widget _summaryRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 80, child: Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade600))),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.ink))),
        ],
      ),
    );
  }

  Widget _navigationBar() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 14),
        child: Row(
          children: [
            if (currentStep > 1)
              OutlinedButton(
                onPressed: submitting ? null : _prevStep,
                child: Text(context.tr('Anterior')),
              ),
            if (currentStep > 1) const SizedBox(width: 12),
            Expanded(
              child: FilledButton(
                key: Key(currentStep == 3 ? 'radicacion-submit-button' : 'radicacion-next-button'),
                style: FilledButton.styleFrom(backgroundColor: AppTheme.teal, padding: const EdgeInsets.symmetric(vertical: 14)),
                onPressed: submitting ? null : (currentStep == 3 ? _submitRadicacion : _nextStep),
                child: Text(currentStep == 3 ? context.tr('Radicar Solicitud Digital') : context.tr('Continuar')),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Diálogo de comprobante de radicación con código único copiable.
Future<void> showRadicacionSuccessDialog(
  BuildContext context,
  AuthApi api,
  RadicacionResultModel result,
) {
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: AppTheme.mint.withValues(alpha: 0.4), shape: BoxShape.circle),
            child: const Icon(Icons.check_circle, size: 48, color: AppTheme.teal),
          ),
          const SizedBox(height: 16),
          Text(context.tr('¡Radicación Exitosa!'), style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.ink)),
          const SizedBox(height: 8),
          Text(
            context.tr('Tu solicitud ha sido radicada formalmente. Conserva tu número de radicación para consultar su avance.'),
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: Colors.grey),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  result.expedientCode,
                  key: const Key('radicacion-success-code'),
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.teal, letterSpacing: 0.5),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.copy, size: 18, color: AppTheme.teal),
                  tooltip: context.tr('Copiar código'),
                  onPressed: () {
                    try {
                      Clipboard.setData(ClipboardData(text: result.expedientCode));
                    } catch (_) {}
                    ScaffoldMessenger.of(ctx).showSnackBar(
                      SnackBar(content: Text(context.tr('Código copiado al portapapeles.'))),
                    );
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            formatDate(result.createdAt, withTime: true),
            style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: Text(context.tr('Cerrar')),
        ),
        OutlinedButton.icon(
          key: const Key('radicacion-view-receipt-button'),
          icon: const Icon(Icons.receipt_long, size: 16),
          label: Text(context.tr('Comprobante')),
          style: OutlinedButton.styleFrom(foregroundColor: AppTheme.teal),
          onPressed: () {
            Navigator.of(ctx).pop();
            final receipt = RadicacionReceiptModel.fromParameters(
              code: result.expedientCode,
              tenantName: context.tr('Entidad Receptora'),
              radicacionType: context.tr('Solicitud Formal Radicada'),
              subject: result.expedientName,
              citizenName: context.tr('Solicitante Registrado'),
              citizenDocumentType: 'CC',
              citizenDocumentNumber: context.tr('Consultar en detalle'),
              citizenEmail: context.tr('Registrado en sistema'),
              timestamp: DateTime.tryParse(result.createdAt) ?? DateTime.now(),
              signatureHash: result.signatureHash,
            );
            showRadicacionReceiptSheet(context, receipt);
          },
        ),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: AppTheme.teal),
          onPressed: () {
            Navigator.of(ctx).pop();
            showExpedientDetailSheet(context, api, result.expedientId);
          },
          child: Text(context.tr('Ver radicación')),
        ),
      ],
    ),
  );
}
