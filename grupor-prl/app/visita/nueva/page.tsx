"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SECTORES, DOCUMENTOS, SECTOR_OTROS } from "@/lib/sectores";
import {
  guardarVisita, guardarDatosVisita,
  type TipoDocumento, type FotoVisita, type TipoVisita,
} from "@/lib/visitas/store";

type Empresa = { id: string; nombre: string; nif?: string; cnae?: string; direccion?: string; actividad?: string };

const MAX_FOTOS = 20;

function leerComoBase64(file: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

/** Redimensiona el lado mayor a 1568px (límite recomendado para visión) */
async function redimensionar(file: File): Promise<{ base64: string; mime: string }> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, 1568 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.85));
  return { base64: await leerComoBase64(blob), mime: "image/jpeg" };
}

export default function NuevaVisitaPage() {
  const router = useRouter();

  const [empresas, setEmpresas] = useState<Empresa[] | null>(null);
  const [errorEmpresas, setErrorEmpresas] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState("");
  const [sector, setSector] = useState("");
  const [sectorOtro, setSectorOtro] = useState("");
  const [docs, setDocs] = useState<TipoDocumento[]>([]);
  const [fotos, setFotos] = useState<FotoVisita[]>([]);
  const [notas, setNotas] = useState("");
  const [numTrabajadores, setNumTrabajadores] = useState("");
  const [tipoVisita, setTipoVisita] = useState<TipoVisita>("inicial");
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // --- audio ---
  const [grabando, setGrabando] = useState(false);
  const [audio, setAudio] = useState<{ base64: string; mime: string; url: string } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    fetch("/api/empresas")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => setEmpresas(Array.isArray(d) ? d : d.empresas ?? []))
      .catch(() => setErrorEmpresas("No se pudo cargar el listado de empresas desde el CRM."));
  }, []);

  async function onFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setProcesando(true);
    const nuevas: FotoVisita[] = [];
    for (const f of files) {
      if (fotos.length + nuevas.length >= MAX_FOTOS) break;
      const { base64, mime } = await redimensionar(f);
      const n = fotos.length + nuevas.length + 1;
      nuevas.push({ id: `foto_${String(n).padStart(2, "0")}`, nombre: f.name, mime, base64 });
    }
    setFotos((prev) => [...prev, ...nuevas]);
    setProcesando(false);
    e.target.value = "";
  }

  async function toggleGrabacion() {
    if (grabando) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => chunksRef.current.push(ev.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        setAudio({ base64: await leerComoBase64(blob), mime: rec.mimeType, url: URL.createObjectURL(blob) });
        setGrabando(false);
      };
      rec.start();
      recorderRef.current = rec;
      setGrabando(true);
    } catch {
      alert("No se pudo acceder al micrófono. Revisa los permisos del navegador.");
    }
  }

  const empresa = empresas?.find((e) => e.id === empresaId);
  const sectorValido = sector !== "" && (sector !== SECTOR_OTROS || sectorOtro.trim().length >= 3);
  const listo = Boolean(empresaId && sectorValido && docs.length > 0) && !procesando && !grabando;

  async function onContinuar() {
    if (!listo || !empresa) return;
    setGuardando(true);
    const id = crypto.randomUUID();
    const ahora = new Date().toISOString();
    try {
      await guardarDatosVisita({
        id, fotos, notas,
        audioBase64: audio?.base64 ?? null,
        audioMime: audio?.mime ?? null,
        empresa: {
          ghlId: empresa.id,
          nombre: empresa.nombre,
          nif: empresa.nif || null,
          cnae: empresa.cnae || null,
          direccion: empresa.direccion || null,
          actividad: empresa.actividad || null,
        },
        numTrabajadores: numTrabajadores.trim() ? Number(numTrabajadores) : null,
        tipoVisita,
        fecha: ahora.slice(0, 10),
      });
      await guardarVisita({
        id,
        empresaId: empresa.id,
        empresaNombre: empresa.nombre,
        sector,
        sectorOtro: sector === SECTOR_OTROS ? sectorOtro.trim() : null,
        tecnico: "",
        estado: "borrador",
        creadaEn: ahora,
        actualizadaEn: ahora,
        documentosSolicitados: docs,
        numFotos: fotos.length,
      });
      router.push(`/visita/${id}/checklist`);
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar la visita en este dispositivo.");
      setGuardando(false);
    }
  }

  const card: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 12, padding: "1.15rem", marginBottom: "1rem" };
  const label: React.CSSProperties = { display: "block", fontWeight: 600, marginBottom: "0.6rem", fontSize: "0.95rem" };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "0.6rem", borderRadius: 8, border: "1px solid #d1d5db" };

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.25rem" }}>
      <Link href="/dashboard" style={{ color: "#6b7280", fontSize: "0.9rem", textDecoration: "none" }}>← Visitas</Link>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: "0.75rem 0 1.5rem" }}>Nueva visita</h1>

      <section style={card}>
        <label style={label} htmlFor="empresa">Empresa</label>
        {errorEmpresas && <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>{errorEmpresas}</p>}
        <select id="empresa" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}
          disabled={!empresas} style={inputStyle}>
          <option value="">{empresas ? "Selecciona una empresa…" : "Cargando…"}</option>
          {empresas?.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </section>

      <section style={card}>
        <label style={label} htmlFor="sector">Sector</label>
        <select id="sector" value={sector} onChange={(e) => setSector(e.target.value)} style={inputStyle}>
          <option value="">Selecciona un sector…</option>
          {SECTORES.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>

        {sector === SECTOR_OTROS && (
          <div style={{ marginTop: "0.75rem" }}>
            <input type="text" value={sectorOtro} onChange={(e) => setSectorOtro(e.target.value)}
              placeholder="Escribe la actividad de la empresa (ej. taller de carpintería metálica)"
              maxLength={80} autoFocus style={inputStyle} />
            <p style={{ color: "#b45309", fontSize: "0.8rem", margin: "0.5rem 0 0" }}>
              Sin módulo sectorial: el checklist incluirá solo los bloques transversales.
              Sé específico, la descripción guía la generación de riesgos.
            </p>
          </div>
        )}
        {sector && sector !== SECTOR_OTROS && (
          <p style={{ color: "#6b7280", fontSize: "0.8rem", margin: "0.5rem 0 0" }}>
            Determina qué módulos del checklist se activan.
          </p>
        )}
      </section>

      <section style={card}>
        <span style={label}>Datos de la visita</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
          <div>
            <label style={{ fontSize: "0.8rem", color: "#6b7280", display: "block", marginBottom: "0.3rem" }}>Nº de trabajadores</label>
            <input type="number" min={0} value={numTrabajadores}
              onChange={(e) => setNumTrabajadores(e.target.value)}
              placeholder="Opcional" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: "0.8rem", color: "#6b7280", display: "block", marginBottom: "0.3rem" }}>Tipo de visita</label>
            <select value={tipoVisita} onChange={(e) => setTipoVisita(e.target.value as TipoVisita)} style={inputStyle}>
              <option value="inicial">Inicial</option>
              <option value="revision">Revisión</option>
              <option value="extraordinaria">Extraordinaria</option>
            </select>
          </div>
        </div>
      </section>

      <section style={card}>
        <span style={label}>Documentos a generar</span>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {DOCUMENTOS.map((d) => (
            <label key={d.id} style={{ display: "flex", gap: "0.6rem", alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={docs.includes(d.id)}
                onChange={(e) => setDocs((p) => e.target.checked ? [...p, d.id] : p.filter((x) => x !== d.id))} />
              <span>{d.nombre}</span>
            </label>
          ))}
        </div>
      </section>

      <section style={card}>
        <span style={label}>Fotografías ({fotos.length}/{MAX_FOTOS})</span>
        <input type="file" accept="image/*" multiple capture="environment"
          onChange={onFotos} disabled={procesando || fotos.length >= MAX_FOTOS} />
        {procesando && <p style={{ color: "#6b7280", fontSize: "0.85rem" }}>Procesando imágenes…</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.85rem" }}>
          {fotos.map((f) => (
            <div key={f.id} style={{ position: "relative" }}>
              <img src={`data:${f.mime};base64,${f.base64}`} alt={f.id}
                style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, display: "block" }} />
              <span style={{ position: "absolute", bottom: 2, left: 2, background: "rgba(0,0,0,.65)", color: "#fff", fontSize: "0.65rem", padding: "1px 4px", borderRadius: 4 }}>
                {f.id}
              </span>
              <button onClick={() => setFotos((p) => p.filter((x) => x.id !== f.id))}
                style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: "#111827", color: "#fff", cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      </section>

      <section style={card}>
        <span style={label}>Notas del técnico</span>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={4}
          placeholder="Observaciones, incidencias, datos que no se ven en las fotos…"
          style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }} />
      </section>

      <section style={card}>
        <span style={label}>Audio</span>
        <button onClick={toggleGrabacion}
          style={{ padding: "0.6rem 1.1rem", borderRadius: 8, border: "1px solid #d1d5db", background: grabando ? "#b91c1c" : "#fff", color: grabando ? "#fff" : "#111827", cursor: "pointer", fontWeight: 500 }}>
          {grabando ? "■ Detener grabación" : "● Grabar audio"}
        </button>
        {audio && !grabando && (
          <div style={{ marginTop: "0.85rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <audio controls src={audio.url} style={{ height: 36 }} />
            <button onClick={() => setAudio(null)} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "0.85rem" }}>Descartar</button>
          </div>
        )}
      </section>

      <button onClick={onContinuar} disabled={!listo || guardando}
        style={{ width: "100%", padding: "0.85rem", borderRadius: 8, border: "none", background: listo && !guardando ? "#111827" : "#d1d5db", color: "#fff", fontWeight: 600, fontSize: "1rem", cursor: listo && !guardando ? "pointer" : "not-allowed" }}>
        {guardando ? "Guardando…" : "Continuar → generar checklist"}
      </button>
      {!listo && !procesando && (
        <p style={{ color: "#6b7280", fontSize: "0.85rem", textAlign: "center", marginTop: "0.75rem" }}>
          {sector === SECTOR_OTROS && sectorOtro.trim().length < 3
            ? "Indica la actividad de la empresa."
            : "Selecciona empresa, sector y al menos un documento."}
        </p>
      )}
    </main>
  );
}