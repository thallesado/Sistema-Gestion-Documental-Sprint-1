import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/auth/user_permissions.dart';
import '../../core/errors/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/widgets/state_views.dart';
import '../documents/document_detail_sheet.dart';

/// Detalle de una tarea de workflow con las mismas acciones que la web.
/// Devuelve `true` al cerrar si la tarea cambió, para refrescar el listado.
class TaskDetailPage extends StatefulWidget {
  const TaskDetailPage({super.key, required this.api, required this.taskId});

  final AuthApi api;
  final String taskId;

  @override
  State<TaskDetailPage> createState() => _TaskDetailPageState();
}

class _TaskDetailPageState extends State<TaskDetailPage> {
  Map<String, dynamic>? task;
  String? error;
  bool loading = true;
  bool busy = false;
  bool changed = false;
  final checklist = <String, bool>{};
  final commentController = TextEditingController();

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    commentController.dispose();
    super.dispose();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await widget.api.workflows.task(widget.taskId);
      if (!mounted) return;
      setState(() {
        task = result;
        checklist
          ..clear()
          ..addEntries(_items(result).map((i) => MapEntry(i['id'].toString(), i['completed'] == true)));
      });
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  List<Map<String, dynamic>> _items(Map<String, dynamic>? source) =>
      ((source?['checklist_items'] as List<dynamic>?) ?? []).cast<Map<String, dynamic>>();

  bool get isOpen => !['COMPLETED', 'REJECTED', 'CANCELED'].contains(task?['status']);
  UserPermissions get permissions => widget.api.permissions.value;

  /// La tarea está asignada al usuario y sigue abierta (lo decide el servidor con `can_act`).
  bool get assignedAndOpen => task?['can_act'] == true && isOpen;

  /// Resolver y comentar exigen además `task:update`, como `WorkflowEngineService`.
  bool get canAct => assignedAndOpen && permissions.can(Permissions.taskUpdate);
  bool get canComment => permissions.can(Permissions.taskUpdate);
  bool get isCorrection => task?['correction'] == true;
  String get stageType => task?['stage_type'] as String? ?? 'TASK';
  Map<String, dynamic> get rules => (task?['rules'] as Map?)?.cast<String, dynamic>() ?? const {};

  /// Acción principal según el tipo de etapa (misma regla que WorkflowEngineService).
  String get primaryAction {
    if (isCorrection) return 'COMPLETE';
    return switch (stageType) {
      'APPROVAL' => 'APPROVE',
      'REVIEW' => 'REVIEW',
      _ => 'COMPLETE',
    };
  }

  /// Permiso que exige la acción principal en el servidor (`null`: basta con `task:update`).
  String? get primaryPermission => isCorrection
      ? null
      : switch (stageType) {
          'APPROVAL' => Permissions.workflowApprove,
          'REVIEW' => Permissions.workflowReview,
          _ => null,
        };
  bool get canPrimary => primaryPermission == null || permissions.can(primaryPermission!);

  bool get canReject => !isCorrection && (stageType == 'APPROVAL' || stageType == 'REVIEW') && rules['allowReject'] != false
      && permissions.can(Permissions.workflowReject);
  bool get canReturn => !isCorrection && (stageType == 'APPROVAL' || stageType == 'REVIEW') && returnStages.isNotEmpty
      && permissions.can(Permissions.workflowReturn);

  /// Etapas a las que se puede devolver: la actual o anteriores.
  List<Map<String, dynamic>> get returnStages {
    final stages = ((task?['stages'] as List<dynamic>?) ?? []).cast<Map<String, dynamic>>();
    final current = stages.where((s) => s['id'] == task?['stage_id']).firstOrNull;
    final order = current?['sort_order'] as int?;
    if (order == null) return const [];
    return stages.where((s) => (s['sort_order'] as int? ?? 0) <= order && s['stage_type'] != 'START' && s['stage_type'] != 'END').toList();
  }

  static String actionLabel(String action) => switch (action) {
    'APPROVE' => 'Aprobar',
    'REVIEW' => 'Marcar como revisada',
    'COMPLETE' => 'Completar',
    'REJECT' => 'Rechazar',
    'RETURN' => 'Devolver para corrección',
    _ => action,
  };

