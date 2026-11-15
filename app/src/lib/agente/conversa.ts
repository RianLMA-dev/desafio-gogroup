import "server-only";
import type { Excecao } from "@/lib/data";
import { chat, temChave, SemModeloDisponivel } from "./groq";
import { ACOES, foraDaPolitica } from "./ferramentas";

/**
 * Simulação de conversa: a IA interpreta o cliente (respondendo à mensagem do agente)
 * e depois o Agente de Fila reage, dentro da política. Serve para a demonstração mostrar
 * o agente conduzindo a tratativa, não só mandando uma mensagem.
 */

export interface Fala { autor: "agente" | "cliente"; texto: string; foto?: boolean }
export interface Rodada {
  cliente: Fala; agente: Fala;
  proximo_passo: string; status: "resolvido" | "aguardando_cliente" | "com_pessoa" | "aguardando_aprovacao" | "em_andamento";
  modelo: string; simulado: boolean;
}

const fatos = (e: Excecao, acao: string) => ({
  pedido: e.pedido, marca: e.marca, produto: e.produto, valor: e.valor, problema: e.tipo_rotulo,
  data_prometida: e.data_prometida, prazo_correto: e.prazo_correto, entregue_em: e.data_entrega,
  cliente_vip: e.vip, acao_do_agente: ACOES[acao]?.rotulo ?? acao,
});

const CLIENTE = `Você interpreta um CLIENTE brasileiro de e-commerce respondendo pelo WhatsApp à última mensagem da empresa.
Seja realista e variado: às vezes colaborativo (manda a foto, confirma o endereço, agradece), às vezes impaciente ou pedindo outra solução (reembolso, prazo).
Escreva como gente escreve no WhatsApp: 1 a 3 frases curtas, informal, sem assinatura. Não invente dados que contradigam os fatos.
Responda APENAS com JSON: {"texto": str, "enviou_foto": bool} (enviou_foto=true só se a empresa pediu foto e você decidiu enviar).`;

const AGENTE = `Você é o Agente de Fila respondendo ao cliente pelo WhatsApp, em nome da marca. Hoje é 30/09/2026.
Regras: cordial e direto, até 3 frases, assine "Equipe {marca}". Use só os fatos fornecidos; não invente prazos, códigos ou dados.
Política: você NÃO aprova reembolso nem custos sozinho — reenvio e nova produção precisam de aprovação de uma pessoa (diga que já encaminhou);
reembolso, reclamação grave ou cliente insatisfeito com a solução: diga que uma pessoa do time vai assumir e retorna em breve.
Status: "aguardando_aprovacao" só quando você encaminhou reenvio ou nova produção para aprovação; "em_andamento" quando aguarda a transportadora ou outra área; "com_pessoa" só quando o caso passou para uma pessoa (reembolso, reclamação, insatisfação); "aguardando_cliente" quando falta algo do cliente; "resolvido" quando não há mais nada a fazer.
Responda APENAS com JSON: {"texto": str, "proximo_passo": str (o que acontece agora, para o time, 1 frase), "status": "resolvido"|"aguardando_cliente"|"com_pessoa"|"aguardando_aprovacao"|"em_andamento"}`;

export async function simularRodada(e: Excecao, acao: string, historico: Fala[]): Promise<Rodada> {
  if (temChave()) {
    try {
      const conversa = historico.map((f) => `${f.autor === "agente" ? "EMPRESA" : "CLIENTE"}: ${f.texto}${f.foto ? " [foto enviada]" : ""}`).join("\n");
      const c = await chat({
        messages: [{ role: "system", content: CLIENTE }, { role: "user", content: `Fatos: ${JSON.stringify(fatos(e, acao))}\n\nConversa até agora:\n${conversa}` }],
        json: true, maxTokens: 300, temperature: 0.9,
      });
      const cj = JSON.parse(c.content ?? "{}");
      const cliente: Fala = { autor: "cliente", texto: String(cj.texto ?? "").replace(/\\n/g, "\n").trim(), foto: Boolean(cj.enviou_foto) };
      const fora = foraDaPolitica(e);
      const a = await chat({
        messages: [
          { role: "system", content: AGENTE },
          { role: "user", content: `Fatos: ${JSON.stringify({ ...fatos(e, acao), agente_pode_agir_sozinho: !fora, motivo: fora })}\n\nConversa:\n${conversa}\nCLIENTE: ${cliente.texto}${cliente.foto ? " [foto enviada]" : ""}` },
        ],
        json: true, maxTokens: 350, temperature: 0.3,
      });
      const aj = JSON.parse(a.content ?? "{}");
      let status = ["resolvido", "aguardando_cliente", "com_pessoa", "aguardando_aprovacao", "em_andamento"].includes(aj.status) ? aj.status : "em_andamento";
      // só existe aprovação pendente quando a ação gera custo (reenvio, nova produção)
      if (status === "aguardando_aprovacao" && ACOES[acao]?.nivel !== "aprovacao") status = "em_andamento";
      const limpa = (t: unknown) => String(t ?? "").replace(/\\n/g, "\n").trim();
      return {
        cliente, agente: { autor: "agente", texto: limpa(aj.texto) },
        proximo_passo: String(aj.proximo_passo ?? ""), status, modelo: a.modelo, simulado: false,
      };
    } catch (err) {
      if (!(err instanceof SemModeloDisponivel) && !(err instanceof SyntaxError)) throw err;
    }
  }
  return rodadaSimulada(e, acao);
}

function rodadaSimulada(e: Excecao, acao: string): Rodada {
  const assin = `Equipe ${e.marca}`;
  const pediuFoto = ["reenvio_com_foto", "reenvio_outro_lote"].includes(acao);
  const base = { modelo: "roteiro (sem IA)", simulado: true };
  if (pediuFoto)
    return { ...base, cliente: { autor: "cliente", texto: "Segue a foto. Preciso disso logo, era presente 😕", foto: true },
      agente: { autor: "agente", texto: `Recebemos a foto, obrigado! O reenvio sem custo já foi encaminhado para aprovação e avisamos assim que sair. ${assin}` },
      proximo_passo: "Foto recebida: reenvio aguardando aprovação em Ações do agente.", status: "aguardando_aprovacao" };
  if (acao === "confirmar_endereco" || acao === "reenvio_endereco")
    return { ...base, cliente: { autor: "cliente", texto: "Rua das Flores, 120, apto 32, CEP 01234-000. Pode mandar!" },
      agente: { autor: "agente", texto: `Endereço atualizado, obrigado! Seu pedido segue para envio e avisamos quando sair. ${assin}` },
      proximo_passo: "Endereço confirmado pelo cliente: liberar envio.", status: "resolvido" };
  return { ...base, cliente: { autor: "cliente", texto: "Ok, mas se não chegar até sexta eu quero o reembolso." },
    agente: { autor: "agente", texto: `Entendemos. Vamos acompanhar de perto e, se precisar, uma pessoa do nosso time cuida do reembolso com você. ${assin}` },
    proximo_passo: "Cliente sinalizou reembolso: acompanhar e escalar se não houver entrega.", status: "com_pessoa" };
}
