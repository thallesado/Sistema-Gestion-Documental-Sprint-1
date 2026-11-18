import 'package:flutter/material.dart';
import '../core/api/auth_api.dart';
import '../core/errors/api_exception.dart';
import 'auth/login_page.dart';
import 'shell/main_shell_page.dart';
import '../core/i18n/app_language.dart';

class PasswordPage extends StatefulWidget {
  const PasswordPage({super.key, required this.api, this.requiredChange = false});
  final AuthApi api;
  final bool requiredChange;
  @override
  State<PasswordPage> createState() => _PasswordPageState();
}

class RecoveryPage extends StatefulWidget {
  const RecoveryPage({super.key, required this.api, required this.tenants});
  final AuthApi api;
  final List<PublicTenant> tenants;
  @override
  State<RecoveryPage> createState() => _RecoveryPageState();
}

class _RecoveryPageState extends State<RecoveryPage> {
  final form = GlobalKey<FormState>();
  final email = TextEditingController();
  String? tenantId;
  bool busy = false;
  String? message;
  String? error;
  @override
  void dispose() { email.dispose(); super.dispose(); }
  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    setState(() { busy = true; error = null; message = null; });
    try {
      final result = await widget.api.requestRecovery(tenantId: tenantId!, email: email.text);
      if (mounted) setState(() => message = result);
    } on ApiException catch (e) { if (mounted) setState(() => error = e.message); }
    finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) {
    final fields = Form(key: form, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(context.tr('Selecciona tu organización e indica tu correo. Recibirás un enlace de un solo uso si la cuenta existe.')),
      const SizedBox(height: 20),
      DropdownButtonFormField<String>(
        key: const Key('recover-tenant'),
        // ignore: deprecated_member_use
        value: tenantId,
        decoration: InputDecoration(labelText: context.tr('Organización')),
        items: [
          DropdownMenuItem(value: platformTenant, child: Text(context.tr('Plataforma global'))),
          ...widget.tenants.map((t) => DropdownMenuItem(value: t.id, child: Text(t.name))),
          if (tenantId != null && tenantId != platformTenant && !widget.tenants.any((t) => t.id == tenantId))
            DropdownMenuItem(value: tenantId, child: Text(tr('Organización ({id})', {'id': tenantId}))),
        ],
        onChanged: (v) => setState(() => tenantId = v),
        validator: (v) => v == null ? context.tr('Selecciona una organización') : null),
      const SizedBox(height: 12),
      TextFormField(controller: email, keyboardType: TextInputType.emailAddress,
        decoration: InputDecoration(labelText: context.tr('Correo electrónico')),
        validator: (v) => v == null || !v.contains('@') ? context.tr('Indica un correo válido') : null),
      if (error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(error!)),
      if (message != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(message!)),
      const SizedBox(height: 20),
      FilledButton(onPressed: busy ? null : submit, child: Text(busy ? context.tr('Enviando…') : context.tr('Enviar enlace'))),
    ]));
    return Scaffold(appBar: AppBar(title: Text(context.tr('Recuperar acceso'))),
      body: Center(child: SingleChildScrollView(padding: const EdgeInsets.all(24),
        child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 440), child: fields))));
  }
}

class ResetPasswordPage extends StatefulWidget {
  const ResetPasswordPage({super.key, required this.api});
  final AuthApi api;
  @override
  State<ResetPasswordPage> createState() => _ResetPasswordPageState();
}

