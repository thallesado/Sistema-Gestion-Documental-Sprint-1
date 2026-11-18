import 'package:flutter/material.dart';
import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/models/audit_event_model.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/state_views.dart';
import '../../core/i18n/app_language.dart';

/// Categorías de filtro rápido pensadas para supervisores y auditores en móvil.
enum AuditQuickFilter {
  all('Todos', null, null),
  access('Accesos', 'LOGIN', null),
  downloads('Descargas', 'DOWNLOAD', null),
  stateChanges('Cambios Estado', 'STATUS', null),
  suspicious('Sospechosos / Fallos', null, 'FAILURE');

  const AuditQuickFilter(this.label, this.actionFilter, this.resultFilter);
  final String label;
  final String? actionFilter;
  final String? resultFilter;
}

/// Pantalla de Pistas de Auditoría y Trazabilidad en Tiempo Real (`audit:read`).
class AuditLogPage extends StatefulWidget {
  const AuditLogPage({super.key, required this.api});

  final AuthApi api;

  @override
  State<AuditLogPage> createState() => _AuditLogPageState();
}

class _AuditLogPageState extends State<AuditLogPage> {
  List<AuditEventModel> _events = [];
  AuditVerificationModel? _verification;
  AuditQuickFilter _selectedFilter = AuditQuickFilter.all;
  bool _loading = true;
  bool _verifying = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAuditData();
  }

  Future<void> _loadAuditData() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final events = await widget.api.audit.getEvents(
        action: _selectedFilter.actionFilter,
        result: _selectedFilter.resultFilter,
      );
      AuditVerificationModel? verification;
      try {
        verification = await widget.api.audit.verifyChain();
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _events = events;
        if (verification != null) _verification = verification;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.message;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = tr('Error al cargar pistas de auditoría: {error}', {'error': e});
          _loading = false;
        });
      }
    }
  }

  Future<void> _verifyChainNow() async {
    setState(() => _verifying = true);
    try {
      final v = await widget.api.audit.verifyChain();
      if (mounted) {
        setState(() {
          _verification = v;
          _verifying = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _verifying = false);
    }
  }

  void _showEventDetailSheet(AuditEventModel event) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Icon(
                  event.isSuspicious ? Icons.gpp_maybe_outlined : Icons.verified_user_outlined,
                  color: event.isSuspicious ? Colors.red.shade700 : AppTheme.teal,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    event.humanActionLabel,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.ink),
                  ),
                ),
                StatusBadge(
                  event.isFailure ? 'FALLO' : context.tr('ÉXITO'),
                  tone: event.isFailure ? BadgeTone.danger : BadgeTone.success,
                ),
              ],
            ),
            const Divider(height: 22),
            _detailRow(context.tr('Acción Técnica'), event.action),
            _detailRow(context.tr('Entidad Afectada'), '${event.entityType} ${event.entityId ?? ''}'),
            _detailRow(context.tr('Actor / Usuario'), '${event.actorType ?? 'TENANT'} · ${event.actorId ?? tr('Sistema')}'),
            _detailRow(context.tr('Dirección IP'), event.ipAddress ?? context.tr('Interna')),
            _detailRow(context.tr('Fecha Exacta'), formatDate(event.occurredAt.toIso8601String(), withTime: true)),
            if (event.chainSeq != null)
              _detailRow(context.tr('Eslabón Cadena'), '#${event.chainSeq}'),
            if (event.recordHash != null && event.recordHash!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                context.tr('HASH CRIPTOGRÁFICO DEL REGISTRO (SHA-256):'),
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey),
              ),
              const SizedBox(height: 4),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(6)),
                child: SelectableText(
                  event.recordHash!,
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 10.5),
                ),
              ),
            ],
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: Text(context.tr('Cerrar Detalle')),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppTheme.ink)),
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
        title: Text(context.tr('Auditoría y Trazabilidad'), style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
      ),
      body: Column(
        children: [
          // Banner compacto de verificación de cadena SHA-256
          if (_verification != null)
            Container(
              key: const Key('audit-chain-status-banner'),
              margin: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: _verification!.valid ? const Color(0xffecfdf5) : const Color(0xfffef2f2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: _verification!.valid ? const Color(0xff34d399) : const Color(0xfff87171),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    _verification!.valid ? Icons.verified_user : Icons.gpp_bad,
                    color: _verification!.valid ? const Color(0xff059669) : const Color(0xffdc2626),
                    size: 22,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _verification!.valid
                              ? tr('Cadena SHA-256 Íntegra ({count} eventos)', {'count': _verification!.totalVerified})
                              : tr('Alerta: Eslabón alterado en secuencia #{seq}', {'seq': _verification!.brokenChainSeq}),
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.bold,
                            color: _verification!.valid ? const Color(0xff065f46) : const Color(0xff991b1b),
                          ),
                        ),
                        Text(
                          context.tr('Bitácora inmutable protegida contra alteración retroactiva'),
                          style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    key: const Key('audit-verify-chain-button'),
                    onPressed: _verifying ? null : _verifyChainNow,
                    child: Text(_verifying ? '...' : context.tr('Verificar'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),

          // Chips de filtro rápido sin saturar la pantalla
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: AuditQuickFilter.values.map((filter) {
                  final selected = _selectedFilter == filter;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      key: Key('audit-filter-${filter.name}'),
                      label: Text(tr(filter.label)),
                      selected: selected,
                      onSelected: (_) {
                        setState(() => _selectedFilter = filter);
                        _loadAuditData();
                      },
                      selectedColor: AppTheme.mint,
                      checkmarkColor: AppTheme.teal,
                      labelStyle: TextStyle(
                        fontSize: 12,
                        fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                        color: selected ? AppTheme.tealDark : AppTheme.ink,
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),

          if (_loading) const LinearProgressIndicator(color: AppTheme.teal),

          Expanded(
            child: RefreshIndicator(
              onRefresh: _loadAuditData,
              color: AppTheme.teal,
              child: _error != null
                  ? ErrorStateView(message: _error!, onRetry: _loadAuditData)
                  : _events.isEmpty && !_loading
                  ? EmptyStateView(
                      message: context.tr('No se encontraron eventos de auditoría para este filtro.'),
                      icon: Icons.policy_outlined,
                    )
                  : ListView.builder(
                      key: const Key('audit-events-list'),
                      padding: const EdgeInsets.all(16),
                      itemCount: _events.length,
                      itemBuilder: (context, index) {
                        final ev = _events[index];
                        return Card(
                          elevation: 0,
                          margin: const EdgeInsets.only(bottom: 10),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(
                              color: ev.isSuspicious ? Colors.red.shade200 : Colors.grey.shade200,
                            ),
                          ),
                          child: ListTile(
                            key: Key('audit-event-tile-${ev.id}'),
                            onTap: () => _showEventDetailSheet(ev),
                            leading: CircleAvatar(
                              backgroundColor: ev.isSuspicious
                                  ? Colors.red.shade50
                                  : AppTheme.mint.withValues(alpha: 0.5),
                              child: Icon(
                                _iconForAction(ev),
                                size: 20,
                                color: ev.isSuspicious ? Colors.red.shade700 : AppTheme.teal,
                              ),
                            ),
                            title: Text(
                              ev.humanActionLabel,
                              style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold, color: AppTheme.ink),
                            ),
                            subtitle: Text(
                              '${ev.entityType} · IP: ${ev.ipAddress ?? tr('Local')} · ${formatDate(ev.occurredAt.toIso8601String(), withTime: true)}',
                              style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            trailing: StatusBadge(
                              ev.isFailure ? context.tr('Alerta') : 'OK',
                              tone: ev.isFailure ? BadgeTone.danger : BadgeTone.success,
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }

  IconData _iconForAction(AuditEventModel ev) {
    if (ev.isSuspicious) return Icons.warning_amber_rounded;
    final upper = ev.action.toUpperCase();
    if (upper.contains('LOGIN') || upper.contains('LOGOUT')) return Icons.login;
    if (upper.contains('DOWNLOAD')) return Icons.download_outlined;
    if (upper.contains('DOCUMENT') || upper.contains('VERSION')) return Icons.description_outlined;
    if (upper.contains('EXPEDIENT') || upper.contains('RADICACION')) return Icons.folder_shared_outlined;
    return Icons.fact_check_outlined;
  }
}
