"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListOrdered, Factory, CheckCheck, MessageSquare, Menu, X } from "lucide-react";
import { useState } from "react";

const ITENS = [
  { href: "/", rotulo: "Visão geral", icone: LayoutDashboard },
  { href: "/fila", rotulo: "Fila do dia", icone: ListOrdered },
  { href: "/processo", rotulo: "Problemas de processo", icone: Factory },
  { href: "/acoes", rotulo: "Ações do agente", icone: CheckCheck },
  { href: "/mensagens", rotulo: "Mensagens", icone: MessageSquare },
];

export default function Nav() {
  const path = usePathname();
  const [aberto, setAberto] = useState(false);
  const links = (
    <nav className="flex flex-col gap-1">
      {ITENS.map(({ href, rotulo, icone: Icone }) => {
        const ativo = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href} onClick={() => setAberto(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${ativo ? "bg-accent-soft text-accent-ink font-medium" : "text-ink-2 hover:bg-surface-2"}`}>
            <Icone size={18} strokeWidth={1.75} />
            <span className="flex-1">{rotulo}</span>
          </Link>
        );
      })}
    </nav>
  );
  const marca = (
    <div className="px-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Operações · Exceções</div>
      <div className="mt-1 text-lg font-semibold leading-tight">Central de Exceções</div>
    </div>
  );
  return (
    <>
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col gap-6 border-r border-line bg-surface py-6 px-3">
        {marca}
        {links}
        <div className="mt-auto px-3 text-xs leading-relaxed text-muted">
          Dados sintéticos do desafio AI-First. Data de referência <b className="text-ink-2">30/09/2026</b>.
        </div>
      </aside>
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <div className="font-semibold">Central de Exceções</div>
        <button aria-label="Menu" onClick={() => setAberto(!aberto)} className="p-1">{aberto ? <X /> : <Menu />}</button>
      </header>
      {aberto && <div className="lg:hidden fixed inset-x-0 top-[53px] z-30 border-b border-line bg-surface p-3 shadow-lg">{links}</div>}
    </>
  );
}
