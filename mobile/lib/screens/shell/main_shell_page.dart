import 'package:flutter/material.dart';
import '../../core/api/auth_api.dart';
import '../dashboard/dashboard_tab.dart';
import '../documents/documents_tab.dart';
import '../tasks/tasks_tab.dart';
import '../patients/patients_tab.dart';
import '../profile/profile_tab.dart';

class MainShellPage extends StatefulWidget {
  const MainShellPage({super.key, required this.api});

  final AuthApi api;

  @override
  State<MainShellPage> createState() => _MainShellPageState();
}

class _MainShellPageState extends State<MainShellPage> {
  int currentIndex = 0;

  void setTab(int index) {
    setState(() => currentIndex = index);
  }

  String get currentTitle {
    switch (currentIndex) {
      case 0:
        return 'NexoDocs';
      case 1:
        return 'Documentos';
      case 2:
        return 'Mis Tareas';
      case 3:
        return 'Historia Clínica';
      case 4:
        return 'Mi Perfil';
      default:
        return 'NexoDocs';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          currentTitle,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        actions: [
          if (currentIndex == 0)
            IconButton(
              icon: const Badge(
                label: Text('3'),
                child: Icon(Icons.notifications_outlined),
              ),
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Bandeja de avisos: 3 notificaciones no leídas'),
                    duration: Duration(seconds: 2),
                  ),
                );
              },
            ),
        ],
      ),
      body: IndexedStack(
        index: currentIndex,
        children: [
          DashboardTab(api: widget.api, onNavigateToTab: setTab),
          DocumentsTab(api: widget.api),
          TasksTab(api: widget.api),
          PatientsTab(api: widget.api),
          ProfileTab(api: widget.api),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: setTab,
        indicatorColor: const Color(0xffd4ece7),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard, color: Color(0xff087f7b)),
            label: 'Inicio',
          ),
          NavigationDestination(
            icon: Icon(Icons.description_outlined),
            selectedIcon: Icon(Icons.description, color: Color(0xff087f7b)),
            label: 'Documentos',
          ),
          NavigationDestination(
            icon: Icon(Icons.check_circle_outline),
            selectedIcon: Icon(Icons.check_circle, color: Color(0xff087f7b)),
            label: 'Tareas',
          ),
          NavigationDestination(
            icon: Icon(Icons.local_hospital_outlined),
            selectedIcon: Icon(Icons.local_hospital, color: Color(0xff087f7b)),
            label: 'Clínico',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person, color: Color(0xff087f7b)),
            label: 'Perfil',
          ),
        ],
      ),
    );
  }
}
