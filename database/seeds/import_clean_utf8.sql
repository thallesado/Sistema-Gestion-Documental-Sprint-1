BEGIN;
SET LOCAL app.bypass_rls = 'on';
SET client_encoding = 'UTF8';

INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '93868', 'Yesenia', 'Ortiz Gonzales', '2017-05-03', 'Femenino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '93868' LIMIT 1), 'HC-2026-1001', 'A+', 'Hospitalización por: Colecistectomía (2023) Año: 2023 Evolución: Resuelto completamente', 'Asma bronquial', '[{"allergen": "Mariscos", "severity": "HIGH", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Enalapril 10mg", "dose": "Según necesidad", "frequency": "Uso habitual"}]'::jsonb, 'Se sugiere seguimiento nutricional y control periódico de presión arterial.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '20373', 'Marisol', 'Condori Rivero', '1973-01-10', 'Femenino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '20373' LIMIT 1), 'HC-2026-1010', 'B-', 'Hospitalización por: Colecistectomía (2023) Año: 2017 Evolución: Favorable', 'Ninguna', '[{"allergen": "Polvo doméstico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Levotiroxina 100mcg", "dose": "1 vez al día", "frequency": "Uso habitual"}]'::jsonb, 'Se recomienda control en 6 meses y actualización de esquema de vacunación.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '86220', 'Marcelo', 'Ortiz Gonzales', '2016-07-03', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '86220' LIMIT 1), 'HC-2026-1011', 'A+', 'Hospitalización por: Apendicitis (2021) Año: 2023 Evolución: Sin secuelas', 'Hipertensión arterial', '[{"allergen": "Polvo doméstico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Levotiroxina 100mcg", "dose": "1 vez al día", "frequency": "Uso habitual"}]'::jsonb, 'Paciente acude acompañado de familiar, buena adherencia a indicaciones previas.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '56248', 'Fernanda', 'Suárez Apaza', '1965-11-14', 'Femenino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '56248' LIMIT 1), 'HC-2026-1012', 'A+', 'Hospitalización por: Apendicitis (2021) Año: 2016 Evolución: Sin secuelas', 'Epilepsia', '[{"allergen": "Mariscos", "severity": "HIGH", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Losartán 50mg", "dose": "Cada 12 horas", "frequency": "Uso habitual"}]'::jsonb, 'Refiere buen estado general, sin quejas agudas al momento de la consulta.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '64026', 'Gloria', 'Paz Gonzales', '2024-10-18', 'Femenino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '64026' LIMIT 1), 'HC-2026-1013', 'O+', 'Hospitalización por: Apendicitis (2021) Año: 2020 Evolución: Sin secuelas', 'Epilepsia', '[{"allergen": "Polvo doméstico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Metformina 850mg", "dose": "Cada 8 horas", "frequency": "Uso habitual"}]'::jsonb, 'Sin observaciones adicionales relevantes en la presente consulta.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '51737', 'Fernando', 'Mendoza Rivero', '2005-08-18', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '51737' LIMIT 1), 'HC-2026-1014', 'B-', 'Hospitalización por: Parto (2020) Año: 2023 Evolución: Sin secuelas', 'Asma bronquial', '[{"allergen": "Polvo doméstico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Metformina 850mg", "dose": "Cada 12 horas", "frequency": "Uso habitual"}]'::jsonb, 'Se recomienda control en 6 meses y actualización de esquema de vacunación.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '65960', 'Andrés', 'Aguilar Choque', '1951-02-14', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '65960' LIMIT 1), 'HC-2026-1015', 'AB+', 'Hospitalización por: Ninguna Año: 2015 Evolución: Sin secuelas', 'Ninguna', '[{"allergen": "Ninguna conocida", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Losartán 50mg", "dose": "1 vez al día", "frequency": "Uso habitual"}]'::jsonb, 'Se sugiere seguimiento nutricional y control periódico de presión arterial.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '15742', 'Miguel', 'Ortiz Rojas', '1988-06-26', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '15742' LIMIT 1), 'HC-2026-1016', 'AB+', 'Hospitalización por: Colecistectomía (2023) Año: 2018 Evolución: Sin secuelas', 'Epilepsia', '[{"allergen": "Ácido acetilsalicílico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Salbutamol inhalador", "dose": "Según necesidad", "frequency": "Uso habitual"}]'::jsonb, 'Paciente colabora durante la entrevista, orientado en tiempo, espacio y persona.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '88558', 'Roberto', 'Quispe Quispe', '1972-06-13', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '88558' LIMIT 1), 'HC-2026-1017', 'B-', 'Hospitalización por: Neumonía (2022) Año: 2022 Evolución: Favorable', 'Diabetes mellitus tipo 2', '[{"allergen": "Mariscos", "severity": "HIGH", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[]'::jsonb, 'Refiere buen estado general, sin quejas agudas al momento de la consulta.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '31812', 'Patricia', 'Antelo Salazar', '1969-07-06', 'Femenino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '31812' LIMIT 1), 'HC-2026-1018', 'AB+', 'Hospitalización por: Ninguna Año: 2021 Evolución: Resuelto completamente', 'Hipertensión arterial', '[{"allergen": "Ácido acetilsalicílico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Enalapril 10mg", "dose": "Cada 8 horas", "frequency": "Uso habitual"}]'::jsonb, 'Paciente colabora durante la entrevista, orientado en tiempo, espacio y persona.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '14451', 'Norma', 'Ortiz Guzmán', '2003-05-13', 'Femenino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '14451' LIMIT 1), 'HC-2026-1019', 'O+', 'Hospitalización por: Apendicitis (2021) Año: 2019 Evolución: Resuelto completamente', 'Diabetes mellitus tipo 2', '[{"allergen": "Ácido acetilsalicílico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Levotiroxina 100mcg", "dose": "Cada 8 horas", "frequency": "Uso habitual"}]'::jsonb, 'Paciente acude acompañado de familiar, buena adherencia a indicaciones previas.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '20156', 'Gabriel', 'Choque Vaca Diez', '1952-09-25', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '20156' LIMIT 1), 'HC-2026-1002', 'A-', 'Hospitalización por: Ninguna Año: 2017 Evolución: Sin secuelas', 'Diabetes mellitus tipo 2', '[{"allergen": "Ácido acetilsalicílico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Salbutamol inhalador", "dose": "1 vez al día", "frequency": "Uso habitual"}]'::jsonb, 'Se recomienda control en 6 meses y actualización de esquema de vacunación.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '83213', 'Freddy', 'Peredo Peredo', '1956-04-23', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '83213' LIMIT 1), 'HC-2026-1020', 'A+', 'Hospitalización por: Neumonía (2022) Año: 2018 Evolución: Resuelto completamente', 'Diabetes mellitus tipo 2', '[{"allergen": "Polvo doméstico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Metformina 850mg", "dose": "Según necesidad", "frequency": "Uso habitual"}]'::jsonb, 'Se sugiere seguimiento nutricional y control periódico de presión arterial.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '51346', 'Ricardo', 'Cárdenas Choque', '1996-04-24', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '51346' LIMIT 1), 'HC-2026-1003', 'O-', 'Hospitalización por: Fractura de brazo (2019) Año: 2016 Evolución: Resuelto completamente', 'Epilepsia', '[{"allergen": "Polvo doméstico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Ácido valproico 500mg", "dose": "1 vez al día", "frequency": "Uso habitual"}]'::jsonb, 'Paciente acude acompañado de familiar, buena adherencia a indicaciones previas.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '75394', 'Beatriz', 'Peredo Ibáñez', '1991-10-12', 'Femenino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '75394' LIMIT 1), 'HC-2026-1004', 'B-', 'Hospitalización por: Parto (2020) Año: 2018 Evolución: Favorable', 'Hipotiroidismo', '[{"allergen": "Penicilina", "severity": "HIGH", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Enalapril 10mg", "dose": "Según necesidad", "frequency": "Uso habitual"}]'::jsonb, 'Paciente acude acompañado de familiar, buena adherencia a indicaciones previas.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '58867', 'Hugo', 'Rojas Ibáñez', '1985-01-17', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '58867' LIMIT 1), 'HC-2026-1005', 'B+', 'Hospitalización por: Colecistectomía (2023) Año: 2016 Evolución: Resuelto completamente', 'Epilepsia', '[{"allergen": "Ninguna conocida", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Ácido valproico 500mg", "dose": "1 vez al día", "frequency": "Uso habitual"}]'::jsonb, 'Refiere buen estado general, sin quejas agudas al momento de la consulta.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '13203', 'Juan', 'Flores Ibáñez', '2021-04-25', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '13203' LIMIT 1), 'HC-2026-1006', 'O-', 'Hospitalización por: Fractura de brazo (2019) Año: 2019 Evolución: Resuelto completamente', 'Epilepsia', '[{"allergen": "Ácido acetilsalicílico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Salbutamol inhalador", "dose": "Cada 8 horas", "frequency": "Uso habitual"}]'::jsonb, 'Paciente colabora durante la entrevista, orientado en tiempo, espacio y persona.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '57966', 'Andrés', 'Condori Gonzales', '1946-11-08', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '57966' LIMIT 1), 'HC-2026-1007', 'B-', 'Hospitalización por: Colecistectomía (2023) Año: 2023 Evolución: Resuelto completamente', 'Ninguna', '[{"allergen": "Mariscos", "severity": "HIGH", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[]'::jsonb, 'Paciente acude acompañado de familiar, buena adherencia a indicaciones previas.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '16509', 'Wilson', 'Peredo Apaza', '2007-07-15', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '16509' LIMIT 1), 'HC-2026-1008', 'O+', 'Hospitalización por: Ninguna Año: 2016 Evolución: Favorable', 'Diabetes mellitus tipo 2', '[{"allergen": "Mariscos", "severity": "HIGH", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Levotiroxina 100mcg", "dose": "1 vez al día", "frequency": "Uso habitual"}]'::jsonb, 'Paciente colabora durante la entrevista, orientado en tiempo, espacio y persona.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '94254', 'Fernanda', 'Cárdenas Paz', '1966-06-08', 'Femenino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '94254' LIMIT 1), 'HC-2026-1009', 'B+', 'Hospitalización por: Neumonía (2022) Año: 2025 Evolución: Resuelto completamente', 'Artritis reumatoide', '[{"allergen": "Sulfas", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Salbutamol inhalador", "dose": "Cada 12 horas", "frequency": "Uso habitual"}]'::jsonb, 'Sin observaciones adicionales relevantes en la presente consulta.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000002', 'CI', '93868-S', 'Silvia', 'Ortiz Gonzales', '1964-03-03', 'Femenino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000002', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000002' AND document_type = 'CI' AND document_number = '93868-S' LIMIT 1), 'HC-2026-1001-S', 'A+', 'Hospitalización por: Colecistectomía (2023) Año: 2023 Evolución: Resuelto completamente', 'Asma bronquial', '[{"allergen": "Mariscos", "severity": "HIGH", "reaction": "Reacción anafiláctica"}]'::jsonb, '[{"name": "Enalapril 10mg", "dose": "Según necesidad", "frequency": "Uso habitual"}]'::jsonb, 'Se sugiere seguimiento nutricional y control periódico de presión arterial.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '93868', 'Yesenia', 'Ortiz Gonzales', '2017-05-03', 'Femenino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '93868' LIMIT 1), 'HC-2026-1001', 'A+', 'Hospitalización por: Colecistectomía (2023) Año: 2023 Evolución: Resuelto completamente', 'Asma bronquial', '[{"allergen": "Mariscos", "severity": "HIGH", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Enalapril 10mg", "dose": "Según necesidad", "frequency": "Uso habitual"}]'::jsonb, 'Se sugiere seguimiento nutricional y control periódico de presión arterial.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '20373', 'Marisol', 'Condori Rivero', '1973-01-10', 'Femenino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '20373' LIMIT 1), 'HC-2026-1010', 'B-', 'Hospitalización por: Colecistectomía (2023) Año: 2017 Evolución: Favorable', 'Ninguna', '[{"allergen": "Polvo doméstico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Levotiroxina 100mcg", "dose": "1 vez al día", "frequency": "Uso habitual"}]'::jsonb, 'Se recomienda control en 6 meses y actualización de esquema de vacunación.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '86220', 'Marcelo', 'Ortiz Gonzales', '2016-07-03', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '86220' LIMIT 1), 'HC-2026-1011', 'A+', 'Hospitalización por: Apendicitis (2021) Año: 2023 Evolución: Sin secuelas', 'Hipertensión arterial', '[{"allergen": "Polvo doméstico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Levotiroxina 100mcg", "dose": "1 vez al día", "frequency": "Uso habitual"}]'::jsonb, 'Paciente acude acompañado de familiar, buena adherencia a indicaciones previas.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '56248', 'Fernanda', 'Suárez Apaza', '1965-11-14', 'Femenino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '56248' LIMIT 1), 'HC-2026-1012', 'A+', 'Hospitalización por: Apendicitis (2021) Año: 2016 Evolución: Sin secuelas', 'Epilepsia', '[{"allergen": "Mariscos", "severity": "HIGH", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Losartán 50mg", "dose": "Cada 12 horas", "frequency": "Uso habitual"}]'::jsonb, 'Refiere buen estado general, sin quejas agudas al momento de la consulta.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '64026', 'Gloria', 'Paz Gonzales', '2024-10-18', 'Femenino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '64026' LIMIT 1), 'HC-2026-1013', 'O+', 'Hospitalización por: Apendicitis (2021) Año: 2020 Evolución: Sin secuelas', 'Epilepsia', '[{"allergen": "Polvo doméstico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Metformina 850mg", "dose": "Cada 8 horas", "frequency": "Uso habitual"}]'::jsonb, 'Sin observaciones adicionales relevantes en la presente consulta.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '51737', 'Fernando', 'Mendoza Rivero', '2005-08-18', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '51737' LIMIT 1), 'HC-2026-1014', 'B-', 'Hospitalización por: Parto (2020) Año: 2023 Evolución: Sin secuelas', 'Asma bronquial', '[{"allergen": "Polvo doméstico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Metformina 850mg", "dose": "Cada 12 horas", "frequency": "Uso habitual"}]'::jsonb, 'Se recomienda control en 6 meses y actualización de esquema de vacunación.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '65960', 'Andrés', 'Aguilar Choque', '1951-02-14', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '65960' LIMIT 1), 'HC-2026-1015', 'AB+', 'Hospitalización por: Ninguna Año: 2015 Evolución: Sin secuelas', 'Ninguna', '[{"allergen": "Ninguna conocida", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Losartán 50mg", "dose": "1 vez al día", "frequency": "Uso habitual"}]'::jsonb, 'Se sugiere seguimiento nutricional y control periódico de presión arterial.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '15742', 'Miguel', 'Ortiz Rojas', '1988-06-26', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '15742' LIMIT 1), 'HC-2026-1016', 'AB+', 'Hospitalización por: Colecistectomía (2023) Año: 2018 Evolución: Sin secuelas', 'Epilepsia', '[{"allergen": "Ácido acetilsalicílico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Salbutamol inhalador", "dose": "Según necesidad", "frequency": "Uso habitual"}]'::jsonb, 'Paciente colabora durante la entrevista, orientado en tiempo, espacio y persona.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '88558', 'Roberto', 'Quispe Quispe', '1972-06-13', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '88558' LIMIT 1), 'HC-2026-1017', 'B-', 'Hospitalización por: Neumonía (2022) Año: 2022 Evolución: Favorable', 'Diabetes mellitus tipo 2', '[{"allergen": "Mariscos", "severity": "HIGH", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[]'::jsonb, 'Refiere buen estado general, sin quejas agudas al momento de la consulta.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '31812', 'Patricia', 'Antelo Salazar', '1969-07-06', 'Femenino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '31812' LIMIT 1), 'HC-2026-1018', 'AB+', 'Hospitalización por: Ninguna Año: 2021 Evolución: Resuelto completamente', 'Hipertensión arterial', '[{"allergen": "Ácido acetilsalicílico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Enalapril 10mg", "dose": "Cada 8 horas", "frequency": "Uso habitual"}]'::jsonb, 'Paciente colabora durante la entrevista, orientado en tiempo, espacio y persona.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '14451', 'Norma', 'Ortiz Guzmán', '2003-05-13', 'Femenino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '14451' LIMIT 1), 'HC-2026-1019', 'O+', 'Hospitalización por: Apendicitis (2021) Año: 2019 Evolución: Resuelto completamente', 'Diabetes mellitus tipo 2', '[{"allergen": "Ácido acetilsalicílico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Levotiroxina 100mcg", "dose": "Cada 8 horas", "frequency": "Uso habitual"}]'::jsonb, 'Paciente acude acompañado de familiar, buena adherencia a indicaciones previas.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '20156', 'Gabriel', 'Choque Vaca Diez', '1952-09-25', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '20156' LIMIT 1), 'HC-2026-1002', 'A-', 'Hospitalización por: Ninguna Año: 2017 Evolución: Sin secuelas', 'Diabetes mellitus tipo 2', '[{"allergen": "Ácido acetilsalicílico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Salbutamol inhalador", "dose": "1 vez al día", "frequency": "Uso habitual"}]'::jsonb, 'Se recomienda control en 6 meses y actualización de esquema de vacunación.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '83213', 'Freddy', 'Peredo Peredo', '1956-04-23', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '83213' LIMIT 1), 'HC-2026-1020', 'A+', 'Hospitalización por: Neumonía (2022) Año: 2018 Evolución: Resuelto completamente', 'Diabetes mellitus tipo 2', '[{"allergen": "Polvo doméstico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Metformina 850mg", "dose": "Según necesidad", "frequency": "Uso habitual"}]'::jsonb, 'Se sugiere seguimiento nutricional y control periódico de presión arterial.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '51346', 'Ricardo', 'Cárdenas Choque', '1996-04-24', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '51346' LIMIT 1), 'HC-2026-1003', 'O-', 'Hospitalización por: Fractura de brazo (2019) Año: 2016 Evolución: Resuelto completamente', 'Epilepsia', '[{"allergen": "Polvo doméstico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Ácido valproico 500mg", "dose": "1 vez al día", "frequency": "Uso habitual"}]'::jsonb, 'Paciente acude acompañado de familiar, buena adherencia a indicaciones previas.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '75394', 'Beatriz', 'Peredo Ibáñez', '1991-10-12', 'Femenino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '75394' LIMIT 1), 'HC-2026-1004', 'B-', 'Hospitalización por: Parto (2020) Año: 2018 Evolución: Favorable', 'Hipotiroidismo', '[{"allergen": "Penicilina", "severity": "HIGH", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Enalapril 10mg", "dose": "Según necesidad", "frequency": "Uso habitual"}]'::jsonb, 'Paciente acude acompañado de familiar, buena adherencia a indicaciones previas.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '58867', 'Hugo', 'Rojas Ibáñez', '1985-01-17', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '58867' LIMIT 1), 'HC-2026-1005', 'B+', 'Hospitalización por: Colecistectomía (2023) Año: 2016 Evolución: Resuelto completamente', 'Epilepsia', '[{"allergen": "Ninguna conocida", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Ácido valproico 500mg", "dose": "1 vez al día", "frequency": "Uso habitual"}]'::jsonb, 'Refiere buen estado general, sin quejas agudas al momento de la consulta.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '13203', 'Juan', 'Flores Ibáñez', '2021-04-25', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '13203' LIMIT 1), 'HC-2026-1006', 'O-', 'Hospitalización por: Fractura de brazo (2019) Año: 2019 Evolución: Resuelto completamente', 'Epilepsia', '[{"allergen": "Ácido acetilsalicílico", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Salbutamol inhalador", "dose": "Cada 8 horas", "frequency": "Uso habitual"}]'::jsonb, 'Paciente colabora durante la entrevista, orientado en tiempo, espacio y persona.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '57966', 'Andrés', 'Condori Gonzales', '1946-11-08', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '57966' LIMIT 1), 'HC-2026-1007', 'B-', 'Hospitalización por: Colecistectomía (2023) Año: 2023 Evolución: Resuelto completamente', 'Ninguna', '[{"allergen": "Mariscos", "severity": "HIGH", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[]'::jsonb, 'Paciente acude acompañado de familiar, buena adherencia a indicaciones previas.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '16509', 'Wilson', 'Peredo Apaza', '2007-07-15', 'Masculino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '16509' LIMIT 1), 'HC-2026-1008', 'O+', 'Hospitalización por: Ninguna Año: 2016 Evolución: Favorable', 'Diabetes mellitus tipo 2', '[{"allergen": "Mariscos", "severity": "HIGH", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Levotiroxina 100mcg", "dose": "1 vez al día", "frequency": "Uso habitual"}]'::jsonb, 'Paciente colabora durante la entrevista, orientado en tiempo, espacio y persona.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '94254', 'Fernanda', 'Cárdenas Paz', '1966-06-08', 'Femenino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '94254' LIMIT 1), 'HC-2026-1009', 'B+', 'Hospitalización por: Neumonía (2022) Año: 2025 Evolución: Resuelto completamente', 'Artritis reumatoide', '[{"allergen": "Sulfas", "severity": "MEDIUM", "reaction": "Reacción registrada en ficha clínica"}]'::jsonb, '[{"name": "Salbutamol inhalador", "dose": "Cada 12 horas", "frequency": "Uso habitual"}]'::jsonb, 'Sin observaciones adicionales relevantes en la presente consulta.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;


INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('20000000-0000-0000-0000-000000000001', 'CI', '93868-S', 'Silvia', 'Ortiz Gonzales', '1964-03-03', 'Femenino', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('20000000-0000-0000-0000-000000000001', (SELECT id FROM patients WHERE tenant_id = '20000000-0000-0000-0000-000000000001' AND document_type = 'CI' AND document_number = '93868-S' LIMIT 1), 'HC-2026-1001-S', 'A+', 'Hospitalización por: Colecistectomía (2023) Año: 2023 Evolución: Resuelto completamente', 'Asma bronquial', '[{"allergen": "Mariscos", "severity": "HIGH", "reaction": "Reacción anafiláctica"}]'::jsonb, '[{"name": "Enalapril 10mg", "dose": "Según necesidad", "frequency": "Uso habitual"}]'::jsonb, 'Se sugiere seguimiento nutricional y control periódico de presión arterial.')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;

COMMIT;