import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { secret } from "./env";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, options: object) => Promise<Buffer>;
const SCRYPT = { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function sha256(input: string | Buffer) {
  return createHash("sha256").update(input).digest("hex");
}

export function hmac(input: string, purpose: string) {
  return createHmac("sha256", `${secret("AUTH_SECRET")}:${purpose}`).update(input).digest("hex");
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function randomDigits(length: number) {
  return Array.from({ length }, () => randomInt(0, 10)).join("");
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(length: number) {
  return Array.from({ length }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join("");
}

export async function hashSecret(value: string) {
  const salt = randomBytes(16);
  const derived = await scryptAsync(value, salt, 32, SCRYPT);
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifySecret(value: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const derived = await scryptAsync(value, Buffer.from(salt, "base64url"), 32, SCRYPT);
  return safeEqual(derived.toString("base64url"), hash);
}

function documentKey() {
  return createHash("sha256").update(secret("DOCUMENT_KEY")).digest();
}

export const DOCUMENT_KEY_ID = "v1";

/** AES-256-GCM at application level: the storage provider only ever holds ciphertext. */
export function encryptBytes(plain: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", documentKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { ciphertext, iv: iv.toString("base64url"), authTag: cipher.getAuthTag().toString("base64url"), keyId: DOCUMENT_KEY_ID };
}

export function decryptBytes(ciphertext: Buffer, iv: string, authTag: string) {
  const decipher = createDecipheriv("aes-256-gcm", documentKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** TOTP secrets at rest use the same key, so a database dump alone cannot generate codes. */
export function sealText(plain: string) {
  const { ciphertext, iv, authTag } = encryptBytes(Buffer.from(plain));
  return `${iv}.${authTag}.${ciphertext.toString("base64url")}`;
}

export function openText(sealed: string) {
  const [iv, authTag, ciphertext] = sealed.split(".");
  return decryptBytes(Buffer.from(ciphertext, "base64url"), iv, authTag).toString();
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret() {
  return Array.from(randomBytes(20), (byte) => BASE32[byte % 32]).join("");
}

function base32Decode(input: string) {
  let bits = "";
  for (const char of input) bits += BASE32.indexOf(char).toString(2).padStart(5, "0");
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((byte) => parseInt(byte, 2)));
}

export function totpCode(base32Secret: string, at = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const digest = createHmac("sha1", base32Decode(base32Secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0xf;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, "0");
}

export function verifyTotp(base32Secret: string, code: string, at = Date.now()) {
  return [-30_000, 0, 30_000].some((drift) => safeEqual(totpCode(base32Secret, at + drift), code));
}
