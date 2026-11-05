"use client";

import { motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { DEFAULT_SUPPORT_WHATSAPP, whatsappUrl } from "@/lib/contact";

export function WhatsappContact() {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [href, setHref] = useState(whatsappUrl(DEFAULT_SUPPORT_WHATSAPP)!);
  const field = pathname === "/app" || pathname.startsWith("/app/") || pathname === "/agente" || pathname.startsWith("/agente/");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    fetch("/api/site/contact", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (typeof data?.whatsappUrl === "string" && /^https:\/\/wa\.me\/[1-9]\d{7,14}$/.test(data.whatsappUrl)) setHref(data.whatsappUrl); })
      .catch(() => undefined)
      .finally(() => clearTimeout(timeout));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, []);

  return <motion.a className="whatsapp-fab no-print" data-field={field} href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label="Falar com o Ukuphila no WhatsApp" initial={false} whileHover={reduced ? undefined : { y: -3, scale: 1.04 }} whileTap={reduced ? undefined : { scale: .93 }} transition={{ type: "spring", stiffness: 420, damping: 28 }}><Icon name="whatsapp" size={25} stroke={1.65} /><span className="whatsapp-fab-label">Fala connosco</span></motion.a>;
}
