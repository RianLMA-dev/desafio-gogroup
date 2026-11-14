"use client";
import type { Decisao } from "@/lib/agente/tipos";

/** Execuções ao vivo e aprovações ficam só no navegador de quem usa (sem login, sem banco). */
const CHAVE_EXEC = "central.execucoes.v1";
const CHAVE_APROV = "central.aprovacoes.v1";

function ler<T>(k: string, padrao: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : padrao; } catch { return padrao; }
}
function gravar(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); window.dispatchEvent(new Event("central:mudou")); } catch { /* sem storage */ }
}

export const lerExecucoes = () => ler<Record<string, Decisao>>(CHAVE_EXEC, {});
export const salvarExecucao = (d: Decisao) => gravar(CHAVE_EXEC, { ...lerExecucoes(), [d.id]: d });

export type StatusAprov = "aprovada" | "rejeitada";
export const lerAprovacoes = () => ler<Record<string, StatusAprov>>(CHAVE_APROV, {});
export const marcarAprovacao = (id: string, s: StatusAprov | null) => {
  const a = lerAprovacoes();
  if (s) a[id] = s; else delete a[id];
  gravar(CHAVE_APROV, a);
};
