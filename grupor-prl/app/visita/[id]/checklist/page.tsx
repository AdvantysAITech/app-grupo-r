// grupor-prl/app/visita/[id]/checklist/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  leerVisita, leerDatosVisita, guardarChecklist, leerChecklist, actualizarEstadoVisita,
  type VisitaResumen, type DatosVisita,
} from "@/lib/visitas/store";
import {
  type Checklist, type Bloque, type Item, type ValorItem,
  itemsPendientes, puedeConfirmar, itemsInferidos, marcarEditado, confirmarChecklist, bloqueSectorial,
} from "@/lib/checklist/types";
import { nombreSector } from "@/lib/sectores";

export default function ChecklistPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [visita, setVisita] = useState<VisitaResumen | null>(null);
  const [datos, setDatos] = useState<DatosVisita | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [avisosParseo, setAvisosParseo] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [generandoDocs, setGenerandoDocs] = useState(false);
  const [progresoDocs, setProgresoDocs] = useState<string[]>([]);
  const [docsListos, setDocsListos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const generar = useCallback(async (v: VisitaResumen, d: DatosVisita) => {
    setGenerando(true);
    setError(null);
    try {
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
          fotos: d.fotos.map((f) => ({ id: f.id, mime: f.mime, base64: f.base64 })),
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

    setGenerandoDocs(true);
    setProgresoDocs([]);
    let huboError = false;
    for (const tipo of confirmado.documentos_solicitados) {
      setProgresoDocs((p) => [...p, `Generando "${tipo}"…`]);
      try {
        const res = await fetch("/api/generar-documento", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitaId: visita.id, tipoDocumento: tipo, checklist: confirmado, fotos: datos.fotos }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
        setProgresoDocs((p) => [...p.slice(0, -1), `✅ "${tipo}" generado${data.avisos?.length ? ` (avisos: ${data.avisos.join("; ")})` : ""}`]);
      } catch (e) {
        huboError = true;
        setProgresoDocs((p) => [...p.slice(0, -1), `❌ "${tipo}" falló: ${e instanceof Error ? e.message : String(e)}`]);
      }
    }
    setGenerandoDocs(false);
    await actualizarEstadoVisita(visita.id, huboError ? "error" : "completada");
    setDocsListos(!huboError);
  }

  async function onEnviarEmail() {
    if (!visita) return;
    setEnviando(true);
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
      setProgresoDocs((p) => [...p, `❌ Error enviando email: ${e instanceof Error ? e.message : String(e)}`]);
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) return <EstadoCentral texto="Cargando visita…" />;
  if (generando) return <EstadoCentral texto="Generando checklist con IA… puede tardar hasta un minuto." />;
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

      {progresoDocs.length > 0 && (
        <div style={{ marginTop: "1rem", fontSize: "0.85rem", color: "#374151" }}>
          {progresoDocs.map((p, i) => <div key={i} style={{ padding: "0.3rem 0" }}>{p}</div>)}
        </div>
      )}

      {docsListos && !enviado && (
        <button onClick={onEnviarEmail} disabled={enviando}
          style={{ ...btnPrimario, width: "100%", marginTop: "0.75rem", background: "#1e8449", opacity: enviando ? 0.5 : 1 }}>
          {enviando ? "Enviando…" : "Enviar documentos por email"}
        </button>
      )}
      {enviado && <Aviso tipo="parseo">✅ Documentos enviados por email correctamente.</Aviso>}
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