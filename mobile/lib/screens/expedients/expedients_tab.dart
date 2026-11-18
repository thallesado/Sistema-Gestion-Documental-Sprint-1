import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/auth/user_permissions.dart';
import '../../core/errors/api_exception.dart';
import '../../core/models/expedient_model.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/state_views.dart';
import 'expedient_detail_sheet.dart';
import 'radicacion_wizard_sheet.dart';
import '../../core/i18n/app_language.dart';

/// Pestaña de Expedientes Digitales.
/// Permite al usuario final y administrativo consultar sus unidades documentales radicadas,
/// agrupando documentos y trámites bajo una misma radicación.
class ExpedientsTab extends StatefulWidget {
  const ExpedientsTab({super.key, required this.api});

  final AuthApi api;

  @override
  State<ExpedientsTab> createState() => _ExpedientsTabState();
}

class _ExpedientsTabState extends State<ExpedientsTab> {
  final TextEditingController searchController = TextEditingController();
  Timer? debounce;

  List<ExpedientModel> expedients = [];
  bool loading = true;
  String? error;
  String selectedStatus = 'ALL';
  int totalElements = 0;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    searchController.dispose();
    debounce?.cancel();
    super.dispose();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });

    try {
      final raw = await widget.api.expedients.list(
        filter: searchController.text.trim().isEmpty ? null : searchController.text.trim(),
        status: selectedStatus == 'ALL' ? null : selectedStatus,
        page: 0,
        size: 50,
      );
      final rawList = raw['content'] as List<dynamic>? ?? [];
      final items = rawList.map((e) => Map<String, dynamic>.from(e as Map)).toList();
      final models = items.map(ExpedientModel.fromJson).toList();
      final count = raw['totalElements'] as int? ?? models.length;

      if (!mounted) return;
      setState(() {
        expedients = models;
        totalElements = count;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } catch (e) {
      if (mounted) setState(() => error = 'Error al cargar expedientes: $e');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  void onSearchChanged(String text) {
    debounce?.cancel();
    debounce = Timer(const Duration(milliseconds: 350), load);
  }

  void selectStatus(String status) {
    if (selectedStatus == status) return;
    setState(() => selectedStatus = status);
    load();
  }

  Future<void> openRadicacionWizard() async {
    final result = await showRadicacionWizardSheet(context, widget.api);
    if (result != null && mounted) {
      await load();
      if (!mounted) return;
      showRadicacionSuccessDialog(context, widget.api, result);
    }
  }

  @override
  Widget build(BuildContext context) {
    final permissions = widget.api.permissions.value;
    if (!ExpedientPermissions.canRead(permissions)) {
      return Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(context.tr('No tienes permiso para consultar expedientes (expedient:read).')),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      body: Column(
        children: [
          // Barra de búsqueda y filtros superiores
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Column(
              children: [
                TextField(
                  key: const Key('expedient-search-input'),
                  controller: searchController,
                  onChanged: onSearchChanged,
                  decoration: InputDecoration(
                    hintText: context.tr('Buscar por código de radicación, asunto o persona...'),
                    prefixIcon: const Icon(Icons.search, size: 20),
                    suffixIcon: searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear, size: 18),
                            onPressed: () {
                              searchController.clear();
                              load();
                            },
                          )
                        : null,
                    filled: true,
                    fillColor: Colors.grey.shade100,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                // Chips de filtro por estado
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _statusChip(context.tr('Todos'), 'ALL'),
                      const SizedBox(width: 8),
                      _statusChip(context.tr('Activos'), 'ACTIVE'),
                      const SizedBox(width: 8),
                      _statusChip(context.tr('Cerrados'), 'CLOSED'),
                      const SizedBox(width: 8),
                      _statusChip(context.tr('Archivados'), 'ARCHIVED'),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Contador de resultados
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Row(
              children: [
                Text(
                  '$totalElements ${totalElements == 1 ? 'expediente' : 'expedientes'}',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey.shade700),
                ),
              ],
            ),
          ),

          // Contenido principal
          Expanded(
            child: RefreshIndicator(
              onRefresh: load,
              color: AppTheme.teal,
              child: loading && expedients.isEmpty
                  ? const Center(child: CircularProgressIndicator(color: AppTheme.teal))
                  : error != null && expedients.isEmpty
                      ? ErrorStateView(message: error!, onRetry: load)
                      : expedients.isEmpty
                          ? _emptyState()
                          : ListView.builder(
                              key: const Key('expedients-list'),
                              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                              itemCount: expedients.length,
                              itemBuilder: (context, index) {
                                final item = expedients[index];
                                return _ExpedientCard(
                                  expedient: item,
                                  onTap: () => showExpedientDetailSheet(
                                    context,
                                    widget.api,
                                    item.id,
                                    expedient: item,
                                  ),
                                );
                              },
                            ),
            ),
          ),
        ],
      ),
      floatingActionButton: ExpedientPermissions.canCreate(permissions)
          ? FloatingActionButton.extended(
              key: const Key('new-radicacion-fab'),
              heroTag: null,
              onPressed: openRadicacionWizard,
              backgroundColor: AppTheme.teal,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.add_circle_outline),
              label: Text(context.tr('Radicar solicitud'), style: TextStyle(fontWeight: FontWeight.bold)),
            )
          : null,
    );
  }

  Widget _statusChip(String label, String value) {
    final isSelected = selectedStatus == value;
    return ChoiceChip(
      key: Key('chip-status-$value'),
      label: Text(label),
      selected: isSelected,
      onSelected: (_) => selectStatus(value),
      selectedColor: AppTheme.mint,
      backgroundColor: Colors.grey.shade100,
      labelStyle: TextStyle(
        color: isSelected ? AppTheme.teal : Colors.grey.shade800,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        fontSize: 12,
      ),
      side: BorderSide(color: isSelected ? AppTheme.teal : Colors.grey.shade300),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    );
  }

  Widget _emptyState() {
    return Center(
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.folder_open_outlined, size: 64, color: Colors.grey.shade400),
            const SizedBox(height: 16),
            Text(
              context.tr('No se encontraron expedientes'),
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.ink),
            ),
            const SizedBox(height: 8),
            Text(
              searchController.text.isNotEmpty || selectedStatus != 'ALL'
                  ? context.tr('Intenta con otro término de búsqueda o limpia los filtros.')
                  : context.tr('Aún no hay radicaciones o expedientes disponibles.'),
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
            ),
            if (searchController.text.isNotEmpty || selectedStatus != 'ALL') ...[
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: () {
                  searchController.clear();
                  selectedStatus = 'ALL';
                  load();
                },
                child: Text(context.tr('Limpiar filtros')),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ExpedientCard extends StatelessWidget {
  const _ExpedientCard({required this.expedient, required this.onTap});

  final ExpedientModel expedient;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      key: Key('expedient-card-${expedient.id}'),
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.mint,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.folder_outlined, size: 14, color: AppTheme.teal),
                        const SizedBox(width: 4),
                        Text(
                          expedient.code,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.teal),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  StatusBadge(
                    expedientStatusLabel(expedient.status),
                    tone: expedientStatusTone(expedient.status),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                expedient.name,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppTheme.ink),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              if (expedient.description != null && expedient.description!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  expedient.description!,
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(Icons.calendar_today_outlined, size: 14, color: Colors.grey.shade500),
                  const SizedBox(width: 6),
                  Text(
                    formatDate(expedient.createdAt),
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                  const Spacer(),
                  Text(context.tr('Ver radicación'), style: TextStyle(color: AppTheme.teal, fontSize: 13, fontWeight: FontWeight.w600)),
                  const SizedBox(width: 4),
                  const Icon(Icons.arrow_forward_ios, size: 12, color: AppTheme.teal),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
