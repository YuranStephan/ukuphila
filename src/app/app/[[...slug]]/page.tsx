import type { Metadata, Viewport } from "next";
import { MerchantApp } from "@/components/merchant/app";

/*
 * The merchant app is a static shell: no personal data is rendered on the server, so the service worker can cache it
 * and the app opens with no network. Data comes from IndexedDB first and /api/app/snapshot when online; the API
 * enforces the session, and a 401 sends the person to /entrar.
 */

export const metadata: Metadata = { title: "O meu negócio", manifest: "/manifest.webmanifest" };

export const viewport: Viewport = { themeColor: "#071F1A", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function MerchantAppPage() {
  return <MerchantApp />;
}
