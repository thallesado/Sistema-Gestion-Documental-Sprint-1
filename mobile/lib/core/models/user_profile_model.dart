import '../auth/user_permissions.dart';

/// Modelo de dominio para el perfil de usuario autenticado.
class UserProfileModel {
  const UserProfileModel({
    required this.id,
    required this.username,
    required this.email,
    required this.firstName,
    required this.lastName,
    this.tenantId,
    this.tenantName,
    this.role,
    this.permissions = const UserPermissions({}),
    this.rawJson = const {},
  });

  factory UserProfileModel.fromJson(Map<String, dynamic> json) {
    return UserProfileModel(
      id: json['id'] as String? ?? json['userId'] as String? ?? '',
      username: json['username'] as String? ?? json['email'] as String? ?? '',
      email: json['email'] as String? ?? '',
      firstName: json['firstName'] as String? ?? '',
      lastName: json['lastName'] as String? ?? '',
      tenantId: json['tenantId'] as String?,
      tenantName: json['tenantName'] as String?,
      role: json['role'] as String? ?? json['roleName'] as String?,
      permissions: UserPermissions.fromJson(json),
      rawJson: json,
    );
  }

  final String id;
  final String username;
  final String email;
  final String firstName;
  final String lastName;
  final String? tenantId;
  final String? tenantName;
  final String? role;
  final UserPermissions permissions;
  final Map<String, dynamic> rawJson;

  dynamic operator [](String key) => rawJson[key];

  String get fullName {
    final name = '$firstName $lastName'.trim();
    return name.isNotEmpty ? name : username;
  }

  String get initials {
    final f = firstName.isNotEmpty ? firstName[0].toUpperCase() : '';
    final l = lastName.isNotEmpty ? lastName[0].toUpperCase() : '';
    if (f.isNotEmpty || l.isNotEmpty) return '$f$l';
    return username.isNotEmpty ? username[0].toUpperCase() : 'U';
  }

  Map<String, dynamic> toJson() => rawJson.isNotEmpty
      ? rawJson
      : {
          'id': id,
          'username': username,
          'email': email,
          'firstName': firstName,
          'lastName': lastName,
          'tenantId': tenantId,
          'tenantName': tenantName,
          'role': role,
        };
}
