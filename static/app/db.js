// Persistance du brouillon en IndexedDB (les Blobs photos y sont stockés tels quels).
// Un seul slot : « le brouillon en cours ».

const DB_NAME = "tlc-app";
const STORE = "drafts";
const KEY = "current";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function saveDraft(state) {
  return withStore("readwrite", (store) => store.put(state, KEY));
}

export function loadDraft() {
  return withStore("readonly", (store) => store.get(KEY));
}

export function clearDraft() {
  return withStore("readwrite", (store) => store.delete(KEY));
}
