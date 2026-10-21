import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/auth/user_permissions.dart';
import '../../core/errors/api_exception.dart';
import '../../core/notifications/workflow_notifications.dart';
import '../../core/theme/app_theme.dart';
import '../dashboard/dashboard_tab.dart';
import '../documents/documents_tab.dart';
import '../notifications/notifications_page.dart';
import '../patients/patients_tab.dart';
import '../profile/profile_tab.dart';
import '../scan/scan_document_page.dart';
import '../tasks/task_detail_page.dart';
import '../tasks/tasks_tab.dart';

/// Pestañas de la app. El índice lógico (posición en [values]) es el que usa el Inicio para
/// navegar; el índice visible cambia cuando el perfil no tiene permiso para alguna pestaña.
enum ShellTab {
  home('Inicio', 'NexoDocs', Icons.dashboard_outlined, Icons.dashboard, null),
  documents('Documentos', 'Documentos', Icons.description_outlined, Icons.description, Permissions.documentRead),
  tasks('Tareas', 'Mis tareas', Icons.check_circle_outline, Icons.check_circle, Permissions.taskRead),
  clinical('Clínico', 'Pacientes', Icons.local_hospital_outlined, Icons.local_hospital, Permissions.patientRead),
  profile('Perfil', 'Mi perfil', Icons.person_outline, Icons.person, null);

  const ShellTab(this.label, this.title, this.icon, this.selectedIcon, this.permission);

  final String label;
  final String title;
  final IconData icon;
  final IconData selectedIcon;

  /// Permiso del endpoint que usa la pestaña (mismo criterio que el menú de la web).
  final String? permission;
}

class MainShellPage extends StatefulWidget {
  const MainShellPage({super.key, required this.api, this.notifications});

  final AuthApi api;

  /// Avisos del sistema; `null` usa [WorkflowNotifications.instance].
  final WorkflowNotifications? notifications;

  @override
  State<MainShellPage> createState() => _MainShellPageState();
}

class _MainShellPageState extends State<MainShellPage> with WidgetsBindingObserver {
  static const _refreshInterval = Duration(minutes: 1);

  ShellTab current = ShellTab.home;
  int unreadNotifications = 0;
  Timer? _timer;

  WorkflowNotifications get _notifications => widget.notifications ?? WorkflowNotifications.instance;
  UserPermissions get permissions => widget.api.permissions.value;

  List<ShellTab> get visibleTabs => ShellTab.values.where((tab) => tab.permission == null || permissions.can(tab.permission!)).toList();

  bool get canSeeNotifications => permissions.can(Permissions.notificationRead);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.api.permissions.addListener(_onPermissionsChanged);
    _notifications.onOpenTask = _openTask;
    _start();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    widget.api.permissions.removeListener(_onPermissionsChanged);
    if (_notifications.onOpenTask == _openTask) _notifications.onOpenTask = null;
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _start() async {
    await widget.api.loadPermissions();
    if (!mounted) return;
    if (canSeeNotifications) {
      await _notifications.start();
      await loadUnread();
      _timer = Timer.periodic(_refreshInterval, (_) => loadUnread());
    }
    final pending = _notifications.takePendingTask();
    if (pending != null && mounted) _openTask(pending);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && canSeeNotifications) loadUnread();
  }

  void _onPermissionsChanged() {
    if (!mounted) return;
    setState(() {
      if (!visibleTabs.contains(current)) current = ShellTab.home;
    });
  }

  Future<void> loadUnread() async {
    if (!canSeeNotifications) return;
    try {
      final page = await widget.api.workflows.notifications();
      final items = (page['content'] as List<dynamic>).cast<Map<String, dynamic>>();
      if (mounted) setState(() => unreadNotifications = items.where((i) => i['is_read'] != true).length);
      await _notifications.notifyNew(items);
    } on ApiException {
      // El contador es informativo: si falla, la campana se muestra sin número.
    }
  }

  Future<void> openNotifications() async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => NotificationsPage(api: widget.api)));
    loadUnread();
  }

  void _openTask(String taskId) {
    if (!mounted || !permissions.can(Permissions.taskRead)) return;
    Navigator.of(context).push(
      MaterialPageRoute<bool>(
        builder: (_) => TaskDetailPage(api: widget.api, taskId: taskId),
      ),
    );
  }

  /// El Inicio navega con el índice lógico; si la pestaña no está permitida no hace nada.
  void _navigateFromHome(int logicalIndex) {
    if (logicalIndex < 0 || logicalIndex >= ShellTab.values.length) return;
    final tab = ShellTab.values[logicalIndex];
    if (visibleTabs.contains(tab)) setState(() => current = tab);
  }

  Widget _page(ShellTab tab) => switch (tab) {
    ShellTab.home => DashboardTab(api: widget.api, onNavigateToTab: _navigateFromHome),
    ShellTab.documents => DocumentsTab(api: widget.api),
    ShellTab.tasks => TasksTab(api: widget.api),
    ShellTab.clinical => PatientsTab(api: widget.api),
    ShellTab.profile => ProfileTab(api: widget.api),
  };

  @override
  Widget build(BuildContext context) {
    final tabs = visibleTabs;
    final index = tabs.indexOf(current).clamp(0, tabs.length - 1);
    return Scaffold(
      appBar: AppBar(
        title: Text(tabs[index].title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        actions: [
          IconButton(
            key: const Key('scan-button'),
            tooltip: 'Escanear con cámara',
            icon: const Icon(Icons.document_scanner_outlined, color: AppTheme.teal),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => ScanDocumentPage(api: widget.api)),
            ),
          ),
          if (canSeeNotifications)
            IconButton(
              key: const Key('notifications-button'),
              tooltip: 'Notificaciones',
              icon: Badge(
                isLabelVisible: unreadNotifications > 0,
                label: Text('$unreadNotifications'),
                child: const Icon(Icons.notifications_outlined),
              ),
              onPressed: openNotifications,
            ),
        ],
      ),
      body: IndexedStack(index: index, children: [for (final tab in tabs) _page(tab)]),
      floatingActionButton: FloatingActionButton.extended(
        key: const Key('scan-fab'),
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => ScanDocumentPage(api: widget.api)),
        ),
        backgroundColor: AppTheme.teal,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.camera_alt),
        label: const Text('Escanear', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (selected) => setState(() => current = tabs[selected]),
        indicatorColor: AppTheme.mint,
        destinations: [
          for (final tab in tabs)
            NavigationDestination(
              icon: Icon(tab.icon),
              selectedIcon: Icon(tab.selectedIcon, color: AppTheme.teal),
              label: tab.label,
            ),
        ],
      ),
    );
  }
}
