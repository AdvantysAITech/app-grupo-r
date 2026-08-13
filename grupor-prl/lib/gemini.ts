export async function transcribirAudio(base64: string, mime: string, intento = 1): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY en el entorno");

  const modelo = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text:
                "Transcribe literalmente en español lo que dice el audio. Es un técnico de prevención " +
                "de riesgos laborales narrando lo que observa durante una visita a un centro de trabajo. " +
                "Devuelve solo la transcripción, sin comentarios ni resumen. Si el audio está en silencio " +
                "o no se entiende, responde exactamente: (audio no inteligible).",
            },
            { inline_data: { mime_type: mime, data: base64 } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    if (res.status === 503 && intento < 3) {
      await new Promise((r) => setTimeout(r, 2000 * intento));
      return transcribirAudio(base64, mime, intento + 1);
    }
    throw new Error(`Gemini respondió ${res.status}: ${detalle.slice(0, 300)}`);
  }

  const data = await res.json();
  const texto: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return texto?.trim() || "(audio no inteligible)";
}