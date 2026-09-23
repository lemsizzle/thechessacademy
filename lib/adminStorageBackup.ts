// Separate from localStorage's small quota. Never overwrite the original archive.
export async function archiveAdminStorage(saved: string | null, current: string) {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("chessquest-admin-recovery", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("backups");
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Close other Chess Quest tabs to finish the backup."));
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("backups", "readwrite");
      const store = tx.objectStore("backups");
      const original = store.get("original-v1");
      original.onsuccess = () => {
        if (!original.result) store.put({ saved, current, createdAt: new Date().toISOString() }, "original-v1");
        store.put({ saved, current, createdAt: new Date().toISOString() }, "latest-recovery");
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error ?? new Error("Backup cancelled.")); };
    };
  });
}

export async function readAdminStorageArchive(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("chessquest-admin-recovery", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("backups");
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Backup storage is busy."));
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("backups", "readonly");
      const result = tx.objectStore("backups").get("original-v1");
      result.onsuccess = () => resolve(result.result ?? null);
      result.onerror = () => reject(result.error);
      tx.oncomplete = () => db.close();
    };
  });
}
