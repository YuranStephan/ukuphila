import type { BeforeSendEvent } from "@vercel/analytics/next";

const PUBLIC_PATHS = new Set([
  "/", "/como-funciona", "/comerciantes", "/agentes", "/fornecedores",
  "/parceiros", "/seguranca", "/sobre", "/faq", "/contacto",
  "/privacidade", "/termos", "/pitch", "/verificar", "/entrar", "/registar",
]);

export function isPublicAnalyticsPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname.replace(/\/+$/, "") || "/");
}

/** Only public page views enter traffic analytics; account identifiers stay out. */
export function publicPageView(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type !== "pageview") return null;
  try {
    const url = new URL(event.url);
    if (!["https:", "http:"].includes(url.protocol) || !isPublicAnalyticsPath(url.pathname)) return null;
    return { ...event, url: `${url.origin}${url.pathname.replace(/\/+$/, "") || "/"}` };
  } catch {
    return null;
  }
}
