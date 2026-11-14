/**
 * Processamento em lote dos agentes (como rodaria de madrugada em produção).
 *
 * Usa os MESMOS agentes do site, chamando a API local. Passo a passo:
 *   1. npm run dev                      (em um terminal)
 *   2. npm run agente:lote              (em outro terminal)
 *
 * Opções:  --por-nivel 40   quantos casos de cada nível (agente / aprovação / pessoa)
 *          --pausa 2500     ms entre chamadas (respeitar o limite gratuito do Groq)
 *          --url http://localhost:3000
 * Gera: src/data/lote_agente.json e src/data/relatorios.json
 */
import fs from "node:fs";
import path from "node:path";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const URL = arg("url", "http://localhost:3000");
const POR_NIVEL = Number(arg("por-nivel", 40));
const PAUSA = Number(arg("pausa", 2500));
const DADOS = path.join(process.cwd(), "src", "data");
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const fila = JSON.parse(fs.readFileSync(path.join(DADOS, "fila.json"), "utf8"));
const causas = JSON.parse(fs.readFileSync(path.join(DADOS, "causas.json"), "utf8"));

// casos do dia (dia 0 no cenário com agente), em ordem de prioridade, N de cada nível
const dia0 = fila.filter((e) => e.dia_agente === 0);
// --ids EX1,EX2 reprocessa só esses casos e mescla no lote existente; --relatorios a,b idem para relatórios
const IDS = arg("ids", "") ? arg("ids").split(",") : null;
const REL = arg("relatorios", "") ? arg("relatorios").split(",") : null;
const escolhidos = IDS ? fila.filter((e) => IDS.includes(e.id)) : REL ? [] : ["humano", "aprovacao", "auto"].flatMap((n) => dia0.filter((e) => e.nivel === n).slice(0, POR_NIVEL));
const anterior = (IDS || REL) && fs.existsSync(path.join(DADOS, "lote_agente.json")) ? JSON.parse(fs.readFileSync(path.join(DADOS, "lote_agente.json"), "utf8")).decisoes : [];
console.log(`Agente de Fila: ${escolhidos.length} casos · Agente de Processo: ${causas.filter((c) => !c.monitorar).length} problemas`);

async function rodarCaso(id) {
  const res = await fetch(`${URL}/api/agente/fila`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  const linhas = (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l));
  return { decisao: linhas.find((l) => l.tipo === "acao")?.resultado, erros: linhas.filter((l) => l.tipo === "erro").map((l) => l.texto), correcoes: linhas.filter((l) => l.tipo === "correcao").length };
}

const decisoes = anterior.filter((d) => !IDS?.includes(d.id));
const salvarLote = () => fs.writeFileSync(path.join(DADOS, "lote_agente.json"), JSON.stringify({ gerado_em: new Date().toISOString(), modo: decisoes.every((d) => d.simulado) ? "simulado" : "ia", decisoes }, null, 1));
let ia = 0, simuladas = 0, corrigidas = 0;
for (const [i, e] of escolhidos.entries()) {
  try {
    const { decisao, erros, correcoes } = await rodarCaso(e.id);
    if (decisao) { decisoes.push({ ...decisao, correcoes }); if (decisao.simulado) simuladas++; else ia++; if (correcoes) corrigidas++; salvarLote(); }
    process.stdout.write(`\r  ${i + 1}/${escolhidos.length}  IA: ${ia}  simuladas: ${simuladas}  corrigidas pela política: ${corrigidas}   ${erros[0] ? "· " + erros[0].slice(0, 60) : ""}`);
  } catch (err) { console.log(`\n  erro em ${e.id}: ${err.message}`); }
  await espera(PAUSA);
}
console.log();
salvarLote();

const relatorios = IDS ? null : (REL && fs.existsSync(path.join(DADOS, "relatorios.json")) ? JSON.parse(fs.readFileSync(path.join(DADOS, "relatorios.json"), "utf8")) : {});
for (const c of IDS ? [] : causas.filter((c) => !c.monitorar && (!REL || REL.includes(c.id)))) {
  const res = await fetch(`${URL}/api/agente/processo`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id }) });
  relatorios[c.id] = await res.json();
  console.log(`  relatório ${c.id}: ${relatorios[c.id].simulado ? "simulado" : relatorios[c.id].modelo}`);
  await espera(PAUSA);
}
if (relatorios) fs.writeFileSync(path.join(DADOS, "relatorios.json"), JSON.stringify(relatorios, null, 1));
console.log("Pronto. Arquivos salvos em src/data/.");
