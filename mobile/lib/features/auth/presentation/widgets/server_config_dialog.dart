import 'package:flutter/material.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/i18n/app_language.dart';

/// Diálogo del ⚙ del login para cambiar la URL de la API.
/// No guarda por sí mismo: entrega la URL a [onSave], que persiste con `ApiClient.saveServerUrl`.
class ServerConfigDialog extends StatefulWidget {
  const ServerConfigDialog({super.key, required this.currentUrl, required this.onSave});

  final String currentUrl;
  final Future<void> Function(String url) onSave;

  @override
  State<ServerConfigDialog> createState() => _ServerConfigDialogState();
}

class _ServerConfigDialogState extends State<ServerConfigDialog> {
  late final TextEditingController _serverController = TextEditingController(text: widget.currentUrl);
  bool _saving = false;

  @override
  void dispose() {
    _serverController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final url = _serverController.text.trim();
    if (url.isEmpty) return;
    setState(() => _saving = true);
    await widget.onSave(url);
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(context.tr('Servidor')),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.tr('URL de la API de NexoDocs. Desde un teléfono usa la IP del equipo que ejecuta el backend.'),
            style: const TextStyle(fontSize: 12),
          ),
          const SizedBox(height: 10),
          TextField(
            key: const Key('server-url'),
            controller: _serverController,
            keyboardType: TextInputType.url,
            decoration: InputDecoration(labelText: context.tr('URL del servidor'), hintText: defaultApiBaseUrl),
          ),
          const SizedBox(height: 12),
          ActionChip(
            avatar: const Icon(Icons.usb, size: 16),
            label: Text(context.tr('USB (adb reverse)')),
            onPressed: () => _serverController.text = defaultApiBaseUrl,
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: _saving ? null : () => Navigator.pop(context), child: Text(context.tr('Cancelar'))),
        FilledButton(onPressed: _saving ? null : _save, child: Text(context.tr('Guardar'))),
      ],
    );
  }
}
