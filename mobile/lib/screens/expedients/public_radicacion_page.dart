import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/api/auth_api.dart';
import '../../core/api/expedients_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/models/patient_model.dart';
import '../../core/models/public_radicacion_model.dart';
import '../../core/models/radicacion_receipt_model.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../patients/patient_appointments_sheet.dart';
import 'radicacion_receipt_sheet.dart';
import 'radicacion_wizard_sheet.dart';
import '../../core/i18n/app_language.dart';

/// Pantalla pública de consulta de radicación y trámites ciudadanos (modo externo / sin login).
const defaultPublicTenantsMap = [
  {'id': '20000000-0000-0000-0000-000000000001', 'name': 'FinoCode'},
  {'id': '20000000-0000-0000-0000-000000000002', 'name': 'Clínica Central'},
];

class PublicRadicacionPage extends StatefulWidget {
  const PublicRadicacionPage({
    super.key,
    required this.client,
    this.authApi,
    this.initialEmail,
    this.initialTenantId,
  });

  final ApiClient client;
  final AuthApi? authApi;
  final String? initialEmail;
  final String? initialTenantId;

  @override
  State<PublicRadicacionPage> createState() => _PublicRadicacionPageState();
}

class _PublicRadicacionPageState extends State<PublicRadicacionPage> {
  late final ExpedientsApi _expedientsApi;
  late final AuthApi _authApi = widget.authApi ?? AuthApi.withClient(widget.client);
  final TextEditingController _codeController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  List<Map<String, dynamic>> _tenants = List.of(defaultPublicTenantsMap);
  String? _selectedTenantId = '20000000-0000-0000-0000-000000000001';
  bool _loadingTenants = true;

  bool _searching = false;
  String? _searchError;
  PublicRadicacionModel? _radicacionResult;

