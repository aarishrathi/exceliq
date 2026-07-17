/**
 * File-backed local store for development without Vercel Postgres/Blob.
 * Data lives in `.data/store.json`; uploaded files in `.data/files/`.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { AnomalyFlag, SemanticDiff } from '@/types/workbook';
import type { ParsedWorkbook } from '@/lib/parser';

const DATA_DIR = path.join(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const FILES_DIR = path.join(DATA_DIR, 'files');

export interface StoredWorkbook {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
  lastModifiedAt: string;
  healthScore: number;
  openFlagCount: number;
}

export interface StoredVersion {
  id: string;
  workbookId: string;
  versionNumber: number;
  uploadedBy: string;
  uploadedAt: string;
  fileName: string;
  fileHash: string;
  blobUrl: string;
  diff: (Partial<SemanticDiff> & { parsedSnapshot?: ParsedWorkbook }) | null;
  aiSummary: string;
}

export interface StoredFlag extends AnomalyFlag {
  versionId: string;
  workbookId: string;
  createdAt: string;
}

interface StoreData {
  workbooks: StoredWorkbook[];
  versions: StoredVersion[];
  flags: StoredFlag[];
}

async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(FILES_DIR, { recursive: true });
}

async function readStore(): Promise<StoreData> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    return JSON.parse(raw) as StoreData;
  } catch {
    return { workbooks: [], versions: [], flags: [] };
  }
}

async function writeStore(data: StoreData) {
  await ensureDirs();
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export function isLocalMode(): boolean {
  return !process.env.POSTGRES_URL;
}

export async function saveFileLocally(
  fileHash: string,
  fileName: string,
  bytes: Uint8Array
): Promise<string> {
  await ensureDirs();
  const dir = path.join(FILES_DIR, fileHash);
  await fs.mkdir(dir, { recursive: true });
  const safeName = fileName.replace(/[/\\]/g, '_');
  const filePath = path.join(dir, safeName);
  await fs.writeFile(filePath, bytes);
  return `/api/files/${fileHash}/${encodeURIComponent(safeName)}`;
}

export async function listWorkbooks() {
  const store = await readStore();
  return store.workbooks
    .map((w) => ({
      ...w,
      openFlagCount: store.flags.filter(
        (f) => f.workbookId === w.id && f.status === 'open'
      ).length,
    }))
    .sort(
      (a, b) =>
        new Date(b.lastModifiedAt).getTime() - new Date(a.lastModifiedAt).getTime()
    );
}

export async function getWorkbook(id: string) {
  const store = await readStore();
  return store.workbooks.find((w) => w.id === id) ?? null;
}

export async function createWorkbook(input: {
  id: string;
  name: string;
  createdBy: string;
}) {
  const store = await readStore();
  const now = new Date().toISOString();
  const workbook: StoredWorkbook = {
    id: input.id,
    name: input.name,
    description: '',
    createdBy: input.createdBy,
    createdAt: now,
    lastModifiedAt: now,
    healthScore: 100,
    openFlagCount: 0,
  };
  store.workbooks.push(workbook);
  await writeStore(store);
  return workbook;
}

export async function touchWorkbook(id: string) {
  const store = await readStore();
  const wb = store.workbooks.find((w) => w.id === id);
  if (wb) {
    wb.lastModifiedAt = new Date().toISOString();
    await writeStore(store);
  }
}

export async function getLatestVersionNumber(workbookId: string): Promise<number> {
  const store = await readStore();
  const versions = store.versions.filter((v) => v.workbookId === workbookId);
  if (versions.length === 0) return 0;
  return Math.max(...versions.map((v) => v.versionNumber));
}

export async function getLatestVersion(workbookId: string) {
  const store = await readStore();
  return (
    store.versions
      .filter((v) => v.workbookId === workbookId)
      .sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null
  );
}

export async function listVersions(workbookId: string) {
  const store = await readStore();
  return store.versions
    .filter((v) => v.workbookId === workbookId)
    .sort((a, b) => b.versionNumber - a.versionNumber);
}

export async function createVersion(version: StoredVersion) {
  const store = await readStore();
  store.versions.push(version);
  await writeStore(store);
  return version;
}

export async function listFlags(workbookId: string) {
  const store = await readStore();
  return store.flags
    .filter((f) => f.workbookId === workbookId)
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export async function createFlags(
  workbookId: string,
  versionId: string,
  flags: AnomalyFlag[]
) {
  if (flags.length === 0) return;
  const store = await readStore();
  const now = new Date().toISOString();
  for (const flag of flags) {
    store.flags.push({
      ...flag,
      versionId,
      workbookId,
      createdAt: now,
    });
  }

  const wb = store.workbooks.find((w) => w.id === workbookId);
  if (wb) {
    const criticalCount = flags.filter((f) => f.severity === 'critical').length;
    const warningCount = flags.filter((f) => f.severity === 'warning').length;
    wb.healthScore = Math.max(0, 100 - criticalCount * 20 - warningCount * 5);
    wb.openFlagCount = store.flags.filter(
      (f) => f.workbookId === workbookId && f.status === 'open'
    ).length;
  }

  await writeStore(store);
}

export async function resolveFlagLocal(
  workbookId: string,
  flagId: string,
  resolvedBy: string,
  note: string
) {
  const store = await readStore();
  const flag = store.flags.find((f) => f.id === flagId && f.workbookId === workbookId);
  if (!flag) return false;

  flag.status = 'resolved';
  flag.resolvedBy = resolvedBy;
  flag.resolvedAt = new Date().toISOString();
  flag.resolutionNote = note;

  const wb = store.workbooks.find((w) => w.id === workbookId);
  if (wb) {
    wb.openFlagCount = store.flags.filter(
      (f) => f.workbookId === workbookId && f.status === 'open'
    ).length;
  }

  await writeStore(store);
  return true;
}