class _ResetPasswordPageState extends State<ResetPasswordPage> {
  final form = GlobalKey<FormState>();
  final link = TextEditingController();
  final password = TextEditingController();
  final confirmation = TextEditingController();
  bool busy = false;
  String? error;
  @override
  void dispose() { link.dispose(); password.dispose(); confirmation.dispose(); super.dispose(); }
  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    final uri = Uri.tryParse(link.text.trim());
    final token = uri?.queryParameters['token'] ??
        (uri != null && uri.pathSegments.contains('reset-password') && uri.pathSegments.last != 'reset-password'
            ? uri.pathSegments.last : link.text.trim());
    setState(() { busy = true; error = null; });
    try {
      await widget.api.resetPassword(token: token, newPassword: password.text, tenantId: uri?.queryParameters['tenantId']);
      await widget.api.restoreProfile();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute<void>(builder: (_) =>
        widget.api.mustChangePassword ? PasswordPage(api: widget.api, requiredChange: true)
            : MainShellPage(api: widget.api)), (_) => false);
    } on ApiException catch (e) { if (mounted) setState(() => error = e.message); }
    finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) {
    final fields = Form(key: form, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      TextFormField(controller: link, decoration: InputDecoration(labelText: context.tr('Enlace o token de recuperación')),
        validator: (v) => v == null || v.trim().isEmpty ? context.tr('Campo obligatorio') : null),
      const SizedBox(height: 12),
      TextFormField(controller: password, obscureText: true, decoration: InputDecoration(labelText: context.tr('Nueva contraseña')),
        validator: (v) => v == null || v.length < 10 ? context.tr('Mínimo 10 caracteres') : null),
      const SizedBox(height: 12),
      TextFormField(controller: confirmation, obscureText: true, decoration: InputDecoration(labelText: context.tr('Confirmar contraseña')),
        validator: (v) => v != password.text ? context.tr('Las contraseñas no coinciden') : null),
      if (error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(error!)),
      const SizedBox(height: 20),
      FilledButton(onPressed: busy ? null : submit, child: Text(busy ? context.tr('Guardando…') : context.tr('Restablecer contraseña'))),
    ]));
    return Scaffold(appBar: AppBar(title: Text(context.tr('Nueva contraseña'))),
      body: Center(child: SingleChildScrollView(padding: const EdgeInsets.all(24),
        child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 440), child: fields))));
  }
}

class _PasswordPageState extends State<PasswordPage> {
  final form = GlobalKey<FormState>();
  final current = TextEditingController();
  final next = TextEditingController();
  final confirm = TextEditingController();
  bool busy = false;
  String? error;

  @override
  void dispose() { current.dispose(); next.dispose(); confirm.dispose(); super.dispose(); }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    setState(() { busy = true; error = null; });
    try {
      await widget.api.changePassword(currentPassword: current.text, newPassword: next.text);
      if (!mounted) return;
      if (widget.requiredChange) {
        Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute<void>(builder: (_) =>
          LoginPage(authApi: widget.api, notice: context.tr('Contraseña actualizada. Inicia sesión de nuevo.'))), (_) => false);
      } else { Navigator.of(context).pop(true); }
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally { if (mounted) setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) {
    final fields = Form(key: form, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (widget.requiredChange) Padding(padding: EdgeInsets.only(bottom: 20),
        child: Text(context.tr('Debes elegir una contraseña nueva antes de continuar.'))),
      TextFormField(controller: current, obscureText: true, decoration: InputDecoration(labelText: context.tr('Contraseña actual')),
        validator: (v) => v == null || v.isEmpty ? context.tr('Campo obligatorio') : null),
      const SizedBox(height: 12),
      TextFormField(controller: next, obscureText: true, decoration: InputDecoration(labelText: context.tr('Nueva contraseña')),
        validator: (v) => v == null || v.length < 8 ? context.tr('Mínimo 8 caracteres') : null),
      const SizedBox(height: 12),
      TextFormField(controller: confirm, obscureText: true, decoration: InputDecoration(labelText: context.tr('Confirmar contraseña')),
        validator: (v) => v != next.text ? context.tr('Las contraseñas no coinciden') : null),
      if (error != null) Padding(padding: const EdgeInsets.only(top: 12),
        child: Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
      const SizedBox(height: 20),
      FilledButton(onPressed: busy ? null : submit, child: Text(busy ? context.tr('Guardando…') : context.tr('Guardar contraseña'))),
      if (widget.requiredChange) TextButton(onPressed: busy ? null : () async {
        await widget.api.logout();
        if (!context.mounted) return;
        Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute<void>(builder: (_) =>
          LoginPage(authApi: widget.api)), (_) => false);
      }, child: Text(context.tr('Cerrar sesión'))),
    ]));
    return Scaffold(appBar: AppBar(title: Text(widget.requiredChange ? context.tr('Contraseña temporal') : context.tr('Cambiar contraseña')),
        automaticallyImplyLeading: !widget.requiredChange),
      body: Center(child: SingleChildScrollView(padding: const EdgeInsets.all(24),
        child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 440), child: fields))));
  }
}
