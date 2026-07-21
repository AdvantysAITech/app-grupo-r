'use client';

import { useState, useEffect, use } from "react";

interface Documento {
    id: string,
    estado: string;
    html_content: string | null;
    error_msg: string | null;
}

export default function VisitaPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [documento, setDocumento] = useState<Documento | null>(null);
    const [generando, setGenerando] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch(`/api/visitas/${id}/documento`)
            .then((res) => res.json())
            .then(setDocumento);
    }, [id]);

    async function generar() {
        setGenerando(true);
        setError('');

        const res = await fetch('api/generar-documento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visita_id: id }),
        });

        setGenerando(false);

        if (!res.ok) {
            setError('Error al generar el documento. Inténtalo de nuevo.');
            return;
        }

        const data = await fetch(`/api/visitas/${id}/documento`).then((r) => r.json());
        setDocumento(data);
    }

    return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        {!documento?.html_content && (
          <div className="bg-white rounded-xl p-6 shadow text-center">
            <p className="text-gray-600 mb-4">
              Aún no se ha generado el documento para esta visita.
            </p>
            <button
              onClick={generar}
              disabled={generando}
              className="bg-red-700 text-white px-6 py-3 rounded-lg font-bold disabled:opacity-50"
            >
              {generando ? 'Generando documento (puede tardar hasta un minuto)...' : 'Generar documento'}
            </button>
            {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
          </div>
        )}

        {documento?.html_content && (
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <iframe
              srcDoc={documento.html_content}
              className="w-full min-h-screen border-0"
              title="Documento generado"
            />
          </div>
        )}
      </div>
    </div>
  );
}