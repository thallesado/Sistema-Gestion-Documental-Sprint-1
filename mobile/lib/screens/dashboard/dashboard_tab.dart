import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/state_views.dart';
import '../../features/dashboard/presentation/widgets/dashboard_kpi_grid.dart';
import '../../features/dashboard/presentation/widgets/dashboard_quick_actions.dart';
import '../../features/dashboard/presentation/widgets/dashboard_welcome_card.dart';
import '../../features/documents/presentation/widgets/document_item_tile.dart';
import '../../features/tasks/presentation/widgets/task_item_card.dart';
import '../documents/create_document_page.dart';
import '../documents/document_detail_sheet.dart';
import '../scan/scan_document_page.dart';
import '../tasks/task_detail_page.dart';
import '../../core/i18n/app_language.dart';

class DashboardTab extends StatefulWidget {
  const DashboardTab({super.key, required this.api, required this.onNavigateToTab, required this.isTabVisible});

  final AuthApi api;
  final void Function(int tabIndex) onNavigateToTab;
  final bool Function(int tabIndex) isTabVisible;

  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> {
  Map<String, dynamic>? data;
  List<Map<String, dynamic>> pendingTasks = [];
  int pendingTotal = 0;
  bool loading = true;
  String? error;

  @override
  void initState() {
    super.initState();
    loadData();
  }

  Future<void> loadData() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final results = await Future.wait([
        widget.api.dashboard(),
        widget.api.workflows.tasks(filters: {'status': 'PENDING'}, size: 5),
      ]);
      if (!mounted) return;
      final tasksPage = results[1];
      setState(() {
        data = results[0];
        pendingTasks = (tasksPage['content'] as List<dynamic>).cast<Map<String, dynamic>>();
        pendingTotal = tasksPage['totalElements'] as int? ?? pendingTasks.length;
      });
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  /// Mismo saludo que la web según la hora local.
  String get greeting {
    final hour = DateTime.now().hour;
    if (hour < 12) return tr('Buenos días');
    if (hour < 19) return tr('Buenas tardes');
    return tr('Buenas noches');
  }

  Future<void> openTask(Map<String, dynamic> task) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => TaskDetailPage(api: widget.api, taskId: task['id'] as String)),
    );
    if (changed == true) loadData();
  }

  @override
  Widget build(BuildContext context) {
    if (loading && data == null) return const Center(child: CircularProgressIndicator(color: AppTheme.teal));
    if (error != null && data == null) {
      return RefreshIndicator(onRefresh: loadData, child: ErrorStateView(message: error!, onRetry: loadData));
    }

    final user = data?['currentUser'] as Map<String, dynamic>? ?? {};
    final name = '${user['firstName'] ?? ''} ${user['lastName'] ?? ''}'.trim();
    final tenantName = user['tenantName'] as String? ?? tr('Plataforma');
    final docs = (data?['recentDocuments'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    final activities = (data?['recentActivity'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();

    return RefreshIndicator(
      onRefresh: loadData,
      color: AppTheme.teal,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        children: [
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(context.tr('No se pudo actualizar: {error}', {'error': error}), style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
          DashboardWelcomeCard(
            greeting: name.isEmpty ? greeting : '$greeting, $name',
            tenantName: tenantName,
            summary: tr('Aquí tienes un resumen de lo que está ocurriendo en tu organización.'),
          ),
          const SizedBox(height: 16),
          DashboardKpiGrid(
            pendingTotal: pendingTotal,
            docCount: docs.length,
            pendingTitle: tr('Tareas pendientes'),
            pendingSubtitle: tr('Requieren tu atención'),
            docsTitle: tr('Documentos'),
            docsSubtitle: tr('Con actividad reciente'),
            onNavigateToTab: widget.onNavigateToTab,
          ),
          const SizedBox(height: 20),
          DashboardQuickActions(
            onScan: () => Navigator.of(context).push<void>(MaterialPageRoute<void>(builder: (_) => ScanDocumentPage(api: widget.api))),
            onNewDocument: () => Navigator.of(context).push<Map<String, dynamic>>(MaterialPageRoute(builder: (_) => CreateDocumentPage(api: widget.api))).then((created) {
              if (created != null && mounted) loadData();
            }),
            onPatients: widget.isTabVisible(3) ? () => widget.onNavigateToTab(3) : null,
          ),
          _SectionHeader(title: tr('Mis tareas pendientes'), action: tr('Ver todas →'), onAction: () => widget.onNavigateToTab(2)),
          if (pendingTasks.isEmpty)
            _EmptyCard(tr('No tienes tareas pendientes.'))
          else
            ...pendingTasks.take(3).map((task) => TaskItemCard(
              task: task,
              onTap: () => openTask(task),
            )),
          _SectionHeader(title: tr('Documentos recientes'), action: tr('Ver todos →'), onAction: () => widget.onNavigateToTab(1)),
          if (docs.isEmpty)
            _EmptyCard(tr('No hay documentos recientes.'))
          else
            ...docs.take(3).map((doc) => DocumentItemTile(
              doc: doc,
              onTap: () => showDocumentDetail(context, widget.api, doc['id'] as String),
            )),
          _SectionHeader(title: tr('Actividad reciente')),
          if (activities.isEmpty)
            _EmptyCard(tr('No hay registros de actividad recientes.'))
          else
            ...activities.take(5).map((act) => _Item(
              icon: Icons.history,
              iconColor: Colors.grey,
              title: '${act['action'] ?? 'Acción'} · ${act['entityType'] ?? ''}',
              subtitle: '${act['actorName'] ?? 'Sistema'} · ${formatDate(act['occurredAt'], withTime: true)}',
            )),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, this.action, this.onAction});
  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 20, bottom: 6),
    child: Row(children: [
      // Flexible: con letra grande (accesibilidad) el título no empuja el botón fuera de pantalla.
      Expanded(
        child: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.ink)),
      ),
      if (action != null)
        TextButton(onPressed: onAction, child: Text(action!, style: const TextStyle(color: AppTheme.teal, fontWeight: FontWeight.w600))),
    ]),
  );
}

class _Item extends StatelessWidget {
  const _Item({required this.icon, required this.iconColor, required this.title, required this.subtitle});
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppTheme.line)),
    child: ListTile(
      dense: true,
      leading: Icon(icon, color: iconColor, size: 20),
      title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.ink)),
      subtitle: Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
    ),
  );
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard(this.message);
  final String message;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppTheme.line)),
    child: Center(child: Text(message, style: TextStyle(fontSize: 12, color: Colors.grey.shade500))),
  );
}
