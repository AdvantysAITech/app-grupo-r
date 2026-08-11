# Esquema JSON del Checklist — v1.0

Contrato único entre: **Llamada 1** (Claude genera y rellena) → **Pantalla de revisión** (técnico edita/confirma) → **Llamada 2** (generación de documentos). Este mismo documento se inyecta (resumido) en el prompt de la Llamada 1 como definición del formato de salida.

Ubicación sugerida en el repo: `grupor-prl/docs/Esquema_Checklist_v1.md`

---

## 1. Objeto raíz

```json
{
  "schema_version": "1.0",
  "visita": {
    "id": "v_20260811_farmacia-lopez",
    "fecha": "2026-08-11",
    "tipo": "inicial",
    "tecnico": { "usuario": "jgomez", "nombre": "Jorge Gómez", "email": "jgomez@gruporsalud.com" },
    "empresa": {
      "ghl_id": "abc123",
      "razon_social": "Farmacia López S.L.",
      "nombre_comercial": "Farmacia López",
      "nif": null,
      "direccion_centro": "C/ Mayor 12, Parets del Vallès",
      "actividad": "Oficina de farmacia",
      "sector": "farmacia",
      "num_trabajadores": 4
    }
  },
  "documentos_solicitados": ["plan_prevencion", "evaluacion_riesgos", "planificacion"],
  "bloques": [],
  "modulo_sectorial": {},
  "puestos": [],
  "imagenes": [],
  "avisos": []
}
```

- `visita` y `documentos_solicitados` los rellena **el frontend antes de la Llamada 1** (datos de GHL + selección del técnico). La IA **no los toca**: se le pasan como contexto y los devuelve tal cual.
- `tipo`: `"inicial" | "revision" | "extraordinaria"`.
- `documentos_solicitados` — valores permitidos: `"plan_prevencion" | "evaluacion_riesgos" | "planificacion" | "programa" | "entrega" | "memoria"`.

---

## 2. Bloques e items (la pieza central)

`bloques` es un array de bloques transversales (B0–B11) + `modulo_sectorial` con la misma forma interna.

```json
{
  "id": "b3",
  "titulo": "B3 — Emergencias, evacuación e incendios",
  "aplicable": true,
  "items": [
    {
      "id": "b3_em05",
      "label": "Obstáculos ante extintores",
      "pregunta": "¿Los extintores están libres de obstáculos?",
      "tipo": "snp",
      "valor": "no",
      "detalle_no": ["Extintor parcialmente oculto por expositor"],
      "observaciones": "Extintor de zona de mostrador con cartelería delante.",
      "obligatorio": true,
      "estado": "ia",
      "fuente": ["foto_03"]
    }
  ],
  "observaciones_bloque": null
}
```

### Campos del item

| Campo | Tipo | Quién lo escribe | Notas |
|---|---|---|---|
| `id` | string | Plantilla | Convención: `{bloque}_{item}` (`b3_em05`). Compatible con los ids actuales de `SECTORES`. |
| `label`, `pregunta` | string | Plantilla | Fijos por sector, la IA no los modifica. |
| `tipo` | enum | Plantilla | `"snp"` \| `"texto"` \| `"numero"` \| `"seleccion"` \| `"multiseleccion"` |
| `opciones` | string[] | Plantilla | Solo para `seleccion`/`multiseleccion`. |
| `valor` | según tipo | **IA / técnico** | `snp` → `"si"`\|`"no"`\|`"na"`. `null` = sin dato. |
| `detalle_no` | string[] | IA / técnico | Solo con `valor: "no"`. Texto libre o chips de `noOptions`. |
| `observaciones` | string \| null | IA / técnico | Contexto específico del centro. |
| `obligatorio` | boolean | Plantilla | Si `true` y `valor: null` → bloquea el avance. |
| `estado` | enum | IA / frontend | Ver ciclo de estados abajo. |
| `fuente` | string[] | IA | Trazabilidad: `"foto_XX"`, `"audio_XX"`, `"notas"`, `"inferido"`. Vacío si lo rellenó el técnico a mano. |

### Ciclo de `estado`

```
IA emite:        "ia"        → valor rellenado con evidencia
                 "pendiente" → valor null, no había información
Frontend pone:   "editado"   → el técnico modificó el valor
Al confirmar:    todos pasan a "confirmado"
```

