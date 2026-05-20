import { createHash, randomBytes } from "crypto";

/** טוקן גלוי שנשלח במייל / ב-URL (לא לאחסון DB) */
export function generateInvitationRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}
