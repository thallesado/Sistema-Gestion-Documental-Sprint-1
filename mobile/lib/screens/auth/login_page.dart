import 'package:flutter/material.dart';
import '../../core/api/auth_api.dart';
import '../../core/constants/api_constants.dart';
import '../../core/errors/auth_exception.dart';
import '../../features/auth/presentation/widgets/server_config_dialog.dart';
import '../shell/main_shell_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.authApi});
  final AuthApi authApi;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final formKey = GlobalKey<FormState>();
  final tenantController = TextEditingController();
  final userController = TextEditingController();
  final passwordController = TextEditingController();
  bool submitting = false;
  String? error;

  @override
  void dispose() {
    tenantController.dispose();
    userController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  void showServerDialog() {
    showDialog<void>(
      context: context,
      builder: (ctx) => ServerConfigDialog(
        onSaved: (url) {
          setState(() {});
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Servidor actualizado a $url')),
          );
        },
      ),
    );
  }

  Future<void> submit() async {
    if (!formKey.currentState!.validate()) return;
    setState(() {
      submitting = true;
      error = null;
    });
    try {
      await widget.authApi.login(
        tenantId: tenantController.text.trim(),
        username: userController.text.trim(),
        password: passwordController.text,
      );
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => MainShellPage(api: widget.authApi),
        ),
      );
    } on AuthException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } catch (e) {
      if (mounted) setState(() => error = 'Error de conexión: $e');
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Form(
                  key: formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Align(
                        alignment: Alignment.topRight,
                        child: IconButton(
                          icon: const Icon(Icons.settings_outlined, size: 20, color: Colors.grey),
                          tooltip: 'Configurar servidor',
                          onPressed: showServerDialog,
                        ),
                      ),
                      const Icon(
                        Icons.folder_shared_outlined,
                        size: 52,
                        color: Color(0xff087f7b),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'NexoDocs',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineMedium,
                      ),
                      const Text(
                        'Acceso clínico móvil',
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 20),
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        alignment: WrapAlignment.center,
                        children: [
                          ActionChip(
                            avatar: const Icon(Icons.business, size: 14),
                            label: const Text('Admin (Laura)', style: TextStyle(fontSize: 12)),
                            onPressed: () {
                              setState(() {
                                tenantController.text = '20000000-0000-0000-0000-000000000001';
                                userController.text = 'laura@acme.com';
                                passwordController.text = 'DemoPass123!';
                                error = null;
                              });
                            },
                          ),
                          ActionChip(
                            avatar: const Icon(Icons.shield_outlined, size: 14),
                            label: const Text('SuperAdmin (Carlos)', style: TextStyle(fontSize: 12)),
                            onPressed: () {
                              setState(() {
                                tenantController.text = '';
                                userController.text = 'carlos@nexodocs.com';
                                passwordController.text = 'DemoPass123!';
                                error = null;
                              });
                            },
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        key: const Key('tenant'),
                        controller: tenantController,
                        decoration: const InputDecoration(
                          labelText: 'Organización (Tenant ID)',
                        ),
                        validator: requiredField,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        key: const Key('username'),
                        controller: userController,
                        keyboardType: TextInputType.emailAddress,
                        autofillHints: const [AutofillHints.username],
                        decoration: const InputDecoration(
                          labelText: 'Correo o usuario',
                        ),
                        validator: requiredField,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        key: const Key('password'),
                        controller: passwordController,
                        obscureText: true,
                        autofillHints: const [AutofillHints.password],
                        decoration: const InputDecoration(
                          labelText: 'Contraseña',
                        ),
                        validator: requiredField,
                      ),
                      if (error != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Text(
                            error!,
                            key: const Key('login-error'),
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                            ),
                          ),
                        ),
                      const SizedBox(height: 18),
                      FilledButton(
                        key: const Key('login-submit'),
                        onPressed: submitting ? null : submit,
                        child: Text(
                          submitting ? 'Validando…' : 'Iniciar sesión',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );

  static String? requiredField(String? value) =>
      value == null || value.trim().isEmpty ? 'Campo obligatorio' : null;
}
