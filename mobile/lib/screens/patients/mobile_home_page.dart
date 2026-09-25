import 'package:flutter/material.dart';
import '../../core/api/auth_api.dart';
import '../../core/errors/auth_exception.dart';
import 'widgets/summary_card.dart';

class MobileHome extends StatefulWidget {
  const MobileHome({super.key, required this.api});
  final AuthApi api;

  @override
  State<MobileHome> createState() => _MobileHomeState();
}

class _MobileHomeState extends State<MobileHome> {
  final searchController = TextEditingController();
  List<Map<String, dynamic>> patients = [];
  Map<String, dynamic>? summary;
  bool loading = false;
  String? error;

  @override
  void dispose() {
    searchController.dispose();
    super.dispose();
  }

  Future<void> search() async {
    setState(() {
      loading = true;
      error = null;
      summary = null;
    });
    try {
      final result = await widget.api.patients(searchController.text.trim());
      if (mounted) setState(() => patients = result);
    } catch (exception) {
      if (mounted) {
        setState(
          () => error = exception is AuthException
              ? exception.message
              : 'No se pudo buscar.',
        );
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> openSummary(String id) async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await widget.api.quickSummary(id);
      if (mounted) setState(() => summary = result);
    } catch (exception) {
      if (mounted) {
        setState(
          () => error = exception is AuthException
              ? exception.message
              : 'No se pudo abrir el resumen.',
        );
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Consulta rápida')),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        SearchBar(
          controller: searchController,
          hintText: 'CI, seguro o nombre',
          trailing: [
            IconButton(
              onPressed: loading ? null : search,
              icon: const Icon(Icons.search),
              tooltip: 'Buscar',
            ),
          ],
          onSubmitted: (_) => search(),
        ),
        if (loading) const LinearProgressIndicator(),
        if (error != null)
          Padding(
            padding: const EdgeInsets.all(12),
            child: Text(
              error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ),
        if (summary case final value?)
          SummaryCard(summary: value)
        else
          ...patients.map(
            (patient) => ListTile(
              leading: const CircleAvatar(child: Icon(Icons.person_outline)),
              title: Text('${patient['firstName']} ${patient['lastName']}'),
              subtitle: Text(
                '${patient['documentType']} ${patient['documentNumber']}',
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => openSummary(patient['id'] as String),
            ),
          ),
      ],
    ),
  );
}
