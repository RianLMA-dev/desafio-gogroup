"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListOrdered, Factory, CheckCheck, MessageSquare, Menu, X, Waypoints } from "lucide-react";
import { useState } from "react";
import AgenteAvatar from "./AgenteAvatar";

const ITENS = [
  { href: "/", rotulo: "Visão geral", icone: LayoutDashboard },
  { href: "/fila", rotulo: "Fila do dia", icone: ListOrdered },
  { href: "/processo", rotulo: "Problemas de processo", icone: Factory },
  { href: "/acoes", rotulo: "Ações do agente", icone: CheckCheck, ia: true },
  { href: "/mensagens", rotulo: "Mensagens", icone: MessageSquare, ia: true },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--ai) 100%)" }}>
        <Waypoints size={19} strokeWidth={2.2} />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight">Central de Exceções</span>
        <span className="block text-[11px] text-muted">Operações · AI-First</span>
      </span>
    </Link>
  );
}

export default function Nav({ lote }: { lote: { quando: string | null; casos: number } }) {
  const path = usePathname();
  const [aberto, setAberto] = useState(false);
  const quando = lote.quando
    ? new Date(lote.quando).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
    : null;

  const links = (
    <nav className="flex flex-col gap-0.5">
      {ITENS.map(({ href, rotulo, icone: Icone, ia }) => {
        const ativo = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href} onClick={() => setAberto(false)}
            className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${ativo ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}>
            {ativo && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full" style={{ background: ia ? "var(--ai)" : "var(--accent)" }} />}
            <Icone size={18} strokeWidth={1.75} className={ativo ? (ia ? "text-ai" : "text-accent") : ""} />
            <span className="flex-1">{rotulo}</span>
            {ia && <span className="h-1.5 w-1.5 rounded-full bg-ai/70" aria-label="feito por IA" />}
          </Link>
        );
      })}
    </nav>
  );

  const status = (
    <div className="rounded-xl border border-ai-line bg-ai-soft/60 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-ai-strong">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ai opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-ai" />
        </span>
        2 agentes ativos
      </div>
      <div className="mt-2.5 flex flex-col gap-2 text-xs text-ink-2">
        <div className="flex items-center gap-2"><AgenteAvatar tipo="fila" tamanho={22} /> Agente de Fila</div>
        <div className="flex items-center gap-2"><AgenteAvatar tipo="processo" tamanho={22} /> Agente de Processo</div>
      </div>
      {quando && <div className="mt-2.5 border-t border-ai-line pt-2 text-[11px] text-muted">Último lote: {lote.casos} casos em {quando}</div>}
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-7 border-r border-line bg-surface px-3 py-6 lg:flex">
        <Logo />
        {links}
        <div className="mt-auto flex flex-col gap-3">
          {status}
          <div className="px-1 text-[11px] leading-relaxed text-muted">
            Dados sintéticos do desafio AI-First. Data de referência <b className="text-ink-2">30/09/2026</b>.
          </div>
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button aria-label="Menu" onClick={() => setAberto(!aberto)} className="p-1">{aberto ? <X /> : <Menu />}</button>
      </header>
      {aberto && <div className="fixed inset-x-0 top-[61px] z-30 flex flex-col gap-3 border-b border-line bg-surface p-3 shadow-lg lg:hidden">{links}{status}</div>}
    </>
  );
}
