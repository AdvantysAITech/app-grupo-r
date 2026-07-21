import { redirect } from "next/navigation";
import { getTecnicoId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export default async function DashboardPage() {
    const tecnicoId = await getTecnicoId();
    if (!tecnicoId) redirect('/login');

    interface Visita {
        id: string,
        empresa_nombre: string,
        estado: string,
        created_at: string;
    }

    const supabase = supabaseAdmin();
    const { data } = await supabase
        .from('visitas')
        .select('id, empresa_nombre, estado, created_at')
        .eq('tecnico_id', tecnicoId)
        .order('created_at', { ascending: false });

    const visitas = data as unknown as Visita[] | null;

    return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold">Mis visitas</h1>
          <a
            href="/visita/nueva"
            className="bg-red-700 text-white px-4 py-2 rounded-lg font-semibold text-sm"
          >
            + Nueva visita
          </a>
        </div>

        {(!visitas || visitas.length === 0) && (
          <p className="text-gray-500 text-sm">Todavía no has registrado ninguna visita.</p>
        )}

        <div className="space-y-3">
          {visitas?.map((v) => (
            <a
              key={v.id}
              href={`/visita/${v.id}`}
              className="block bg-white border rounded-lg p-4 hover:shadow-md transition"
              >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">{v.empresa_nombre}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(v.created_at).toLocaleDateString('es-ES')}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100">
                  {v.estado}
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}