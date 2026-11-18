import 'package:flutter_test/flutter_test.dart';
import 'package:nexodocs_mobile/core/models/patient_model.dart';

void main() {
  group('PatientModel.fromJson', () {
    test('lee el nombre y el CI con la forma real de GET /patients', () {
      // Respuesta real del backend (PatientResponse) comprobada en el emulador el 2026-11-17.
      final patient = PatientModel.fromJson({
        'id': '70000000-0000-0000-0000-000000000001',
        'documentType': 'CI',
        'documentNumber': '12345678',
        'firstName': 'Paciente',
        'lastName': 'Demostración',
        'birthDate': '1990-01-15',
        'status': 'ACTIVE',
      });

      expect(patient.fullName, 'Paciente Demostración');
      expect(patient.documentNumber, '12345678');
    });

    test('conserva el formato anterior con name y documentId', () {
      final patient = PatientModel.fromJson({'id': 'p1', 'name': 'Sofía Vergara', 'documentId': '31998877'});

      expect(patient.fullName, 'Sofía Vergara');
      expect(patient.documentNumber, '31998877');
    });

    test('sin ningún nombre muestra Sin nombre', () {
      expect(PatientModel.fromJson({'id': 'p2'}).fullName, 'Sin nombre');
    });
  });
}
