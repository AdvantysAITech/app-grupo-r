"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

type Empresa = {
  id: string;
  nombre: string;
  nif: string;
  cnae: string;
  direccion: string;
  actividad: string;
};

type Plantilla = {
  tipo_documento: string;
  nombre_visible: string;
};

type TipoVisita = "inicial" | "revision";

// Sectores del checklist multisector. Ajustar si cambia la lista real
// de Checklist_Base_PRL_Multisector.md
const SECTORES = [
  { value: "hosteleria", label: "Hostelería" },
  { value: "farmacia_sanitario", label: "Farmacia / Sanitario" },
  { value: "comercio_retail", label: "Comercio / Retail" },
  { value: "oficina_administrativo", label: "Oficina / Administrativo" },
  { value: "construccion", label: "Construcción" },
  { value: "agroalimentario", label: "Agroalimentario" },
  { value: "industrial_almacen", label: "Industrial / Almacén" },
];

export default function NuevaVisitaPage() {
  const router = useRouter();

  // ---------- Empresa ----------
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [cargandoEmpresas, setCargandoEmpresas] = useState(true);
  const [errorEmpresas, setErrorEmpresas] = useState<string | null>(null);
  const [busquedaEmpresa, setBusquedaEmpresa] = useState("");
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState<Empresa | null>(null);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  // ---------- Tipo de visita ----------
  const [tipoVisita, setTipoVisita] = useState<TipoVisita>("inicial");

  // ---------- Sector ----------
  const [sector, setSector] = useState<string>("");

  // ---------- Documentos (multiselect) ----------
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [cargandoPlantillas, setCargandoPlantillas] = useState(false);
  const [documentosSeleccionados, setDocumentosSeleccionados] = useState<string[]>([]);

  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  // Cargar empresas una vez al entrar
  useEffect(() => {
    fetch("/api/empresas")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setErrorEmpresas(data.error);
        } else {
          setEmpresas(data.empresas || []);
        }
      })
      .catch(() => setErrorEmpresas("No se pudo conectar con GHL"))
      .finally(() => setCargandoEmpresas(false));
  }, []);

  // Recargar plantillas cada vez que cambia el tipo de visita
  useEffect(() => {
    setCargandoPlantillas(true);
    setDocumentosSeleccionados([]); // el tipo de visita cambia que documentos aplican, se resetea la seleccion
    fetch(`/api/plantillas?tipo_visita=${tipoVisita}`)
      .then((r) => r.json())
      .then((data) => setPlantillas(data.plantillas || []))
      .catch(() => setPlantillas([]))
      .finally(() => setCargandoPlantillas(false));
  }, [tipoVisita]);

  const sugerencias = useMemo(() => {
    if (busquedaEmpresa.length === 0) {
      // Sin texto todavía: muestra el listado completo cargado (recortado
      // para no reventar el DOM si hay cientos de empresas)
      return empresas.slice(0, 50);
    }
    const q = busquedaEmpresa.toLowerCase();
    return empresas.filter((e) => e.nombre.toLowerCase().includes(q)).slice(0, 50);
  }, [busquedaEmpresa, empresas]);

  function seleccionarEmpresa(empresa: Empresa) {
    setEmpresaSeleccionada(empresa);
    setBusquedaEmpresa(empresa.nombre);
    setMostrarSugerencias(false);
    // Autocompleta el sector a partir de la actividad de GHL, pero el
    // técnico puede cambiarlo si no coincide con la lista de sectores
    if (!sector) {
      const actividadLower = (empresa.actividad || "").toLowerCase();
      const match = SECTORES.find((s) => actividadLower.includes(s.label.toLowerCase().split(" ")[0]));
      if (match) setSector(match.value);
    }
  }

  function toggleDocumento(tipo: string) {
    setDocumentosSeleccionados((prev) =>
      prev.includes(tipo) ? prev.filter((d) => d !== tipo) : [...prev, tipo]
    );
  }

  const puedeContinuar =
    empresaSeleccionada !== null && sector !== "" && documentosSeleccionados.length > 0;

  async function continuar() {
    if (!puedeContinuar) return;
    setEnviando(true);
    setErrorEnvio(null);

    try {
      const res = await fetch("/api/visitas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa: empresaSeleccionada,
          tipo_visita: tipoVisita,
          sector,
          documentos_seleccionados: documentosSeleccionados,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorEnvio(data.error || "No se pudo crear la visita");
        return;
      }

      // La Pantalla 2 recupera el visita_id de aqui para subir fotos/audio
      // ligados a esta visita concreta.
      sessionStorage.setItem(
        "visita_seleccion",
        JSON.stringify({
          visita_id: data.id,
          empresa: empresaSeleccionada,
          tipo_visita: tipoVisita,
          sector,
          documentos_seleccionados: documentosSeleccionados,
        })
      );
      router.push("/visita/checklist");
    } catch (err) {
      setErrorEnvio("No se pudo continuar. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={styles.contenedor}>
      <h1 className={styles.titulo}>Nueva visita</h1>

      {/* ---------- Empresa ---------- */}
      <section className={styles.bloque}>
        <label className={styles.etiqueta}>Empresa</label>
        {errorEmpresas && <div className={styles.error}>{errorEmpresas}</div>}
        <div className={styles.buscadorWrap}>
          <input
            type="text"
            className={styles.input}
            placeholder={cargandoEmpresas ? "Cargando empresas..." : "Busca una empresa..."}
            value={busquedaEmpresa}
            disabled={cargandoEmpresas}
            onChange={(e) => {
              setBusquedaEmpresa(e.target.value);
              setEmpresaSeleccionada(null);
              setMostrarSugerencias(true);
            }}
            onFocus={() => setMostrarSugerencias(true)}
          />
          {mostrarSugerencias && sugerencias.length > 0 && (
            <div className={styles.sugerencias}>
              {sugerencias.map((e) => (
                <div
                  key={e.id}
                  className={styles.sugerenciaItem}
                  onClick={() => seleccionarEmpresa(e)}
                >
                  {e.nombre}{" "}
                  {e.nif && <span className={styles.sugerenciaNif}>{e.nif}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        {empresaSeleccionada && (
          <div className={styles.empresaConfirmada}>
            ✓ {empresaSeleccionada.nombre}
          </div>
        )}
      </section>

      {/* ---------- Tipo de visita ---------- */}
      <section className={styles.bloque}>
        <label className={styles.etiqueta}>Tipo de visita</label>
        <div className={styles.botonesFila}>
          {(
            [
              { value: "inicial", label: "Inicial" },
              { value: "revision", label: "Revisión" },
            ] as { value: TipoVisita; label: string }[]
          ).map((opcion) => (
            <button
              key={opcion.value}
              type="button"
              className={
                tipoVisita === opcion.value
                  ? `${styles.botonTipo} ${styles.botonTipoActivo}`
                  : styles.botonTipo
              }
              onClick={() => setTipoVisita(opcion.value)}
            >
              {opcion.label}
            </button>
          ))}
        </div>
      </section>

      {/* ---------- Sector ---------- */}
      <section className={styles.bloque}>
        <label className={styles.etiqueta}>Sector de actividad</label>
        <select
          className={styles.select}
          value={sector}
          onChange={(e) => setSector(e.target.value)}
        >
          <option value="">— Selecciona un sector —</option>
          {SECTORES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </section>

      {/* ---------- Documentos a generar ---------- */}
      <section className={styles.bloque}>
        <label className={styles.etiqueta}>Documentos a generar</label>
        {cargandoPlantillas && <div className={styles.info}>Cargando plantillas...</div>}
        {!cargandoPlantillas && plantillas.length === 0 && (
          <div className={styles.info}>
            No hay plantillas configuradas para este tipo de visita.
          </div>
        )}
        <div className={styles.documentosGrid}>
          {plantillas.map((p) => (
            <label key={p.tipo_documento} className={styles.documentoItem}>
              <input
                type="checkbox"
                checked={documentosSeleccionados.includes(p.tipo_documento)}
                onChange={() => toggleDocumento(p.tipo_documento)}
              />
              {p.nombre_visible}
            </label>
          ))}
        </div>
      </section>

      {errorEnvio && <div className={styles.error}>{errorEnvio}</div>}

      <button
        type="button"
        className={styles.botonContinuar}
        disabled={!puedeContinuar || enviando}
        onClick={continuar}
      >
        {enviando ? "Cargando..." : "Continuar al checklist"}
      </button>
    </div>
  );
}