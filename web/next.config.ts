import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // Pivot portail multi-sports : le site football (ex. "Le Maillot Idéal")
  // vit maintenant sous /football/*, et / est devenu le portail multi-sports
  // (voir le plan). Le site est déjà en ligne avec de vrais clients et des
  // liens WhatsApp déjà partagés — redirige les anciennes URLs plutôt que de
  // les casser.
  async redirects() {
    return [
      { source: "/boutique", destination: "/football/boutique", permanent: true },
      { source: "/boutique/:path*", destination: "/football/boutique/:path*", permanent: true },
      { source: "/produits/:path*", destination: "/football/produits/:path*", permanent: true },
      { source: "/phototheque", destination: "/football/phototheque", permanent: true },
      { source: "/compte", destination: "/football/compte", permanent: true },
      { source: "/compte/:path*", destination: "/football/compte/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
