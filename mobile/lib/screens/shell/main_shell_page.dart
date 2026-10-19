import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/errors/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../dashboard/dashboard_tab.dart';
import '../documents/documents_tab.dart';
import '../notifications/notifications_page.dart';
import '../patients/patients_tab.dart';
import '../profile/profile_tab.dart';
import '../tasks/tasks_tab.dart';

class MainShellPage extends StatefulWidget {
  const MainShellPage({super.key, required this.api});

  final AuthApi api;

  @override
  State<MainShellPage> createState() => _MainShellPageState();
}

class _MainShellPageState extends State<MainShellPage> {
  int currentIndex = 0;
  int unreadNotifications = 0;

  static const titles = ['NexoDocs', 'Documentos', 'Mis tareas', 'Pacientes', 'Mi perfil'];

  @override
  void initState() {
    super.initState();
    loadUnread();
  }

  Future<void> loadUnread() async {
    try {
      final page = await widget.api.workflows.notifications();
      final items = (page['content'] as List<dynamic>).cast<Map<String, dynamic>>();
      if (mounted) setState(() => unreadNotifications = items.where((i) => i['is_read'] != true).length);
    } on ApiException {
      // El contador es informativo: si falla, la campana se muestra sin número.
    }
  }

  Future<void> openNotifications() async {
    await Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => NotificationsPage(api: widget.api)));
    loadUnread();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(titles[currentIndex], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      backgroundColor: Colors.white,
      elevation: 0,
      scrolledUnderElevation: 1,
      actions: [
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
    body: IndexedStack(
      index: currentIndex,
      children: [
        DashboardTab(api: widget.api, onNavigateToTab: (index) => setState(() => currentIndex = index)),
        DocumentsTab(api: widget.api),
        TasksTab(api: widget.api),
        PatientsTab(api: widget.api),
        ProfileTab(api: widget.api),
      ],
    ),
    bottomNavigationBar: NavigationBar(
      selectedIndex: currentIndex,
      onDestinationSelected: (index) => setState(() => currentIndex = index),
      indicatorColor: AppTheme.mint,
      destinations: const [
        NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard, color: AppTheme.teal), label: 'Inicio'),
        NavigationDestination(icon: Icon(Icons.description_outlined), selectedIcon: Icon(Icons.description, color: AppTheme.teal), label: 'Documentos'),
        NavigationDestination(icon: Icon(Icons.check_circle_outline), selectedIcon: Icon(Icons.check_circle, color: AppTheme.teal), label: 'Tareas'),
        NavigationDestination(icon: Icon(Icons.local_hospital_outlined), selectedIcon: Icon(Icons.local_hospital, color: AppTheme.teal), label: 'Clínico'),
        NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person, color: AppTheme.teal), label: 'Perfil'),
      ],
    ),
  );
}
