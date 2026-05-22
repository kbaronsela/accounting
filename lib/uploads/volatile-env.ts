/**
 * קריאת env בזמן ריצה — מפחית מצבים שבהם bundler מחליף `process.env.NAME`
 * בערך מזמן build (מקובל בפריסות Next).
 */
export function readVolatileEnv(varName: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const v = process.env[varName];
  return typeof v === "string" ? v : undefined;
}

export function trimEnvValue(raw: string | undefined): string {
  if (!raw?.length) return "";
  return raw
    .replace(/^\ufeff+/g, "")
    .replace(/\ufeff+/g, "")
    .trim();
}
