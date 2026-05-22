import "server-only";

import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

let _client: S3Client | null = null;

function getBucket(): string {
  const b = process.env.DOCUMENTS_S3_BUCKET?.trim();
  if (!b) {
    throw new Error(
      "DOCUMENTS_S3_BUCKET חסר ב־env — נדרש כאשר DOCUMENTS_STORAGE=s3 (או תואם).",
    );
  }
  return b;
}

function getRegion(): string {
  const r =
    process.env.DOCUMENTS_S3_REGION?.trim() ||
    process.env.AWS_REGION?.trim();
  return r && r.length > 0 ? r : "auto";
}

function shouldForcePathStyle(endpoint: string | undefined): boolean {
  const forced = process.env.DOCUMENTS_S3_FORCE_PATH_STYLE?.trim().toLowerCase();
  if (forced === "1" || forced === "true" || forced === "yes") return true;
  if (forced === "0" || forced === "false") return false;
  return Boolean(endpoint?.length);
}

function getOrCreateClient(): S3Client {
  if (_client) return _client;
  const region = getRegion();
  const endpoint = process.env.DOCUMENTS_S3_ENDPOINT?.trim();
  _client = new S3Client({
    region,
    ...(endpoint?.length ? { endpoint, forcePathStyle: shouldForcePathStyle(endpoint) } : {}),
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
