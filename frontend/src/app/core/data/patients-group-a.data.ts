import { Patient } from './data.types';

export const patientsGroupA: Patient[] = [
  {
    "id": 1,
    "name": "Silvia Ortiz Gonzales",
    "documentId": "HC-2026-1001",
    "birthDate": "1964-03-03",
    "gender": "Femenino",
    "bloodType": "A+",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Cobija",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-1.pdf",
    "events": [
      {
        "date": "2023-01-15",
        "type": "CirugÝa",
        "title": "ColecistectomÝa (2023)",
        "description": "Hospitalizaci¾n registrada en antecedentes. ColecistectomÝa (2023).",
        "doctor": "MÚdico Asignado",
        "status": "Completado"
      },
      {
        "date": "2024-01-10",
        "type": "Receta",
        "title": "Tratamiento cr¾nico",
        "description": "Prescripci¾n de Enalapril 10mg",
        "doctor": "MÚdico Tratante",
        "status": "Vigente"
      }
    ]
  },
  {
    "id": 2,
    "name": "╔dgar Condori Rivero",
    "documentId": "HC-2026-1010",
    "birthDate": "1983-06-24",
    "gender": "Masculino",
    "bloodType": "B-",
    "phone": "+591 70000000",
    "email": "correo@ejemplo.com",
    "address": "Riberalta",
    "insuranceProvider": "SUS",
    "pdfFile": "Historia_Clinica_20_Pacientes-10.pdf",
    "events": [
      {
        "date": "2017-01-15",
        "type": "CirugÝa",
        "title": "ColecistectomÝa (2023)",
        "description": "Hospitalizaci¾n registrada en antecedentes. ColecistectomÝa (2023).",
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
  }
];
