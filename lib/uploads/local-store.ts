import path from "node:path";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { getLocalUploadRelativeDir } from "@/lib/uploads/config";

/**
 * ברירת מחדל: תיקיה יחסית לשורש הפרויקט (`path.resolve(process.cwd())`).
 * בפריסה שבה ה-cwd אינו איפה שנכתבו הקבצים (Docker/Nix/standalone) — הגדירו ב־`LOCAL_UPLOAD_DIR`
 * את **נתיב המוחלט** לאותה תיקייה שבה מתבצעת ההעלאה.
 */
export function getLocalUploadRoot(): string {
  let configured = getLocalUploadRelativeDir().trim().replaceAll("\\", "/");
  if (configured === "") configured = ".data/uploads";
  return path.isAbsolute(configured)
    ? path.normalize(configured)
    : path.normalize(path.resolve(process.cwd(), configured));
}

function documentIdDerivedPath(documentId: string): string {
  return path.resolve(getLocalUploadRoot(), documentId);
}

/** `local/<יחסית>` מתוך `storageObjectKey` — בלי path traversal. */
function safeRelativeFromStorageKey(storageObjectKey: string): string | null {
  const key = storageObjectKey.trim().replaceAll("\\", "/");
  const m = /^local\/(.+)$/i.exec(key);
  if (!m?.[1]?.length) return null;
  const trimmed = m[1].trim().replace(/^\/+/, "");
  if (!trimmed.length) return null;

  const parts = trimmed.split("/").filter(Boolean);
  if (parts.some((p) => p === "..")) return null;
  return path.join(...parts);
}

function isUnderUploadRoot(candidatePath: string): boolean {
  const root = path.resolve(getLocalUploadRoot());
  const abs = path.resolve(candidatePath);
  const rel = path.relative(root, abs);
  if (rel === "") return true;
  if (rel.startsWith(`..${path.sep}`) || rel === "..") return false;
  return !path.isAbsolute(rel);
}

async function localFileByteSize(candidatePath: string): Promise<number | null> {
  try {
    const st = await stat(candidatePath);
    return st.isFile() ? st.size : null;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return null;
    throw e;
  }
}

export async function ensureUploadDir(): Promise<void> {
  await mkdir(getLocalUploadRoot(), { recursive: true });
}

export async function writeLocalDocumentFile(
  documentId: string,
  data: Buffer,
): Promise<void> {
  await ensureUploadDir();
  const p = documentIdDerivedPath(documentId);
  if (!isUnderUploadRoot(p)) {
    throw new Error("לא ניתן לשמור את הקובץ מחוץ לתיקיית האחסון.");
  }
  await writeFile(p, data);
}

export async function localDocumentFileExists(
  documentId: string,
): Promise<{ exists: boolean; size: number }> {
  const p = documentIdDerivedPath(documentId);
  if (!isUnderUploadRoot(p)) {
    return { exists: false, size: 0 };
  }
  const sizeOrNull = await localFileByteSize(p);
  return sizeOrNull != null ? { exists: true, size: sizeOrNull } : { exists: false, size: 0 };
}

/** קריאה לפי שם הקובץ = id (מסלול ה־PUT). */
export async function readLocalDocumentFile(documentId: string): Promise<Buffer | null> {
  const p = documentIdDerivedPath(documentId);
  if (!isUnderUploadRoot(p)) return null;
  const sz = await localFileByteSize(p);
  if (sz == null) return null;
  return readFile(p);
}

/**
 * טעינה לפי מפתח אחסון + id — נתיב מ־`local/…` ואם חסר — נפילה ל־`uploadRoot/documentId`.
 */
export async function readLocalDocumentByStorageMeta(meta: {
  id: string;
  storageObjectKey: string;
}): Promise<Buffer | null> {
  const root = path.resolve(getLocalUploadRoot());
  const uniqueAbs: string[] = [];

  function pushAbs(abs: string) {
    if (!isUnderUploadRoot(abs)) return;
    if (!uniqueAbs.includes(abs)) uniqueAbs.push(abs);
  }

  const rel = safeRelativeFromStorageKey(meta.storageObjectKey);
  if (rel) {
    pushAbs(path.resolve(path.join(root, rel)));
  }
  pushAbs(documentIdDerivedPath(meta.id));

  for (const p of uniqueAbs) {
    const sz = await localFileByteSize(p);
    if (sz != null) return readFile(p);
  }

  return null;
}

export async function deleteLocalDocumentFile(documentId: string): Promise<void> {
  const p = documentIdDerivedPath(documentId);
  if (!isUnderUploadRoot(p)) return;
  try {
    await unlink(p);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") throw e;
  }
}
