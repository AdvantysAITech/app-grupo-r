"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";

type Origen = "foto" | "audio" | "nota" | "inferido" | "sin_dato";
type TipoCampo = "text" | "number" | "date" | "select" | "textarea" | "sino" | "estado" | "checks";

type Campo = {
  id: string;
  label: string;
  tipo: TipoCampo;
  valor: string | string[] | null;
  observaciones: string | null;
  origen: Origen;
  pendiente_revision: boolean;
  opciones?: string[];
};

type Seccion = { id: string; titulo: string; campos: Campo[] };

type Puesto = {
  id: string;
  nombre: string;
  descripcion_operativa: string;
  riesgos_detectados: string[];
  pendiente_revision: boolean;
};

type ChecklistContenido = { secciones: Seccion[]; puestos: Puesto[]; avisos: string[] };

type ChecklistResponse = {
  estado: "generando" | "listo" | "confirmado" | "error";
  contenido: ChecklistContenido | null;
  error_msg?: string | null;
};

const OPCIONES_SINO = ["Sí", "No", "N.A."];
const OPCIONES_ESTADO = ["Correcto", "Deficiente", "No aplica"];

export default function RevisionChecklistPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const visitaId = params.id;

  const [estado, setEstado] = useState<ChecklistResponse["estado"]>("generando");
  const [contenido, setContenido] = useState<ChecklistContenido | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  // Secciones cuyo bloque de "campos ya confirmados por la IA" está desplegado.
  // Por defecto todo lo confirmado permanece oculto: solo se ve lo que necesita revisión.
  const [seccionesExpandidas, setSeccionesExpandidas] = useState<Set<string>>(new Set());
  const [puestosExpandido, setPuestosExpandido] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function cargar() {
      const res = await fetch(`/api/visitas/${visitaId}/checklist`);
      const data: ChecklistResponse = await res.json();
      setEstado(data.estado);
      if (data.contenido) setContenido(data.contenido);
      setCargando(false);

      if (data.estado === "generando" && !pollRef.current) {
        pollRef.current = setInterval(cargar, 4000);
      } else if (data.estado !== "generando" && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    cargar();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [visitaId]);

  function actualizarCampo(seccionId: string, campoId: string, cambios: Partial<Campo>) {
    setContenido((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        secciones: prev.secciones.map((s) =>
          s.id !== seccionId
            ? s
            : {
                ...s,
                campos: s.campos.map((c) =>
                  c.id !== campoId ? c : { ...c, ...cambios, pendiente_revision: false }
                ),
              }
        ),
      };
    });
  }

  function toggleSeccionExpandida(seccionId: string) {
    setSeccionesExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(seccionId)) next.delete(seccionId);
      else next.add(seccionId);
      return next;
    });
  }

  async function guardarCambios(): Promise<boolean> {
    if (!contenido) return false;
    setGuardando(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/visitas/${visitaId}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenido }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      return true;
    } catch (err: any) {
      setErrorMsg(err.message);
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function enviarYGenerar() {
    setEnviando(true);
    setErrorMsg(null);
    const guardadoOk = await guardarCambios();
    if (!guardadoOk) {
      setEnviando(false);
      return;
    }
    try {
      const res = await fetch(`/api/visitas/${visitaId}/confirmar`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo confirmar el checklist");
      setEnviado(true);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const totalPendientes =
    (contenido?.secciones.flatMap((s) => s.campos).filter((c) => c.pendiente_revision).length ?? 0) +
    (contenido?.puestos.filter((p) => p.pendiente_revision).length ?? 0);

  if (cargando) {
    return <div className="p-6 text-center text-gray-500">Cargando checklist...</div>;
  }

  if (estado === "generando") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-xl p-8 shadow text-center max-w-sm">
          <p className="font-semibold mb-2">Generando el checklist...</p>
          <p className="text-sm text-gray-500">
            La IA está analizando las fotos y el audio de la visita. Puede tardar hasta un minuto.
          </p>
        </div>
      </div>
    );
  }

  if (estado === "error") {
    return (
      <div className="p-6 text-center text-red-600">
        Hubo un error generando el checklist. Contacta con soporte.
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-xl p-8 shadow text-center max-w-sm">
          <div className="text-3xl mb-2">✓</div>
          <p className="font-bold mb-2">Checklist enviado</p>
          <p className="text-sm text-gray-500 mb-4">
            Estamos generando los documentos seleccionados. Te llegarán como borrador a tu correo.
          </p>
          <button
            className="bg-red-700 text-white px-4 py-2 rounded-lg font-semibold text-sm"
            onClick={() => router.push("/dashboard")}
          >
            Volver a mis visitas
          </button>
        </div>
      </div>
    );
  }

  if (!contenido) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Revisar checklist</h1>
          {totalPendientes > 0 ? (
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
              {totalPendientes} campo{totalPendientes !== 1 ? "s" : ""} por revisar
            </span>
          ) : (
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-800">
              ✓ Todo revisado por la IA
            </span>
          )}
        </div>

        {contenido.avisos.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="font-semibold text-sm mb-2">Avisos de la IA</p>
            <ul className="list-disc list-inside text-sm text-yellow-900 space-y-1">
              {contenido.avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {contenido.secciones.map((seccion) => {
          const pendientes = seccion.campos.filter((c) => c.pendiente_revision);
          const confirmados = seccion.campos.filter((c) => !c.pendiente_revision);
          const expandida = seccionesExpandidas.has(seccion.id);
          const totalmenteConfirmada = seccion.campos.length > 0 && pendientes.length === 0;

          return (
            <section key={seccion.id} className="bg-white rounded-xl shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">{seccion.titulo}</h2>
                {totalmenteConfirmada && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-green-700 whitespace-nowrap"
                    onClick={() => toggleSeccionExpandida(seccion.id)}
                  >
                    ✓ {confirmados.length} confirmado{confirmados.length !== 1 ? "s" : ""} por la IA{" "}
                    {expandida ? "▲" : "▼"}
                  </button>
                )}
              </div>

              {pendientes.length > 0 && (
                <div className="space-y-4">
                  {pendientes.map((campo) => (
                    <CampoEditable
                      key={campo.id}
                      campo={campo}
                      onChange={(cambios) => actualizarCampo(seccion.id, campo.id, cambios)}
                    />
                  ))}
                </div>
              )}

              {pendientes.length > 0 && confirmados.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-gray-500 mt-3 underline block"
                  onClick={() => toggleSeccionExpandida(seccion.id)}
                >
                  {expandida ? "Ocultar" : "Ver"} {confirmados.length} campo
                  {confirmados.length !== 1 ? "s" : ""} ya confirmado{confirmados.length !== 1 ? "s" : ""} por la IA
                </button>
              )}

              {expandida && confirmados.length > 0 && (
                <div
                  className={`space-y-4 ${pendientes.length > 0 ? "mt-3 pt-3 border-t border-gray-100" : ""}`}
                >
                  {confirmados.map((campo) => (
                    <CampoEditable
                      key={campo.id}
                      campo={campo}
                      onChange={(cambios) => actualizarCampo(seccion.id, campo.id, cambios)}
                    />
                  ))}
                </div>
              )}

              {seccion.campos.length === 0 && (
                <p className="text-xs text-gray-400">Sin campos en esta sección.</p>
              )}
            </section>
          );
        })}

        {contenido.puestos.length > 0 &&
          (() => {
            const puestosPendientes = contenido.puestos.filter((p) => p.pendiente_revision);
            const puestosConfirmados = contenido.puestos.filter((p) => !p.pendiente_revision);

            return (
              <section className="bg-white rounded-xl shadow p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">Puestos de trabajo</h2>
                  {puestosPendientes.length === 0 && puestosConfirmados.length > 0 && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-green-700 whitespace-nowrap"
                      onClick={() => setPuestosExpandido((v) => !v)}
                    >
                      ✓ {puestosConfirmados.length} confirmado{puestosConfirmados.length !== 1 ? "s" : ""} por la IA{" "}
                      {puestosExpandido ? "▲" : "▼"}
                    </button>
                  )}
                </div>

                {puestosPendientes.length > 0 && (
                  <div className="space-y-4">
                    {puestosPendientes.map((puesto) => (
                      <PuestoCard key={puesto.id} puesto={puesto} />
                    ))}
                  </div>
                )}

                {puestosPendientes.length > 0 && puestosConfirmados.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-gray-500 mt-3 underline block"
                    onClick={() => setPuestosExpandido((v) => !v)}
                  >
                    {puestosExpandido ? "Ocultar" : "Ver"} {puestosConfirmados.length} puesto
                    {puestosConfirmados.length !== 1 ? "s" : ""} ya confirmado
                    {puestosConfirmados.length !== 1 ? "s" : ""} por la IA
                  </button>
                )}

                {puestosExpandido && puestosConfirmados.length > 0 && (
                  <div
                    className={`space-y-4 ${
                      puestosPendientes.length > 0 ? "mt-3 pt-3 border-t border-gray-100" : ""
                    }`}
                  >
                    {puestosConfirmados.map((puesto) => (
                      <PuestoCard key={puesto.id} puesto={puesto} />
                    ))}
                  </div>
                )}
              </section>
            );
          })()}

        {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}

        <div className="flex gap-3 pb-6">
          <button
            className="flex-1 bg-white border border-gray-300 rounded-lg py-3 font-semibold text-sm disabled:opacity-50"
            disabled={guardando}
            onClick={guardarCambios}
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
          <button
            className="flex-1 bg-red-700 text-white rounded-lg py-3 font-bold disabled:opacity-50"
            disabled={enviando}
            onClick={enviarYGenerar}
          >
            {enviando ? "Enviando..." : "Enviar y generar documentos"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PuestoCard({ puesto }: { puesto: Puesto }) {
  return (
    <div
      className={`border rounded-lg p-3 ${
        puesto.pendiente_revision ? "border-yellow-400 bg-yellow-50" : "border-gray-200"
      }`}
    >
      <p className="font-semibold text-sm">{puesto.nombre}</p>
      <p className="text-sm text-gray-600 mt-1">{puesto.descripcion_operativa}</p>
      {puesto.riesgos_detectados.length > 0 && (
        <ul className="list-disc list-inside text-sm mt-2 text-gray-700">
          {puesto.riesgos_detectados.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CampoEditable({ campo, onChange }: { campo: Campo; onChange: (cambios: Partial<Campo>) => void }) {
  const resaltado = campo.pendiente_revision;

  return (
    <div className={`p-3 rounded-lg ${resaltado ? "bg-yellow-50 border border-yellow-300" : ""}`}>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-sm font-medium">{campo.label}</label>
        {resaltado && (
          <span className="text-xs font-semibold text-yellow-700">⚠ Sin información suficiente — revisar</span>
        )}
      </div>

      {(campo.tipo === "sino" || campo.tipo === "estado") && (
        <div className="flex gap-2">
          {(campo.tipo === "sino" ? OPCIONES_SINO : OPCIONES_ESTADO).map((opt) => (
            <button
              key={opt}
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                campo.valor === opt ? "bg-red-700 text-white border-red-700" : "bg-white text-gray-600 border-gray-300"
              }`}
              onClick={() => onChange({ valor: opt })}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {campo.tipo === "select" && (
        <select
          className="w-full border rounded-lg px-3 py-2 text-sm"
          value={(campo.valor as string) ?? ""}
          onChange={(e) => onChange({ valor: e.target.value })}
        >
          <option value="">— Seleccionar —</option>
          {(campo.opciones ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}

      {campo.tipo === "checks" && (
        <div className="flex flex-wrap gap-2">
          {(campo.opciones ?? []).map((o) => {
            const seleccionado = Array.isArray(campo.valor) && campo.valor.includes(o);
            return (
              <button
                key={o}
                type="button"
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  seleccionado ? "bg-red-700 text-white border-red-700" : "bg-white text-gray-600 border-gray-300"
                }`}
                onClick={() => {
                  const actual = Array.isArray(campo.valor) ? campo.valor : [];
                  const nuevo = seleccionado ? actual.filter((v) => v !== o) : [...actual, o];
                  onChange({ valor: nuevo });
                }}
              >
                {o}
              </button>
            );
          })}
        </div>
      )}

      {(campo.tipo === "text" || campo.tipo === "number" || campo.tipo === "date") && (
        <input
          type={campo.tipo}
          className="w-full border rounded-lg px-3 py-2 text-sm"
          value={(campo.valor as string) ?? ""}
          onChange={(e) => onChange({ valor: e.target.value })}
        />
      )}

      {campo.tipo === "textarea" && (
        <textarea
          className="w-full border rounded-lg px-3 py-2 text-sm"
          rows={3}
          value={(campo.valor as string) ?? ""}
          onChange={(e) => onChange({ valor: e.target.value })}
        />
      )}

      <input
        type="text"
        placeholder="Observaciones..."
        className="w-full border-b border-gray-200 text-xs text-gray-500 mt-2 py-1 focus:outline-none focus:border-gray-400"
        value={campo.observaciones ?? ""}
        onChange={(e) => onChange({ observaciones: e.target.value })}
      />
    </div>
  );
}