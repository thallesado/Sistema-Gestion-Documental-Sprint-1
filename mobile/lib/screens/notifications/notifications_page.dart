import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/state_views.dart';
import '../tasks/task_detail_page.dart';

/// Avisos internos de workflows (los mismos que la campana de la web).
class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key, required this.api});

  final AuthApi api;

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<Map<String, dynamic>> items = [];
  bool loading = true;
  String? error;
  bool onlyUnread = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final page = await widget.api.workflows.notifications();
      if (mounted) setState(() => items = (page['content'] as List<dynamic>).cast<Map<String, dynamic>>());
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> open(Map<String, dynamic> item) async {
    if (item['is_read'] != true) {
      try {
        await widget.api.workflows.markNotificationRead(item['id'] as String);
        if (mounted) setState(() => item['is_read'] = true);
      } on ApiException {
        // Abrir el aviso no depende de poder marcarlo como leído.
      }
    }
    if (!mounted) return;
    if (item['related_entity_type'] == 'workflow_task' && item['related_entity_id'] != null) {
      await Navigator.of(context).push(MaterialPageRoute<bool>(
        builder: (_) => TaskDetailPage(api: widget.api, taskId: item['related_entity_id'] as String),
      ));
    }
  }

  Future<void> markAllRead() async {
    final unread = items.where((i) => i['is_read'] != true).toList();
    try {
      await Future.wait(unread.map((i) => widget.api.workflows.markNotificationRead(i['id'] as String)));
      if (mounted) setState(() => [for (final i in unread) i['is_read'] = true]);
    } on ApiException catch (exception) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(exception.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final visible = onlyUnread ? items.where((i) => i['is_read'] != true).toList() : items;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notificaciones'),
        backgroundColor: Colors.white,
        actions: [
          if (items.any((i) => i['is_read'] != true))
            TextButton(onPressed: markAllRead, child: const Text('Marcar todo leído')),
        ],
      ),
      body: Column(children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(children: [
            ChoiceChip(label: const Text('Todas'), selected: !onlyUnread, onSelected: (_) => setState(() => onlyUnread = false), selectedColor: AppTheme.mint),
            const SizedBox(width: 8),
            ChoiceChip(label: const Text('No leídas'), selected: onlyUnread, onSelected: (_) => setState(() => onlyUnread = true), selectedColor: AppTheme.mint),
          ]),
        ),
        if (loading) const LinearProgressIndicator(color: AppTheme.teal),
        Expanded(
          child: RefreshIndicator(
            onRefresh: load,
            color: AppTheme.teal,
            child: error != null
                ? ErrorStateView(message: error!, onRetry: load)
                : visible.isEmpty && !loading
                ? const EmptyStateView(message: 'No tienes notificaciones.', icon: Icons.notifications_none)
                : ListView.separated(
                    itemCount: visible.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final item = visible[index];
                      final unread = item['is_read'] != true;
                      return ListTile(
                        tileColor: unread ? AppTheme.mint.withValues(alpha: 0.45) : Colors.white,
                        leading: Icon(unread ? Icons.notifications_active : Icons.notifications_none, color: unread ? AppTheme.teal : Colors.grey),
                        title: Text(item['title'] as String? ?? 'Aviso', style: TextStyle(fontWeight: unread ? FontWeight.bold : FontWeight.normal)),
                        subtitle: Text('${item['message'] ?? ''}\n${formatDate(item['created_at'], withTime: true)}'),
                        isThreeLine: true,
                        onTap: () => open(item),
                      );
                    },
                  ),
          ),
        ),
      ]),
    );
  }
}
