interface Deficiencia {
    bloque: string;
    pregunta: string;
    observacion: string;
}

interface PayloadIA {
    empresa: string;
    sector: string;
    centro: string;
    num_trabajadores: number | null;
    deficiencias_detectadas: Deficiencia[];
    no_procede: string[];
    observaciones_generales: string;
}

export function construirPrompt(payload: PayloadIA): string {
    const deficienciasTexto = payload.deficiencias_detectadas
        .map((d, i) => `${i + 1}. [${d.bloque}] ${d.pregunta}${d.observacion ? ` — Observación del técnico: ${d.observacion}` : ''}`)
        .join('\n');
    
 return `Eres un técnico experto en prevención de riesgos laborales (PRL) en España (Ley 31/1995 y reglamentos de desarrollo).

Genera ÚNICAMENTE las secciones VARIABLES de una evaluación de riesgos, en HTML, a partir de las deficiencias detectadas en una inspección. NO generes portada, introducción, datos de empresa ni normativa — eso ya existe en una plantilla aparte.

DATOS DE CONTEXTO:
- Empresa: ${payload.empresa}
- Sector de actividad: ${payload.sector}
- Nº trabajadores: ${payload.num_trabajadores ?? 'No especificado'}

DEFICIENCIAS DETECTADAS EN LA VISITA (respuestas "No cumple" del checklist):
${deficienciasTexto || 'No se detectaron deficiencias relevantes en el checklist.'}

OBSERVACIONES GENERALES DEL TÉCNICO:
${payload.observaciones_generales || 'Ninguna adicional.'}

INSTRUCCIONES:
1. Devuelve ÚNICAMENTE HTML válido, sin explicaciones, sin markdown, sin \`\`\`html.
2. Para cada deficiencia relevante, agrupa las que compartan un mismo riesgo real y genera un bloque con esta estructura EXACTA (usa <div class="riesgo-box">):

<h3>Riesgo nº [N]: [NOMBRE DEL RIESGO EN MAYÚSCULAS]</h3>
<div class="riesgo-box">
  <table>
    <tr><th>Probabilidad</th><th>Consecuencias</th><th>Valoración</th><th>Zona/Puesto</th></tr>
    <tr><td>[Baja/Media/Alta]</td><td>[Ligeramente dañino/Dañino/Extremadamente dañino]</td><td class="valoracion-[trivial|tolerable|moderado|importante]">[Trivial/Tolerable/Moderado/Importante]</td><td>[zona]</td></tr>
  </table>
  <p><strong>Factores de riesgo:</strong></p>
  <ul>[factores observados, basados en las deficiencias y observaciones reales, sin inventar datos que no estén arriba]</ul>
  <p><strong>Medidas preventivas/correctoras:</strong></p>
  <ul>[medidas específicas y accionables para ESTE riesgo concreto, no genéricas]</ul>
</div>

3. Aplica tu conocimiento de riesgos específicos del sector "${payload.sector}" para interpretar el contexto, pero NUNCA inventes datos concretos (cifras, nombres, equipos) que no estén en las deficiencias u observaciones proporcionadas. Si falta un dato necesario, indícalo como "Pendiente de verificación in situ".
4. Después de todos los riesgos, genera una tabla de EPIs recomendados (<h3>EQUIPOS DE PROTECCIÓN INDIVIDUAL</h3> + tabla con columnas EPI, Riesgo/zona de uso, Criterio de uso) basada solo en los riesgos detectados arriba.
5. Después, genera la tabla de planificación preventiva (<h3>PLANIFICACIÓN DE LA ACTIVIDAD PREVENTIVA</h3> + tabla con columnas Nº, Zona/puesto, Medida, Tipo, Riesgo asociado, Prioridad, Responsable, Plazo), una fila por cada medida preventiva propuesta arriba, con prioridad y plazo coherentes con la gravedad (Alta = inmediato/1 semana, Media = 1 mes, Baja = revisión periódica).
6. No repitas ni redactes de nuevo la introducción, datos de empresa o normativa: empieza directamente por el primer "Riesgo nº 1".`;
}