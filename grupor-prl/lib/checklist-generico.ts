export interface PreguntaChecklist {
    id: string;
    texto: string;
}

export interface BloqueChecklist {
    id: string;
    titulo: string;
    preguntas: PreguntaChecklist[];
}

export const CHECKLIST_GENERICO: BloqueChecklist[] = [
    {
    id: 'accesos',
    titulo: '1. Accesos y zonas de tránsito',
    preguntas: [
      { id: 'acc_01', texto: 'Acceso desde vía pública sin desniveles peligrosos ni obstáculos.' },
      { id: 'acc_02', texto: 'Pasillos y zonas de paso libres de cajas, cables o mobiliario.' },
      { id: 'acc_03', texto: 'Suelos antideslizantes, secos y sin roturas o desniveles.' },
    ],
  },
  {
    id: 'orden_limpieza',
    titulo: '2. Orden y limpieza',
    preguntas: [
      { id: 'ord_01', texto: 'Zonas de trabajo y almacén libres de acumulaciones innecesarias.' },
      { id: 'ord_02', texto: 'Procedimiento de orden y limpieza al cierre.' },
      { id: 'ord_03', texto: 'Derrames o roturas se limpian de forma inmediata.' },
    ],
  },
  {
    id: 'almacen_cargas',
    titulo: '3. Almacenamiento y manipulación de cargas',
    preguntas: [
      { id: 'alm_01', texto: 'Estanterías estables, ancladas y sin sobrecarga visible.' },
      { id: 'alm_02', texto: 'Productos pesados en niveles bajos/medios; ligeros en altura.' },
      { id: 'alm_03', texto: 'Se dispone de carros o medios auxiliares para cargas voluminosas.' },
      { id: 'alm_04', texto: 'Escaleras de mano en buen estado y uso adecuado para reposición en altura.' },
    ],
  },
  {
    id: 'equipos_electricidad',
    titulo: '4. Equipos de trabajo e instalación eléctrica',
    preguntas: [
      { id: 'equ_01', texto: 'Cuadro eléctrico cerrado, identificado y accesible.' },
      { id: 'equ_02', texto: 'Cableado ordenado y protegido frente a tropiezos.' },
      { id: 'equ_03', texto: 'Equipos de trabajo en buen estado, sin cableado expuesto ni sobrecalentamiento.' },
      { id: 'equ_04', texto: 'Regletas y enchufes sin sobrecarga.' },
    ],
  },
  {
    id: 'emergencias',
    titulo: '5. Emergencias, incendio y evacuación',
    preguntas: [
      { id: 'eme_01', texto: 'Extintores accesibles, señalizados y sin obstáculos.' },
      { id: 'eme_02', texto: 'Recorridos y salidas de evacuación libres.' },
      { id: 'eme_03', texto: 'Alumbrado de emergencia operativo.' },
      { id: 'eme_04', texto: 'Existe consigna de actuación ante incendio/evacuación/emergencia sanitaria.' },
      { id: 'eme_05', texto: 'Botiquín de primeros auxilios accesible y con contenido revisado.' },
    ],
  },
  {
    id: 'quimico_biologico',
    titulo: '6. Riesgo químico y/o biológico (si aplica)',
    preguntas: [
      { id: 'qb_01', texto: 'Productos químicos etiquetados y almacenados correctamente.' },
      { id: 'qb_02', texto: 'Fichas de datos de seguridad disponibles si se manipulan productos peligrosos.' },
      { id: 'qb_03', texto: 'Existe contacto con público, fluidos o material biológico en la actividad.' },
    ],
  },
  {
    id: 'ergonomia_pvd',
    titulo: '7. Ergonomía y pantallas de visualización de datos',
    preguntas: [
      { id: 'erg_01', texto: 'Puestos con pantalla, teclado y ratón en posición adecuada.' },
      { id: 'erg_02', texto: 'Sillas regulables y apoyo lumbar donde corresponda.' },
      { id: 'erg_03', texto: 'Se permiten pausas o alternancia en tareas repetitivas/bipedestación prolongada.' },
    ],
  },
  {
    id: 'epis',
    titulo: '8. Equipos de protección individual',
    preguntas: [
      { id: 'epi_01', texto: 'El personal dispone de calzado adecuado a la tarea.' },
      { id: 'epi_02', texto: 'Se entregan y registran los EPIs necesarios según la actividad.' },
      { id: 'epi_03', texto: 'El personal está formado en el uso correcto de los EPIs.' },
    ],
  },
  {
    id: 'psicosocial',
    titulo: '9. Factores psicosociales y atención al público',
    preguntas: [
      { id: 'psi_01', texto: 'Existe procedimiento ante agresiones, atraco o conflicto con clientes.' },
      { id: 'psi_02', texto: 'Se gestiona adecuadamente la carga de trabajo y los turnos/guardias.' },
    ],
  },
  {
    id: 'sensibles',
    titulo: '10. Trabajadores especialmente sensibles',
    preguntas: [
      { id: 'sen_01', texto: 'Existe procedimiento para comunicar embarazo, lactancia o sensibilidad especial.' },
      { id: 'sen_02', texto: 'Se identifican tareas incompatibles con trabajadores sensibles.' },
    ],
    }
];