import { progressBytes } from "./uploadProgress.js";
import { httpsCallable, getFunctions } from "firebase/functions";
import { app, auth } from "../../Firebase";
const region = getFunctions(app, "asia-south1");
export const api = async (action, data = {}) =>
  (await httpsCallable(region, "videoEditing")({ ...data, action })).data;
export const media = async (action, data = {}) =>
  (await httpsCallable(region, "videoEditingMedia")({ ...data, action })).data;
const options = import.meta.env || {};
const parallelFiles = Math.max(
  1,
  Math.min(3, Math.trunc(Number(options.VITE_VIDEO_UPLOAD_CONCURRENCY) || 1)),
);
const maxAttempts = Math.max(
  1,
  Math.min(10, Math.trunc(Number(options.VITE_VIDEO_UPLOAD_ATTEMPTS) || 5)),
);
const storeKey = () => {
  if (!auth.currentUser) throw Error("Sign in again.");
  return "video-draft:" + auth.currentUser.uid;
};
function database() {
  return new Promise((resolve, reject) => {
    const q = indexedDB.open("mlmlive-video-drafts", 1);
    q.onupgradeneeded = () => q.result.createObjectStore("drafts");
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
}
async function record(action, value) {
  const key = storeKey(),
    db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(
          "drafts",
          action === "get" ? "readonly" : "readwrite",
        ),
        s = tx.objectStore("drafts");
      const q =
        action === "put"
          ? s.put(value, key)
          : action === "delete"
            ? s.delete(key)
            : s.get(key);
      tx.oncomplete = () => resolve(q.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function signature(file) {
  const digests = [];
  const hashChunkBytes = 8_388_608;
  for (let offset = 0; offset < file.size; offset += hashChunkBytes) {
    const chunk = await file
      .slice(offset, offset + hashChunkBytes)
      .arrayBuffer();
    digests.push(await crypto.subtle.digest("SHA-256", chunk));
  }
  const hash = await crypto.subtle.digest(
    "SHA-256",
    await new Blob(digests).arrayBuffer(),
  );
  return Array.from(new Uint8Array(hash), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
export async function persist(draft) {
  let saved = false;
  try {
    localStorage.setItem(
      storeKey(),
      JSON.stringify({
        ...draft,
        files: draft.files.map(({ blob, ...f }) => f),
      }),
    );
    saved = true;
  } catch {
    /* Private browsing may disable storage. */
  }
  try {
    await record("put", draft);
    return "";
  } catch {
    return saved
      ? "This device may ask you to select the original files after restart."
      : "This browser can resume uploads during this session only.";
  }
}
export async function restore() {
  let meta;
  try {
    meta = JSON.parse(localStorage.getItem(storeKey()) || "null");
  } catch {
    /* Optional storage. */
  }
  const full = await record("get").catch(() => null);
  if (full && (!meta || full.token === meta.token))
    return { ...full, ...meta, files: full.files };
  return meta;
}
export async function clearDraft() {
  try {
    localStorage.removeItem(storeKey());
  } catch {
    /* Optional storage. */
  }
  await record("delete").catch(() => {});
}
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    function done() {
      signal.removeEventListener("abort", abort);
      resolve();
    }
    function abort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
async function connected(signal, onState) {
  if (!navigator.onLine) onState("Offline · resuming when connected");
  while (!navigator.onLine) await wait(500, signal);
  signal.throwIfAborted();
}
function put(url, blob, signal, onProgress) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const x = new XMLHttpRequest(),
      abort = () => x.abort();
    x.open("PUT", url);
    x.timeout = 180000;
    x.upload.onprogress = (e) => onProgress(e.loaded);
    x.onload = () =>
      x.status >= 200 && x.status < 300
        ? resolve()
        : reject(Error("Upload authorization or connection expired."));
    x.onerror = x.ontimeout = () => reject(Error("Upload interrupted."));
    x.onabort = () => reject(signal.reason || Error("Upload interrupted."));
    x.onloadend = () => {
      signal.removeEventListener("abort", abort);
      window.removeEventListener("offline", abort);
    };
    signal.addEventListener("abort", abort, { once: true });
    window.addEventListener("offline", abort, { once: true });
    x.send(blob);
  });
}
export async function retry(task, signal, state) {
  for (let attempt = 0; ;) {
    await connected(signal, state);
    try {
      return await task();
    } catch (e) {
      signal.throwIfAborted();
      if (!navigator.onLine) continue;
      if (
        [
          "functions/failed-precondition",
          "functions/permission-denied",
          "functions/invalid-argument",
          "functions/unauthenticated",
        ].includes(e.code) ||
        ++attempt >= maxAttempts
      )
        throw e;
      state("Retrying upload…");
      await wait(Math.min(8000, 500 * 2 ** attempt), signal);
    }
  }
}
export async function upload(draft, parentSignal, progress, state) {
  const child = new AbortController(),
    signal = child.signal;
  const stop = () => child.abort(parentSignal.reason);
  parentSignal.throwIfAborted();
  parentSignal.addEventListener("abort", stop, { once: true });
  const id = draft.id,
    partSize = draft.partSize;
  const loaded = draft.files.map(() => 0);
  const show = (i, n) => {
    loaded[i] = n;
    progress([...loaded]);
  };
  async function one(index) {
    const f = draft.files[index];
    const params = { id, index };
    const session = await retry(() => media("resume", params), signal, state);
    if (session.ready) {
      show(index, f.size);
      return;
    }
    const done = new Set(session.parts),
      count = Math.ceil(f.size / partSize);
    let bytes = 0;
    for (let n = 1; n <= count; n++)
      if (done.has(n)) bytes += Math.min(partSize, f.size - (n - 1) * partSize);
    show(index, progressBytes(bytes, 0, f.size));
    for (let part = 1; part <= count; part++) {
      if (done.has(part)) continue;
      if (!f.blob)
        throw Error("Select the original videos to resume this draft.");
      const chunk = f.blob.slice((part - 1) * partSize, part * partSize);
      await retry(
        async () => {
          const { url } = await media("part", { ...params, part });
          state("Uploading clip " + (index + 1) + " of " + draft.files.length);
          show(index, progressBytes(bytes, 0, f.size));
          await put(url, chunk, signal, (n) => show(index, progressBytes(bytes, n, f.size)));
        },
        signal,
        state,
      );
      bytes += chunk.size;
      show(index, progressBytes(bytes, 0, f.size));
    }
    state("Finalizing clip " + (index + 1));
    await retry(() => media("finish", params), signal, state);
    show(index, f.size);
  }
  const queue = draft.files.keys();
  const jobs = Array.from(
    { length: Math.min(parallelFiles, draft.files.length) },
    async () => {
      try {
        for (const index of queue) {
          signal.throwIfAborted();
          await one(index);
        }
      } catch (e) {
        if (!signal.aborted) child.abort(e);
        throw e;
      }
    },
  );
  try {
    const results = await Promise.allSettled(jobs);
    if (results.some((r) => r.status === "rejected")) throw signal.reason;
  } finally {
    parentSignal.removeEventListener("abort", stop);
  }
}
