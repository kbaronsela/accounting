import "server-only";

import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { readVolatileEnv, trimEnvValue } from "@/lib/uploads/volatile-env";

let _client: S3Client | null = null;

function envDocumentsS3Bucket(): string {
  return String.fromCharCode(
    68, 79, 67, 85, 77, 69, 78, 84, 83, 95, 83, 51, 95, 66, 85, 67, 75, 69, 84,
  );
}

function envDocumentsS3Region(): string {
  return String.fromCharCode(
    68, 79, 67, 85, 77, 69, 78, 84, 83, 95, 83, 51, 95, 82, 69, 71, 73, 79, 78,
  );
}

function envAwsRegion(): string {
  return String.fromCharCode(65, 87, 83, 95, 82, 69, 71, 73, 79, 78);
}

function envDocumentsS3Endpoint(): string {
  return String.fromCharCode(
    68, 79, 67, 85, 77, 69, 78, 84, 83, 95, 83, 51, 95, 69, 78, 68, 80, 79, 73,
    78, 84,
  );
}

function envDocumentsS3ForcePathStyle(): string {
  return String.fromCharCode(
    68, 79, 67, 85, 77, 69, 78, 84, 83, 95, 83, 51, 95, 70, 79, 82, 67, 69, 95,
    80, 65, 84, 72, 95, 83, 84, 89, 76, 69,
  );
}

function envAwsAccessKeyId(): string {
  return String.fromCharCode(
    65, 87, 83, 95, 65, 67, 67, 69, 83, 83, 95, 75, 69, 89, 95, 73, 68,
  );
}

function envAwsSecretAccessKey(): string {
  return String.fromCharCode(
    65, 87, 83, 95, 83, 69, 67, 82, 69, 84, 95, 65, 67, 67, 69, 83, 83, 95, 75,
    69, 89,
  );
}

/** חלופה לשם AWS — מתאימה ל‑R2 (אותם ערכים כמו מה שמקבלים מ‑«R2 API Token») */
function envDocumentsS3AccessKeyId(): string {
  return String.fromCharCode(
    68, 79, 67, 85, 77, 69, 78, 84, 83, 95, 83, 51, 95, 65, 67, 67, 69, 83, 83, 95,
    75, 69, 89, 95, 73, 68,
  );
}

function envDocumentsS3SecretAccessKey(): string {
  return String.fromCharCode(
    68, 79, 67, 85, 77, 69, 78, 84, 83, 95, 83, 51, 95, 83, 69, 67, 82, 69, 84, 95,
    65, 67, 67, 69, 83, 83, 95, 75, 69, 89,
  );
}

function getBucket(): string {
  const b = trimEnvValue(readVolatileEnv(envDocumentsS3Bucket()));
  if (!b) {
    throw new Error(
      "DOCUMENTS_S3_BUCKET חסר או לא נטען בזמן ריצה — בדוקי Variables בפריסה.",
    );
  }
  return b;
}

function resolvedEndpointHostname(): string {
  const raw = trimEnvValue(readVolatileEnv(envDocumentsS3Endpoint())).toLowerCase();
  try {
    return new URL(raw).hostname;
  } catch {
    return "";
  }
}

/**
 * עם R2 והאזור `auto`, AWS SDK לעיתים פושט חתימות לא נכון.
 * ב‑R2 ובמיניו/endpoint מותאם מתקנים ל‑`us-east-1` כשאין אזור קונקרטי (מקובל בספקי S3-compat).
 */
function getRegion(): string {
  const explicit =
    trimEnvValue(readVolatileEnv(envDocumentsS3Region())) ||
    trimEnvValue(readVolatileEnv(envAwsRegion()));
  const host = resolvedEndpointHostname();
  const low = explicit.toLowerCase();

  if (host.includes("r2.cloudflarestorage.com")) {
    return !explicit || low === "auto" ? "us-east-1" : explicit;
  }

  if (host.length > 0 && (!explicit || low === "auto")) {
    return "us-east-1";
  }

  if (!explicit || low === "auto") return "auto";
  return explicit;
}

function shouldForcePathStyle(endpoint: string | undefined): boolean {
  const forced = trimEnvValue(
    readVolatileEnv(envDocumentsS3ForcePathStyle()),
  ).toLowerCase();
  if (forced === "1" || forced === "true" || forced === "yes") return true;
  if (forced === "0" || forced === "false") return false;
  return Boolean(endpoint?.length);
}

function volatileAwsCredentials(): { accessKeyId: string; secretAccessKey: string } | undefined {
  const accessKeyId =
    trimEnvValue(readVolatileEnv(envDocumentsS3AccessKeyId())) ||
    trimEnvValue(readVolatileEnv(envAwsAccessKeyId()));
  const secretAccessKey =
    trimEnvValue(readVolatileEnv(envDocumentsS3SecretAccessKey())) ||
    trimEnvValue(readVolatileEnv(envAwsSecretAccessKey()));
  if (!accessKeyId?.length || !secretAccessKey?.length) return undefined;
  return { accessKeyId, secretAccessKey };
}

