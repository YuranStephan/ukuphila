/** Normalises a Mozambican mobile number to E.164. Returns null when it is not a valid 8X number. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const national = digits.startsWith("00258") ? digits.slice(5) : digits.startsWith("258") ? digits.slice(3) : digits;
  return /^8[234567]\d{7}$/.test(national) ? `+258${national}` : null;
}

export function formatPhone(phone: string | null | undefined) {
  if (!phone) return "—";
  const national = phone.replace(/^\+258/, "");
  return national.length === 9 ? `${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}` : phone;
}

/** Staff lists show only the last digits. The full number needs a logged read. */
export function maskPhone(phone: string | null | undefined) {
  if (!phone) return "—";
  return `•• ••• ${phone.slice(-4)}`;
}
