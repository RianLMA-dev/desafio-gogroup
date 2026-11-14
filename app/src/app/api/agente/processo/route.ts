import { NextResponse } from "next/server";
import { gerarRelatorio } from "@/lib/agente/agenteProcesso";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Roda o Agente de Processo ao vivo e devolve o relatório de incidente. */
export async function POST(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await gerarRelatorio(String(id ?? "")));
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 400 });
  }
}