function getOrCreateClient(): S3Client {
  if (_client) return _client;
  const region = getRegion();
  const endpointRaw = trimEnvValue(readVolatileEnv(envDocumentsS3Endpoint()));
  const endpoint = endpointRaw.length > 0 ? endpointRaw : undefined;
  const explicitCreds = volatileAwsCredentials();

  if (endpoint?.length && !explicitCreds) {
    throw new Error(
      "חסרים מפתחות גישה ל‑S3-compat: הגדירי DOCUMENTS_S3_ACCESS_KEY_ID ו־DOCUMENTS_S3_SECRET_ACCESS_KEY, או AWS_ACCESS_KEY_ID ו־AWS_SECRET_ACCESS_KEY (ב־Cloudflare R2 הערכים מ־«R2 API Token»).",
    );
  }

  _client = new S3Client({
    region,
    ...(endpoint?.length ? { endpoint, forcePathStyle: shouldForcePathStyle(endpoint) } : {}),
    ...(explicitCreds ? { credentials: explicitCreds } : {}),
  });
  return _client;
}

/** מפתח אובייקט ב(bucket) מתוך `storageObjectKey` בפורמט `s3/<key>` */
export function s3BucketObjectKey(storageObjectKey: string): string | null {
  const k = storageObjectKey.trim().replaceAll("\\", "/");
  const m = /^s3\/(.+)$/i.exec(k);
  if (!m?.[1]?.length) return null;
  const body = m[1].trim().replace(/^\/+/, "");
  return body.length > 0 ? body : null;
}

function canonicalS3DocKey(documentId: string): string {
  return `documents/${documentId}`;
}

async function readableToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function s3PayloadToBuffer(payload: unknown): Promise<Buffer | null> {
  if (!payload) return null;

  const withTransform = payload as { transformToByteArray?: () => Promise<Uint8Array> };
  if (typeof withTransform.transformToByteArray === "function") {
    const u8 = await withTransform.transformToByteArray();
    const buf = Buffer.from(u8);
    return buf.length ? buf : null;
  }

  if (payload instanceof Readable) {
    const buf = await readableToBuffer(payload);
    return buf.length ? buf : null;
  }

  return null;
}

export async function writeS3UploadedDocument(
  storageObjectKey: string,
  documentId: string,
  data: Buffer,
): Promise<void> {
  const parsed = s3BucketObjectKey(storageObjectKey);
  const canonical = canonicalS3DocKey(documentId);
  if (parsed !== canonical) {
    throw new Error(`מפתח אחסון S3 לא תואם למסמך (צפוי ${canonical}).`);
  }
  const client = getOrCreateClient();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: canonical,
      Body: data,
    }),
  );
}

/** Head — גודל בבתים; אין אובייקט ⇒ exists: false */
export async function headS3UploadedDocument(
  storageObjectKey: string,
): Promise<{ exists: boolean; size: number }> {
  const key = s3BucketObjectKey(storageObjectKey);
  if (!key) return { exists: false, size: 0 };
  const client = getOrCreateClient();
  try {
    const r = await client.send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    return { exists: true, size: Number(r.ContentLength ?? 0) };
  } catch (e: unknown) {
    const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
    const code404 =
      err.name === "NotFound" ||
      err.name === "NoSuchKey" ||
      err.$metadata?.httpStatusCode === 404;
    if (code404) return { exists: false, size: 0 };
    throw e;
  }
}

async function tryGetOnce(key: string): Promise<Buffer | null> {
  const client = getOrCreateClient();
  let out;
  try {
    out = await client.send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
  } catch (e: unknown) {
    const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
    const code404 =
      err.name === "NoSuchKey" ||
      err.name === "NotFound" ||
      err.$metadata?.httpStatusCode === 404;
    if (code404) return null;
    throw e;
  }

  return s3PayloadToBuffer(out.Body);
}

/**
 * טעינה לפי `storageObjectKey` או נפילה ל־`documents/<documentId>`
 * (למקרי מפתח לא צפוי / יורש).
 */
export async function readS3DocumentBuffer(meta: {
  id: string;
  storageObjectKey: string;
}): Promise<Buffer | null> {
  const fromMeta = s3BucketObjectKey(meta.storageObjectKey);
  const keysOrdered: string[] = [];
  function push(unique: string) {
    if (unique.length && !keysOrdered.includes(unique)) keysOrdered.push(unique);
  }
  if (fromMeta) push(fromMeta);
  push(canonicalS3DocKey(meta.id));

  for (const key of keysOrdered) {
    const buf = await tryGetOnce(key);
    if (buf?.length) return buf;
  }
  return null;
}

export async function deleteS3DocumentByStorageKey(
  storageObjectKey: string,
): Promise<void> {
  const key = s3BucketObjectKey(storageObjectKey);
  if (!key) return;
  const client = getOrCreateClient();
  await client.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}
