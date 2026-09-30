import 'package:flutter/material.dart';
import '../../../../core/constants/api_constants.dart';

class ServerConfigDialog extends StatefulWidget {
  const ServerConfigDialog({super.key, required this.onSaved});
  final ValueChanged<String> onSaved;

  @override
  State<ServerConfigDialog> createState() => _ServerConfigDialogState();
}

class _ServerConfigDialogState extends State<ServerConfigDialog> {
  late final TextEditingController serverController;

  @override
  void initState() {
    super.initState();
    serverController = TextEditingController(text: apiBaseUrl);
  }

  @override
  void dispose() {
    serverController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Servidor Backend'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Selecciona o ingresa la URL de la API de Spring Boot:',
            style: TextStyle(fontSize: 12),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: serverController,
            decoration: const InputDecoration(
              labelText: 'URL del servidor',
              hintText: 'http://127.0.0.1:8080/api/v1',
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: [
              ActionChip(
                avatar: const Icon(Icons.usb, size: 16),
                label: const Text('USB (127.0.0.1)'),
                onPressed: () => serverController.text = 'http://127.0.0.1:8080/api/v1',
              ),
              ActionChip(
                avatar: const Icon(Icons.wifi, size: 16),
                label: const Text('Wi-Fi (192.168.100.37)'),
                onPressed: () => serverController.text = 'http://192.168.100.37:8080/api/v1',
              ),
            ],
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: () {
            final newUrl = serverController.text.trim();
            apiBaseUrl = newUrl;
            widget.onSaved(newUrl);
            Navigator.pop(context);
          },
          child: const Text('Guardar'),
        ),
      ],
    );
  }
}
