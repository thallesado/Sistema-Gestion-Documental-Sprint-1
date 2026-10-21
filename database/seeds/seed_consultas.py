import subprocess, json

def run():
    p = subprocess.Popen(
        ["docker", "exec", "-i", "nexodocs-postgres", "psql", "-U", "nexodocs", "-d", "nexodocs"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    consultas_templates = [
        {
            "fecha": "2026-09-15 09:30:00",
            "establecimiento": "Clínica Central",
            "motivo": "Consulta de control por cuadro respiratorio leve, tos seca de 3 días de evolución sin fiebre.",
            "peso": 62.5, "talla": 160, "pa": "115/75", "fc": 72, "fr": 16, "temp": 36.4, "spo2": 98, "glic": 88
        },
        {
            "fecha": "2026-09-22 14:15:00",
            "establecimiento": "Clínica Central",
            "motivo": "Seguimiento y control de evolución favorable. Remisión completa de sintomatología respiratoria.",
            "peso": 63.0, "talla": 160, "pa": "120/80", "fc": 70, "fr": 16, "temp": 36.5, "spo2": 99, "glic": 91
        },
        {
            "fecha": "2026-09-28 11:00:00",
            "establecimiento": "Clínica Central",
            "motivo": "Control clínico general rutinario. Solicitud de certificación médica para actividad física.",
            "peso": 62.8, "talla": 160, "pa": "118/78", "fc": 68, "fr": 17, "temp": 36.6, "spo2": 98, "glic": 89
        }
    ]

    sql_statements = [
        "SET client_encoding = 'UTF8';",
        "BEGIN;"
    ]

    # For both tenants and for Yesenia and Andrés
    for tid, aid in [
        ('20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004'),
        ('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001')
    ]:
        for code in ['HC-2026-1001', 'HC-2026-1015']:
            for c in consultas_templates:
                imc = round(c['peso'] / ((c['talla'] / 100) ** 2), 2)
                content_obj = {
                    "tipo": "REGISTRO_CONSULTA_MEDICA",
                    "fecha": c['fecha'],
                    "establecimiento": c['establecimiento'],
                    "motivoConsulta": c['motivo'],
                    "signosVitales": {
                        "peso": c['peso'],
                        "talla": c['talla'],
                        "imc": imc,
                        "presionArterial": c['pa'],
                        "frecuenciaCardiaca": c['fc'],
                        "frecuenciaRespiratoria": c['fr'],
                        "temperatura": c['temp'],
                        "saturacionOxigeno": c['spo2'],
                        "glicemia": c['glic']
                    }
                }
                c_json = json.dumps(content_obj, ensure_ascii=False).replace("'", "''")
                sql = f"""
                INSERT INTO medical_notes (tenant_id, clinical_history_id, author_id, note_type, content, created_at)
                SELECT '{tid}', ch.id, '{aid}', 'CONSULTA_MEDICA', '{c_json}', '{c['fecha']}Z'::timestamptz
                FROM clinical_histories ch
                WHERE ch.tenant_id = '{tid}' AND ch.code = '{code}'
                AND NOT EXISTS (
                    SELECT 1 FROM medical_notes mn 
                    WHERE mn.clinical_history_id = ch.id AND mn.created_at = '{c['fecha']}Z'::timestamptz
                );
                """
                sql_statements.append(sql)

    sql_statements.append("COMMIT;")
    full_sql = "\n".join(sql_statements)

    out, err = p.communicate(full_sql.encode('utf-8'))
    print("OUTPUT:", out.decode('utf-8', errors='replace'))
    if err:
        print("ERR:", err.decode('utf-8', errors='replace'))
    print("DONE SEEDING CONSULTAS!")

if __name__ == '__main__':
    run()
