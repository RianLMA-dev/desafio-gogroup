import "server-only";
import { causas, getExcecao, type Causa } from "@/lib/data";
import { chat, temChave, SemModeloDisponivel } from "./groq";

import type { Relatorio } from "./tipos";
export type { Relatorio };

const SISTEMA = `Você é o Agente de Processo da operação de um e-commerce (Gocase e GoBeauté). Hoje é 30/09/2026.
Recebe os dados estatísticos de um padrão anormal de exceções e escreve um relatório de incidente para a liderança.
Regras: use SOMENTE os números fornecidos (não invente dados); copie porcentagens exatamente com o mesmo significado da evidência (ex.: "47% dos pedidos dela com exceção" não é "47% do total"); valores em R$ arredondados sem centavos; português do Brasil; direto e executivo.
Responda APENAS com JSON no formato:
{"titulo": str, "severidade": "crítica"|"alta"|"média"|"baixa", "resumo_executivo": str (2 frases),
 "o_que_acontece": str, "evidencias": [str, ...] (3 a 5), "causa_raiz": str,
 "impacto": str (custo em R$ e horas do time), "acoes": [{"acao": str, "responsavel": str, "prazo": str}] (3 a 5, prazos como "hoje", "48h", "1 semana"),
 "pedidos_afetados": str (o que fazer com os pedidos já abertos), "como_medir": str (indicador para saber se resolveu)}`;

function contexto(c: Causa) {
  const exemplos = c.pedidos.slice(0, 5).map((id) => {
    const e = getExcecao(id);
    return e && { pedido: e.pedido, tipo: e.tipo_rotulo, valor: e.valor, transportadora: e.transportadora, uf: e.uf, cd: e.cd, turno: e.turno, impressora: e.maquina, lote: e.lote };
  });
  return {
    problema: c.titulo, categoria: c.categoria, responsavel_sugerido: c.responsavel,
    evidencia_estatistica: c.evidencia, causa_provavel_levantada: c.causa_provavel, grafico: c.grafico,
    excecoes_abertas_hoje_ligadas_ao_problema: c.n_casos, casos_acima_do_normal_no_periodo_de_58_dias: c.casos_evitaveis,
    custo_mensal_reais: c.custo_mensal, horas_do_time_por_mes: c.horas_time_mes,
    acoes_ja_mapeadas: c.acoes, exemplos_de_pedidos: exemplos,
  };
}

export async function gerarRelatorio(id: string): Promise<Relatorio> {
  const c = causas.find((x) => x.id === id);
  if (!c) throw new Error("causa não encontrada");
  if (temChave()) {
    try {
      const r = await chat({
        messages: [{ role: "system", content: SISTEMA }, { role: "user", content: JSON.stringify(contexto(c)) }],
        json: true, maxTokens: 1200, temperature: 0.3,
      });
      const j = JSON.parse(r.content ?? "{}");
      return { causa: c.id, ...j, acoes: j.acoes ?? [], evidencias: j.evidencias ?? [], modelo: r.modelo, simulado: false, gerado_em: new Date().toISOString() };
    } catch (err) {
      if (!(err instanceof SemModeloDisponivel) && !(err instanceof SyntaxError)) throw err;
    }
  }
  return relatorioSimulado(c);
}

export function relatorioSimulado(c: Causa): Relatorio {
  const sev = c.custo_mensal > 5000 ? "alta" : c.custo_mensal > 2000 ? "média" : "baixa";
  return {
    causa: c.id, titulo: c.titulo, severidade: sev, resumo_executivo: c.resumo,
    o_que_acontece: c.evidencia[0] ?? "", evidencias: c.evidencia, causa_raiz: c.causa_provavel,
    impacto: `Cerca de R$ ${Math.round(c.custo_mensal).toLocaleString("pt-BR")} por mês e ${Math.round(c.horas_time_mes)} horas do time por mês.`,
    acoes: c.acoes.map((a, i) => ({ acao: a, responsavel: c.responsavel, prazo: i === 0 ? "48h" : "1 semana" })),
    pedidos_afetados: `${c.n_casos} exceções abertas ligadas a este problema; o Agente de Fila já aplica a instrução específica nelas.`,
    como_medir: "Acompanhar semanalmente o número de exceções deste tipo na origem apontada.",
    modelo: "modelo (sem IA)", simulado: true, gerado_em: new Date().toISOString(),
  };
}