  Future<void> runAction(String action) async {
    final needsComment = action == 'REJECT' || action == 'RETURN' || rules['commentRequired'] == true;
    final result = await showModalBottomSheet<_ActionInput>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _ActionSheet(
        title: actionLabel(action),
        commentRequired: needsComment,
        destructive: action == 'REJECT',
        returnStages: action == 'RETURN' ? returnStages : const [],
      ),
    );
    if (result == null) return;
    setState(() => busy = true);
    try {
      final updated = await widget.api.workflows.act(
        widget.taskId,
        action,
        comment: result.comment,
        returnStageId: result.returnStageId,
        checklist: checklist,
      );
      changed = true;
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${actionLabel(action)}: operación realizada.')));
      if (updated != null) {
        await load();
      }
    } on ApiException catch (exception) {
      if (mounted) _showError(exception.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> sendComment() async {
    final text = commentController.text.trim();
    if (text.isEmpty) return;
    setState(() => busy = true);
    try {
      await widget.api.workflows.comment(widget.taskId, text);
      commentController.clear();
      await load();
    } on ApiException catch (exception) {
      if (mounted) _showError(exception.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void _showError(String message) => ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(message), backgroundColor: Theme.of(context).colorScheme.error),
  );

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    onPopInvokedWithResult: (didPop, _) {
      if (!didPop) Navigator.of(context).pop(changed);
    },
    child: Scaffold(
      appBar: AppBar(title: const Text('Detalle de tarea'), backgroundColor: Colors.white),
      body: loading && task == null
          ? const Center(child: CircularProgressIndicator(color: AppTheme.teal))
          : error != null && task == null
          ? ErrorStateView(message: error!, onRetry: load)
          : RefreshIndicator(onRefresh: load, color: AppTheme.teal, child: _body()),
      bottomNavigationBar: task == null || !canAct || !(canPrimary || canReject || canReturn) ? null : _actionBar(),
    ),
  );

  Widget _body() {
    final t = task!;
    final status = t['status'] as String?;
    final comments = ((t['comments'] as List<dynamic>?) ?? []).cast<Map<String, dynamic>>();
    final events = ((t['events'] as List<dynamic>?) ?? []).cast<Map<String, dynamic>>();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (busy) const LinearProgressIndicator(color: AppTheme.teal),
        Text(t['title'] as String? ?? 'Tarea', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.bold, color: AppTheme.ink)),
        const SizedBox(height: 4),
        Text('${t['workflow_title'] ?? ''} · ${t['workflow_code'] ?? ''}', style: TextStyle(color: Colors.grey.shade600)),
        const SizedBox(height: 10),
        Wrap(spacing: 6, runSpacing: 6, children: [
          StatusBadge(taskStatusLabel(status), tone: taskStatusTone(status)),
          StatusBadge(stageTypeLabel(stageType), tone: BadgeTone.brand),
          if (isCorrection) const StatusBadge('Corrección', tone: BadgeTone.warning),
        ]),
        if (!assignedAndOpen && isOpen) ...[
          const SizedBox(height: 12),
          const _Notice('Esta tarea no está asignada a ti: puedes consultarla, pero no resolverla.'),
        ] else if (assignedAndOpen && !canAct) ...[
          const SizedBox(height: 12),
          const _Notice('Tu perfil no tiene permiso para resolver tareas. Pide al administrador el permiso task:update.'),
        ] else if (canAct && !canPrimary) ...[
          const SizedBox(height: 12),
          _Notice('Tu perfil no puede ${actionLabel(primaryAction).toLowerCase()} en esta etapa.'),
        ],
        const SizedBox(height: 16),
        _Section(title: 'Información', children: [
          _Info('Etapa', t['stage_name']),
          _Info('Prioridad', priorityLabel(t['priority'])),
          _Info('Vencimiento', formatDate(t['due_at'], withTime: true)),
          _Info('Categoría', t['category']),
          if (t['description'] != null) _Info('Descripción', t['description']),
        ]),
        if (t['document_id'] != null)
          _Section(title: 'Documento', children: [
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.description_outlined, color: AppTheme.teal),
              title: Text(t['document_name'] as String? ?? 'Documento'),
              subtitle: Text('Versión ${t['document_version'] ?? '—'}'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => showDocumentDetail(context, widget.api, t['document_id'] as String),
            ),
          ]),
        if (checklist.isNotEmpty)
          _Section(title: 'Checklist', children: [
            for (final item in _items(t))
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                value: checklist[item['id'].toString()] ?? false,
                onChanged: canAct ? (value) => setState(() => checklist[item['id'].toString()] = value ?? false) : null,
                title: Text('${item['label']}${item['required'] == true ? ' *' : ''}'),
                activeColor: AppTheme.teal,
              ),
          ]),
        _Section(title: 'Comentarios', children: [
          if (comments.isEmpty) Text('Sin comentarios.', style: TextStyle(color: Colors.grey.shade600)),
          for (final c in comments)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(
                radius: 16,
                backgroundColor: AppTheme.mint,
                child: Text(((c['author_name'] as String?) ?? 'U').characters.first, style: const TextStyle(color: AppTheme.teal)),
              ),
              title: Text(c['comment'] as String? ?? ''),
              subtitle: Text('${c['author_name'] ?? ''} · ${formatDate(c['created_at'], withTime: true)}'),
            ),
          if (canComment) Row(children: [
            Expanded(
              child: TextField(
                key: const Key('task-comment'),
                controller: commentController,
                minLines: 1,
                maxLines: 3,
                decoration: const InputDecoration(hintText: 'Escribe un comentario…', isDense: true),
              ),
            ),
            IconButton(onPressed: busy ? null : sendComment, icon: const Icon(Icons.send, color: AppTheme.teal), tooltip: 'Enviar'),
          ]),
        ]),
        if (events.isNotEmpty)
          _Section(title: 'Historial', children: [
            for (final e in events.take(15))
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.history, size: 18, color: Colors.grey),
                title: Text(workflowEventLabel(e['event_type'] as String?)),
                subtitle: Text([
                  '${e['actor_name'] ?? 'Sistema'} · ${formatDate(e['performed_at'], withTime: true)}',
                  if ((e['comment'] as String?)?.isNotEmpty ?? false) e['comment'] as String,
                ].join('\n')),
              ),
          ]),
        const SizedBox(height: 80),
      ],
    );
  }

  Widget _actionBar() => SafeArea(
    child: Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: Row(children: [
        if (canReject || canReturn)
          PopupMenuButton<String>(
            enabled: !busy,
            tooltip: 'Más acciones',
            onSelected: runAction,
            itemBuilder: (_) => [
              if (canReturn) PopupMenuItem(value: 'RETURN', child: Text(actionLabel('RETURN'))),
              if (canReject) PopupMenuItem(value: 'REJECT', child: Text(actionLabel('REJECT'))),
            ],
            child: const Padding(padding: EdgeInsets.all(12), child: Icon(Icons.more_vert)),
          ),
        Expanded(
          child: FilledButton(
            key: const Key('task-primary-action'),
            onPressed: busy || !canPrimary ? null : () => runAction(primaryAction),
            style: FilledButton.styleFrom(backgroundColor: AppTheme.teal, padding: const EdgeInsets.symmetric(vertical: 14)),
            child: Text(actionLabel(primaryAction)),
          ),
        ),
      ]),
    ),
  );
}

