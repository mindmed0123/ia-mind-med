/**
 * Persistência de gravação em IndexedDB para evitar perda de áudio
 * em casos de refresh, crash, internet instável ou fechamento acidental.
 *
 * Cada chunk do MediaRecorder (1s) é gravado incrementalmente.
 * Em caso de recovery, conseguimos remontar o blob completo.
 */

const DB_NAME = "mindmed-recording";
const DB_VERSION = 1;
const STORE_CHUNKS = "chunks";
const STORE_META = "meta";

interface RecordingMeta {
  id: string;
  startedAt: number;
  updatedAt: number;
  durationSec: number;
  mimeType: string;
  finalized: boolean;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        const store = db.createObjectStore(STORE_CHUNKS, { keyPath: "id", autoIncrement: true });
        store.createIndex("recordingId", "recordingId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function startPersistedRecording(mimeType: string): Promise<string> {
  const id = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_META, "readwrite");
    tx.objectStore(STORE_META).put({
      id,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      durationSec: 0,
      mimeType,
      finalized: false,
    } as RecordingMeta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return id;
}

export async function persistChunk(recordingId: string, blob: Blob, durationSec: number): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_CHUNKS, STORE_META], "readwrite");
      tx.objectStore(STORE_CHUNKS).add({ recordingId, blob, ts: Date.now() });
      const metaStore = tx.objectStore(STORE_META);
      const getReq = metaStore.get(recordingId);
      getReq.onsuccess = () => {
        const meta = getReq.result as RecordingMeta | undefined;
        if (meta) {
          meta.updatedAt = Date.now();
          meta.durationSec = durationSec;
          metaStore.put(meta);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn("[recording-persistence] persistChunk failed", e);
  }
}

export async function finalizeRecording(recordingId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, "readwrite");
      const store = tx.objectStore(STORE_META);
      const getReq = store.get(recordingId);
      getReq.onsuccess = () => {
        const meta = getReq.result as RecordingMeta | undefined;
        if (meta) {
          meta.finalized = true;
          meta.updatedAt = Date.now();
          store.put(meta);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn("[recording-persistence] finalize failed", e);
  }
}

export async function getRecoverableRecording(): Promise<{ id: string; blob: Blob; durationSec: number; mimeType: string } | null> {
  try {
    const db = await openDb();
    const meta = await new Promise<RecordingMeta | null>((resolve, reject) => {
      const tx = db.transaction(STORE_META, "readonly");
      const req = tx.objectStore(STORE_META).getAll();
      req.onsuccess = () => {
        const all = (req.result as RecordingMeta[]) || [];
        // pega gravação não finalizada mais recente, com pelo menos 5s
        const candidates = all
          .filter((m) => !m.finalized && m.durationSec >= 5)
          .sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(candidates[0] || null);
      };
      req.onerror = () => reject(req.error);
    });

    if (!meta) {
      db.close();
      return null;
    }

    // descarta gravações antigas (> 6h)
    if (Date.now() - meta.updatedAt > 6 * 60 * 60 * 1000) {
      db.close();
      await clearRecording(meta.id);
      return null;
    }

    const chunks = await new Promise<Blob[]>((resolve, reject) => {
      const tx = db.transaction(STORE_CHUNKS, "readonly");
      const store = tx.objectStore(STORE_CHUNKS);
      const idx = store.index("recordingId");
      const req = idx.getAll(meta.id);
      req.onsuccess = () => resolve((req.result || []).map((r: any) => r.blob));
      req.onerror = () => reject(req.error);
    });
    db.close();

    if (!chunks.length) return null;
    const blob = new Blob(chunks, { type: meta.mimeType });
    return { id: meta.id, blob, durationSec: meta.durationSec, mimeType: meta.mimeType };
  } catch (e) {
    console.warn("[recording-persistence] getRecoverable failed", e);
    return null;
  }
}

export async function clearRecording(recordingId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction([STORE_CHUNKS, STORE_META], "readwrite");
      const idx = tx.objectStore(STORE_CHUNKS).index("recordingId");
      const req = idx.openCursor(IDBKeyRange.only(recordingId));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.objectStore(STORE_META).delete(recordingId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch (e) {
    console.warn("[recording-persistence] clear failed", e);
  }
}

export async function clearAllRecordings(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction([STORE_CHUNKS, STORE_META], "readwrite");
      tx.objectStore(STORE_CHUNKS).clear();
      tx.objectStore(STORE_META).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    db.close();
  } catch {}
}
