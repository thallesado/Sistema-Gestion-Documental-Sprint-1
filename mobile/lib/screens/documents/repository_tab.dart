import 'package:flutter/material.dart';

import '../../core/api/auth_api.dart';
import '../../core/auth/user_permissions.dart';
import '../../core/i18n/app_language.dart';
import '../../core/theme/app_theme.dart';
import '../expedients/expedients_view.dart';
import 'documents_tab.dart';

/// Pestaña "Documentos": repositorio documental y, si el perfil puede verlos, expedientes.
class RepositoryTab extends StatefulWidget {
  const RepositoryTab({super.key, required this.api});

  final AuthApi api;

  @override
  State<RepositoryTab> createState() => _RepositoryTabState();
}

enum _Section { documents, expedients }

class _RepositoryTabState extends State<RepositoryTab> {
  _Section section = _Section.documents;

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<UserPermissions>(
    valueListenable: widget.api.permissions,
    builder: (context, permissions, _) {
      final sections = [
        if (permissions.can(Permissions.documentRead)) _Section.documents,
        if (permissions.can(Permissions.expedientRead)) _Section.expedients,
      ];
      if (sections.isEmpty) return const SizedBox.shrink();
      final current = sections.contains(section) ? section : sections.first;
      final view = switch (current) {
        _Section.documents => DocumentsTab(api: widget.api),
        _Section.expedients => ExpedientsView(api: widget.api),
      };
      if (sections.length == 1) return view;
      return Column(
        children: [
          Container(
            width: double.infinity,
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
            child: SegmentedButton<_Section>(
              key: const Key('repository-sections'),
              showSelectedIcon: false,
              style: SegmentedButton.styleFrom(selectedBackgroundColor: AppTheme.mint, selectedForegroundColor: AppTheme.teal),
              segments: [
                ButtonSegment(value: _Section.documents, icon: const Icon(Icons.description_outlined, size: 18), label: Text(context.tr('Documentos'))),
                ButtonSegment(value: _Section.expedients, icon: const Icon(Icons.folder_outlined, size: 18), label: Text(context.tr('Expedientes'))),
              ],
              selected: {current},
              onSelectionChanged: (selected) => setState(() => section = selected.first),
            ),
          ),
          Expanded(child: view),
        ],
      );
    },
  );
}
