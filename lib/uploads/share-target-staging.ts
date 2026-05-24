import "server-only";

import path from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  deleteS3ShareStagingBundle,
  readS3ShareStagingBlob,
  readS3ShareStagingMetaText,
  writeS3ShareStaging,
} from "@/lib/uploads/s3-documents-store";
import { getDocumentsStorageBackend } from "@/lib/uploads/storage-backend";
import { getLocalUploadRoot } from "@/lib/uploads/local-store";
import { UPLOAD_MAX_BYTES } from "@/lib/uploads/config";

const STAGING_TTL_MS = 15 * 60 * 1000;

const SAFE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ShareStagingMetaStored = {
  mimeType: string;
  suggestedName: string | null;
  /** epoch ms זמן כתיבה — לסיום פג תוקף */
  createdAtMs: number;
};

function assertStagingIds(userId: string, stagingId: string): void {
  if (!SAFE_UUID.test(userId) || !SAFE_UUID.test(stagingId)) {
    throw new Error("מזהה staging לא תקין.");
  }
}

async function stagingLocalDirAbs(userId: string, stagingId: string): Promise<string> {
  assertStagingIds(userId, stagingId);
  const root = path.resolve(getLocalUploadRoot());
  const stagingRoot = path.join(root, "share-staging");
  const dir = path.join(stagingRoot, userId, stagingId);
  const normRoot = path.normalize(stagingRoot);
  const normDir = path.normalize(dir);
  if (!normDir.startsWith(normRoot + path.sep) && normDir !== normRoot) {
    throw new Error("נתיב staging חורג מתיקיית האחסון.");
  }
  return normDir;
}

function isStale(meta: ShareStagingMetaStored): boolean {
  return Date.now() - meta.createdAtMs > STAGING_TTL_MS;
}

export async function createShareStaging(
  userId: string,
  buffer: Buffer,
  metaPick: Omit<ShareStagingMetaStored, "createdAtMs">,
): Promise<{ stagingId: string }> {
  if (!SAFE_UUID.test(userId)) throw new Error("מזהה משתמש לא תקין.");
  if (buffer.length === 0) throw new Error("קובץ ריק.");
  if (buffer.length > UPLOAD_MAX_BYTES) throw new Error("קובץ חורג מהמגבלה.");

  const stagingId = randomUUID();
  const stored: ShareStagingMetaStored = {
    ...metaPick,
    createdAtMs: Date.now(),
  };
  const metaJson = `${JSON.stringify(stored)}\n`;

  const backend = getDocumentsStorageBackend();
  if (backend === "s3") {
    await writeS3ShareStaging(userId, stagingId, buffer, metaJson);
  } else {
    const dir = await stagingLocalDirAbs(userId, stagingId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "blob"), buffer);
    await writeFile(path.join(dir, "meta.json"), metaJson, "utf8");
  }
  return { stagingId };
}

export async function peekShareStagingMeta(
  userId: string,
  stagingId: string,
): Promise<ShareStagingMetaStored | null> {
  assertStagingIds(userId, stagingId);
  const backend = getDocumentsStorageBackend();
  try {
    const raw =
      backend === "s3"
        ? await readS3ShareStagingMetaText(userId, stagingId)
        : await readFile(
            path.join(await stagingLocalDirAbs(userId, stagingId), "meta.json"),
            "utf8",
          );
    if (!raw?.trim()) return null;
    const parsed = JSON.parse(raw) as ShareStagingMetaStored;
    if (!parsed.mimeType?.length || typeof parsed.createdAtMs !== "number") {
      await deleteShareStagingQuiet(userId, stagingId).catch(() => {});
      return null;
    }
    if (isStale(parsed)) {
      await deleteShareStagingQuiet(userId, stagingId).catch(() => {});
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** טעינת blob + meta אחרי וידוא תוקף (לא מוחקים — מחיקה לאחר ingest מוצלח). */
export async function loadShareStagingPayload(
  userId: string,
  stagingId: string,
): Promise<{ buffer: Buffer; meta: ShareStagingMetaStored } | null> {
  assertStagingIds(userId, stagingId);
  const meta = await peekShareStagingMeta(userId, stagingId);
  if (!meta) return null;
  const backend = getDocumentsStorageBackend();
  const buffer =
    backend === "s3"
      ? await readS3ShareStagingBlob(userId, stagingId)
      : await readFile(path.join(await stagingLocalDirAbs(userId, stagingId), "blob"));
  if (!buffer?.length) {
    await deleteShareStagingQuiet(userId, stagingId).catch(() => {});
    return null;
  }
  return { buffer, meta };
}

export async function deleteShareStagingQuiet(
  userId: string,
  stagingId: string,
): Promise<void> {
  assertStagingIds(userId, stagingId);
  const backend = getDocumentsStorageBackend();
  if (backend === "s3") {
    await deleteS3ShareStagingBundle(userId, stagingId);
    return;
  }
  try {
    const dir = await stagingLocalDirAbs(userId, stagingId);
    await rm(dir, { recursive: true, force: true });
  } catch {
    /* אידומפוטנטיות */
  }
}
