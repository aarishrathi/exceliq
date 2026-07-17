/**
 * Storage helpers — Vercel Blob when configured, otherwise local `.data/files`.
 */

import { put } from '@vercel/blob';
import { isLocalMode, saveFileLocally } from '@/lib/local-store';

export async function storeWorkbookFile(
  fileHash: string,
  fileName: string,
  bytes: Uint8Array,
  contentType: string
): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN && !isLocalMode()) {
    const blob = await put(
      `workbooks/${fileHash}/${fileName}`,
      Buffer.from(bytes),
      {
        access: 'public',
        contentType,
      }
    );
    return blob.url;
  }

  // Local / no-blob fallback
  return saveFileLocally(fileHash, fileName, bytes);
}
