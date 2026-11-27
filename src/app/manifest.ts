import type { MetadataRoute } from "next";

// Permite instalar la app en el celular desde el navegador ("Agregar a pantalla de inicio").
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MarsLogistics",
    short_name: "MarsLogistics",
    description: "Sistema de control logístico integral",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0f4c81",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
