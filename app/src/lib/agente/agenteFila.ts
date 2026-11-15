import "server-only";
import { lote, type Excecao } from "@/lib/data";
import { chat, temChave, type Msg, SemModeloDisponivel } from "./groq";
import { ACOES, FERRAMENTAS, TOOLS_SCHEMA, validarAcao, foraDaPolitica, verificarPrazo, achado } from "./ferramentas";

import type { Evento, Decisao } from "./tipos";
export type { Evento, Decisao };

const SISTEMA = `Você é o Agente de Fila da Central de Exceções de um e-commerce (marcas Gocase e GoBeauté).
Hoje é 30/09/2026. Sua tarefa: tratar UMA exceção de pedido.

Como trabalhar:
1. Investigue chamando as ferramentas. verificar_incidentes e consultar_politica são obrigatórias; as outras, conforme o caso.
2. Escolha a ação entre as acoes_permitidas. Se agente_pode_agir_sozinho = false, use uma ação de nivel humano e deixe a recomendação na nota_interna.
3. Se houver incidente de processo, SIGA a instrução dele e repita-a na nota_interna (ex.: qual impressora ou lote evitar).
4. Finalize chamando registrar_acao uma única vez.

Regras de texto:
- mensagem_cliente: português do Brasil, cordial e direto, até 4 frases, assinada "Equipe {marca}". Datas dd/mm. Use só fatos retornados pelas ferramentas e não prometa prazos que elas não informaram; 
- mensagem_cliente é obrigatória em toda ação (em nivel humano, é o rascunho para a pessoa revisar). Só em fechar_duplicado ela fica vazia.
- Não exponha problemas internos ao cliente: nada de lote, impressora, CD, turno ou desempenho da transportadora numa região. Diga o que vamos fazer por ele.
- Em lembrete_pagamento, inclua o marcador [link de pagamento].
- Nunca invente dados que as ferramentas não deram (endereço, nome, código de rastreio, datas). Em confirmar_endereco, peça ao cliente que envie o endereço completo com CEP.
- Datas: nunca informe como previsão uma data anterior a hoje (30/09). Se prazo_correto_ja_passou = true, diga que vai informar a nova previsão assim que a transportadora responder. Se ja_entregue = true, não fale em previsão.
- Reenvio por avaria, vazamento ou item faltante: peça a foto ao cliente.
- mensagem_transportadora: só quando a ação envolve a transportadora; cite pedido, destino, prazo contratado e peça nova previsão em 24h.`;

const detalhe = (nome: string, e: Excecao) => { const a = achado(nome, e); return { achado: a.texto, instrucao: a.instrucao }; };
const dm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");

function base(e: Excecao, modelo: string, simulado: boolean, passos: string[]) {
  return {
    id: e.id, pedido: e.pedido, marca: e.marca, cliente: e.cliente, transportadora: e.transportadora,
    passos, modelo, simulado, gerado_em: new Date().toISOString(),
  };
}

// Cache curto em memória: se o mesmo pedido for rodado de novo em poucos minutos
// (vários avaliadores clicando no mesmo caso), reaproveita o resultado e poupa o limite do Groq.
const CACHE = new Map<string, { quando: number; eventos: Evento[] }>();
const CACHE_MS = 10 * 60 * 1000;

/** Executa o agente com IA (Groq + ferramentas). Emite eventos à medida que trabalha. */
export async function* rodarAgenteFila(e: Excecao): AsyncGenerator<Evento> {
  const c = CACHE.get(e.id);
  if (c && Date.now() - c.quando < CACHE_MS) { yield* c.eventos; return; }
  const eventos: Evento[] = [];
  for await (const ev of rodarSemCache(e)) { eventos.push(ev); yield ev; }
  const final = eventos.find((x) => x.tipo === "acao");
  if (final && final.tipo === "acao" && !final.resultado.simulado) CACHE.set(e.id, { quando: Date.now(), eventos });
}

/** Plano B quando a IA está no limite: decisão já processada pela IA no lote, se existir. */
async function* doLote(e: Excecao): AsyncGenerator<Evento> {
  const d = lote.decisoes.find((x) => x.id === e.id && !x.simulado);
  if (!d) return;
  for (const nome of d.passos) {
    const f = FERRAMENTAS[nome];
    if (f) yield { tipo: "ferramenta", nome, rotulo: f.rotulo, resultado: f.fn(e), ...detalhe(nome, e) };
  }
  yield { tipo: "acao", resultado: d };
}

