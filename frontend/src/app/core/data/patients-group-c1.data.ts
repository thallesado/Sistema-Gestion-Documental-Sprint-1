import { Patient } from './data.types';

export const patientsGroupC1: Patient[] = [
  {
    "id": 5,
    "name": "Hugo Paz Gonzales",
    "documentId": "HC-2026-1013",
    "birthDate": "1966-05-02",
    "gender": "Masculino",
    "bloodType": "O+",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Yacuiba",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-13.pdf",
    "events": [
      {
        "date": "2020-01-15",
        "type": "CirugÝa",
        "title": "Apendicitis (2021)",
        "description": "Hospitalizaci¾n registrada en antecedentes. Apendicitis (2021).",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de Metformina 850mg",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 6,
    "name": "Beatriz Mendoza Rivero",
    "documentId": "HC-2026-1014",
    "birthDate": "1993-08-18",
    "gender": "Masculino",
    "bloodType": "B-",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Yacuiba",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-14.pdf",
    "events": [
      {
        "date": "2023-01-15",
        "type": "CirugÝa",
        "title": "Parto (2020)",
        "description": "Hospitalizaci¾n registrada en antecedentes. Parto (2020).",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de Metformina 850mg",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  }
];
