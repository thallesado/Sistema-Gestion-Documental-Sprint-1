import 'package:flutter/material.dart';

import '../../core/models/audit_event_model.dart';

import '../../core/api/auth_api.dart';
import '../../core/auth/user_permissions.dart';
import '../../core/errors/api_exception.dart';
import '../../core/models/workflow_task_model.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/state_views.dart';
import '../audit/audit_log_page.dart';
import '../documents/document_detail_sheet.dart';
import '../tasks/task_detail_page.dart';
import '../../core/i18n/app_language.dart';

class DashboardTab extends StatefulWidget {
  const DashboardTab({super.key, required this.api, required this.onNavigateToTab});

  final AuthApi api;
  final void Function(int tabIndex) onNavigateToTab;

  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> {
  Map<String, dynamic>? data;
  List<WorkflowTaskModel> pendingTasks = [];
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
      final rawItems = (tasksPage['content'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
      setState(() {
        data = results[0];
        pendingTasks = rawItems.map(WorkflowTaskModel.fromJson).toList();
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
    if (hour < 12) return context.tr('Buenos días');
    if (hour < 19) return context.tr('Buenas tardes');
    return context.tr('Buenas noches');
  }

  Future<void> openTask(WorkflowTaskModel task) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => TaskDetailPage(api: widget.api, taskId: task.id)),
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
    final tenantName = user['tenantName'] as String? ?? context.tr('Plataforma');
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
              child: Text(tr('No se pudo actualizar: {error}', {'error': error}), style: TextStyle(color: Theme.of(context).colorScheme.error)),
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
              Text(
                context.tr('Aquí tienes un resumen de lo que está ocurriendo en tu organización.'),
                style: TextStyle(color: AppTheme.mint, fontSize: 13),
              ),
            ]),
          ),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(
              child: _KpiCard(
                title: context.tr('Tareas pendientes'),
                value: '$pendingTotal',
                subtitle: context.tr('Requieren tu atención'),
                icon: Icons.check_circle_outline,
                color: const Color(0xffd97706),
                onTap: () => widget.onNavigateToTab(2),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _KpiCard(
                title: context.tr('Documentos'),
                value: '${docs.length}',
                subtitle: context.tr('Con actividad reciente'),
                icon: Icons.description_outlined,
                color: AppTheme.teal,
                onTap: () => widget.onNavigateToTab(1),
              ),
            ),
          ]),
          if (widget.api.permissions.value.can(Permissions.expedientRead)) ...[
            const SizedBox(height: 12),
            Card(
              key: const Key('dashboard-expedients-card'),
              elevation: 0,
              color: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.grey.shade200),
              ),
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: AppTheme.mint,
                  child: const Icon(Icons.folder_special, color: AppTheme.teal, size: 20),
                ),
                title: Text(context.tr('Expedientes Digitales'), style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                subtitle: Text(context.tr('Consulta y seguimiento a tus radicaciones')),
                trailing: const Icon(Icons.chevron_right, color: AppTheme.teal),
                onTap: () => widget.onNavigateToTab(3),
              ),
            ),
          ],
          if (AuditPermissions.canRead(widget.api.permissions.value)) ...[
            const SizedBox(height: 10),
            Card(
              key: const Key('dashboard-audit-card'),
              elevation: 0,
              color: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.grey.shade200),
              ),
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: AppTheme.mint,
                  child: const Icon(Icons.shield_outlined, color: AppTheme.teal, size: 20),
                ),
                title: Text(context.tr('Pistas de Auditoría y Trazabilidad'), style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                subtitle: Text(context.tr('Accesos, descargas, estados y cadena SHA-256')),
                trailing: const Icon(Icons.chevron_right, color: AppTheme.teal),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => AuditLogPage(api: widget.api)),
                ),
              ),
            ),
          ],
          _SectionHeader(title: context.tr('Mis tareas pendientes'), action: context.tr('Ver todas →'), onAction: () => widget.onNavigateToTab(2)),
          if (pendingTasks.isEmpty)
            _EmptyCard(context.tr('No tienes tareas pendientes.'))
          else
            ...pendingTasks.take(3).map((task) => _Item(
              icon: Icons.radio_button_unchecked,
              iconColor: const Color(0xffd97706),
              title: task.title,
              subtitle: '${task.workflowTitle ?? ''} · vence ${formatDate(task['due_at'])}',
              trailing: StatusBadge(stageTypeLabel(task.stageType), tone: BadgeTone.brand),
              onTap: () => openTask(task),
            )),
          _SectionHeader(title: context.tr('Documentos recientes'), action: context.tr('Ver todos →'), onAction: () => widget.onNavigateToTab(1)),
          if (docs.isEmpty)
            _EmptyCard(context.tr('No hay documentos recientes.'))
          else
            ...docs.take(3).map((doc) => _Item(
              icon: Icons.description_outlined,
              iconColor: AppTheme.teal,
              title: doc['name'] as String? ?? context.tr('Documento'),
              subtitle: [doc['code'], doc['size'], formatDate(doc['updatedAt'])].whereType<Object>().join(' · '),
              trailing: StatusBadge(documentStatusLabel(doc['status'] as String?), tone: documentStatusTone(doc['status'] as String?)),
              onTap: () => showDocumentDetail(context, widget.api, doc['id'] as String),
            )),
          if (activities.isNotEmpty) ...[
            _SectionHeader(title: context.tr('Actividad reciente')),
            ...activities.take(5).map((act) => _ActivityItem(
              // DashboardActivityResponse: action, actorName, occurredAt.
              description: act['action'] is String
                  ? auditActionLabel(act['action'] as String)
                  : act['description'] as String? ?? context.tr('Actividad registrada'),
              timestamp: formatDate(act['occurredAt'] ?? act['timestamp'], withTime: true),
              userName: act['actorName'] as String? ?? act['userName'] as String? ?? '',
            )),
          ],
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
    padding: const EdgeInsets.only(top: 20, bottom: 8),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(
            title,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppTheme.ink),
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (action != null && onAction != null) ...[
          const SizedBox(width: 8),
          InkWell(
            onTap: onAction,
            child: Text(action!, style: const TextStyle(fontSize: 12, color: AppTheme.teal, fontWeight: FontWeight.w600)),
          ),
        ],
      ],
    ),
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
  Widget build(BuildContext context) => Card(
    elevation: 0,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
    child: InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 4),
              Icon(icon, color: color, size: 20),
            ],
          ),
          const SizedBox(height: 8),
          Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 2),
          Text(subtitle, style: TextStyle(fontSize: 11, color: Colors.grey.shade500), maxLines: 1, overflow: TextOverflow.ellipsis),
        ]),
      ),
    ),
  );
}

