import "server-only";

import {
  type DocumentsStorageBackend,
  getDocumentsStorageBackend,
} from "@/lib/uploads/storage-backend";
import {
  deleteLocalDocumentFile,
  localDocumentFileExists,
  readLocalDocumentByStorageMeta,
  writeLocalDocumentFile,
} from "@/lib/uploads/local-store";
import {
  deleteS3DocumentByStorageKey,
  headS3UploadedDocument,
  readS3DocumentBuffer,
  writeS3UploadedDocument,
} from "@/lib/uploads/s3-documents-store";

export { type DocumentsStorageBackend } from "@/lib/uploads/storage-backend";
export { isManagedDocumentStorageKey } from "@/lib/uploads/config";

/** מפתח חדש לרשומה ב־documents — בהתאם ל־DOCUMENTS_STORAGE. */
export function newDocumentStorageObjectKey(documentId: string): string {
  const backend: DocumentsStorageBackend = getDocumentsStorageBackend();
  if (backend === "s3") {
    return `s3/documents/${documentId}`;
  }
  return `local/${documentId}`;
}

export async function writeUploadedDocumentFile(
  documentId: string,
  storageObjectKey: string,
  data: Buffer,
): Promise<void> {
  if (/^local\//i.test(storageObjectKey)) {
    await writeLocalDocumentFile(documentId, data);
    return;
  }
  if (/^s3\//i.test(storageObjectKey)) {
    await writeS3UploadedDocument(storageObjectKey, documentId, data);
    return;
  }
  throw new Error(`סוג אחסון לא נתמך במפתח: ${storageObjectKey.slice(0, 120)}`);
}

export async function uploadedDocumentFileExists(meta: {
  documentId: string;
  storageObjectKey: string;
}): Promise<{ exists: boolean; size: number }> {
  if (/^local\//i.test(meta.storageObjectKey)) {
    return localDocumentFileExists(meta.documentId);
  }
  if (/^s3\//i.test(meta.storageObjectKey)) {
    return headS3UploadedDocument(meta.storageObjectKey);
  }
  return { exists: false, size: 0 };
}

export async function readUploadedDocumentBuffer(meta: {
  id: string;
  storageObjectKey: string;
}): Promise<Buffer | null> {
  if (/^local\//i.test(meta.storageObjectKey)) {
    return readLocalDocumentByStorageMeta(meta);
  }
  if (/^s3\//i.test(meta.storageObjectKey)) {
    return readS3DocumentBuffer(meta);
  }
  return null;
}

export async function deleteUploadedDocumentAfterDbChange(
  storageObjectKey: string,
  documentId: string,
): Promise<void> {
  if (/^local\//i.test(storageObjectKey)) {
    await deleteLocalDocumentFile(documentId);
    return;
  }
  if (/^s3\//i.test(storageObjectKey)) {
    await deleteS3DocumentByStorageKey(storageObjectKey);
    return;
  }
}
