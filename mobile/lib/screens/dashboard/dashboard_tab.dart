import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/state_views.dart';
import '../documents/document_detail_sheet.dart';
import '../tasks/task_detail_page.dart';

class DashboardTab extends StatefulWidget {
  const DashboardTab({super.key, required this.api, required this.onNavigateToTab});

  final AuthApi api;
  final void Function(int tabIndex) onNavigateToTab;

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
    if (hour < 12) return 'Buenos días';
    if (hour < 19) return 'Buenas tardes';
    return 'Buenas noches';
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
    final tenantName = user['tenantName'] as String? ?? 'Plataforma';
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
              child: Text('No se pudo actualizar: $error', style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [AppTheme.teal, AppTheme.tealDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(20)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.domain, color: Colors.white, size: 14),
                  const SizedBox(width: 4),
                  Text(tenantName, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                ]),
              ),
              const SizedBox(height: 14),
              Text(
                name.isEmpty ? greeting : '$greeting, $name',
                key: const Key('dashboard-greeting'),
                style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              const Text(
                'Aquí tienes un resumen de lo que está ocurriendo en tu organización.',
                style: TextStyle(color: AppTheme.mint, fontSize: 13),
              ),
            ]),
          ),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(
              child: _KpiCard(
                title: 'Tareas pendientes',
                value: '$pendingTotal',
                subtitle: 'Requieren tu atención',
                icon: Icons.check_circle_outline,
                color: const Color(0xffd97706),
                onTap: () => widget.onNavigateToTab(2),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _KpiCard(
                title: 'Documentos',
                value: '${docs.length}',
                subtitle: 'Con actividad reciente',
                icon: Icons.description_outlined,
                color: AppTheme.teal,
                onTap: () => widget.onNavigateToTab(1),
              ),
            ),
          ]),
          _SectionHeader(title: 'Mis tareas pendientes', action: 'Ver todas →', onAction: () => widget.onNavigateToTab(2)),
          if (pendingTasks.isEmpty)
            const _EmptyCard('No tienes tareas pendientes.')
          else
            ...pendingTasks.take(3).map((task) => _Item(
              icon: Icons.radio_button_unchecked,
              iconColor: const Color(0xffd97706),
              title: task['title'] as String? ?? 'Tarea',
              subtitle: '${task['workflow_title'] ?? ''} · vence ${formatDate(task['due_at'])}',
              trailing: StatusBadge(stageTypeLabel(task['stage_type'] as String?), tone: BadgeTone.brand),
              onTap: () => openTask(task),
            )),
          _SectionHeader(title: 'Documentos recientes', action: 'Ver todos →', onAction: () => widget.onNavigateToTab(1)),
          if (docs.isEmpty)
            const _EmptyCard('No hay documentos recientes.')
          else
            ...docs.take(3).map((doc) => _Item(
              icon: Icons.description_outlined,
              iconColor: AppTheme.teal,
              title: doc['name'] as String? ?? 'Documento',
              subtitle: '${doc['code'] ?? ''} · ${formatDate(doc['updatedAt'])}',
              trailing: StatusBadge(documentStatusLabel(doc['status'] as String?), tone: documentStatusTone(doc['status'] as String?)),
              onTap: () => showDocumentDetail(context, widget.api, doc['id'] as String),
            )),
          const _SectionHeader(title: 'Actividad reciente'),
          if (activities.isEmpty)
            const _EmptyCard('No hay registros de actividad recientes.')
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

class _KpiCard extends StatelessWidget {
  const _KpiCard({required this.title, required this.value, required this.subtitle, required this.icon, required this.color, required this.onTap});
  final String title;
  final String value;
  final String subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(12),
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppTheme.line)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, color: color, size: 20),
          ),
          Icon(Icons.chevron_right, color: Colors.grey.shade400, size: 18),
        ]),
        const SizedBox(height: 10),
        Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 2),
        Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xff374151))),
        Text(subtitle, style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
      ]),
    ),
  );
}

class _Item extends StatelessWidget {
  const _Item({required this.icon, required this.iconColor, required this.title, required this.subtitle, this.trailing, this.onTap});
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: AppTheme.line)),
    child: ListTile(
      dense: true,
      leading: Icon(icon, color: iconColor, size: 20),
      title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.ink)),
      subtitle: Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
      trailing: trailing,
      onTap: onTap,
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
