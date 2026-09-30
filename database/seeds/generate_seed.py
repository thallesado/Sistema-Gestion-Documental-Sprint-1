import glob
import re
import json
from pypdf import PdfReader

files = sorted(glob.glob('backend/bootstrap/src/main/resources/docs/*.pdf'))
tenant_id = '20000000-0000-0000-0000-000000000002'

sql_statements = [
    "-- Importación de 20 pacientes e historias clínicas extraídos de los PDFs oficiales",
    "BEGIN;",
    "SET LOCAL app.bypass_rls = 'on';"
]

for idx, f in enumerate(files, 1):
    r = PdfReader(f)
    t = r.pages[0].extract_text()
    
    hc_m = re.search(r'No\.\s*H\.C\.:\s*([^\s]+)', t)
    hc = hc_m.group(1) if hc_m else f'HC-2026-{1000+idx}'
    
    sumi_m = re.search(r'No\.\s*SUMI:\s*([^\s]+)', t)
    sumi = sumi_m.group(1) if sumi_m else f'{10000000+idx}'
    ci = re.sub(r'[^0-9]', '', sumi) or str(10000000 + idx)
    
    b_part = t[t.find('B. IDENTIFICACI'):] if 'B. IDENTIFICACI' in t else t
    pat_m = re.search(r'Apellido Paterno:\s*([^\n\r]+?)\s*Apellido Materno:\s*([^\n\r]+?)\s*Nombres:\s*([^\n\r]+)', b_part)
    paterno = pat_m.group(1).strip() if pat_m else 'Paterno'
    materno = pat_m.group(2).strip() if pat_m else 'Materno'
    nombres = pat_m.group(3).strip() if pat_m else f'Paciente {idx}'
    
    fnac_m = re.search(r'Fecha de nacimiento:\s*(\d{2}/\d{2}/\d{4})', b_part)
    if fnac_m:
        d, m, y = fnac_m.group(1).split('/')
        bdate = f'{y}-{m}-{d}'
    else:
        bdate = '1995-01-01'
        
    sexo_m = re.search(r'Sexo:\s*([MF])', b_part)
    sexo = 'Femenino' if (sexo_m and sexo_m.group(1) == 'F') else 'Masculino'
    
    gs_m = re.search(r'Grupo sangu[íi]neo:\s*([ABO]+)\s*Factor Rh:\s*([+-])', b_part)
    gs = (gs_m.group(1) + gs_m.group(2)) if gs_m else 'O+'
    
    alg_m = re.search(r'Alergias:\s*([^\n\r]+)', t)
    alg_str = alg_m.group(1).strip() if alg_m else 'Ninguna'
    
    hosp_m = re.search(r'Hospitalizaci[óo]n por:\s*(.+?)\s*A[ñn]o:\s*(\d+)?\s*Evoluci[óo]n:\s*(.+?)(?=\n[A-Z]|\nMedicamento|\nAlergias|$)', t, re.DOTALL)
    patho = hosp_m.group(0).strip().replace('\n', ' ').replace("'", "''") if hosp_m else 'Sin antecedentes patológicos relevantes.'
    
    cron_m = re.search(r'Enfermedad cr[óo]nica:\s*(.+?)(?=\nMedicamento|$)', t)
    cron = cron_m.group(1).strip().replace("'", "''") if cron_m else ''
    
    med_m = re.search(r'Medicamento:\s*(.+?)\s*Dosificaci[óo]n:\s*(.+?)(?=\nInicio|$)', t)
    med = med_m.group(1).strip().replace("'", "''") if med_m else ''
    dose = med_m.group(2).strip().replace("'", "''") if med_m else ''
    
    obs_m = re.search(r'J\.\s*OBSERVACIONES\s*\n(.+)', t, re.DOTALL)
    obs = obs_m.group(1).strip().replace('\n', ' ').replace("'", "''") if obs_m else ''
    
    # We assign distinct UUIDs starting with 70000000-0000-0000-0000-0000000001XX
    pat_id = f'70000000-0000-0000-0000-0000000001{idx:02d}'
    hc_id = f'71000000-0000-0000-0000-0000000001{idx:02d}'
    
    first_esc = nombres.replace("'", "''")
    last_esc = f'{paterno} {materno}'.strip().replace("'", "''")
    
    allergies_list = []
    if alg_str and alg_str.lower() != 'ninguna':
        for item in alg_str.split(','):
            item = item.strip()
            if item:
                allergies_list.append({
                    'allergen': item,
                    'severity': 'HIGH' if any(crit in item.lower() for crit in ['mariscos', 'penicilina', 'látex', 'anestesia']) else 'MEDIUM',
                    'reaction': 'Reacción registrada en ficha clínica'
                })
    allergies_json = json.dumps(allergies_list, ensure_ascii=False).replace("'", "''")
    
    med_list = []
    if med and med.lower() != 'ninguno':
        med_list.append({
            'name': med,
            'dose': dose or 'Según prescripción médica',
            'frequency': 'Uso habitual'
        })
    med_json = json.dumps(med_list, ensure_ascii=False).replace("'", "''")

    sql_statements.append(f"""
INSERT INTO patients (id, tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('{pat_id}', '{tenant_id}', 'CI', '{ci}', '{first_esc}', '{last_esc}', '{bdate}', '{sexo}', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (id, tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('{hc_id}', '{tenant_id}', (SELECT id FROM patients WHERE tenant_id = '{tenant_id}' AND document_type = 'CI' AND document_number = '{ci}'), '{hc}', '{gs}', '{patho}', '{cron}', '{allergies_json}'::jsonb, '{med_json}'::jsonb, '{obs}')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;
""")

sql_statements.append("COMMIT;")

with open('database/seeds/import_20_pdf_histories.sql', 'w', encoding='utf-8') as out:
    out.write('\n'.join(sql_statements))

print("Regenerado con éxito con IDs separados.")
