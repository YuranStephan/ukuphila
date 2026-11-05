import { normalizePhone } from "./phone";

export const DEFAULT_SUPPORT_WHATSAPP = "+258845000392";

export function whatsappUrl(value: string) {
  const phone = (normalizePhone(value) ?? value).replace(/\D/g, "");
  return /^[1-9]\d{7,14}$/.test(phone) ? `https://wa.me/${phone}` : null;
}
