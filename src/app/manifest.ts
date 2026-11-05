import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ukuphila",
    short_name: "Ukuphila",
    description: "A memória do teu negócio: vendas, stock, fiado, poupança e Xitique, mesmo sem internet.",
    lang: "pt-MZ",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#071F1A",
    theme_color: "#071F1A",
    categories: ["business", "finance"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    // Share a wallet SMS or a phrase into Ukuphila and it opens as a record to confirm.
    share_target: { action: "/app/registar", method: "GET", params: { text: "text", title: "title" } },
    shortcuts: [
      { name: "Registar venda", url: "/app/registar", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "Movimentos", url: "/app/movimentos" },
    ],
  } as MetadataRoute.Manifest;
}
