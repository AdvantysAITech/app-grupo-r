'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CHECKLIST_GENERICO } from '@/lib/checklist-generico';
import { Preahvihear } from 'next/font/google';

type RespuestaValor = 'S' | 'N' | 'NP';

interface RespuestaItem {
  valor: RespuestaValor | '';
  observacion: string;
}

const SECTORES = ['Hostelería', 'Farmacia', 'Oficinas', 'Construcción', 'Comercio', 'Otro'];

export default function NuevaVisitaPage() {
  const router = useRouter();

  // Cabecera (equivalente a la tabla de datos inicial del checklist)
  const [empresaNombre, setEmpresaNombre] = useState('');
  const [sector, setSector] = useState('');
  const [centroDireccion, setCentroDireccion] = useState('');
  const [contactoNombre, setContactoNombre] = useState('');
  const [contactoTel, setContactoTel] = useState('');
  const [numTrabajadores, setNumTrabajadores] = useState('');
  const [fotos, setFotos] = useState<Record<string, string[]>>({});
  const [subiendoFoto, setSubiendoFoto] = useState<string | null>(null);

  // Respuestas del checklist genérico
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaItem>>({});
  const [observacionesGenerales, setObservacionesGenerales] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  function setRespuesta(preguntaId: string, campo: 'valor' | 'observacion', valor: string) {
    setRespuestas((prev) => ({
      ...prev,
      [preguntaId]: {
        valor: campo === 'valor' ? (valor as RespuestaValor) : (prev[preguntaId]?.valor ?? ''),
        observacion: campo === 'observacion' ? valor : (prev[preguntaId]?.observacion ?? ''),
      },
    }));
  }

  async function subirFoto(preguntaId: string, file: File) {
    setSubiendoFoto(preguntaId);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('pregunta_id', preguntaId);

    const res = await fetch('/api/fotos', { method: 'POST', body: formData });
    setSubiendoFoto(null);

    if (!res.ok) {
      setError('Error al subir la foto. Inténtalo de nuevo.');
      return;
    }

    const data = await res.json();
    setFotos((prev) => ({
      ...prev,
      [preguntaId]: [...(prev[preguntaId] || []), data.url],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!empresaNombre || !sector) {
      setError('Completa al menos empresa y sector.');
      return;
    }

    setEnviando(true);

    const res = await fetch('/api/visitas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empresa_nombre: empresaNombre,
        sector,
        centro_direccion: centroDireccion,
        contacto_nombre: contactoNombre,
        contacto_tel: contactoTel,
        num_trabajadores: numTrabajadores ? Number(numTrabajadores) : null,
        respuestas,
        fotos,
        observaciones_generales: observacionesGenerales,
      }),
    });

    setEnviando(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Error al guardar la visita');
      return;
    }

    const visita = await res.json();
    router.push(`/visita/${visita.id}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-xl p-6 shadow">
        <h1 className="text-xl font-bold mb-6">Nueva visita</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cabecera */}
          <div className="space-y-4 border-b pb-5">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Empresa</label>
              <input value={empresaNombre} onChange={(e) => setEmpresaNombre(e.target.value)} className="w-full border rounded-lg px-3 py-2" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Sector</label>
              <select value={sector} onChange={(e) => setSector(e.target.value)} className="w-full border rounded-lg px-3 py-2" required>
                <option value="">— Seleccionar sector —</option>
                {SECTORES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Centro de trabajo (dirección)</label>
              <input value={centroDireccion} onChange={(e) => setCentroDireccion(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Persona de contacto</label>
                <input value={contactoNombre} onChange={(e) => setContactoNombre(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Teléfono</label>
                <input value={contactoTel} onChange={(e) => setContactoTel(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nº trabajadores</label>
              <input type="number" value={numTrabajadores} onChange={(e) => setNumTrabajadores(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>

          {/* Checklist genérico */}
          {CHECKLIST_GENERICO.map((bloque) => (
            <div key={bloque.id} className="border-b pb-4">
              <h2 className="font-semibold text-sm mb-3">{bloque.titulo}</h2>
              <div className="space-y-4">
                {bloque.preguntas.map((p) => (
                  <div key={p.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm flex-1">{p.texto}</span>
                      <div className="flex gap-1">
                        {(['S', 'N', 'NP'] as RespuestaValor[]).map((opcion) => (
                          <button
                            key={opcion}
                            type="button"
                            onClick={() => setRespuesta(p.id, 'valor', opcion)}
                            className={`px-2.5 py-1 rounded text-xs font-bold border ${
                              respuestas[p.id]?.valor === opcion
                                ? opcion === 'N' ? 'bg-red-600 text-white border-red-600'
                                  : opcion === 'S' ? 'bg-green-600 text-white border-green-600'
                                  : 'bg-gray-400 text-white border-gray-400'
                                : 'bg-white text-gray-600 border-gray-300'
                            }`}
                          >
                            {opcion}
                          </button>
                        ))}
                      </div>
                    </div>
                    {respuestas[p.id]?.valor === 'N' && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Observación / detalle de la deficiencia (opcional pero recomendado)"
                        value={respuestas[p.id]?.observacion ?? ''}
                        onChange={(e) => setRespuesta(p.id, 'observacion', e.target.value)}
                        className="w-full border rounded-lg px-3 py-1.5 text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <label className="text-xs bg-gray-100 px-3 py-1.5 rounded-lg cursor-pointer font-medium text-gray-600">
                          📷 Añadir foto
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) subirFoto(p.id, file);
                            }}
                          />
                        </label>
                        {subiendoFoto === p.id && <span className="text-xs text-gray-400">Subiendo...</span>}
                        {fotos[p.id]?.length > 0 && (
                          <span className="text-xs text-green-600">{fotos[p.id].length} foto(s) adjunta(s)</span>
                        )}
                      </div>
                    </div>
                  )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
              Observaciones generales del técnico
            </label>
            <textarea
              value={observacionesGenerales}
              onChange={(e) => setObservacionesGenerales(e.target.value)}
              placeholder="Describe procesos específicos del sector, maquinaria especial, productos peligrosos, etc."
              className="w-full border rounded-lg px-3 py-2 min-h-[100px]"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button type="submit" disabled={enviando} className="w-full bg-red-700 text-white rounded-lg py-3 font-bold disabled:opacity-50">
            {enviando ? 'Guardando...' : 'Guardar y continuar'}
          </button>
        </form>
      </div>
    </div>
  );
}