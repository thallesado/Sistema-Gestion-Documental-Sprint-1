import { Patient } from './data.types';

export const patientsGroupB: Patient[] = [
  {
    "id": 3,
    "name": "Luis Ortiz Gonzales",
    "documentId": "HC-2026-1011",
    "birthDate": "1990-02-07",
    "gender": "Masculino",
    "bloodType": "A+",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Santa Cruz de la Sierra",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-11.pdf",
    "events": [
      {
        "date": "2023-01-15",
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
        "description": "Prescripci¾n de Levotiroxina 100mcg",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 4,
    "name": "Tito Sußrez Apaza",
    "documentId": "HC-2026-1012",
    "birthDate": "1969-11-25",
    "gender": "Masculino",
    "bloodType": "A+",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "El Alto",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-12.pdf",
    "events": [
      {
        "date": "2016-01-15",
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
        "description": "Prescripci¾n de Losartßn 50mg",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  }
];
