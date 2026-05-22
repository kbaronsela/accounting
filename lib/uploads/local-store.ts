import path from "node:path";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { getLocalUploadRelativeDir } from "@/lib/uploads/config";

/**
 * ברירת מחדל: תיקיה יחסית לשורש הפרויקט (`path.resolve(process.cwd())`).
 * בפריסה שבה ה-cwd אינו איפה שנכתבו הקבצים (Docker/Nix/standalone) — הגדירו ב־`LOCAL_UPLOAD_DIR`
 * את **נתיב המוחלט** לאותה תיקייה שבה מתבצעת ההעלאה.
 *
 * מסמכים ישנים: אם קבצים נשמרו תחת שורש אחר (למשל `data/uploads` במקום `.data/uploads`), מוסיפים את
 * `LOCAL_UPLOAD_LEGACY_DIR`, או נסיים קריאה אוטומטית ממתיקיות ידועות ראשונות.
 */
export function getLocalUploadRoot(): string {
  let configured = getLocalUploadRelativeDir().trim().replaceAll("\\", "/");
  if (configured === "") configured = ".data/uploads";
  return path.isAbsolute(configured)
    ? path.normalize(configured)
    : path.normalize(path.resolve(process.cwd(), configured));
}

/** שורשי אחסון לפי סדר עדיפות — קנוני ראשון, אחר כך מסלולים ישנים/נפוצים. */
function distinctCandidateUploadRoots(): string[] {
  const cwd = process.cwd();
  const ordered: string[] = [];
  const seen = new Set<string>();

  function addResolved(absInput: string) {
    const n = path.normalize(path.resolve(absInput));
    if (!seen.has(n)) {
      seen.add(n);
      ordered.push(n);
    }
  }

  addResolved(getLocalUploadRoot());

  // לפני נרמול ל־.data/uploads — השתמשו בתיקיות נפוצות אחרות
  addResolved(path.resolve(cwd, "data", "uploads"));
  addResolved(path.resolve(cwd, "uploads"));

  const legacy = process.env.LOCAL_UPLOAD_LEGACY_DIR?.trim();
  if (legacy) {
    const norm = legacy.replaceAll("\\", "/");
    addResolved(path.isAbsolute(norm) ? norm : path.resolve(cwd, norm));
  }

  return ordered;
}

function documentPathUnderRoot(root: string, documentId: string): string {
  return path.normalize(path.resolve(root, documentId));
}

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

function isPathUnderRoot(absPath: string, root: string): boolean {
  const r = path.resolve(root);
  const a = path.resolve(absPath);
  const rel = path.relative(r, a);
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
  const root = path.resolve(getLocalUploadRoot());
  const p = documentPathUnderRoot(root, documentId);
  if (!isPathUnderRoot(p, root)) {
    throw new Error("לא ניתן לשמור את הקובץ מחוץ לתיקיית האחסון.");
  }
  await writeFile(p, data);
}

export async function localDocumentFileExists(
  documentId: string,
): Promise<{ exists: boolean; size: number }> {
  for (const root of distinctCandidateUploadRoots()) {
    const p = documentPathUnderRoot(root, documentId);
    if (!isPathUnderRoot(p, root)) continue;
    const sizeOrNull = await localFileByteSize(p);
    if (sizeOrNull != null) return { exists: true, size: sizeOrNull };
  }
  return { exists: false, size: 0 };
}

/** קריאה לפי שם הקובץ = id (מסלול ה־PUT) — עם נפילה לשורשי legacy. */
export async function readLocalDocumentFile(documentId: string): Promise<Buffer | null> {
  for (const root of distinctCandidateUploadRoots()) {
    const p = documentPathUnderRoot(root, documentId);
    if (!isPathUnderRoot(p, root)) continue;
    const sz = await localFileByteSize(p);
    if (sz != null) return readFile(p);
  }
  return null;
}

/**
 * טעינה לפי מפתח אחסון + id — נתיב מ־`local/…` ואם חסר — נפילה ל־`<root>/<documentId>`
 * לכל שורש אחסון אפשרי (קנוני + legacy).
 */
export async function readLocalDocumentByStorageMeta(meta: {
  id: string;
  storageObjectKey: string;
}): Promise<Buffer | null> {
  const rel = safeRelativeFromStorageKey(meta.storageObjectKey);

  for (const root of distinctCandidateUploadRoots()) {
    const tried: string[] = [];

    function pushCandidate(abs: string) {
      const n = path.normalize(abs);
      if (!isPathUnderRoot(n, root)) return;
      if (!tried.includes(n)) tried.push(n);
    }

    if (rel) {
      pushCandidate(path.resolve(path.join(root, rel)));
    }
    pushCandidate(documentPathUnderRoot(root, meta.id));

    for (const p of tried) {
      const sz = await localFileByteSize(p);
      if (sz != null) return readFile(p);
    }
  }

  return null;
}

export async function deleteLocalDocumentFile(documentId: string): Promise<void> {
  /** מחק רק בשורש הקנוני — כדי לא לגעת בלי כוונה בהעתק legacy */
  const root = path.resolve(getLocalUploadRoot());
  const p = documentPathUnderRoot(root, documentId);
  if (!isPathUnderRoot(p, root)) return;
  try {
    await unlink(p);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") throw e;
  }
}
