import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Control de Turnos de Agua & Insumos",
  description: "Gestión inteligente y rotación de compras de insumos de oficina.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${plusJakarta.variable} bg-white`}>
      <body className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
