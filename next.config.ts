import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Documentos (BL, DAM, facturas) se suben por acciones del servidor: hasta 20 MB.
  experimental: { serverActions: { bodySizeLimit: "21mb" } },
};

export default nextConfig;
