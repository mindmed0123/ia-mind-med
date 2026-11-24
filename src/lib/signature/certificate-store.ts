/**
 * Guarda o certificado A1 do médico só neste navegador.
 * - O arquivo .pfx pode ser lembrado neste computador (ele já é protegido pela senha).
 * - A senha nunca é gravada: o certificado aberto fica só na memória até fechar/recarregar a página.
 */
import type { A1Certificate, CertificateInfo } from './pades';

const DB_NAME = 'mindmed-certificado';
const STORE = 'pfx';

export interface StoredCertificate {
  userId: string;
  fileName: string;
  bytes: ArrayBuffer;
  info: CertificateInfo;
  savedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

export async function getStoredCertificate(userId: string): Promise<StoredCertificate | null> {
  try {
    return ((await tx('readonly', (s) => s.get(userId))) as StoredCertificate | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function saveStoredCertificate(c: StoredCertificate): Promise<void> {
  await tx('readwrite', (s) => s.put(c, c.userId));
}

export async function removeStoredCertificate(userId: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(userId));
  } catch { /* nada guardado */ }
}

// ── Certificado aberto nesta sessão (memória) ──
let unlocked: { userId: string; a1: A1Certificate } | null = null;
const listeners = new Set<() => void>();

export function getUnlocked(userId: string): A1Certificate | null {
  if (!unlocked || unlocked.userId !== userId) return null;
  if (new Date() > unlocked.a1.certificate.validity.notAfter) {
    unlocked = null;
    return null;
  }
  return unlocked.a1;
}

export function setUnlocked(userId: string, a1: A1Certificate | null) {
  unlocked = a1 ? { userId, a1 } : null;
  listeners.forEach((l) => l());
}

export function subscribeCertificate(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ── Pedido de assinatura (abre a janela do certificado) ──
export interface SignRequest {
  userId: string;
  documentLabel: string;
  resolve: (a1: A1Certificate | null) => void;
}
let requestHandler: ((r: SignRequest) => void) | null = null;

export function registerSignRequestHandler(h: ((r: SignRequest) => void) | null) {
  requestHandler = h;
}

/**
 * Devolve o certificado pronto para assinar. Se ainda não estiver aberto,
 * pede ao médico (senha ou arquivo). Devolve null se ele escolher baixar sem assinatura.
 */
export function requestSigner(userId: string, documentLabel: string): Promise<A1Certificate | null> {
  const ready = getUnlocked(userId);
  if (ready) return Promise.resolve(ready);
  if (!requestHandler) return Promise.resolve(null);
  return new Promise((resolve) => requestHandler!({ userId, documentLabel, resolve }));
}
