import "server-only";

/**
 * Cliente mínimo da API do Groq (compatível com OpenAI).
 * Tenta uma cadeia de modelos: se um bater no limite de uso (429) ou não existir,
 * passa para o próximo. Assim a demo continua de pé mesmo no plano gratuito.
 */

export type Msg =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ToolCall { id: string; type: "function"; function: { name: string; arguments: string } }

export interface Resposta { content: string | null; tool_calls?: ToolCall[]; modelo: string }

const URL = "https://api.groq.com/openai/v1/chat/completions";

export function modelos(): string[] {
  const env = process.env.GROQ_MODELS;
  if (env) return env.split(",").map((s) => s.trim()).filter(Boolean);
  return ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];
}

export const temChave = () => Boolean(process.env.GROQ_API_KEY) && process.env.AGENTE_SIMULADO !== "1";

export class SemModeloDisponivel extends Error {}

export async function chat(opts: {
  messages: Msg[];
  tools?: unknown[];
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  modelosPreferidos?: string[];
}): Promise<Resposta> {
  const chave = process.env.GROQ_API_KEY;
  if (!chave) throw new SemModeloDisponivel("GROQ_API_KEY não configurada");
  const lista = opts.modelosPreferidos ?? modelos();
  let ultimoErro = "";
  for (const modelo of lista) {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const body: Record<string, unknown> = {
        model: modelo,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 800,
      };
      // raciocínio interno curto: gasta muito menos tokens (limite gratuito é por minuto)
      if (modelo.startsWith("openai/gpt-oss")) body.reasoning_effort = "low";
      if (modelo.startsWith("qwen/")) body.reasoning_effort = "none";
      if (opts.tools) { body.tools = opts.tools; body.tool_choice = "auto"; }
      if (opts.json) body.response_format = { type: "json_object" };
      let res: Response;
      try {
        res = await fetch(URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(45_000),
        });
      } catch (e) {
        ultimoErro = `${modelo}: ${(e as Error).message}`;
        continue;
      }
      if (res.ok) {
        const data = await res.json();
        if (process.env.NODE_ENV !== "production" || process.env.AGENTE_LOG) console.log(`[groq] ${modelo} tokens=${data.usage?.total_tokens}`);
        const m = data.choices?.[0]?.message ?? {};
        return { content: m.content ?? null, tool_calls: m.tool_calls, modelo };
      }
      const texto = await res.text();
      ultimoErro = `${modelo}: HTTP ${res.status} ${texto.slice(0, 200)}`;
      // 400 tool_use_failed: o modelo errou o formato da chamada — tenta de novo
      if (res.status === 400 && texto.includes("tool_use_failed")) continue;
      // 429 com espera curta (limite por minuto): espera e tenta o mesmo modelo
      if (res.status === 429) {
        const s = Number(res.headers.get("retry-after") ?? "60");
        if (s <= 12 && tentativa < 2) { await new Promise((r) => setTimeout(r, (s + 0.5) * 1000)); continue; }
      }
      // limite longo, modelo indisponível (404) ou erro do servidor: próximo modelo
      break;
    }
  }
  console.warn("[groq] nenhum modelo respondeu:", ultimoErro);
  throw new SemModeloDisponivel(ultimoErro || "nenhum modelo respondeu");
}
