import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "node:crypto";
export const randomToken = () => randomBytes(32).toString("base64url");
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function equal(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function key() {
  const k = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || "", "base64");
  if (k.length !== 32) throw new Error("invalid_encryption_key");
  return k;
}
export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((x) => x.toString("base64url"))
    .join(".");
}
export function decrypt(value: string) {
  const [iv, tag, ciphertext] = value
    .split(".")
    .map((x) => Buffer.from(x, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", key(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString(
    "utf8",
  );
}
export class AppError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export function safeCode(error: unknown) {
  return error instanceof AppError ? error.code : "unavailable";
}
