// grupor-prl/app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listarVisitas, borrarVisita, type VisitaResumen, type EstadoVisita } from "@/lib/visitas/store";
import { nombreSector } from "@/lib/sectores";

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

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function DashboardPage() {
  const [visitas, setVisitas] = useState<VisitaResumen[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    try {
      setVisitas(await listarVisitas());
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar las visitas guardadas en este dispositivo.");
    }
  }

  useEffect(() => { cargar(); }, []);

  async function onBorrar(id: string, empresa: string) {
    if (!confirm(`¿Eliminar la visita de ${empresa}? Esta acción no se puede deshacer.`)) return;
    await borrarVisita(id);
    cargar();
  }

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.25rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.75rem" }}>
        <div>
          <h1 style={{ fontSize: "1.65rem", fontWeight: 600, margin: 0 }}>Visitas</h1>
          <p style={{ color: "#6b7280", margin: "0.35rem 0 0", fontSize: "0.9rem" }}>
            Visitas guardadas en este dispositivo
          </p>
        </div>
        <Link
          href="/visita/nueva"
          style={{
            background: "#111827", color: "#fff", padding: "0.65rem 1.15rem",
            borderRadius: 8, textDecoration: "none", fontWeight: 500, whiteSpace: "nowrap",
          }}
        >
          + Nueva visita
        </Link>
      </header>

      {error && (
        <div style={{ background: "#fef2f2", color: "#b91c1c", padding: "0.9rem 1rem", borderRadius: 8, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {visitas === null && !error && <p style={{ color: "#6b7280" }}>Cargando…</p>}

      {visitas?.length === 0 && (
        <div style={{ border: "1px dashed #d1d5db", borderRadius: 12, padding: "3rem 1.5rem", textAlign: "center" }}>
          <p style={{ margin: "0 0 1.25rem", color: "#6b7280" }}>Todavía no hay ninguna visita registrada.</p>
          <Link href="/visita/nueva" style={{ color: "#111827", fontWeight: 500 }}>
            Crear la primera visita →
          </Link>
        </div>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.75rem" }}>
        {visitas?.map((v) => (
          <li key={v.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: "1rem 1.15rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <Link href={`/visita/${v.id}`} style={{ fontWeight: 600, fontSize: "1.05rem", color: "#111827", textDecoration: "none" }}>
                  {v.empresaNombre}
                </Link>
                <div style={{ color: "#6b7280", fontSize: "0.85rem", marginTop: "0.3rem" }}>
                  {nombreSector(v.sector, v.sectorOtro)} · {formatearFecha(v.actualizadaEn)} · {v.numFotos} foto{v.numFotos === 1 ? "" : "s"}
                  {v.documentosSolicitados.length > 0 && ` · ${v.documentosSolicitados.length} documento${v.documentosSolicitados.length === 1 ? "" : "s"}`}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                <span style={{ color: COLOR_ESTADO[v.estado], fontSize: "0.8rem", fontWeight: 600 }}>
                  {ETIQUETA_ESTADO[v.estado]}
                </span>
                <button
                  onClick={() => onBorrar(v.id, v.empresaNombre)}
                  style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: "0.85rem" }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}