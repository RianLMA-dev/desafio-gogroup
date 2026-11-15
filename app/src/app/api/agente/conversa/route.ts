import { NextResponse } from "next/server";
import { getExcecao } from "@/lib/data";
import { simularRodada, type Fala } from "@/lib/agente/conversa";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Simula a resposta do cliente e a reação do agente (uma rodada de conversa). */
export async function POST(req: Request) {
  const { id, acao, historico } = (await req.json().catch(() => ({}))) as { id?: string; acao?: string; historico?: Fala[] };
  const e = getExcecao(String(id ?? ""));
  if (!e || !acao || !Array.isArray(historico) || historico.length === 0 || historico.length > 8)
    return NextResponse.json({ erro: "pedido inválido" }, { status: 400 });
  try {
    return NextResponse.json(await simularRodada(e, acao, historico.slice(-6)));
  } catch (err) {
    return NextResponse.json({ erro: (err as Error).message }, { status: 500 });
  }
}
