import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Identificadores de avisos ya mostrados al usuario, sean push o del sondeo.
///
/// Evita mostrar dos veces el mismo aviso: un push que llegó con la app cerrada y después el sondeo
/// que lo encuentra en la bandeja. Se guardan los últimos [maxIds] en almacenamiento seguro.
class SeenNotifications {
  SeenNotifications({FlutterSecureStorage storage = const FlutterSecureStorage()}) : _storage = storage;

  static final instance = SeenNotifications();

  static const storageKey = 'notifications_seen_ids';
  static const maxIds = 200;

  final FlutterSecureStorage _storage;

  /// Marca el aviso como visto. Devuelve false si ya estaba marcado: entonces no debe mostrarse.
  Future<bool> markSeen(String id) async {
    final ids = await _load();
    if (ids.contains(id)) return false;
    ids.add(id);
    final kept = ids.length > maxIds ? ids.sublist(ids.length - maxIds) : ids;
    await _storage.write(key: storageKey, value: jsonEncode(kept));
    return true;
  }

  Future<Set<String>> seenIds() async => (await _load()).toSet();

  Future<void> clear() => _storage.delete(key: storageKey);

  Future<List<String>> _load() async {
    try {
      final raw = await _storage.read(key: storageKey);
      if (raw == null) return <String>[];
      final decoded = jsonDecode(raw);
      return decoded is List ? decoded.whereType<String>().toList() : <String>[];
    } catch (_) {
      // Un valor dañado no debe impedir mostrar avisos: se vuelve a empezar la lista.
      return <String>[];
    }
  }
}
