import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Club Lettura",
    short_name: "Club Lettura",
    description: "Libri e commenti per un piccolo club privato.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff9ef",
    theme_color: "#fff9ef",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      }
    ]
  };
}
