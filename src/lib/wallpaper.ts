const DATABASE = "aetheros-media";
const STORE = "wallpapers";
const KEY = "desktop";
export const wallpaperImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
];
export const maxWallpaperBytes = 20 * 1024 * 1024;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(new Error("Image storage is unavailable."));
    request.onblocked = () => {
      blocked = true;
      reject(
        new Error(
          "Image storage is busy. Close other AetherOS tabs and try again.",
        ),
      );
    };
  });
}

/** Keep image bytes in IndexedDB rather than filling the workspace's localStorage. */
export async function readWallpaperImage(): Promise<Blob | undefined> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(KEY);
      request.onsuccess = () =>
        resolve(request.result instanceof Blob ? request.result : undefined);
      request.onerror = () =>
        reject(new Error("The wallpaper could not be loaded."));
    });
  } finally {
    db.close();
  }
}

export async function saveWallpaperImage(file: File): Promise<void> {
  if (!wallpaperImageTypes.includes(file.type))
    throw new Error("Choose a JPEG, PNG, WebP, AVIF or GIF image.");
  if (file.size > maxWallpaperBytes)
    throw new Error("Choose an image smaller than 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
  } catch {
    throw new Error("This file could not be opened as an image.");
  } finally {
    URL.revokeObjectURL(url);
  }
  await writeImage(file);
}

export async function removeWallpaperImage(): Promise<void> {
  await writeImage(null);
}

async function writeImage(image: Blob | null): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      if (image) store.put(image, KEY);
      else store.delete(KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(
          new Error(
            "The wallpaper could not be saved. Check available browser storage.",
          ),
        );
      transaction.onabort = () =>
        reject(new Error("The wallpaper could not be saved."));
    });
  } finally {
    db.close();
  }
}