class _ActionInput {
  const _ActionInput(this.comment, this.returnStageId);
  final String? comment;
  final String? returnStageId;
}

class _ActionSheet extends StatefulWidget {
  const _ActionSheet({required this.title, required this.commentRequired, required this.destructive, required this.returnStages});

  final String title;
  final bool commentRequired;
  final bool destructive;
  final List<Map<String, dynamic>> returnStages;

  @override
  State<_ActionSheet> createState() => _ActionSheetState();
}

class _ActionSheetState extends State<_ActionSheet> {
  final controller = TextEditingController();
  String? returnStageId;
  String? error;

  @override
  void initState() {
    super.initState();
    if (widget.returnStages.isNotEmpty) returnStageId = widget.returnStages.last['id'] as String?;
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  void confirm() {
    if (widget.commentRequired && controller.text.trim().isEmpty) {
      setState(() => error = 'El comentario es obligatorio para esta acción.');
      return;
    }
    Navigator.pop(context, _ActionInput(controller.text, returnStageId));
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(widget.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 14),
        if (widget.returnStages.isNotEmpty) ...[
          DropdownButtonFormField<String>(
            initialValue: returnStageId,
            decoration: const InputDecoration(labelText: 'Devolver a la etapa'),
            items: [for (final s in widget.returnStages) DropdownMenuItem(value: s['id'] as String, child: Text(s['name'] as String? ?? 'Etapa'))],
            onChanged: (value) => setState(() => returnStageId = value),
          ),
          const SizedBox(height: 12),
        ],
        TextField(
          key: const Key('action-comment'),
          controller: controller,
          minLines: 2,
          maxLines: 5,
          decoration: InputDecoration(
            labelText: widget.commentRequired ? 'Comentario *' : 'Comentario (opcional)',
            errorText: error,
          ),
        ),
        const SizedBox(height: 16),
        FilledButton(
          key: const Key('action-confirm'),
          onPressed: confirm,
          style: FilledButton.styleFrom(
            backgroundColor: widget.destructive ? Colors.red.shade700 : AppTheme.teal,
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          child: const Text('Confirmar'),
        ),
      ],
    ),
  );
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(bottom: 12),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppTheme.line)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.ink)),
      const SizedBox(height: 8),
      ...children,
    ]),
  );
}

class _Info extends StatelessWidget {
  const _Info(this.label, this.value);
  final String label;
  final Object? value;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(width: 110, child: Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 13))),
      Expanded(child: Text(value?.toString() ?? '—', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500))),
    ]),
  );
}

class _Notice extends StatelessWidget {
  const _Notice(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(color: const Color(0xfffef3c7), borderRadius: BorderRadius.circular(8)),
    child: Text(text, style: const TextStyle(fontSize: 13)),
  );
}
