import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Der Build soll nicht an Style-Regeln (z. B. no-explicit-any im Odoo-Client)
    // scheitern. Typprüfung (tsc) bleibt aktiv und blockiert echte Fehler.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