**Regla de oro para el prompt de la Llamada 1:** la IA NUNCA inventa. Sin evidencia en fotos/audio/notas → `valor: null` + `estado: "pendiente"`. Con inferencia razonable pero no observada directamente → puede rellenar con `fuente: ["inferido"]` y el frontend lo resalta visualmente para revisión.

### Regla de validación (frontend)

```
puedeConfirmar = bloques (aplicables) + modulo_sectorial + puestos
                 .flatMap(items)
                 .every(i => !i.obligatorio || i.valor !== null)
```

---

## 3. Puestos y riesgos

```json
{
  "id": "farmaceutico",
  "nombre": "Farmacéutico/a",
  "num_trabajadores": 2,
  "descripcion_operativa": "Dispensación en mostrador, gestión de recetas...",
  "riesgos": [
    {
      "codigo": "070",
      "nombre": "Golpes contra objetos inmóviles",
      "probabilidad": "baja",
      "consecuencias": "danino",
      "valoracion": "tolerable",
      "zona": "Rebotica",
      "factores": ["Estanterías con cajas sobresalientes en pasillo estrecho"],
      "estado": "ia",
      "fuente": ["foto_05", "audio_01"]
    }
  ]
}
```

- `codigo`: catálogo INSHT (los 31/36 códigos ya definidos en la matriz de riesgos del sector).
- `probabilidad`: `"baja"|"media"|"alta"` · `consecuencias`: `"ligeramente_danino"|"danino"|"extremadamente_danino"` · `valoracion`: derivada de la matriz (`"trivial"|"tolerable"|"moderado"|"importante"|"intolerable"`).
- Las **medidas preventivas NO van en el checklist**: se resuelven en la Llamada 2 desde la matriz del sector (regla "tal cual" del system prompt). El checklist solo lleva la detección: riesgo + valoración + factores del centro.
- La lista de puestos la propone la IA a partir de la evidencia + `num_trabajadores`; el técnico puede añadir/quitar puestos en la revisión.

---

## 4. Imágenes

```json
{
  "id": "foto_03",
  "descripcion": "Extintor junto al mostrador parcialmente oculto por expositor de cartelería.",
  "hallazgos": ["Accesibilidad del extintor comprometida", "Señalización no visible desde la sala"],
  "items_relacionados": ["b3_em05", "b3_em02"],
  "secciones_destino": ["fichas_riesgo", "anexo_i"]
}
```

- Los `id` (`foto_01`, `foto_02`…) los asigna **el frontend** al subir, y mantiene el mapa `id → base64`. La IA recibe cada imagen precedida de un bloque de texto con su id.
- `descripcion` y `hallazgos` los escribe la IA en la Llamada 1 — sirven de pie de foto y de contexto en la Llamada 2.
- `secciones_destino`: `"fichas_riesgo" | "descripcion_centro" | "anexo_i"` — dónde puede insertarse la foto en el documento. La Llamada 2 usa el marcador `[[FOTO:id|pie]]` y el backend sustituye por `<img>` con el base64 del mapa.

---

## 5. Avisos

```json
{
  "tipo": "contradiccion",
  "texto": "El checklist declara 4 trabajadores pero en audio se mencionan 5 personas en plantilla.",
  "refs": ["visita.empresa.num_trabajadores", "audio_01"]
}
```

`tipo`: `"contradiccion" | "dato_pendiente" | "hallazgo_audio" | "fuera_checklist"`. Se muestran destacados en la pantalla de revisión y se arrastran al bloque `## AVISOS` de cada documento en la Llamada 2.

---

## 6. Flujo del objeto

1. **Frontend** monta el esqueleto: `visita` + `documentos_solicitados` + bloques/items de la plantilla del sector con `valor: null`.
2. **Llamada 1** recibe ese esqueleto + fotos + transcripción (Gemini) + notas → devuelve el mismo objeto con `valor/detalle_no/observaciones/estado/fuente` rellenados, más `puestos`, `imagenes` y `avisos`. Responde **solo el JSON**, sin markdown.
3. **Frontend** renderiza, resalta `pendiente` e `inferido`, aplica la regla de validación, marca ediciones como `editado`.
4. Al confirmar, todo pasa a `confirmado` y el objeto completo (sin base64) es la entrada de **cada iteración de la Llamada 2**.

Versionado: cualquier cambio de campos incrementa `schema_version` y se refleja aquí antes de tocar código.
