interface RespuestaItem {
    valor: 'S' | 'N' | 'NP' | '';
    observacion: string;
}

interface DatosVisitaPayload {
    empresaNombre: string;
    sector: string;
    centroDireccion: string | null;
    numTrabajadores: number | null;
    respuestas: Record<string, RespuestaItem>;
    observacionesGenerales: string;
}

import { CHECKLIST_GENERICO } from "./checklist-generico";

export function construirPayload(datos: DatosVisitaPayload) {
    const deficienciasDetectadas: { bloque: string; pregunta: string; observacion: string }[] = [];
    const noProcede: string[] = [];

    for (const bloque of CHECKLIST_GENERICO) {
        for (const pregunta of bloque.preguntas) {
            const respuesta = datos.respuestas[pregunta.id];
            if (!respuesta || !respuesta.valor) continue;

            if (respuesta.valor === 'N') {
                deficienciasDetectadas.push({
                    bloque: bloque.titulo,
                    pregunta: pregunta.texto,
                    observacion: respuesta.observacion || '',
                });
            }
            if (respuesta.valor === 'NP') {
                noProcede.push(pregunta.texto);
            }
        }
    }

    return {
        empresa: datos.empresaNombre,
        sector: datos.sector,
        centro: datos.centroDireccion ?? '',
        num_trabajadores: datos.numTrabajadores,
        deficiencias_detectadas: deficienciasDetectadas,
        no_procede: noProcede,
        observaciones_generales: datos.observacionesGenerales,
    };
}