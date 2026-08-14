// grupor-prl/app/visita/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  leerVisita, leerDatosVisita, leerChecklist, borrarVisita,
  type VisitaResumen, type DatosVisita, type EstadoVisita,
} from "@/lib/visitas/store";
import { nombreSector, DOCUMENTOS } from "@/lib/sectores";

const ETIQUETA_ESTADO: Record<EstadoVisita, string> = {
  borrador: "Borrador",
  checklist_pendiente: "Checklist por revisar",
  generando: "Generando documentos",
  completada: "Completada",
  error: "Con errores",
};

const COLOR_ESTADO: Record<EstadoVisita, string> = {
  borrador: "#6b7280",
  checklist_pendiente: "#b45309",
  generando: "#1d4ed8",
  completada: "#15803d",
  error: "#b91c1c",
};

/** Texto del botón principal según en qué punto del flujo está la visita. */
const ACCION_PRINCIPAL: Record<EstadoVisita, string> = {
  borrador: "Generar checklist →",
  checklist_pendiente: "Revisar y confirmar checklist →",
  generando: "Continuar con la generación →",
  completada: "Ver checklist confirmado →",
  error: "Reintentar →",
};

type DocumentoDisponible = { tipo: string; nombre: string; url: string; tamano: number };

function nombreDocumento(tipo: string) {
  return DOCUMENTOS.find((d) => d.id === tipo)?.nombre ?? tipo;
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function DetalleVisitaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [visita, setVisita] = useState<VisitaResumen | null>(null);
  const [datos, setDatos] = useState<DatosVisita | null>(null);
  const [tieneChecklist, setTieneChecklist] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [noEncontrada, setNoEncontrada] = useState(false);

  const [documentos, setDocumentos] = useState<DocumentoDisponible[] | null>(null);
  const [errorDocs, setErrorDocs] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const v = await leerVisita(id);
      const d = await leerDatosVisita(id);
      if (!v || !d) {
        setNoEncontrada(true);
        setCargando(false);
        return;
      }
      setVisita(v);
      setDatos(d);
      setTieneChecklist(Boolean(await leerChecklist(id)));
      setCargando(false);
    })();
  }, [id]);

  // Los documentos generados no viven en el dispositivo, sino en el buffer de
  // Supabase Storage: se piden al servidor, que devuelve URLs firmadas.
  useEffect(() => {
    if (!visita || (visita.estado !== "completada" && visita.estado !== "error")) return;
    fetch(`/api/documentos?visitaId=${encodeURIComponent(id)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? `Error ${r.status}`);
        setDocumentos(data.documentos ?? []);
      })
      .catch((e) => setErrorDocs(e instanceof Error ? e.message : "No se pudieron listar los documentos."));
  }, [visita, id]);

  async function onBorrar() {
    if (!visita) return;
    if (!confirm(`¿Eliminar la visita de ${visita.empresaNombre}? Esta acción no se puede deshacer.`)) return;
    await borrarVisita(visita.id);
    router.push("/dashboard");
  }

  if (cargando) {
    return <Centrado><p style={{ color: "#6b7280" }}>Cargando visita…</p></Centrado>;
  }

  // Antes daba un 404 del router. Ahora se explica el motivo real: las visitas
  // se guardan en IndexedDB, que es por dispositivo y por navegador.
  if (noEncontrada) {
    return (
      <Centrado>
        <h1 style={{ fontSize: "1.35rem", fontWeight: 600, margin: "0 0 0.75rem" }}>Visita no encontrada</h1>
        <p style={{ color: "#6b7280", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
          No hay ninguna visita con este identificador guardada en este dispositivo.
          Las visitas se almacenan localmente en el navegador, así que no aparecen si
          se creó desde otro móvil, otro navegador o en modo incógnito, o si se borraron
          los datos del sitio.
        </p>
        <Link href="/dashboard" style={btnPrimario}>Volver a mis visitas</Link>
      </Centrado>
    );
  }

  if (!visita || !datos) return null;

  const e = datos.empresa;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.25rem 4rem" }}>
      <Link href="/dashboard" style={{ color: "#6b7280", fontSize: "0.9rem", textDecoration: "none" }}>← Visitas</Link>

      <header style={{ margin: "0.75rem 0 1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>{visita.empresaNombre}</h1>
        <p style={{ margin: "0.4rem 0 0", fontSize: "0.9rem", color: "#6b7280" }}>
          <span style={{ color: COLOR_ESTADO[visita.estado], fontWeight: 600 }}>
            {ETIQUETA_ESTADO[visita.estado]}
          </span>
          {visita.centroNombre ? ` · ${visita.centroNombre}` : ""}
          {" · "}{nombreSector(visita.sector, visita.sectorOtro)}
          {" · "}Actualizada {formatearFecha(visita.actualizadaEn)}
        </p>
      </header>

      <section style={card}>
        <h2 style={tituloSeccion}>Empresa</h2>
        <Dato etiqueta="Razón social" valor={e.razonSocial} />
        <Dato etiqueta="Nombre comercial" valor={e.nombreComercial} />
        <Dato etiqueta="NIF" valor={e.nif} />
        <Dato etiqueta="CNAE" valor={e.cnae} />
        <Dato etiqueta="Actividad" valor={e.actividad} />
        <Dato etiqueta="Domicilio social" valor={e.direccionFiscal} />
        <Dato etiqueta="Origen" valor={e.ghlId ? "CRM" : "Introducida manualmente"} />
      </section>

      <section style={card}>
        <h2 style={tituloSeccion}>Centro de trabajo evaluado</h2>
        <Dato etiqueta="Nombre del centro" valor={e.centro.nombre} />
        <Dato etiqueta="Dirección" valor={e.centro.direccion} />
        <Dato etiqueta="Responsable" valor={e.centro.responsable} />
        <Dato etiqueta="Teléfono" valor={e.centro.telefono} />
        <Dato etiqueta="Email" valor={e.centro.email} />
      </section>

      <section style={card}>
        <h2 style={tituloSeccion}>Datos de la visita</h2>
        <Dato etiqueta="Fecha" valor={datos.fecha} />
        <Dato etiqueta="Tipo de visita" valor={datos.tipoVisita} />
        <Dato etiqueta="Nº de trabajadores" valor={datos.numTrabajadores?.toString() ?? null} />
        <Dato etiqueta="Fotografías" valor={`${datos.fotos.length}`} />
        <Dato etiqueta="Audio" valor={datos.audioBase64 ? "Grabado" : "Sin audio"} />
        <Dato etiqueta="Notas" valor={datos.notas.trim() || null} />
      </section>

      <section style={card}>
        <h2 style={tituloSeccion}>Documentos solicitados</h2>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#374151", fontSize: "0.9rem" }}>
          {visita.documentosSolicitados.map((t) => <li key={t}>{nombreDocumento(t)}</li>)}
        </ul>
      </section>

      {datos.fotos.length > 0 && (
        <section style={card}>
          <h2 style={tituloSeccion}>Fotografías</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {datos.fotos.map((f) => (
              <img key={f.id} src={`data:${f.mime};base64,${f.base64}`} alt={f.id}
                style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8 }} />
            ))}
          </div>
        </section>
      )}

      {(visita.estado === "completada" || visita.estado === "error") && (
        <section style={card}>
          <h2 style={tituloSeccion}>Documentos generados</h2>
          {errorDocs && <p style={{ color: "#b91c1c", fontSize: "0.85rem", margin: 0 }}>{errorDocs}</p>}
          {!errorDocs && documentos === null && <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: 0 }}>Consultando…</p>}
          {documentos?.length === 0 && (
            <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: 0 }}>
              No quedan documentos en el buffer. Si ya se enviaron por email, se borran tras el envío.
            </p>
          )}
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
            {documentos?.map((d) => (
              <li key={d.tipo}>
                <a href={d.url} style={{ color: "#1d4ed8", fontSize: "0.9rem", textDecoration: "none" }}>
                  ⬇ {nombreDocumento(d.tipo)} <span style={{ color: "#9ca3af" }}>({Math.round(d.tamano / 1024)} KB)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href={`/visita/${visita.id}/checklist`} style={{ ...btnPrimario, display: "block", textAlign: "center", marginTop: "0.5rem" }}>
        {tieneChecklist && visita.estado === "borrador"
          ? "Revisar y confirmar checklist →"
          : ACCION_PRINCIPAL[visita.estado]}
      </Link>

      <button onClick={onBorrar}
        style={{ width: "100%", marginTop: "0.75rem", padding: "0.75rem", background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "0.85rem" }}>
        Eliminar visita
      </button>
    </main>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <div style={{ display: "flex", gap: "0.75rem", padding: "0.4rem 0", borderBottom: "1px solid #f3f4f6", fontSize: "0.9rem" }}>
      <span style={{ color: "#6b7280", minWidth: 150, flexShrink: 0 }}>{etiqueta}</span>
      <span style={{ color: valor ? "#111827" : "#9ca3af" }}>{valor || "Sin informar"}</span>
    </div>
  );
}

function Centrado({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "5rem 1.25rem", textAlign: "center" }}>
      {children}
    </main>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb", borderRadius: 12, padding: "1.15rem", marginBottom: "1rem",
};
const tituloSeccion: React.CSSProperties = {
  fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
  color: "#6b7280", margin: "0 0 0.75rem",
};
const btnPrimario: React.CSSProperties = {
  background: "#111827", color: "#fff", padding: "0.85rem 1.25rem", borderRadius: 8,
  textDecoration: "none", fontWeight: 600, border: "none", cursor: "pointer", fontSize: "1rem",
};