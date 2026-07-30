"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

const MIN_FOTOS = 3; // Ajustar si Grupo R pide otro mínimo

type VisitaSeleccion = {
  visita_id: string;
  empresa: { id: string; nombre: string };
  tipo_visita: string;
  sector: string;
  documentos_seleccionados: string[];
};

type Foto = {
  localId: string;
  previewUrl: string;
  subiendo: boolean;
  error: string | null;
};

export default function ChecklistVisitaPage() {
  const router = useRouter();
  const [visita, setVisita] = useState<VisitaSeleccion | null>(null);

  const [notas, setNotas] = useState("");
  const [fotos, setFotos] = useState<Foto[]>([]);

  const [grabando, setGrabando] = useState(false);
  const [audioSubido, setAudioSubido] = useState(false);
  const [audioSubiendo, setAudioSubiendo] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Recupera la seleccion de la Pantalla 1
  useEffect(() => {
    const raw = sessionStorage.getItem("visita_seleccion");
    if (!raw) {
      router.replace("/visita/nueva");
      return;
    }
    setVisita(JSON.parse(raw));
  }, [router]);

  const fotosOk = fotos.filter((f) => !f.error && !f.subiendo).length;
  const puedeEnviar = visita !== null && fotosOk >= MIN_FOTOS && !enviando;

  async function subirFotos(files: FileList) {
    if (!visita) return;

    const nuevas: Foto[] = Array.from(files).map((file) => ({
      localId: `${Date.now()}-${Math.random()}`,
      previewUrl: URL.createObjectURL(file),
      subiendo: true,
      error: null,
    }));
    setFotos((prev) => [...prev, ...nuevas]);

    await Promise.all(
      Array.from(files).map(async (file, i) => {
        const localId = nuevas[i].localId;
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("visita_id", visita.visita_id);
          const res = await fetch("/api/fotos", { method: "POST", body: formData });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Error al subir la foto");
          setFotos((prev) =>
            prev.map((f) => (f.localId === localId ? { ...f, subiendo: false } : f))
          );
        } catch (err: any) {
          setFotos((prev) =>
            prev.map((f) =>
              f.localId === localId ? { ...f, subiendo: false, error: err.message } : f
            )
          );
        }
      })
    );
  }

  function quitarFoto(localId: string) {
    setFotos((prev) => prev.filter((f) => f.localId !== localId));
    // Nota: esto solo la quita de la vista. Borrar el archivo ya subido en
    // Storage/visita_fotos es un ajuste pendiente (endpoint DELETE en /api/fotos).
  }

  async function iniciarGrabacion() {
    setAudioError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => subirAudio(new Blob(chunksRef.current, { type: "audio/webm" }));
      recorder.start();
      mediaRecorderRef.current = recorder;
      setGrabando(true);
    } catch {
      setAudioError("No se pudo acceder al micrófono");
    }
  }

  function detenerGrabacion() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    setGrabando(false);
  }

  async function subirArchivoAudio(file: File) {
    await subirAudio(file);
  }

  async function subirAudio(blobOrFile: Blob) {
    if (!visita) return;
    setAudioSubiendo(true);
    setAudioError(null);
    try {
      const formData = new FormData();
      const nombre = blobOrFile instanceof File ? blobOrFile.name : "nota.webm";
      formData.append("file", blobOrFile, nombre);
      formData.append("visita_id", visita.visita_id);
      const res = await fetch("/api/audios", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al subir el audio");
      setAudioPreviewUrl(URL.createObjectURL(blobOrFile));
      setAudioSubido(true);
    } catch (err: any) {
      setAudioError(err.message);
    } finally {
      setAudioSubiendo(false);
    }
  }

  async function enviarVisita() {
    if (!visita || !puedeEnviar) return;
    setEnviando(true);
    setErrorEnvio(null);
    try {
      const res = await fetch(`/api/visitas/${visita.visita_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notas }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo enviar la visita");
      sessionStorage.removeItem("visita_seleccion");
      setEnviado(true);
    } catch (err: any) {
      setErrorEnvio(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (!visita) return null;

  if (enviado) {
    return (
      <div className={styles.contenedor}>
        <div className={styles.confirmacion}>
          <div className={styles.confirmacionIcono}>✓</div>
          <h1 className={styles.titulo}>Visita enviada</h1>
          <p>
            Estamos generando el checklist a partir de las fotos y el audio. Te
            avisaremos en cuanto esté listo para revisar.
          </p>
          <button className={styles.botonSecundario} onClick={() => router.push("/visita/nueva")}>
            Registrar otra visita
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.contenedor}>
      <h1 className={styles.titulo}>{visita.empresa.nombre}</h1>
      <p className={styles.subtitulo}>
        {visita.tipo_visita} · {visita.sector}
      </p>

      <section className={styles.bloque}>
        <label className={styles.etiqueta}>Notas de la visita (opcional)</label>
        <textarea
          className={styles.textarea}
          rows={4}
          placeholder="Cualquier detalle relevante que no quede claro en las fotos..."
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </section>

      <section className={styles.bloque}>
        <label className={styles.etiqueta}>
          Fotos del local <span className={styles.obligatorio}>· mínimo {MIN_FOTOS}</span>
        </label>
        <label className={styles.botonSubirFoto}>
          + Añadir fotos
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            hidden
            onChange={(e) => e.target.files && subirFotos(e.target.files)}
          />
        </label>

        <div className={styles.fotosGrid}>
          {fotos.map((f) => (
            <div key={f.localId} className={styles.fotoItem}>
              <img src={f.previewUrl} alt="" className={styles.fotoPreview} />
              {f.subiendo && <div className={styles.fotoOverlay}>Subiendo...</div>}
              {f.error && <div className={styles.fotoOverlayError}>{f.error}</div>}
              <button
                type="button"
                className={styles.fotoQuitar}
                onClick={() => quitarFoto(f.localId)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className={styles.contadorFotos}>
          {fotosOk} / {MIN_FOTOS} fotos válidas
        </div>
      </section>

      <section className={styles.bloque}>
        <label className={styles.etiqueta}>Audio (opcional)</label>
        <div className={styles.audioFila}>
          {!grabando ? (
            <button type="button" className={styles.botonAudio} onClick={iniciarGrabacion}>
              🎙️ Grabar nota de voz
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.botonAudio} ${styles.botonAudioGrabando}`}
              onClick={detenerGrabacion}
            >
              ⏹️ Detener grabación
            </button>
          )}
          <label className={styles.botonAudioSecundario}>
            Subir archivo
            <input
              type="file"
              accept="audio/*"
              hidden
              onChange={(e) => e.target.files?.[0] && subirArchivoAudio(e.target.files[0])}
            />
          </label>
        </div>
        {audioSubiendo && <div className={styles.info}>Subiendo audio...</div>}
        {audioError && <div className={styles.error}>{audioError}</div>}
        {audioSubido && audioPreviewUrl && (
          <div className={styles.audioListo}>
            ✓ Audio guardado
            <audio controls src={audioPreviewUrl} className={styles.audioPlayer} />
          </div>
        )}
      </section>

      {errorEnvio && <div className={styles.error}>{errorEnvio}</div>}

      <button
        type="button"
        className={styles.botonEnviar}
        disabled={!puedeEnviar}
        onClick={enviarVisita}
      >
        {enviando ? "Enviando..." : "Enviar visita"}
      </button>
      {fotosOk < MIN_FOTOS && (
        <p className={styles.ayuda}>
          Añade al menos {MIN_FOTOS - fotosOk} foto{MIN_FOTOS - fotosOk !== 1 ? "s" : ""} más para poder enviar.
        </p>
      )}
    </div>
  );
}