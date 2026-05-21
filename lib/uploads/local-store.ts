import path from "node:path";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { getLocalUploadRelativeDir } from "@/lib/uploads/config";

function getLocalUploadRoot(): string {
  return path.join(process.cwd(), getLocalUploadRelativeDir());
}

function getLocalDocumentFilePath(documentId: string): string {
  return path.join(getLocalUploadRoot(), documentId);
}

export async function ensureUploadDir(): Promise<void> {
  await mkdir(getLocalUploadRoot(), { recursive: true });
}

export async function writeLocalDocumentFile(
  documentId: string,
  data: Buffer,
): Promise<void> {
  await ensureUploadDir();
  const p = getLocalDocumentFilePath(documentId);
  await writeFile(p, data);
}

export async function localDocumentFileExists(
  documentId: string,
): Promise<{ exists: boolean; size: number }> {
  try {
    const st = await stat(getLocalDocumentFilePath(documentId));
    return { exists: st.isFile(), size: st.size };
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return { exists: false, size: 0 };
    }
    throw e;
  }
}

export async function readLocalDocumentFile(documentId: string): Promise<Buffer | null> {
  const { exists } = await localDocumentFileExists(documentId);
  if (!exists) return null;
  return readFile(getLocalDocumentFilePath(documentId));
}

export async function deleteLocalDocumentFile(documentId: string): Promise<void> {
  try {
    await unlink(getLocalDocumentFilePath(documentId));
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") throw e;
  }
}