async function* rodarSemCache(e: Excecao): AsyncGenerator<Evento> {
  if (!temChave()) { yield* simularAgenteFila(e); return; }
  yield { tipo: "inicio", id: e.id, pedido: e.pedido, modo: "ia" };

  const msgs: Msg[] = [
    { role: "system", content: SISTEMA },
    { role: "user", content: `Trate a exceção ${e.id}: pedido ${e.pedido}, tipo "${e.tipo_rotulo}", marca ${e.marca}. Assine a mensagem ao cliente como "Equipe ${e.marca}".` },
  ];
  const passos: string[] = [];
  let modelo = "";
  try {
    for (let rodada = 0; rodada < 7; rodada++) {
      const r = await chat({ messages: msgs, tools: TOOLS_SCHEMA, maxTokens: 700 });
      modelo = r.modelo;
      if (!r.tool_calls?.length) {
        msgs.push({ role: "assistant", content: r.content ?? "" });
        msgs.push({ role: "user", content: "Use as ferramentas e finalize chamando registrar_acao." });
        continue;
      }
      msgs.push({ role: "assistant", content: r.content ?? null, tool_calls: r.tool_calls });
      for (const tc of r.tool_calls) {
        const nome = tc.function.name;
        if (nome === "registrar_acao") {
          let args: Record<string, string> = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* vazio */ }
          const erro = validarAcao(e, args.acao, args.mensagem_cliente ?? "");
          if (erro) {
            yield { tipo: "correcao", texto: erro };
            msgs.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ erro }) });
            continue;
          }
          const a = ACOES[args.acao];
          // modelos às vezes escrevem "\n" literal: vira quebra de linha de verdade
          for (const k of ["justificativa", "mensagem_cliente", "mensagem_transportadora", "nota_interna"])
            if (typeof args[k] === "string") args[k] = args[k].replace(/\\n/g, "\n").trim();
          yield {
            tipo: "acao",
            resultado: {
              ...base(e, modelo, false, passos), acao: args.acao, acao_rotulo: a.rotulo, nivel: a.nivel,
              justificativa: args.justificativa ?? "", mensagem_cliente: args.mensagem_cliente ?? "",
              mensagem_transportadora: args.mensagem_transportadora ?? "", nota_interna: args.nota_interna ?? "",
            },
          };
          return;
        }
        const f = FERRAMENTAS[nome];
        const resultado = f ? f.fn(e) : { erro: `ferramenta ${nome} não existe` };
        if (f) passos.push(nome);
        yield { tipo: "ferramenta", nome, rotulo: f?.rotulo ?? nome, resultado, ...(f ? detalhe(nome, e) : {}) };
        msgs.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(resultado) });
      }
    }
    yield { tipo: "erro", texto: "O agente não finalizou a tempo." };
  } catch (err) {
    if (err instanceof SemModeloDisponivel) {
      if (lote.decisoes.some((x) => x.id === e.id && !x.simulado)) {
        yield { tipo: "erro", texto: "Limite de uso gratuito da IA atingido agora. Mostrando a decisão que a IA tomou para este caso no processamento em lote." };
        yield* doLote(e);
        return;
      }
      yield { tipo: "erro", texto: "Limite de uso gratuito da IA atingido agora. Mostrando a decisão pela política, sem IA. Tente de novo em 1 minuto." };
      yield* simularAgenteFila(e, true);
      return;
    }
    yield { tipo: "erro", texto: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// MODO SIMULADO — sem IA. Mesma investigação, decisão pela política e mensagens
// de modelo. Usado em desenvolvimento sem chave e como plano B se a API cair.
// ---------------------------------------------------------------------------
export async function* simularAgenteFila(e: Excecao, semInicio = false): AsyncGenerator<Evento> {
  if (!semInicio) yield { tipo: "inicio", id: e.id, pedido: e.pedido, modo: "simulado" };
  const passos: string[] = [];
  for (const nome of ["consultar_pedido", "verificar_prazo", "consultar_cliente", "verificar_incidentes", "consultar_politica"]) {
    const f = FERRAMENTAS[nome];
    passos.push(nome);
    yield { tipo: "ferramenta", nome, rotulo: f.rotulo, resultado: f.fn(e), ...detalhe(nome, e) };
  }
  yield { tipo: "acao", resultado: decisaoPorPolitica(e, passos) };
}

export function decisaoPorPolitica(e: Excecao, passos: string[] = []): Decisao {
  const fora = foraDaPolitica(e);
  let acao = e.acao in ACOES ? e.acao : "escalar_humano";
  if (e.causas.includes("lote") && e.tipo === "vazamento_produto") acao = "reenvio_outro_lote";
  if (fora && ACOES[acao].nivel !== "humano") acao = "escalar_humano";
  const a = ACOES[acao];
  const nome = `Equipe ${e.marca}`;
  const prazo = verificarPrazo(e);
  const msg: Record<string, string> = {
    fechar_duplicado: "",
    comunicar_encerrar: `Olá! Seu pedido ${e.pedido} chegou depois do prazo que informamos, e pedimos desculpas por isso. Já registramos o ocorrido para melhorar nossas entregas. Qualquer coisa, é só responder aqui. ${nome}`,
    corrigir_promessa: `Olá! Sobre o pedido ${e.pedido}: informamos uma data de entrega errada no site, desculpe. A previsão correta é até ${dm(prazo.prazo_correto_dias_uteis)}, e seu pedido segue dentro do prazo com a ${e.transportadora}. ${nome}`,
    acionar_transportadora: `Olá! Vimos que seu pedido ${e.pedido} está demorando mais que o esperado. Já abrimos um chamado com a ${e.transportadora} e vamos te atualizar em até 2 dias úteis. ${nome}`,
    lembrete_pagamento: `Olá! Seu pedido ${e.pedido} ainda está aguardando pagamento. Geramos um novo link para você concluir a compra: [link]. ${nome}`,
    cancelar_pagamento: `Olá! Como não identificamos o pagamento do pedido ${e.pedido}, ele foi cancelado. Se ainda quiser os produtos, é só fazer um novo pedido. ${nome}`,
    confirmar_endereco: `Olá! Para entregar o pedido ${e.pedido}, precisamos confirmar seu endereço em ${e.cidade}/${e.uf}. Pode nos responder com rua, número, complemento e CEP? ${nome}`,
    nova_producao: `Olá! Identificamos um problema na personalização do seu pedido ${e.pedido}. Já estamos produzindo uma nova peça, sem custo, e avisamos assim que for enviada. ${nome}`,
    reenvio_com_foto: `Olá! Sentimos muito pelo problema com o pedido ${e.pedido}. Pode nos enviar uma foto do produto? Com ela, reenviamos sem custo para você. ${nome}`,
    reenvio_outro_lote: `Olá! Sentimos muito pelo vazamento no seu pedido ${e.pedido}. Já separamos um produto novo para reenvio, sem custo, e avisamos quando sair. ${nome}`,
    reenvio_endereco: `Olá! Seu pedido ${e.pedido} voltou para nós sem ser entregue. Pode confirmar o endereço completo com CEP? Assim reenviamos sem custo. ${nome}`,
    decidir_reenvio_reembolso: `Olá! Infelizmente seu pedido ${e.pedido} foi extraviado pela transportadora. Pedimos desculpas: você prefere que reenviemos ou que façamos o reembolso? ${nome}`,
    oferecer_troca_reembolso: `Olá! O produto do seu pedido ${e.pedido} ficou sem estoque depois da compra, e pedimos desculpas. Podemos trocar por outro produto ou fazer o reembolso integral. O que prefere? ${nome}`,
    escalar_humano: `Olá! Recebemos sua ocorrência no pedido ${e.pedido} e uma pessoa do nosso time já está cuidando dela. Retornamos em breve. ${nome}`,
  };
  const transp = ["acionar_transportadora"].includes(acao)
    ? `Chamado: pedido ${e.pedido}, destino ${e.cidade}/${e.uf}, ${e.tipo_rotulo.toLowerCase()}. Prazo contratado ${e.sla} dias úteis, ${Math.max(0, e.atraso_real)} dias úteis além do prazo. Solicitamos posição e nova previsão em até 24h.`
    : "";
  return {
    ...base(e, "política (sem IA)", true, passos),
    acao, acao_rotulo: a.rotulo, nivel: a.nivel,
    justificativa: fora ? `Fora da política do agente: ${fora}.` : `Caso dentro da política; ${e.tipo_rotulo.toLowerCase()} resolvido com "${a.rotulo.toLowerCase()}".`,
    mensagem_cliente: msg[acao] ?? "", mensagem_transportadora: transp,
    nota_interna: a.nivel === "humano" ? `Recomendação: ${ACOES[e.acao]?.rotulo ?? e.acao_texto}.` : a.nivel === "aprovacao" ? "Aprovar o custo do reenvio/produção." : "",
  };
}
