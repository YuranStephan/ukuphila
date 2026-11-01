/** Portuguese number words → integers: "mil e quinhentos" → 1500, "duas" → 2. Runs on the device, so voice works offline. */
const UNITS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezasseis: 16, dezesseis: 16, dezassete: 17, dezessete: 17,
  dezoito: 18, dezanove: 19, dezenove: 19,
};
const TENS: Record<string, number> = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
const HUNDREDS: Record<string, number> = {
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400,
  quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800,
  novecentos: 900, novecentas: 900,
};

export function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}.,\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const isNumberWord = (word: string) => word in UNITS || word in TENS || word in HUNDREDS || word === "mil" || word === "milhao" || word === "milhoes";

/** Reads consecutive number words starting at `start`. Returns the value and how many words it used. */
function readWords(words: string[], start: number) {
  let total = 0;
  let current = 0;
  let index = start;
  let used = 0;
  while (index < words.length) {
    const word = words[index];
    if (word === "e" && used > 0 && index + 1 < words.length && isNumberWord(words[index + 1])) {
      index += 1;
      continue;
    }
    if (word in UNITS) current += UNITS[word];
    else if (word in TENS) current += TENS[word];
    else if (word in HUNDREDS) current += HUNDREDS[word];
    else if (word === "mil") {
      total += (current || 1) * 1000;
      current = 0;
    } else if (word === "milhao" || word === "milhoes") {
      total += (current || 1) * 1_000_000;
      current = 0;
    } else break;
    used = index - start + 1;
    index += 1;
  }
  return used ? { value: total + current, used } : null;
}

export type NumberToken = { value: number; index: number; length: number };

/** Finds numbers in normalised text, in digits ("1.500", "2 mil") or words. Indexes refer to word positions. */
export function findNumbers(normalized: string): NumberToken[] {
  const words = normalized.split(" ");
  const tokens: NumberToken[] = [];
  for (let index = 0; index < words.length; index += 1) {
    const digit = words[index].replace(/[.,]$/, "").match(/^(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,](\d{1,2}))?(mt)?$/);
    if (digit) {
      const whole = Number(digit[1].replace(/[.,]/g, ""));
      const value = digit[2] ? whole + Number(digit[2].padEnd(2, "0")) / 100 : whole;
      if (words[index + 1] === "mil") {
        tokens.push({ value: value * 1000, index, length: 2 });
        index += 1;
      } else {
        tokens.push({ value, index, length: 1 });
      }
      continue;
    }
    const read = readWords(words, index);
    if (read) {
      tokens.push({ value: read.value, index, length: read.used });
      index += read.used - 1;
    }
  }
  return tokens;
}
