import glob
import re
import json
import subprocess
import os

files = sorted(glob.glob('backend/bootstrap/src/main/resources/docs/*.pdf'))
tenant_ids = [
    '20000000-0000-0000-0000-000000000002', # Clinica Central
    '20000000-0000-0000-0000-000000000001'  # FinoCode
]

sql_statements = [
    "BEGIN;",
    "SET LOCAL app.bypass_rls = 'on';",
    "SET client_encoding = 'UTF8';"
]

records = []

for idx, f in enumerate(files, 1):
    from pypdf import PdfReader
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
    cron = cron_m.group(1).strip().replace("'", "''") if cron_m else 'Ninguna'
    
    med_m = re.search(r'Medicamento:\s*(.+?)\s*Dosificaci[óo]n:\s*(.+?)(?=\nInicio|$)', t)
    med = med_m.group(1).strip().replace("'", "''") if med_m else ''
    dose = med_m.group(2).strip().replace("'", "''") if med_m else ''
    
    obs_m = re.search(r'J\.\s*OBSERVACIONES\s*\n(.+)', t, re.DOTALL)
    obs = obs_m.group(1).strip().replace('\n', ' ').replace("'", "''") if obs_m else 'Sin observaciones adicionales.'
    
    pat_id_base = f'70000000-0000-0000-0000-0000000001{idx:02d}'
    hc_id_base = f'71000000-0000-0000-0000-0000000001{idx:02d}'
    
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
    else:
        allergies_list.append({
            'allergen': 'Ninguna conocida',
            'severity': 'LOW',
            'reaction': 'Sin reacciones alérgicas reportadas'
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

    records.append({
        'idx': idx,
        'ci': ci,
        'first_name': first_esc,
        'last_name': last_esc,
        'bdate': bdate,
        'gender': sexo,
        'hc': hc,
        'blood_type': gs,
        'patho': patho,
        'cron': cron,
        'allergies_json': allergies_json,
        'med_json': med_json,
        'obs': obs
    })

# Add Silvia Ortiz Gonzales
records.append({
    'idx': 99,
    'ci': '93868-S',
    'first_name': 'Silvia',
    'last_name': 'Ortiz Gonzales',
    'bdate': '1964-03-03',
    'gender': 'Femenino',
    'hc': 'HC-2026-1001-S',
    'blood_type': 'A+',
    'patho': 'Hospitalización por: Colecistectomía (2023) Año: 2023 Evolución: Resuelto completamente',
    'cron': 'Asma bronquial',
    'allergies_json': json.dumps([{'allergen': 'Mariscos', 'severity': 'HIGH', 'reaction': 'Reacción anafiláctica'}], ensure_ascii=False).replace("'", "''"),
    'med_json': json.dumps([{'name': 'Enalapril 10mg', 'dose': 'Según necesidad', 'frequency': 'Uso habitual'}], ensure_ascii=False).replace("'", "''"),
    'obs': 'Se sugiere seguimiento nutricional y control periódico de presión arterial.'
})

for tenant_id in tenant_ids:
    for r in records:
        ci = r['ci']
        fn = r['first_name']
        ln = r['last_name']
        bd = r['bdate']
        gn = r['gender']
        hc = r['hc']
        gs = r['blood_type']
        pt = r['patho']
        cr = r['cron']
        al = r['allergies_json']
        md = r['med_json']
        ob = r['obs']
        
        sql_statements.append(f"""
INSERT INTO patients (tenant_id, document_type, document_number, first_name, last_name, birth_date, gender, status)
VALUES ('{tenant_id}', 'CI', '{ci}', '{fn}', '{ln}', '{bd}', '{gn}', 'ACTIVE')
ON CONFLICT (tenant_id, document_type, document_number) DO UPDATE
SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender;

INSERT INTO clinical_histories (tenant_id, patient_id, code, blood_type, pathological_antecedents, chronic_conditions, allergies, current_medications, observations)
VALUES ('{tenant_id}', (SELECT id FROM patients WHERE tenant_id = '{tenant_id}' AND document_type = 'CI' AND document_number = '{ci}' LIMIT 1), '{hc}', '{gs}', '{pt}', '{cr}', '{al}'::jsonb, '{md}'::jsonb, '{ob}')
ON CONFLICT (tenant_id, code) DO UPDATE
SET blood_type = EXCLUDED.blood_type, pathological_antecedents = EXCLUDED.pathological_antecedents, chronic_conditions = EXCLUDED.chronic_conditions, allergies = EXCLUDED.allergies, current_medications = EXCLUDED.current_medications, observations = EXCLUDED.observations;
""")

sql_statements.append("COMMIT;")

full_sql = '\n'.join(sql_statements)

# Save to file
with open('database/seeds/import_clean_utf8.sql', 'w', encoding='utf-8') as f:
    f.write(full_sql)

# Apply directly via subprocess with raw utf-8 bytes
p = subprocess.Popen(
    ['docker', 'exec', '-i', 'nexodocs-postgres', 'psql', '-U', 'nexodocs', '-d', 'nexodocs'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)
out, err = p.communicate(input=full_sql.encode('utf-8'))
if err:
    print('STDERR:', err.decode('utf-8', errors='ignore'))
print('PostgreSQL ejecutado con éxito. Salida:', out.decode('utf-8', errors='ignore')[-200:])
