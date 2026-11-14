import { getExcecao } from "@/lib/data";
import { rodarAgenteFila } from "@/lib/agente/agenteFila";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Roda o Agente de Fila ao vivo em uma exceção. Resposta em NDJSON (um evento por linha). */
export async function POST(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  const e = getExcecao(String(id ?? ""));
  if (!e) return new Response(JSON.stringify({ erro: "exceção não encontrada" }), { status: 404 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      for await (const ev of rodarAgenteFila(e)) ctrl.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
