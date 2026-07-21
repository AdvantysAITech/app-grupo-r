interface DatosCabecera {
    empresaNombre: string,
    sector: string;
    centroDireccion: string,
    numTrabajadores: number | null;
    tecnicoNombre: string;
    fecha: string;
}

export function cabeceraHtml(datos: DatosCabecera): string {
  return `
    <div class="portada">
      <h1>PLAN DE PREVENCIÓN - EVALUACIÓN DE RIESGOS LABORALES Y PLANIFICACIÓN PREVENTIVA</h1>
      <p><strong>SPA: GRUPO R DE SALUD LABORAL</strong></p>
      <p><strong>Técnico:</strong> ${datos.tecnicoNombre}</p>
      <h2>${datos.empresaNombre}</h2>
      <p>Centro de trabajo: ${datos.centroDireccion || 'Pendiente de confirmar'}</p>
      <p>Sector de actividad: ${datos.sector}</p>
      <p>Fecha del documento: ${datos.fecha}</p>
    </div>

    <h2>1. INTRODUCCIÓN Y OBJETO DEL DOCUMENTO</h2>
    <p>El presente Plan de Prevención, Evaluación de Riesgos Laborales y Planificación Preventiva se redacta
    para ${datos.empresaNombre}, conforme al método documental utilizado por GRUPO R DE SALUD LABORAL, S.L.,
    tomando como base la información facilitada por la empresa, el checklist operativo de toma de datos,
    las fotografías aportadas del centro y las condiciones observables de la actividad real.</p>
    <p>La evaluación debe considerarse un documento vivo. Deberá revisarse cuando se produzcan cambios en
    instalaciones, puestos, personal, equipos de trabajo o cuando se produzcan accidentes o incidentes que
    evidencien la necesidad de actualización.</p>

    <h2>2. DATOS DE LA EMPRESA</h2>
    <table class="datos-tabla">
      <tr><td><strong>Razón social</strong></td><td>${datos.empresaNombre}</td></tr>
      <tr><td><strong>Centro de trabajo</strong></td><td>${datos.centroDireccion || 'Pendiente de confirmar'}</td></tr>
      <tr><td><strong>Sector</strong></td><td>${datos.sector}</td></tr>
      <tr><td><strong>Nº trabajadores</strong></td><td>${datos.numTrabajadores ?? 'Pendiente de confirmar'}</td></tr>
      <tr><td><strong>Modalidad preventiva</strong></td><td>Servicio de Prevención Ajeno: GRUPO R DE SALUD LABORAL, S.L.</td></tr>
      <tr><td><strong>Técnico evaluador</strong></td><td>${datos.tecnicoNombre}</td></tr>
      <tr><td><strong>Fecha de evaluación</strong></td><td>${datos.fecha}</td></tr>
    </table>
  `;
}

export function marcoNormativoHtml(): string {
  return `
    <h2>NORMATIVA DE REFERENCIA</h2>
    <ul>
      <li>Ley 31/1995, de Prevención de Riesgos Laborales.</li>
      <li>Real Decreto 39/1997, Reglamento de los Servicios de Prevención.</li>
      <li>Real Decreto 486/1997, lugares de trabajo.</li>
      <li>Real Decreto 485/1997, señalización de seguridad y salud.</li>
      <li>Real Decreto 487/1997, manipulación manual de cargas.</li>
      <li>Real Decreto 488/1997, pantallas de visualización de datos.</li>
      <li>Real Decreto 773/1997, equipos de protección individual.</li>
      <li>Real Decreto 171/2004, coordinación de actividades empresariales.</li>
      <li>Real Decreto 513/2017, Reglamento de instalaciones de protección contra incendios.</li>
    </ul>
  `;
}

export const CSS_DOCUMENTO = `
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #2c3e50; line-height: 1.5; max-width: 900px; margin: 0 auto; padding: 30px; }
  h1 { color: #922b21; font-size: 1.4rem; }
  h2 { color: #1a5276; font-size: 1.15rem; border-bottom: 2px solid #d5d8dc; padding-bottom: 4px; margin-top: 28px; }
  h3 { color: #922b21; font-size: 1rem; margin-top: 20px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  td, th { border: 1px solid #d5d8dc; padding: 8px 10px; font-size: 0.9rem; vertical-align: top; }
  .datos-tabla td:first-child { background: #f4f6f8; width: 220px; }
  .riesgo-box { border: 1px solid #d5d8dc; border-radius: 6px; margin: 16px 0; padding: 14px; background: #fdfefe; }
  .valoracion-trivial { color: #1e8449; font-weight: bold; }
  .valoracion-tolerable { color: #2980b9; font-weight: bold; }
  .valoracion-moderado { color: #e67e22; font-weight: bold; }
  .valoracion-importante { color: #c0392b; font-weight: bold; }
  .portada { text-align: center; border-bottom: 3px solid #922b21; padding-bottom: 20px; margin-bottom: 20px; }
`;