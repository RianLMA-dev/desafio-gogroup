import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Central de Exceções",
  description: "Priorização e resolução de pedidos com exceção, com agentes de IA — Desafio AI-First Gogroup",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Nav />
        <main className="lg:pl-64">
          <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8 sm:py-10">{children}</div>
        </main>
      </body>
    </html>
  );
}
