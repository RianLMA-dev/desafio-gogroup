import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import Nav from "@/components/Nav";
import { lote } from "@/lib/data";

export const metadata: Metadata = {
  title: "Central de Exceções",
  description: "Priorização e resolução de pedidos com exceção, com agentes de IA — Desafio AI-First Gogroup",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={GeistSans.variable}>
      <body>
        <Nav lote={{ quando: lote.gerado_em, casos: lote.decisoes.length }} />
        <main className="lg:pl-64">
          <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8 sm:py-10">{children}</div>
        </main>
      </body>
    </html>
  );
}
