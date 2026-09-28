import 'package:flutter/material.dart';
import '../../core/api/auth_api.dart';

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
      if (mounted) {
        setState(() => error = 'Error al cargar los datos del dashboard');
      }
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
    final activities = (data?['recentActivity'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();

    final pendingTasks = tasks.where((t) => t['status'] != 'COMPLETED').length;

    return RefreshIndicator(
      onRefresh: loadData,
      color: const Color(0xff087f7b),
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        children: [
          // Hero Welcome Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xff087f7b), Color(0xff0f4c47)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xff087f7b).withValues(alpha: 0.25),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.domain, color: Colors.white, size: 14),
                          const SizedBox(width: 4),
                          Text(
                            tenantId.length > 12 ? '${tenantId.substring(0, 8)}...' : tenantId,
                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.folder_shared_outlined, color: Colors.white, size: 28),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  'Buenos días, $firstName $lastName',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Resumen móvil de gestión documental y tareas.',
                  style: TextStyle(color: Color(0xffd4ece7), fontSize: 13),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // KPI Cards Row
          Row(
            children: [
              Expanded(
                child: _buildKpiCard(
                  title: 'Tareas pendientes',
                  value: '$pendingTasks',
                  subtitle: 'Requieren atención',
                  icon: Icons.check_circle_outline,
                  color: const Color(0xffd97706),
                  onTap: () => widget.onNavigateToTab(2), // Tareas tab
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildKpiCard(
                  title: 'Documentos',
                  value: '${docs.length}',
                  subtitle: 'Recientes',
                  icon: Icons.description_outlined,
                  color: const Color(0xff087f7b),
                  onTap: () => widget.onNavigateToTab(1), // Documentos tab
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Section: Mis Tareas Prioritarias
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Mis tareas prioritarias',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xff1f2937)),
              ),
              TextButton(
                onPressed: () => widget.onNavigateToTab(2),
                child: const Text('Ver todas →', style: TextStyle(color: Color(0xff087f7b), fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          if (tasks.isEmpty)
            _buildEmptyCard('No tienes tareas pendientes.')
          else
            ...tasks.take(3).map((task) => _buildTaskItem(task)),

          const SizedBox(height: 20),

          // Section: Documentos Recientes
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Documentos recientes',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xff1f2937)),
              ),
              TextButton(
                onPressed: () => widget.onNavigateToTab(1),
                child: const Text('Ver todos →', style: TextStyle(color: Color(0xff087f7b), fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          if (docs.isEmpty)
            _buildEmptyCard('No hay documentos recientes.')
          else
            ...docs.take(3).map((doc) => _buildDocumentItem(doc)),

          const SizedBox(height: 20),

          // Section: Actividad Reciente
          const Text(
            'Actividad reciente',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xff1f2937)),
          ),
          const SizedBox(height: 8),
          if (activities.isEmpty)
            _buildEmptyCard('No hay registros de actividad recientes.')
          else
            ...activities.take(3).map((act) => _buildActivityItem(act)),

          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xffe5e7eb)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, color: color, size: 20),
                ),
                Icon(Icons.chevron_right, color: Colors.grey.shade400, size: 18),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              value,
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color),
            ),
            const SizedBox(height: 2),
            Text(
              title,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xff374151)),
            ),
            Text(
              subtitle,
              style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTaskItem(Map<String, dynamic> task) {
    final title = task['title'] as String? ?? 'Tarea';
    final status = task['status'] as String? ?? 'PENDING';
    final isDone = status == 'COMPLETED';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xffe5e7eb)),
      ),
      child: Row(
        children: [
          Icon(
            isDone ? Icons.check_circle : Icons.radio_button_unchecked,
            color: isDone ? const Color(0xff10b981) : const Color(0xffd97706),
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    decoration: isDone ? TextDecoration.lineThrough : null,
                    color: isDone ? Colors.grey : const Color(0xff1f2937),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  isDone ? 'Completada' : 'Pendiente de revisión',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: isDone
                  ? const Color(0xffd1fae5)
                  : const Color(0xfffef3c7),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              isDone ? 'Hecha' : 'Pendiente',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: isDone ? const Color(0xff065f46) : const Color(0xff92400e),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDocumentItem(Map<String, dynamic> doc) {
    final name = doc['name'] as String? ?? 'Documento';
    final code = doc['code'] as String? ?? 'DOC';
    final status = doc['status'] as String? ?? 'Aprobado';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xffe5e7eb)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xff087f7b).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.description, color: Color(0xff087f7b), size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xff1f2937)),
                ),
                const SizedBox(height: 2),
                Text(code, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: status == 'Aprobado'
                  ? const Color(0xffd1fae5)
                  : const Color(0xffe0f2fe),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              status,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: status == 'Aprobado' ? const Color(0xff065f46) : const Color(0xff0369a1),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActivityItem(Map<String, dynamic> act) {
    final actor = act['actorName'] as String? ?? 'Usuario';
    final action = act['action'] as String? ?? 'Acción';
    final entity = act['entityType'] as String? ?? 'Registro';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xffe5e7eb)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 14,
            backgroundColor: const Color(0xffd4ece7),
            child: Text(
              actor.isNotEmpty ? actor[0].toUpperCase() : 'U',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xff087f7b)),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '$actor ejecutó $action en $entity',
              style: const TextStyle(fontSize: 12, color: Color(0xff374151)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyCard(String msg) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xffe5e7eb)),
      ),
      child: Center(
        child: Text(msg, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
      ),
    );
  }
}
