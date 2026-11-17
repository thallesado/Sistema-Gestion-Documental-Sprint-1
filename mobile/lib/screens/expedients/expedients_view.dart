import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/auth/user_permissions.dart';
import '../../core/errors/api_exception.dart';
import '../../core/i18n/app_language.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/state_views.dart';
import 'create_expedient_sheet.dart';
import 'expedient_detail_page.dart';
import 'expedient_labels.dart';

/// Listado de expedientes con búsqueda y filtro de estado (GET /expedients), como la web.
class ExpedientsView extends StatefulWidget {
  const ExpedientsView({super.key, required this.api});

  final AuthApi api;

  @override
  State<ExpedientsView> createState() => _ExpedientsViewState();
}

class _ExpedientsViewState extends State<ExpedientsView> {
  final searchController = TextEditingController();
  List<Map<String, dynamic>> expedients = [];
  bool loading = false;
  String? error;
  String? status;

  UserPermissions get permissions => widget.api.permissions.value;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = ((await widget.api.expedients.list(filter: searchController.text.trim(), status: status))['content'] as List<dynamic>).cast<Map<String, dynamic>>();
      if (mounted) setState(() => expedients = result);
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> create() async {
    final created = await showCreateExpedientSheet(context, widget.api);
    if (created == null || !mounted) return;
    await load();
    if (mounted) open(created['id'] as String);
  }

  Future<void> open(String id) async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ExpedientDetailPage(api: widget.api, expedientId: id)));
    load();
  }

  Widget _chip(String label, String? value) {
    final selected = status == value;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) {
          setState(() => status = value);
          load();
        },
        selectedColor: AppTheme.mint,
        checkmarkColor: AppTheme.teal,
        labelStyle: TextStyle(fontSize: 12, fontWeight: selected ? FontWeight.bold : FontWeight.normal, color: selected ? AppTheme.teal : const Color(0xff374151)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Container(
        color: Colors.white,
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
        child: Column(
          children: [
            SearchBar(
              key: const Key('expedients-search'),
              controller: searchController,
              hintText: context.tr('Buscar expediente por código o nombre...'),
              leading: const Icon(Icons.search, color: AppTheme.teal, size: 20),
              trailing: [
                if (permissions.can(Permissions.expedientCreate))
                  IconButton(
                    key: const Key('expedient-create'),
                    tooltip: context.tr('Nuevo expediente'),
                    icon: const Icon(Icons.create_new_folder_outlined, color: AppTheme.teal, size: 22),
                    onPressed: create,
                  ),
              ],
              onSubmitted: (_) => load(),
              elevation: const WidgetStatePropertyAll(0),
              backgroundColor: WidgetStatePropertyAll(Colors.grey.shade100),
              shape: WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
            ),
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(children: [
                _chip(context.tr('Todos'), null),
                for (final value in expedientStatuses) _chip(expedientStatusLabel(value), value),
              ]),
            ),
          ],
        ),
      ),
      if (loading) const LinearProgressIndicator(color: AppTheme.teal),
      Expanded(
        child: RefreshIndicator(
          onRefresh: load,
          color: AppTheme.teal,
          child: error != null
              ? ErrorStateView(message: error!, onRetry: load)
              : expedients.isEmpty && !loading
              ? EmptyStateView(message: context.tr('No se encontraron expedientes.'), icon: Icons.folder_off_outlined)
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: expedients.length,
                  itemBuilder: (context, index) {
                    final item = expedients[index];
                    final itemStatus = item['status'] as String?;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
                      child: ListTile(
                        key: Key('expedient-${item['id']}'),
                        leading: Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(color: AppTheme.teal.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
                          child: const Icon(Icons.folder_outlined, color: AppTheme.teal),
                        ),
                        title: Text(item['name'] as String? ?? '—', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                        subtitle: Text(
                          '${item['code'] ?? ''} · ${formatDate(item['createdAt'])}',
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                        ),
                        trailing: StatusBadge(expedientStatusLabel(itemStatus), tone: expedientStatusTone(itemStatus)),
                        onTap: () => open(item['id'] as String),
                      ),
                    );
                  },
                ),
        ),
      ),
    ],
  );
}
