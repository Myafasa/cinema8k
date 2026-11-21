import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const value = process.env.TICKET_HMAC_SECRET;
  if (!value || value.length < 32) throw new Error("TICKET_HMAC_SECRET harus berisi minimal 32 karakter.");
  return value;
}

export function ticketPayload(code: string) {
  const signature = createHmac("sha256", secret()).update(code).digest("hex");
  return `${code}.${signature}`;
}

export function verifyTicketPayload(payload: string) {
  const separator = payload.lastIndexOf(".");
  if (separator < 1) return null;
  const code = payload.slice(0, separator);
  const suppliedHex = payload.slice(separator + 1);
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) return null;
  const expected = Buffer.from(createHmac("sha256", secret()).update(code).digest("hex"), "hex");
  const supplied = Buffer.from(suppliedHex, "hex");
  return timingSafeEqual(expected, supplied) ? code : null;
}
