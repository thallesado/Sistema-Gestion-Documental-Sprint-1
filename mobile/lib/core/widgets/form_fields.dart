import 'dart:async';

import 'package:flutter/material.dart';

import '../errors/api_exception.dart';
import '../i18n/app_language.dart';
import '../theme/app_theme.dart';

/// Fecha en formato ISO `yyyy-MM-dd`, el que esperan los `LocalDate` del backend.
String? isoDate(DateTime? date) => date == null
    ? null
    : '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

/// Campo de fecha con el selector nativo de Material.
class DateField extends StatelessWidget {
  const DateField({super.key, required this.label, required this.value, required this.onChanged, this.enabled = true});

  final String label;
  final DateTime? value;
  final ValueChanged<DateTime?> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: enabled
        ? () async {
            final now = DateTime.now();
            final picked = await showDatePicker(
              context: context,
              initialDate: value ?? now,
              firstDate: DateTime(now.year - 50),
              lastDate: DateTime(now.year + 50),
            );
            if (picked != null) onChanged(picked);
          }
        : null,
    child: InputDecorator(
      isEmpty: value == null,
      decoration: InputDecoration(
        labelText: label,
        enabled: enabled,
        suffixIcon: value != null && enabled
            ? IconButton(tooltip: context.tr('Quitar fecha'), icon: const Icon(Icons.clear, size: 18), onPressed: () => onChanged(null))
            : const Icon(Icons.calendar_today_outlined, size: 18),
      ),
      child: Text(value == null ? '' : '${value!.day.toString().padLeft(2, '0')}/${value!.month.toString().padLeft(2, '0')}/${value!.year}'),
    ),
  );
}

/// Opción elegida en [SearchPickerField].
class PickerOption {
  const PickerOption(this.id, this.label, {this.subtitle});

  final String id;
  final String label;
  final String? subtitle;
}

/// Campo que abre un buscador contra la API (pacientes, expedientes…).
class SearchPickerField extends StatelessWidget {
  const SearchPickerField({
    super.key,
    required this.label,
    required this.value,
    required this.search,
    required this.onChanged,
    this.enabled = true,
    this.icon = Icons.search,
  });

  final String label;
  final PickerOption? value;
  final Future<List<PickerOption>> Function(String query) search;
  final ValueChanged<PickerOption?> onChanged;
  final bool enabled;
  final IconData icon;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: enabled
        ? () async {
            final picked = await showDialog<PickerOption>(
              context: context,
              builder: (_) => _SearchPickerDialog(title: label, search: search),
            );
            if (picked != null) onChanged(picked);
          }
        : null,
    child: InputDecorator(
      isEmpty: value == null,
      decoration: InputDecoration(
        labelText: label,
        enabled: enabled,
        suffixIcon: value != null && enabled
            ? IconButton(tooltip: context.tr('Quitar'), icon: const Icon(Icons.clear, size: 18), onPressed: () => onChanged(null))
            : Icon(icon, size: 18),
      ),
      child: Text(value?.label ?? '', maxLines: 1, overflow: TextOverflow.ellipsis),
    ),
  );
}

class _SearchPickerDialog extends StatefulWidget {
  const _SearchPickerDialog({required this.title, required this.search});

  final String title;
  final Future<List<PickerOption>> Function(String query) search;

  @override
  State<_SearchPickerDialog> createState() => _SearchPickerDialogState();
}

class _SearchPickerDialogState extends State<_SearchPickerDialog> {
  final query = TextEditingController();
  List<PickerOption> options = [];
  bool loading = false;
  String? error;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _run();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    query.dispose();
    super.dispose();
  }

  Future<void> _run() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await widget.search(query.text.trim());
      if (mounted) setState(() => options = result);
    } on ApiException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.title),
    contentPadding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
    content: SizedBox(
      width: double.maxFinite,
      height: 360,
      child: Column(
        children: [
          TextField(
            key: const Key('picker-search'),
            controller: query,
            autofocus: true,
            decoration: InputDecoration(hintText: context.tr('Buscar...'), prefixIcon: const Icon(Icons.search), isDense: true),
            onChanged: (_) {
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 350), _run);
            },
            onSubmitted: (_) => _run(),
          ),
          if (loading) const LinearProgressIndicator(color: AppTheme.teal),
          const SizedBox(height: 8),
          Expanded(
            child: error != null
                ? Center(child: Text(error!, textAlign: TextAlign.center, style: TextStyle(color: Colors.red.shade700)))
                : options.isEmpty && !loading
                ? Center(child: Text(context.tr('Sin resultados.'), style: TextStyle(color: Colors.grey.shade600)))
                : ListView.builder(
                    itemCount: options.length,
                    itemBuilder: (context, index) {
                      final option = options[index];
                      return ListTile(
                        key: Key('picker-option-${option.id}'),
                        dense: true,
                        title: Text(option.label),
                        subtitle: option.subtitle == null ? null : Text(option.subtitle!),
                        onTap: () => Navigator.of(context).pop(option),
                      );
                    },
                  ),
          ),
        ],
      ),
    ),
    actions: [TextButton(onPressed: () => Navigator.of(context).pop(), child: Text(context.tr('Cancelar')))],
  );
}

/// Tarjeta con título de sección, usada en formularios y fichas.
class SectionCard extends StatelessWidget {
  const SectionCard({super.key, required this.title, required this.children, this.trailing, this.icon});

  final String title;
  final List<Widget> children;
  final Widget? trailing;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Card(
    elevation: 0,
    margin: const EdgeInsets.only(bottom: 12),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
    child: Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              if (icon != null) ...[Icon(icon, size: 18, color: AppTheme.teal), const SizedBox(width: 8)],
              Expanded(
                child: Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.tealDark)),
              ),
              ?trailing,
            ],
          ),
          const SizedBox(height: 10),
          ...children,
        ],
      ),
    ),
  );
}

/// Par etiqueta/valor de solo lectura.
class InfoRow extends StatelessWidget {
  const InfoRow(this.label, this.value, {super.key});

  final String label;
  final Object? value;

  @override
  Widget build(BuildContext context) {
    final text = value == null || '$value'.trim().isEmpty ? '—' : '$value';
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
          const SizedBox(height: 2),
          Text(text, style: const TextStyle(fontSize: 14, color: AppTheme.ink)),
        ],
      ),
    );
  }
}
