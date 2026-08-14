// grupor-prl/app/visita/[id]/checklist/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  leerVisita, leerDatosVisita, guardarChecklist, leerChecklist, actualizarEstadoVisita, guardarDatosVisita,
  type VisitaResumen, type DatosVisita,
} from "@/lib/visitas/store";
import {
  type Checklist, type Bloque, type Item, type ValorItem, type TipoDocumento,
  itemsPendientes, puedeConfirmar, itemsInferidos, marcarEditado, confirmarChecklist, bloqueSectorial,
} from "@/lib/checklist/types";
import { nombreSector, DOCUMENTOS } from "@/lib/sectores";
import { subirFotosPendientes, referenciasFoto } from "@/lib/fotos/subir";

export default function ChecklistPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [visita, setVisita] = useState<VisitaResumen | null>(null);
  const [datos, setDatos] = useState<DatosVisita | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [avisosParseo, setAvisosParseo] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [subiendoFotos, setSubiendoFotos] = useState<{ hechas: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [generandoDocs, setGenerandoDocs] = useState(false);
  const [estadoDocs, setEstadoDocs] = useState<Record<string, EstadoDoc>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const generar = useCallback(async (v: VisitaResumen, d: DatosVisita) => {
    setGenerando(true);
    setError(null);
    try {
      // Las fotos se suben a Supabase ANTES de llamar a la IA: en el body solo
      // viaja su ruta, no los bytes (límite de ~4,5 MB de Vercel).
      let fotos = d.fotos;
      if (fotos.some((f) => !f.path)) {
        setSubiendoFotos({ hechas: 0, total: fotos.filter((f) => !f.path).length });
        fotos = await subirFotosPendientes(v.id, fotos, (hechas, total) => setSubiendoFotos({ hechas, total }));
        await guardarDatosVisita({ ...d, fotos });
        setDatos({ ...d, fotos });
        setSubiendoFotos(null);
      }

      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitaId: v.id,
          fecha: d.fecha,
          tipoVisita: d.tipoVisita,
          empresa: {
            ghlId: d.empresa.ghlId,
            razonSocial: d.empresa.razonSocial,
            nombreComercial: d.empresa.nombreComercial,
            nif: d.empresa.nif,
            cnae: d.empresa.cnae,
            actividad: d.empresa.actividad,
            direccionFiscal: d.empresa.direccionFiscal,
            centro: d.empresa.centro,
          },
          sector: v.sector,
          sectorOtro: v.sectorOtro,
          numTrabajadores: d.numTrabajadores,
          documentosSolicitados: v.documentosSolicitados,
          notas: d.notas,
          fotos: referenciasFoto(fotos),
          audio: d.audioBase64 ? { base64: d.audioBase64, mime: d.audioMime! } : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setChecklist(data.checklist as Checklist);
      setAvisosParseo(data.avisosParseo ?? []);
      await guardarChecklist({ id: v.id, checklist: data.checklist, avisosParseo: data.avisosParseo ?? [], generadoEn: new Date().toISOString() });
      await actualizarEstadoVisita(v.id, "checklist_pendiente");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Error generando el checklist.");
      await actualizarEstadoVisita(v.id, "error");
    } finally {
      setSubiendoFotos(null);
      setGenerando(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const v = await leerVisita(id);
      const d = await leerDatosVisita(id);
      if (!v || !d) {
        setError("No se encuentra esta visita en este dispositivo.");
        setCargando(false);
        return;
      }
      setVisita(v);
      setDatos(d);

      const guardado = await leerChecklist(id);
      if (guardado) {
        setChecklist(guardado.checklist as Checklist);
        setAvisosParseo(guardado.avisosParseo);
        setCargando(false);
      } else {
        setCargando(false);
        await generar(v, d);
      }
    })();
  }, [id, generar]);

  function actualizarItem(bloqueId: string, itemId: string, valor: ValorItem) {
    if (!checklist) return;
    const patch = (b: Bloque): Bloque =>
      b.id === bloqueId
        ? { ...b, items: b.items.map((it) => (it.id === itemId ? marcarEditado(it, valor) : it)) }
        : b;
    const sectorial = bloqueSectorial(checklist);
    setChecklist({
      ...checklist,
      bloques: checklist.bloques.map(patch),
      modulo_sectorial: sectorial && sectorial.id === bloqueId ? patch(sectorial) : checklist.modulo_sectorial,
    });
  }

  /** Genera un único documento y actualiza su fila del modal. */
  const generarDocumento = useCallback(
    async (tipo: TipoDocumento, confirmado: Checklist, fotos: DatosVisita["fotos"], visitaId: string) => {
      setEstadoDocs((p) => ({ ...p, [tipo]: { fase: "generando" } }));
      try {
        const res = await fetch("/api/generar-documento", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitaId, tipoDocumento: tipo, checklist: confirmado, fotos: referenciasFoto(fotos) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
        setEstadoDocs((p) => ({ ...p, [tipo]: { fase: "ok", avisos: data.avisos ?? [] } }));
        return true;
      } catch (e) {
        setEstadoDocs((p) => ({
          ...p,
          [tipo]: { fase: "error", mensaje: e instanceof Error ? e.message : String(e) },
        }));
        return false;
      }
    },
    []
  );

  /** Lanza la generación de la lista de tipos indicada, en serie. */
  const generarDocumentos = useCallback(
    async (tipos: TipoDocumento[], confirmado: Checklist, d: DatosVisita, visitaId: string) => {
      setGenerandoDocs(true);
      setErrorEnvio(null);
      let huboError = false;
      for (const tipo of tipos) {
        const ok = await generarDocumento(tipo, confirmado, d.fotos, visitaId);
        if (!ok) huboError = true;
      }
      setGenerandoDocs(false);
      await actualizarEstadoVisita(visitaId, huboError ? "error" : "completada");
    },
    [generarDocumento]
  );

  async function onConfirmar() {
    if (!checklist || !visita || !datos) return;
    setConfirmando(true);
    let confirmado: Checklist;
    try {
      confirmado = confirmarChecklist(checklist);
      setChecklist(confirmado);
      await guardarChecklist({ id: visita.id, checklist: confirmado, avisosParseo, generadoEn: new Date().toISOString() });
      await actualizarEstadoVisita(visita.id, "generando");
    } finally {
      setConfirmando(false);
    }

    // El modal se abre ANTES de empezar: en móvil el progreso en texto pequeño
    // al pie de la página pasaba desapercibido.
    setEstadoDocs(
      Object.fromEntries(confirmado.documentos_solicitados.map((t) => [t, { fase: "pendiente" } as EstadoDoc]))
    );
    setModalAbierto(true);
    await generarDocumentos(confirmado.documentos_solicitados, confirmado, datos, visita.id);
  }

  async function onReintentarFallidos() {
    if (!checklist || !visita || !datos) return;
    const fallidos = (checklist.documentos_solicitados ?? []).filter((t) => estadoDocs[t]?.fase === "error");
    if (fallidos.length === 0) return;
    await generarDocumentos(fallidos, checklist, datos, visita.id);
  }

  async function onEnviarEmail() {
    if (!visita) return;
    setEnviando(true);
    setErrorEnvio(null);
    try {
      const res = await fetch("/api/enviar-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitaId: visita.id, empresaNombre: visita.empresaNombre }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setEnviado(true);
    } catch (e) {
      setErrorEnvio(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) return <EstadoCentral texto="Cargando visita…" />;
  if (generando) return (
    <PantallaGenerandoChecklist
      numFotos={datos?.fotos.length ?? 0}
      conAudio={Boolean(datos?.audioBase64)}
      subiendoFotos={subiendoFotos}
    />
  );
  if (error && !checklist) {
    return (
      <EstadoCentral texto={error}>
        {visita && datos && <button onClick={() => generar(visita, datos)} style={btnPrimario}>Reintentar</button>}
      </EstadoCentral>
    );
  }
  if (!checklist || !visita) return <EstadoCentral texto="No hay datos que mostrar." />;

  const pendientes = itemsPendientes(checklist);
  const inferidos = itemsInferidos(checklist);
  const puedeConf = puedeConfirmar(checklist);
  const sectorial = bloqueSectorial(checklist);
  const todosBloques = [...checklist.bloques, ...(sectorial ? [sectorial] : [])];

  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "2rem 1.25rem 4rem" }}>
      <Link href="/dashboard" style={{ color: "#6b7280", fontSize: "0.9rem", textDecoration: "none" }}>← Visitas</Link>

      <header style={{ margin: "0.75rem 0 1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>{visita.empresaNombre}</h1>
        <p style={{ color: "#6b7280", margin: "0.3rem 0 0", fontSize: "0.9rem" }}>
          {visita.centroNombre ? `${visita.centroNombre} · ` : ""}
          {nombreSector(visita.sector, visita.sectorOtro)} · Checklist generado por IA — revisa y confirma
        </p>
      </header>

      {error && (
        <Aviso tipo="error">
          {error} <button onClick={() => datos && generar(visita, datos)} style={{ marginLeft: 8 }}>Reintentar</button>
        </Aviso>
      )}

      {checklist.avisos.map((a, i) => (
        <Aviso key={`a${i}`} tipo="aviso"><strong>{ETIQUETA_TIPO_AVISO[a.tipo] ?? a.tipo}:</strong> {a.texto}</Aviso>
      ))}
      {avisosParseo.map((t, i) => <Aviso key={`p${i}`} tipo="parseo">{t}</Aviso>)}

      {pendientes.length > 0 && (
        <Aviso tipo="pendiente">
          {pendientes.length} campo{pendientes.length === 1 ? "" : "s"} obligatorio{pendientes.length === 1 ? "" : "s"} sin rellenar. Complétalos para poder confirmar.
        </Aviso>
      )}
      {inferidos.length > 0 && (
        <Aviso tipo="inferido">
          {inferidos.length} valor{inferidos.length === 1 ? "" : "es"} inferido{inferidos.length === 1 ? "" : "s"} por la IA (no observado directamente): revísalos.
        </Aviso>
      )}

      {todosBloques.map((b) => (
        <BloqueCard key={b.id} bloque={b} onCambiar={(itemId, valor) => actualizarItem(b.id, itemId, valor)} />
      ))}

      {checklist.puestos.length > 0 && (
        <section style={card}>
          <h2 style={tituloSeccion}>Puestos de trabajo y riesgos detectados</h2>
          {checklist.puestos.map((p) => (
            <div key={p.id} style={{ marginBottom: "1.25rem" }}>
              <strong>{p.nombre}</strong>
              {p.num_trabajadores != null && ` · ${p.num_trabajadores} trabajador${p.num_trabajadores === 1 ? "" : "es"}`}
              {p.descripcion_operativa && (
                <p style={{ color: "#6b7280", fontSize: "0.88rem", margin: "0.25rem 0 0.6rem" }}>{p.descripcion_operativa}</p>
              )}
              <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                {p.riesgos.map((r, i) => (
                  <li key={i} style={{ fontSize: "0.88rem", marginBottom: "0.3rem" }}>
                    <strong>{r.nombre}</strong> ({r.codigo}) — {ETIQUETA_VALORACION[r.valoracion] ?? r.valoracion}
                    {r.zona && ` · ${r.zona}`}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <button onClick={onConfirmar} disabled={!puedeConf || confirmando || generandoDocs}
        style={{ ...btnPrimario, width: "100%", marginTop: "1rem", opacity: puedeConf && !confirmando && !generandoDocs ? 1 : 0.5 }}>
        {confirmando ? "Confirmando…" : generandoDocs ? "Generando documentos…" : puedeConf ? "Confirmar checklist" : `Faltan ${pendientes.length} campo(s) obligatorio(s)`}
      </button>

      {modalAbierto && (
        <ModalDocumentos
          orden={checklist.documentos_solicitados}
          estados={estadoDocs}
          generando={generandoDocs}
          enviando={enviando}
          enviado={enviado}
          errorEnvio={errorEnvio}
          onEnviar={onEnviarEmail}
          onReintentar={onReintentarFallidos}
          onCerrar={() => setModalAbierto(false)}
        />
      )}
    </main>
  );
}

function ItemRow({ item, onCambiar }: { item: Item; onCambiar: (valor: ValorItem) => void }) {
  const vacio = (v: ValorItem) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
  const pendiente = item.obligatorio && vacio(item.valor);
  const inferido = item.fuente?.includes("inferido");

  return (
    <div style={{ padding: "0.85rem 0", borderTop: "1px solid #f3f4f6", background: pendiente ? "#fef2f2" : inferido ? "#eff6ff" : "transparent" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.5rem" }}>
        <span style={{ fontWeight: 500, fontSize: "0.92rem" }}>
          {item.pregunta || item.label}{item.obligatorio && <span style={{ color: "#b91c1c" }}> *</span>}
        </span>
        {item.fuente?.length > 0 && (
          <span style={{ fontSize: "0.72rem", color: "#9ca3af", whiteSpace: "nowrap" }}>{item.fuente.join(", ")}</span>
        )}
      </div>

      {item.tipo === "snp" && (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {(["si", "no", "na"] as const).map((v) => (
            <button key={v} onClick={() => onCambiar(v)} style={{
              padding: "0.4rem 0.9rem", borderRadius: 6, border: "1px solid #d1d5db",
              background: item.valor === v ? "#111827" : "#fff", color: item.valor === v ? "#fff" : "#111827",
              cursor: "pointer", fontSize: "0.85rem",
            }}>{v.toUpperCase()}</button>
          ))}
        </div>
      )}

      {item.tipo === "texto" && (
        <textarea value={(item.valor as string) ?? ""} onChange={(e) => onCambiar(e.target.value)} rows={2}
          style={{ width: "100%", padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db", fontFamily: "inherit" }} />
      )}

      {item.tipo === "numero" && (
        <input type="number" value={(item.valor as number) ?? ""}
          onChange={(e) => onCambiar(e.target.value === "" ? null : Number(e.target.value))}
          style={{ width: "100%", padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db" }} />
      )}

      {item.tipo === "seleccion" && (
        <select value={(item.valor as string) ?? ""} onChange={(e) => onCambiar(e.target.value || null)}
          style={{ width: "100%", padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db" }}>
          <option value="">— Seleccionar —</option>
          {item.opciones?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}

      {item.tipo === "multiseleccion" && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {item.opciones?.map((o) => {
            const activo = Array.isArray(item.valor) && item.valor.includes(o);
            return (
              <button key={o} onClick={() => {
                const actual = Array.isArray(item.valor) ? item.valor : [];
                onCambiar(activo ? actual.filter((x) => x !== o) : [...actual, o]);
              }} style={{
                padding: "0.35rem 0.75rem", borderRadius: 999, border: "1px solid #d1d5db",
                background: activo ? "#111827" : "#fff", color: activo ? "#fff" : "#111827",
                cursor: "pointer", fontSize: "0.8rem",
              }}>{o}</button>
            );
          })}
        </div>
      )}

      {item.valor === "no" && item.detalle_no.length > 0 && (
        <p style={{ fontSize: "0.8rem", color: "#b91c1c", margin: "0.4rem 0 0" }}>{item.detalle_no.join(" · ")}</p>
      )}
      {item.observaciones && (
        <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: "0.4rem 0 0" }}>{item.observaciones}</p>
      )}
    </div>
  );
}

function BloqueCard({ bloque, onCambiar }: { bloque: Bloque; onCambiar: (itemId: string, valor: ValorItem) => void }) {
  if (bloque.aplicable === false) return null;
  return (
    <section style={card}>
      <h2 style={tituloSeccion}>{bloque.titulo}</h2>
      {bloque.items.map((it) => (
        <ItemRow key={it.id} item={it} onCambiar={(valor) => onCambiar(it.id, valor)} />
      ))}
      {bloque.observaciones_bloque && (
        <p style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "0.75rem" }}>{bloque.observaciones_bloque}</p>
      )}
    </section>
  );
}

function EstadoCentral({ texto, children }: { texto: string; children?: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1.25rem", textAlign: "center" }}>
      <p style={{ color: "#6b7280" }}>{texto}</p>
      {children}
    </main>
  );
}

const COLOR_AVISO: Record<string, { bg: string; fg: string }> = {
  error: { bg: "#fef2f2", fg: "#b91c1c" },
  aviso: { bg: "#fff7ed", fg: "#9a3412" },
  parseo: { bg: "#f3f4f6", fg: "#4b5563" },
  pendiente: { bg: "#fef2f2", fg: "#b91c1c" },
  inferido: { bg: "#eff6ff", fg: "#1d4ed8" },
};

function Aviso({ tipo, children }: { tipo: keyof typeof COLOR_AVISO; children: React.ReactNode }) {
  const c = COLOR_AVISO[tipo];
  return (
    <div style={{ background: c.bg, color: c.fg, padding: "0.75rem 1rem", borderRadius: 8, marginBottom: "0.6rem", fontSize: "0.88rem" }}>
      {children}
    </div>
  );
}

const ETIQUETA_TIPO_AVISO: Record<string, string> = {
  contradiccion: "Contradicción", dato_pendiente: "Dato pendiente",
  hallazgo_audio: "Hallazgo en audio", fuera_checklist: "Fuera de checklist",
};
const ETIQUETA_VALORACION: Record<string, string> = {
  trivial: "Trivial", tolerable: "Tolerable", moderado: "Moderado", importante: "Importante", intolerable: "Intolerable",
};

const card: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 12, padding: "1.15rem", marginBottom: "1rem" };
const tituloSeccion: React.CSSProperties = { fontSize: "1.05rem", fontWeight: 600, margin: "0 0 0.25rem" };
const btnPrimario: React.CSSProperties = { padding: "0.85rem", borderRadius: 8, border: "none", background: "#111827", color: "#fff", fontWeight: 600, fontSize: "1rem", cursor: "pointer" };


// ---------------------------------------------------------------------------
// Feedback de progreso
// ---------------------------------------------------------------------------

type EstadoDoc = {
  fase: "pendiente" | "generando" | "ok" | "error";
  mensaje?: string;
  avisos?: string[];
};

function nombreDocumento(tipo: string) {
  return DOCUMENTOS.find((d) => d.id === tipo)?.nombre ?? tipo;
}

function mmss(segundos: number) {
  const m = Math.floor(segundos / 60);
  const sg = segundos % 60;
  return `${m}:${String(sg).padStart(2, "0")}`;
}

/** Cronómetro en segundos, arranca al montar. */
function useCronometro(activo: boolean) {
  const [segundos, setSegundos] = useState(0);
  useEffect(() => {
    if (!activo) return;
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [activo]);
  return segundos;
}

/** Barra indeterminada: no fingimos un porcentaje que no conocemos. */
function BarraIndeterminada() {
  return (
    <>
      <style>{`@keyframes grDeslizar { 0% { left: -40%; } 100% { left: 100%; } }`}</style>
      <div style={{ position: "relative", height: 4, background: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: 0, height: "100%", width: "40%", borderRadius: 999,
          background: "#111827", animation: "grDeslizar 1.4s ease-in-out infinite",
        }} />
      </div>
    </>
  );
}

/**
 * Pantalla de espera de la Llamada 1. La generación tarda bastante más de lo
 * que decía el mensaje anterior ("hasta un minuto"), así que aquí se muestra
 * el tiempo transcurrido y en qué fase va, para que el técnico no crea que
 * la app se ha colgado.
 */
function PantallaGenerandoChecklist({ numFotos, conAudio, subiendoFotos }: {
  numFotos: number;
  conAudio: boolean;
  subiendoFotos: { hechas: number; total: number } | null;
}) {
  const segundos = useCronometro(true);

  // Mientras se suben las fotos sí hay progreso real que mostrar.
  if (subiendoFotos) {
    const pct = subiendoFotos.total ? Math.round((subiendoFotos.hechas / subiendoFotos.total) * 100) : 0;
    return (
      <main style={{ maxWidth: 480, margin: "5rem auto", padding: "0 1.5rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.2rem", fontWeight: 600, margin: "0 0 0.5rem" }}>Subiendo fotografías</h1>
        <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: "0 0 1.5rem" }}>
          {subiendoFotos.hechas} de {subiendoFotos.total} · necesitas conexión para este paso.
        </p>
        <div style={{ height: 6, background: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "#111827", borderRadius: 999, transition: "width .25s" }} />
        </div>
      </main>
    );
  }

  const fases = [
    conAudio ? "Transcribiendo la grabación de audio…" : "Preparando los datos de la visita…",
    numFotos > 0 ? `Analizando ${numFotos} fotografía${numFotos === 1 ? "" : "s"} del centro…` : "Analizando las notas del técnico…",
    "Identificando puestos de trabajo y riesgos…",
    "Redactando los bloques del checklist…",
    "Revisando coherencia y datos pendientes…",
  ];
  // Avanza de fase cada 25s; se queda en la última hasta que termine de verdad.
  const faseActual = Math.min(Math.floor(segundos / 25), fases.length - 1);

  return (
    <main style={{ maxWidth: 480, margin: "5rem auto", padding: "0 1.5rem", textAlign: "center" }}>
      <h1 style={{ fontSize: "1.2rem", fontWeight: 600, margin: "0 0 0.5rem" }}>Generando checklist</h1>
      <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: "0 0 1.5rem" }}>
        La IA está analizando la visita. Suele tardar entre 1 y 3 minutos; no cierres esta pantalla.
      </p>

      <BarraIndeterminada />

      <p style={{ margin: "1.25rem 0 0.35rem", fontWeight: 500 }}>{fases[faseActual]}</p>
      <p style={{ color: "#9ca3af", fontSize: "0.85rem", margin: 0, fontVariantNumeric: "tabular-nums" }}>
        {mmss(segundos)} transcurrido{segundos >= 180 && " · está tardando más de lo normal, sigue en marcha"}
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: "1.75rem 0 0", textAlign: "left", display: "grid", gap: "0.4rem" }}>
        {fases.map((f, i) => (
          <li key={f} style={{ display: "flex", gap: "0.6rem", alignItems: "center", fontSize: "0.85rem", color: i <= faseActual ? "#111827" : "#d1d5db" }}>
            <span style={{ width: 16, flexShrink: 0 }}>{i < faseActual ? "✓" : i === faseActual ? "•" : "○"}</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}

const ICONO_FASE: Record<EstadoDoc["fase"], string> = {
  pendiente: "○", generando: "•", ok: "✓", error: "✕",
};
const COLOR_FASE: Record<EstadoDoc["fase"], string> = {
  pendiente: "#9ca3af", generando: "#1d4ed8", ok: "#15803d", error: "#b91c1c",
};

/**
 * Modal bloqueante de generación de documentos.
 *
 * Es deliberadamente imposible de cerrar mientras se generan documentos: no
 * responde al clic en el fondo, no tiene botón de cerrar y bloquea el scroll
 * del cuerpo. Si el técnico se sale a mitad, los DOCX que falten no se generan
 * y el email se enviaría incompleto.
 */
function ModalDocumentos({
  orden, estados, generando, enviando, enviado, errorEnvio, onEnviar, onReintentar, onCerrar,
}: {
  orden: TipoDocumento[];
  estados: Record<string, EstadoDoc>;
  generando: boolean;
  enviando: boolean;
  enviado: boolean;
  errorEnvio: string | null;
  onEnviar: () => void;
  onReintentar: () => void;
  onCerrar: () => void;
}) {
  const segundos = useCronometro(generando);
  const bloqueado = generando || enviando;

  const completados = orden.filter((t) => estados[t]?.fase === "ok").length;
  const fallidos = orden.filter((t) => estados[t]?.fase === "error").length;
  const terminado = !generando && orden.every((t) => ["ok", "error"].includes(estados[t]?.fase ?? ""));
  const avisos = orden.flatMap((t) => (estados[t]?.avisos ?? []).map((a) => ({ tipo: t, texto: a })));

  // Bloquea el scroll de fondo y avisa si se intenta cerrar la pestaña a mitad.
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onSalir = (e: BeforeUnloadEvent) => { if (bloqueado) e.preventDefault(); };
    window.addEventListener("beforeunload", onSalir);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("beforeunload", onSalir);
    };
  }, [bloqueado]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, background: "rgba(17,24,39,.55)", zIndex: 50,
        display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "1rem",
      }}
      // Sin onClick: pulsar fuera NO cierra el modal a propósito.
    >
      <div style={{
        background: "#fff", borderRadius: 16, width: "100%", maxWidth: 460,
        padding: "1.35rem 1.25rem 1.25rem", maxHeight: "88vh", overflowY: "auto",
        boxShadow: "0 -8px 40px rgba(0,0,0,.25)",
      }}>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.3rem" }}>
          {generando ? "Generando documentos" : enviado ? "Documentos enviados" : fallidos > 0 ? "Generación incompleta" : "Documentos listos"}
        </h2>
        <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: "0 0 1rem" }}>
          {generando
            ? `${completados} de ${orden.length} · ${mmss(segundos)} · cada documento tarda entre 1 y 2 minutos.`
            : enviado
              ? "Se han enviado por email con todos los adjuntos."
              : `${completados} de ${orden.length} generados${fallidos > 0 ? `, ${fallidos} con error` : ""}.`}
        </p>

        {generando && <div style={{ marginBottom: "1rem" }}><BarraIndeterminada /></div>}

        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1.1rem", display: "grid", gap: "0.55rem" }}>
          {orden.map((tipo) => {
            const est = estados[tipo] ?? { fase: "pendiente" as const };
            return (
              <li key={tipo} style={{ display: "flex", gap: "0.65rem", alignItems: "flex-start", fontSize: "0.9rem" }}>
                <span style={{ color: COLOR_FASE[est.fase], width: 16, flexShrink: 0, fontWeight: 700 }}>
                  {ICONO_FASE[est.fase]}
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ color: est.fase === "pendiente" ? "#9ca3af" : "#111827" }}>
                    {nombreDocumento(tipo)}
                  </span>
                  {est.fase === "generando" && <span style={{ color: "#1d4ed8" }}> · redactando…</span>}
                  {est.fase === "error" && (
                    <span style={{ display: "block", color: "#b91c1c", fontSize: "0.78rem", marginTop: 2 }}>
                      {est.mensaje}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        {avisos.length > 0 && !generando && (
          <div style={{ background: "#fff7ed", color: "#9a3412", borderRadius: 8, padding: "0.7rem 0.85rem", fontSize: "0.8rem", marginBottom: "1rem" }}>
            <strong style={{ display: "block", marginBottom: "0.35rem" }}>Avisos de la IA</strong>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.25rem" }}>
              {avisos.map((a, i) => <li key={i}>{a.texto}</li>)}
            </ul>
          </div>
        )}

        {errorEnvio && (
          <div style={{ background: "#fef2f2", color: "#b91c1c", borderRadius: 8, padding: "0.7rem 0.85rem", fontSize: "0.82rem", marginBottom: "1rem" }}>
            No se pudo enviar el email: {errorEnvio}
          </div>
        )}

        {terminado && !enviado && (
          <>
            {fallidos > 0 && (
              <button onClick={onReintentar} disabled={bloqueado}
                style={{ ...btnModal, background: "#fff", color: "#111827", border: "1px solid #d1d5db", marginBottom: "0.6rem" }}>
                Reintentar los {fallidos} documento{fallidos === 1 ? "" : "s"} con error
              </button>
            )}
            {completados > 0 && (
              <button onClick={onEnviar} disabled={enviando}
                style={{ ...btnModal, background: "#1e8449", opacity: enviando ? 0.6 : 1 }}>
                {enviando
                  ? "Enviando…"
                  : fallidos > 0
                    ? `Enviar los ${completados} documento${completados === 1 ? "" : "s"} generados`
                    : "Enviar documentos por email"}
              </button>
            )}
          </>
        )}

        {enviado && (
          <div style={{ background: "#f0fdf4", color: "#15803d", borderRadius: 8, padding: "0.8rem 0.9rem", fontSize: "0.88rem", marginBottom: "0.9rem" }}>
            ✅ Enviados correctamente. Los archivos se han borrado del almacenamiento temporal.
          </div>
        )}

        {!bloqueado && terminado && (
          <button onClick={onCerrar}
            style={{ ...btnModal, background: "none", color: "#6b7280", fontWeight: 500, marginTop: "0.4rem" }}>
            {enviado ? "Cerrar" : "Cerrar sin enviar"}
          </button>
        )}

        {bloqueado && (
          <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "0.78rem", margin: "0.4rem 0 0" }}>
            No cierres la aplicación hasta que termine.
          </p>
        )}
      </div>
    </div>
  );
}

const btnModal: React.CSSProperties = {
  width: "100%", padding: "0.85rem", borderRadius: 10, border: "none",
  color: "#fff", fontWeight: 600, fontSize: "0.95rem", cursor: "pointer",
};