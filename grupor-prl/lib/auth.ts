import { cookies } from "next/headers";

export async function getTecnicoId(): Promise<string | null> {
    const cookieStore = await cookies();
    const tecnicoId = cookieStore.get('tecnico_id')?.value;
    return tecnicoId ?? null;
}