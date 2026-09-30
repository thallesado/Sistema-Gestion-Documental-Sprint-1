import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-antecedentes-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="dashboard-card note-panel" style="background: #fff; border: 1px solid #dcebe8; border-radius: 16px; padding: 24px; height: fit-content;">
      <span class="side-kicker" style="color: #087f7b; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; display: block; margin-bottom: 6px;">SEGURIDAD Y PROTOCOLO</span>
      <h2 style="font-size: 16px; margin: 0 0 12px; color: #153a39;">Guía Operativa Clínica</h2>
      <p style="font-size: 12px; color: #6b8583; margin-bottom: 12px;">Lineamientos para el registro del expediente médico:</p>
      <ul style="font-size: 12px; color: #466765; padding-left: 18px; margin: 0; display: grid; gap: 8px;">
        <li><strong>Verificación de Identidad:</strong> Asegúrese de corroborar el documento y datos del paciente antes de actualizar su historial.</li>
        <li><strong>Precaución de Alergias:</strong> El registro de alérgenos de alta severidad activa advertencias preventivas para enfermería y farmacia.</li>
        <li><strong>Confidencialidad:</strong> La información clínica consignada queda protegida bajo estrictos estándares de integridad documental.</li>
      </ul>

      <div class="simulated-note" style="margin-top: 20px; background: #f8fbfa; border: 1px solid #dcebe8; border-radius: 10px; padding: 12px; font-size: 11px;">
        <b style="color: #153a39; display: block; margin-bottom: 4px;">Expediente Digital Activo</b>
        <span style="color: #6b8583;">Los cambios guardados se integran automáticamente al historial clínico centralizado.</span>
      </div>
    </aside>
  `
})
export class AntecedentesSidebarComponent {}
