import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MarsLogistics", template: "%s · MarsLogistics" },
  description: "Sistema de control logístico integral",
  appleWebApp: { capable: true, title: "MarsLogistics", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0f4c81",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