class _Item extends StatelessWidget {
  const _Item({required this.icon, required this.iconColor, required this.title, required this.subtitle, this.trailing, required this.onTap});
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 8),
    elevation: 0,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10), side: BorderSide(color: Colors.grey.shade200)),
    child: ListTile(
      dense: true,
      leading: Icon(icon, color: iconColor, size: 20),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13), overflow: TextOverflow.ellipsis),
      subtitle: Text(subtitle, style: TextStyle(fontSize: 11, color: Colors.grey.shade600), maxLines: 1, overflow: TextOverflow.ellipsis),
      trailing: trailing,
      onTap: onTap,
    ),
  );
}

class _ActivityItem extends StatelessWidget {
  const _ActivityItem({required this.description, required this.timestamp, required this.userName});
  final String description;
  final String timestamp;
  final String userName;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        margin: const EdgeInsets.only(top: 4, right: 10),
        width: 8,
        height: 8,
        decoration: const BoxDecoration(color: AppTheme.teal, shape: BoxShape.circle),
      ),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(description, style: const TextStyle(fontSize: 13, color: AppTheme.ink)),
          const SizedBox(height: 2),
          Text([userName, timestamp].where((s) => s.isNotEmpty).join(' · '), style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
        ]),
      ),
    ]),
  );
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard(this.message);
  final String message;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.grey.shade200)),
    child: Text(message, style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
  );
}
