import { NextResponse } from "next/server";

/**
 * GET /api/empresas
 *
 * Devuelve el listado de empresas para el dropdown de la Pantalla 1.
 *
 * DECISIÓN TOMADA AHORA: se consulta GHL directamente (mismo patrón que ya
 * usaba `script.js` en el formulario viejo, pero movido al servidor para no
 * exponer GHL_API_TOKEN en el navegador).
 *
 * PENDIENTE A FUTURO: cuando esté montada la automatización de sync
 * Contact -> tabla "Empresas" en n8n (la de "dos automatizaciones" que ya
 * está diseñada), este endpoint pasa a leer de esa tabla en vez de llamar a
 * GHL en cada carga. La interfaz que devuelve este endpoint (array de
 * {id, nombre, nif, cnae, direccion, actividad}) se mantiene igual, así que
 * el cambio no debería tocar nada del frontend.
 */
export async function GET() {
  const token = process.env.GHL_API_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  const version = process.env.GHL_VERSION || "2021-07-28";

  if (!token || !locationId) {
    return NextResponse.json(
      { error: "Falta GHL_API_TOKEN o GHL_LOCATION_ID en el entorno" },
      { status: 500 }
    );
  }

  try {
    const empresas: Array<{
      id: string;
      nombre: string;
      nif: string;
      cnae: string;
      direccion: string;
      actividad: string;
    }> = [];

    let url =
      `https://services.leadconnectorhq.com/contacts/?locationId=${encodeURIComponent(
        locationId
      )}&limit=100`;
    let paginas = 0;
    const MAX_PAGINAS = 20;

    while (url && paginas < MAX_PAGINAS) {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: version,
          Accept: "application/json",
        },
        // No cachear: la lista de empresas puede cambiar en GHL en cualquier momento
        cache: "no-store",
      });

      if (!res.ok) {
        return NextResponse.json(
          { error: `GHL respondió ${res.status}` },
          { status: 502 }
        );
      }

      const data = await res.json();

      for (const c of data.contacts || []) {
        empresas.push({
          id: c.id,
          nombre: c.companyName || c.name || c.contactName || "(sin nombre)",
          nif: c.customFields?.find((f: any) => f.key === "nif")?.value || "",
          cnae: c.customFields?.find((f: any) => f.key === "cnae")?.value || "",
          direccion: c.address1 || "",
          actividad:
            c.customFields?.find((f: any) => f.key === "actividad")?.value ||
            "",
        });
      }

      url = data.meta?.nextPageUrl || "";
      paginas++;
    }

    return NextResponse.json({ empresas });
  } catch (err) {
    console.error("Error al obtener empresas de GHL:", err);
    return NextResponse.json(
      { error: "Error al conectar con GHL" },
      { status: 502 }
    );
  }
}