  @override
  void initState() {
    super.initState();
    _expedientsApi = ExpedientsApi(widget.client);
    if (widget.initialTenantId != null) {
      _selectedTenantId = widget.initialTenantId;
    }
    _loadPublicTenants();
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _loadPublicTenants() async {
    try {
      final res = await widget.client.get('/tenants/public') as List<dynamic>;
      final list = res.cast<Map<String, dynamic>>();
      if (mounted) {
        setState(() {
          if (list.isNotEmpty) {
            _tenants = list;
          }
          _loadingTenants = false;
          if (_selectedTenantId == null || !_tenants.any((t) => t['id'] == _selectedTenantId)) {
            _selectedTenantId = _tenants.isNotEmpty ? _tenants.first['id'] as String : null;
          }
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingTenants = false);
    }
  }

  Future<void> _consultar() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedTenantId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.tr('Por favor selecciona una entidad u organización.'))),
      );
      return;
    }

    setState(() {
      _searching = true;
      _searchError = null;
      _radicacionResult = null;
    });

    try {
      final result = await _expedientsApi.consultarRadicacionPublica(
        tenantId: _selectedTenantId!,
        code: _codeController.text.trim(),
      );
      if (mounted) {
        setState(() {
          _radicacionResult = result;
          _searching = false;
        });
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _searchError = e.message.isNotEmpty
              ? e.message
              : context.tr('No se encontró ningún trámite con ese código en la entidad seleccionada.');
          _searching = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _searchError = context.tr('Error de conexión. Verifica el código e inténtalo de nuevo.');
          _searching = false;
        });
      }
    }
  }

  void _abrirComprobante(PublicRadicacionModel rad) {
    final receipt = RadicacionReceiptModel.fromParameters(
      code: rad.code,
      tenantName: rad.tenantName,
      radicacionType: rad.type,
      subject: rad.subject,
      citizenName: rad.citizenName,
      citizenDocumentType: context.tr('Documento'),
      citizenDocumentNumber: context.tr('Registrado en sistema'),
      citizenEmail: context.tr('Consulta pública'),
      timestamp: rad.createdAt,
    );
    showRadicacionReceiptSheet(context, receipt);
  }

  void _openAppointments() {
    final docController = TextEditingController(text: '');
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            Icon(Icons.calendar_month, color: AppTheme.teal),
            SizedBox(width: 8),
            Text(context.tr('Citas Médicas'), style: TextStyle(fontSize: 17)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              context.tr('Ingresa tu Cédula o Documento de Identidad para consultar o solicitar tu cita en Clínica Central.'),
              style: TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: docController,
              decoration: InputDecoration(
                labelText: context.tr('Documento / Cédula'),
                hintText: context.tr('Ej. 10203040'),
                prefixIcon: Icon(Icons.badge_outlined),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(context.tr('Cancelar')),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppTheme.teal),
            onPressed: () {
              final doc = docController.text.trim();
              if (doc.isEmpty) return;
              Navigator.pop(ctx);
              final patient = PatientModel(
                id: doc,
                name: _radicacionResult?.citizenName ?? (widget.initialEmail != null ? tr('Paciente ({email})', {'email': widget.initialEmail}) : tr('Paciente {doc}', {'doc': doc})),
                documentId: doc,
              );
              showPatientAppointmentsSheet(context, _authApi.clinical, patient);
            },
            child: Text(context.tr('Consultar Citas')),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: Text(context.tr('Consulta de Trámites'), style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          // Banner de bienvenida
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppTheme.teal, AppTheme.teal.withValues(alpha: 0.8)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.manage_search, color: Colors.white, size: 32),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        context.tr('Ventanilla Ciudadana'),
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      SizedBox(height: 4),
                      Text(
                        context.tr('Digita tu número de radicación para consultar el estado y respuestas de tu solicitud.'),
                        style: TextStyle(color: Colors.white70, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          if (widget.initialEmail != null && widget.initialEmail!.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppTheme.teal.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.teal.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.verified_user_outlined, color: AppTheme.teal, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Portal Ciudadano: ${widget.initialEmail}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.ink),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],

          // Acciones directas ciudadanas
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  key: const Key('public-radicar-action-button'),
                  onPressed: () => showModalBottomSheet<void>(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => RadicacionWizardSheet(
                      api: _authApi,
                      initialCitizenEmail: widget.initialEmail,
                    ),
                  ),
                  icon: const Icon(Icons.edit_document, size: 18),
                  label: Text(context.tr('Radicar PQRS'), style: TextStyle(fontSize: 13)),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppTheme.teal,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  key: const Key('public-citas-action-button'),
                  onPressed: _openAppointments,
                  icon: const Icon(Icons.calendar_month_outlined, size: 18, color: AppTheme.teal),
                  label: Text(context.tr('Mis Citas'), style: TextStyle(fontSize: 13, color: AppTheme.teal)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppTheme.teal),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Formulario de búsqueda
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: BorderSide(color: Colors.grey.shade300),
            ),
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      context.tr('Consultar Radicación'),
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.ink),
                    ),
                    const SizedBox(height: 14),

                    // Selector de entidad / tenant
                    if (_loadingTenants)
                      const LinearProgressIndicator(color: AppTheme.teal)
                    else ...[
                      DropdownButtonFormField<String>(
                        key: const Key('public-radicacion-tenant-dropdown'),
                        initialValue: _selectedTenantId,
                        decoration: InputDecoration(
                          labelText: context.tr('Entidad / Organización *'),
                          filled: true,
                          fillColor: Colors.grey.shade100,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        ),
                        isExpanded: true,
                        items: [
                          ..._tenants.map((t) {
                            return DropdownMenuItem<String>(
                              value: t['id'] as String,
                              child: Text(t['name'] as String, maxLines: 1, overflow: TextOverflow.ellipsis),
                            );
                          }),
                          if (_selectedTenantId != null && !_tenants.any((t) => t['id'] == _selectedTenantId))
                            DropdownMenuItem<String>(
                              value: _selectedTenantId!,
                              child: Text(_selectedTenantId!),
                            ),
                        ],
                        onChanged: (val) {
                          setState(() {
                            _selectedTenantId = val;
                          });
                        },
                      ),
                    ],
                    const SizedBox(height: 14),

                    // Input de código
                    TextFormField(
                      key: const Key('public-radicacion-code-input'),
                      controller: _codeController,
                      textCapitalization: TextCapitalization.characters,
                      decoration: InputDecoration(
                        labelText: context.tr('Número de Radicación *'),
                        hintText: context.tr('Ej. RAD-2026-000001'),
                        prefixIcon: const Icon(Icons.qr_code, color: AppTheme.teal),
                        filled: true,
                        fillColor: Colors.grey.shade100,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) return context.tr('Ingresa el código de radicación');
                        if (val.trim().length < 4) return context.tr('Código demasiado corto');
                        return null;
                      },
                    ),
                    const SizedBox(height: 18),

                    FilledButton.icon(
                      key: const Key('public-radicacion-search-button'),
                      onPressed: _searching ? null : _consultar,
                      icon: _searching
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Icon(Icons.search),
                      label: Text(_searching ? context.tr('Consultando...') : context.tr('Consultar Estado')),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppTheme.teal,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 18),

          // Error si no se encuentra
          if (_searchError != null)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.red.shade200),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, color: Colors.red.shade700),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _searchError!,
                      key: const Key('public-radicacion-error'),
                      style: TextStyle(color: Colors.red.shade900, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),

          // Tarjeta de resultado encontrada
          if (_radicacionResult != null) ...[
            _buildResultCard(_radicacionResult!),
            const SizedBox(height: 16),
            _buildTimelineCard(_radicacionResult!),
          ],
        ],
      ),
    );
  }

  Widget _buildResultCard(PublicRadicacionModel rad) {
    final statusColor = rad.isClosed
        ? Colors.green
        : rad.isArchived
            ? Colors.grey
            : AppTheme.teal;

    return Card(
      key: const Key('public-radicacion-result-card'),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        rad.tenantName,
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey.shade600),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        rad.code,
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.ink),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    rad.statusLabel,
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: statusColor),
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            _itemDetail(context.tr('Asunto'), rad.subject),
            _itemDetail(context.tr('Tipo de Trámite'), rad.type),
            _itemDetail(context.tr('Solicitante'), rad.citizenName),
            _itemDetail(context.tr('Fecha de Radicación'), formatDate(rad.createdAt.toIso8601String(), withTime: true)),
            if (rad.summary.isNotEmpty) ...[
              const SizedBox(height: 8),
              _itemDetail(context.tr('Detalle'), rad.summary),
            ],
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                key: const Key('public-radicacion-receipt-button'),
                onPressed: () => _abrirComprobante(rad),
                icon: const Icon(Icons.receipt_long, color: AppTheme.teal),
                label: Text(context.tr('Ver Comprobante Oficial con Sello')),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppTheme.teal,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTimelineCard(PublicRadicacionModel rad) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.timeline, color: AppTheme.teal, size: 20),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    context.tr('Seguimiento y Avance del Trámite'),
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.ink),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            for (int i = 0; i < rad.events.length; i++) ...[
              _buildTimelineStep(
                event: rad.events[i],
                isFirst: i == 0,
                isLast: i == rad.events.length - 1,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildTimelineStep({
    required PublicRadicacionEventModel event,
    required bool isFirst,
    required bool isLast,
  }) {
    final isDone = event.status == 'COMPLETED';
    final dotColor = isDone ? AppTheme.teal : Colors.orange;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 14,
              height: 14,
              decoration: BoxDecoration(
                color: dotColor,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
                boxShadow: [
                  BoxShadow(color: dotColor.withValues(alpha: 0.3), blurRadius: 4),
                ],
              ),
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 48,
                color: Colors.grey.shade300,
              ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  event.stageName,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.ink),
                ),
                const SizedBox(height: 2),
                Text(
                  event.description,
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                ),
                const SizedBox(height: 4),
                Text(
                  formatDate(event.timestamp.toIso8601String(), withTime: true),
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _itemDetail(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(
              label,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey.shade600),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppTheme.ink),
            ),
          ),
        ],
      ),
    );
  }
}
