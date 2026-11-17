import 'package:flutter/material.dart';
import '../core/api/auth_api.dart';
import '../core/errors/api_exception.dart';
import 'auth/login_page.dart';
import 'shell/main_shell_page.dart';

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
      const Text('Selecciona tu organización e indica tu correo. Recibirás un enlace de un solo uso si la cuenta existe.'),
      const SizedBox(height: 20),
      DropdownButtonFormField<String>(
        key: const Key('recover-tenant'),
        // ignore: deprecated_member_use
        value: tenantId,
        decoration: const InputDecoration(labelText: 'Organización'),
        items: [
          const DropdownMenuItem(value: platformTenant, child: Text('Plataforma global')),
          ...widget.tenants.map((t) => DropdownMenuItem(value: t.id, child: Text(t.name))),
          if (tenantId != null && tenantId != platformTenant && !widget.tenants.any((t) => t.id == tenantId))
            DropdownMenuItem(value: tenantId, child: Text('Organización ($tenantId)')),
        ],
        onChanged: (v) => setState(() => tenantId = v),
        validator: (v) => v == null ? 'Selecciona una organización' : null),
      const SizedBox(height: 12),
      TextFormField(controller: email, keyboardType: TextInputType.emailAddress,
        decoration: const InputDecoration(labelText: 'Correo electrónico'),
        validator: (v) => v == null || !v.contains('@') ? 'Indica un correo válido' : null),
      if (error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(error!)),
      if (message != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(message!)),
      const SizedBox(height: 20),
      FilledButton(onPressed: busy ? null : submit, child: Text(busy ? 'Enviando…' : 'Enviar enlace')),
    ]));
    return Scaffold(appBar: AppBar(title: const Text('Recuperar acceso')),
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
      TextFormField(controller: link, decoration: const InputDecoration(labelText: 'Enlace o token de recuperación'),
        validator: (v) => v == null || v.trim().isEmpty ? 'Campo obligatorio' : null),
      const SizedBox(height: 12),
      TextFormField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'Nueva contraseña'),
        validator: (v) => v == null || v.length < 10 ? 'Mínimo 10 caracteres' : null),
      const SizedBox(height: 12),
      TextFormField(controller: confirmation, obscureText: true, decoration: const InputDecoration(labelText: 'Confirmar contraseña'),
        validator: (v) => v != password.text ? 'Las contraseñas no coinciden' : null),
      if (error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(error!)),
      const SizedBox(height: 20),
      FilledButton(onPressed: busy ? null : submit, child: Text(busy ? 'Guardando…' : 'Restablecer contraseña')),
    ]));
    return Scaffold(appBar: AppBar(title: const Text('Nueva contraseña')),
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
          LoginPage(authApi: widget.api, notice: 'Contraseña actualizada. Inicia sesión de nuevo.')), (_) => false);
      } else { Navigator.of(context).pop(true); }
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally { if (mounted) setState(() => busy = false); }
  }

  @override
  Widget build(BuildContext context) {
    final fields = Form(key: form, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (widget.requiredChange) const Padding(padding: EdgeInsets.only(bottom: 20),
        child: Text('Debes elegir una contraseña nueva antes de continuar.')),
      TextFormField(controller: current, obscureText: true, decoration: const InputDecoration(labelText: 'Contraseña actual'),
        validator: (v) => v == null || v.isEmpty ? 'Campo obligatorio' : null),
      const SizedBox(height: 12),
      TextFormField(controller: next, obscureText: true, decoration: const InputDecoration(labelText: 'Nueva contraseña'),
        validator: (v) => v == null || v.length < 8 ? 'Mínimo 8 caracteres' : null),
      const SizedBox(height: 12),
      TextFormField(controller: confirm, obscureText: true, decoration: const InputDecoration(labelText: 'Confirmar contraseña'),
        validator: (v) => v != next.text ? 'Las contraseñas no coinciden' : null),
      if (error != null) Padding(padding: const EdgeInsets.only(top: 12),
        child: Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
      const SizedBox(height: 20),
      FilledButton(onPressed: busy ? null : submit, child: Text(busy ? 'Guardando…' : 'Guardar contraseña')),
      if (widget.requiredChange) TextButton(onPressed: busy ? null : () async {
        await widget.api.logout();
        if (!context.mounted) return;
        Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute<void>(builder: (_) =>
          LoginPage(authApi: widget.api)), (_) => false);
      }, child: const Text('Cerrar sesión')),
    ]));
    return Scaffold(appBar: AppBar(title: Text(widget.requiredChange ? 'Contraseña temporal' : 'Cambiar contraseña'),
        automaticallyImplyLeading: !widget.requiredChange),
      body: Center(child: SingleChildScrollView(padding: const EdgeInsets.all(24),
        child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 440), child: fields))));
  }
}
