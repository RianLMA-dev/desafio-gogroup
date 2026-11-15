import { ListChecks, ScanSearch } from "lucide-react";

/** Avatar dos agentes de IA: mesma cor em todo o app, para identificar o que foi feito pela IA. */
export default function AgenteAvatar({ tipo, tamanho = 32 }: { tipo: "fila" | "processo"; tamanho?: number }) {
  const Icone = tipo === "fila" ? ListChecks : ScanSearch;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[30%] text-white shadow-sm"
      style={{ width: tamanho, height: tamanho, background: "linear-gradient(135deg, var(--ai) 0%, #8a7cf0 100%)" }}
      aria-hidden
    >
      <Icone size={Math.round(tamanho * 0.55)} strokeWidth={2} />
    </span>
  );
}
