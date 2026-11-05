/** Minimal IndexedDB: one key-value store and one ordered queue. Enough for an offline ledger client, no dependency. */

const NAME = "ukuphila";
const VERSION = 1;

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue", { keyPath: "deviceSeq" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      opening = null;
      reject(request.error);
    };
  });
  return opening;
}

function run<T>(store: "kv" | "queue", mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = work(tx.objectStore(store));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const kv = {
  get: <T>(key: string) => run<T | undefined>("kv", "readonly", (store) => store.get(key) as IDBRequest<T | undefined>),
  set: (key: string, value: unknown) => run("kv", "readwrite", (store) => store.put(value, key)),
  delete: (key: string) => run("kv", "readwrite", (store) => store.delete(key)),
};

export const queue = {
  all: <T>() => run<T[]>("queue", "readonly", (store) => store.getAll() as IDBRequest<T[]>),
  put: (value: unknown) => run("queue", "readwrite", (store) => store.put(value)),
  delete: (deviceSeq: number) => run("queue", "readwrite", (store) => store.delete(deviceSeq)),
};

/** Lost phone or sign-out: nothing of this person stays on the device. */
export async function wipeLocal() {
  const db = await open();
  db.close();
  opening = null;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(NAME);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}
