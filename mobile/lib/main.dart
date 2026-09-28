import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

const apiBaseUrl = String.fromEnvironment(
  'NEXODOCS_API_URL',
  defaultValue: 'http://10.0.2.2:8080/api/v1',
);

void main() => runApp(const NexoDocsApp());

class NexoDocsApp extends StatelessWidget {
  const NexoDocsApp({super.key, this.authApi});

  final AuthApi? authApi;

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'NexoDocs',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff087f7b)),
      scaffoldBackgroundColor: const Color(0xfff4f8f7),
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
      ),
      useMaterial3: true,
    ),
    home: LoginPage(authApi: authApi ?? AuthApi()),
  );
}

class AuthApi {
  AuthApi({http.Client? client, FlutterSecureStorage? storage})
    : _client = client ?? http.Client(),
      _storage = storage ?? const FlutterSecureStorage();

  final http.Client _client;
  final FlutterSecureStorage _storage;

  Future<void> login({
    required String tenantId,
    required String username,
    required String password,
  }) async {
    final response = await _client.post(
      Uri.parse('$apiBaseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'tenantId': tenantId,
        'usernameOrEmail': username,
        'password': password,
      }),
    );
    if (response.statusCode != 200) {
      throw AuthException(
        response.statusCode == 401
            ? 'Credenciales u organización inválidas.'
            : 'No fue posible iniciar sesión (${response.statusCode}).',
      );
    }
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    final token = body['token'] as String?;
    final refreshToken = body['refreshToken'] as String?;
    if (token == null || refreshToken == null) {
      throw const AuthException('Respuesta de sesión incompleta.');
    }
    await _storage.write(key: 'access_token', value: token);
    await _storage.write(key: 'refresh_token', value: refreshToken);
  }

  Future<List<Map<String, dynamic>>> patients(String filter) async {
    final response = await _get(
      '/patients?size=20&filter=${Uri.encodeQueryComponent(filter)}',
    );
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    return (body['content'] as List<dynamic>).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> quickSummary(String patientId) async {
    final response = await _get('/patients/$patientId/quick-summary');
    return jsonDecode(response.body) as Map<String, dynamic>;
  }

  Future<http.Response> _get(String path) async {
    final token = await _storage.read(key: 'access_token');
    if (token == null) throw const AuthException('La sesión móvil expiró.');
    final response = await _client.get(
      Uri.parse('$apiBaseUrl$path'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode != 200) {
      throw AuthException('La consulta falló (${response.statusCode}).');
    }
    return response;
  }
}

class AuthException implements Exception {
  const AuthException(this.message);
  final String message;
}

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
          builder: (_) => MobileHome(api: widget.authApi),
        ),
      );
    } on AuthException catch (exception) {
      if (mounted) setState(() => error = exception.message);
    } catch (_) {
      if (mounted) setState(() => error = 'No se pudo conectar con NexoDocs.');
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
                      const SizedBox(height: 24),
                      TextFormField(
                        key: const Key('tenant'),
                        controller: tenantController,
                        decoration: const InputDecoration(
                          labelText: 'Organización',
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
          _SummaryCard(summary: value)
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

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.summary});
  final Map<String, dynamic> summary;

  @override
  Widget build(BuildContext context) {
    final allergies = (summary['allergies'] as List<dynamic>? ?? []);
    final diagnoses = (summary['baseDiagnoses'] as List<dynamic>? ?? []);
    final notes = (summary['recentNotes'] as List<dynamic>? ?? []);
    return Card(
      margin: const EdgeInsets.only(top: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              summary['patientName'] as String? ?? '',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            Text(summary['document'] as String? ?? ''),
            const Divider(),
            Text('Alergias', style: Theme.of(context).textTheme.titleMedium),
            Text(
              allergies.isEmpty
                  ? 'Ninguna registrada'
                  : allergies
                        .map(
                          (item) => (item as Map<String, dynamic>)['allergen'],
                        )
                        .join(', '),
            ),
            const SizedBox(height: 12),
            Text(
              'Diagnósticos',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            Text(
              diagnoses.isEmpty
                  ? 'Ninguno registrado'
                  : diagnoses
                        .map(
                          (item) =>
                              (item as Map<String, dynamic>)['description'],
                        )
                        .join(', '),
            ),
            const SizedBox(height: 12),
            Text(
              'Notas recientes',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            if (notes.isEmpty) const Text('Sin notas recientes'),
            ...notes.map((item) {
              final note = item as Map<String, dynamic>;
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(note['type'] as String? ?? 'Nota'),
                subtitle: Text(note['content'] as String? ?? ''),
              );
            }),
          ],
        ),
      ),
    );
  }
}
