import 'package:flutter/material.dart';
import '../../../../core/api/auth_api.dart';
import '../widgets/dashboard_welcome_card.dart';
import '../widgets/dashboard_kpi_grid.dart';
import '../widgets/dashboard_quick_actions.dart';

class DashboardTab extends StatefulWidget {
  const DashboardTab({
    super.key,
    required this.api,
    required this.onNavigateToTab,
  });

  final AuthApi api;
  final void Function(int tabIndex) onNavigateToTab;

  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> {
  Map<String, dynamic>? data;
  bool loading = true;
  String? error;
  String tenantId = '';

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
      final tId = await widget.api.getTenantId() ?? 'Tenant';
      final res = await widget.api.dashboard();
      if (mounted) {
        setState(() {
          tenantId = tId;
          data = res;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = 'Error al cargar el dashboard');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xff087f7b)),
      );
    }

    final user = data?['currentUser'] as Map<String, dynamic>? ?? {};
    final firstName = user['firstName'] as String? ?? 'Usuario';
    final lastName = user['lastName'] as String? ?? '';
    final tasks = (data?['tasks'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    final docs = (data?['recentDocuments'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    final pendingTasks = tasks.where((t) => t['status'] != 'COMPLETED').length;

    return RefreshIndicator(
      onRefresh: loadData,
      color: const Color(0xff087f7b),
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        children: [
          DashboardWelcomeCard(
            firstName: firstName,
            lastName: lastName,
            tenantId: tenantId,
            pendingTasks: pendingTasks,
          ),
          const SizedBox(height: 16),
          DashboardKpiGrid(
            docCount: docs.length,
            taskCount: pendingTasks,
            onNavigateToTab: widget.onNavigateToTab,
          ),
          const SizedBox(height: 20),
          DashboardQuickActions(onNavigateToTab: widget.onNavigateToTab),
          const SizedBox(height: 20),
          if (error != null)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xfffee2e2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(error!, style: const TextStyle(color: Color(0xffb91c1c), fontSize: 13)),
            ),
        ],
      ),
    );
  }
}
