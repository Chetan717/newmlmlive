import { useEffect, useRef, useState } from "react";
import {
  api,
  media,
  restore,
  persist,
  signature,
  retry,
  upload,
  clearDraft,
} from "./uploads";
import { getMlmProfileFromStorage } from "../../utils/companyStorage";
// Read a tiny local frame only; no video downloads or remote player preload.
function previewInfo(file) {
  return new Promise(resolve => {
    const v = document.createElement("video"), url = URL.createObjectURL(file);
    let finished = false, duration = 0;
    const done = (thumbnail = "") => {
      if(finished) return; finished = true; clearTimeout(timer);
      v.onloadeddata = v.onloadedmetadata = v.onseeked = v.onerror = null;
      v.removeAttribute("src"); v.load(); URL.revokeObjectURL(url);
      resolve({thumbnail, duration});
    };
    const timer = setTimeout(() => done(), 2500);
    const capture = () => {
      try {
        if(!v.videoWidth || !v.videoHeight) return done();
        const canvas=document.createElement("canvas"); canvas.width=160;canvas.height=Math.max(1,Math.round(160*v.videoHeight/v.videoWidth));
        if(canvas.height>240) {canvas.height=240;canvas.width=Math.max(1,Math.round(240*v.videoWidth/v.videoHeight));}
        canvas.getContext("2d").drawImage(v,0,0,canvas.width,canvas.height);
        const image=canvas.toDataURL("image/jpeg",.55);done(image.length<=12000?image:"");
      } catch {done();}
    };
    v.muted=true;v.playsInline=true;v.preload="auto";
    v.onloadedmetadata=()=>{duration=Number.isFinite(v.duration)?Math.round(v.duration):0;};
    v.onloadeddata=capture;v.onerror=()=>done();v.src=url;
  });
}
function Preview({ file, thumbnail, length }) {
  const [playing, setPlaying] = useState(false);
  const [url, setUrl] = useState(""),
    [duration, setDuration] = useState(0);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return url ? (
    <div className="ve-local-preview">
      {thumbnail && <img src={thumbnail} alt="Raw clip preview" width="72" height="48"/>}
      <button type="button" onClick={() => setPlaying(!playing)}>{playing ? "Close preview" : "▶ Preview"}</button>
      {playing && <video
        controls
        preload="metadata"
        src={url}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
      />}
      {(duration > 0 || length > 0) && (
        <small> {Math.round(duration || length)} sec</small>
      )}
    </div>
  ) : thumbnail ? <div className="ve-local-preview"><img src={thumbnail} alt="Raw clip preview" width="72" height="48"/><small>Select the original clip to preview again.</small></div> : null;
}
function typeOf(f) {
  return (
    f.type ||
    { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm" }[
      f.name.split(".").pop().toLowerCase()
    ]
  );
}
export default function NewRequest({ info, onDone, onClose }) {
  const profile = getMlmProfileFromStorage() || {};
  const [draft, set] = useState({
    token: crypto.randomUUID(),
    category: "",
    instructions: "",
    other: "",
    company: profile.companyName || "",
    state: profile.state || "",
    files: [],
  });
  const [busy, setBusy] = useState(false),
    [loading, load] = useState(true),
    [msg, say] = useState(""),
    [error, err] = useState(""),
    [bytes, progress] = useState([]);
  const control = useRef(null);
  useEffect(() => {
    let active = true;
    (async () => {
      const local = await restore(),
        remote = await api("currentDraft");
      if (!active) return;
      if (remote.id && remote.token !== local?.token)
        set((d) => ({ ...d, id: remote.id, unavailable: true }));
      else if (local)
        set({ ...local, ...(remote.id ? { id: remote.id } : {}) });
    })()
      .catch((e) => active && err(e.message))
      .finally(() => active && load(false));
    return () => {
      active = false;
      control.current?.abort();
    };
  }, []);
  const patch = (k, v) => set((d) => ({ ...d, [k]: v }));
  async function select(list) {
    err("");
    try {
      if (!list.length) return;
      if (!draft.id && list.length + draft.files.length > 5)
        throw Error("Select up to five clips.");
      if (
        list.some(
          (f) =>
            !["video/mp4", "video/quicktime", "video/webm"].includes(
              typeOf(f),
            ) ||
            f.size < 1 ||
            f.size > 200000000,
        )
      )
        throw Error("Use MP4, MOV or WebM files up to 200 MB each.");
      const files = await Promise.all(
        list.map(async (f) => ({
          name: f.name,
          size: f.size,
          type: typeOf(f),
          sig: await signature(f),
          blob: f,
          ...await previewInfo(f),
        })),
      );
      if (draft.id) {
        const merged = draft.files.map((old) => ({
          ...old,
          blob:
            old.blob ||
            files.find(
              (f) =>
                f.size === old.size && f.sig === old.sig && f.name === old.name,
            )?.blob,
        }));
        set({ ...draft, files: merged });
      } else set({ ...draft, files: [...draft.files, ...files] });
    } catch (e) {
      err(e.message);
    }
  }
  async function send() {
    if (control.current) return;
    const c = new AbortController();
    control.current = c;
    setBusy(true);
    err("");
    try {
      const request = (action, data) =>
        retry(() => api(action, data), c.signal, say);
      const d = { ...draft };
      if (!d.files.length || !d.category || !d.instructions.trim())
        throw Error(
          "Choose a category, add instructions and select your clips.",
        );
      const warning = await persist(d);
      if (warning) say(warning);
      if (d.id) {
        const remote = await request("currentDraft");
        if (!remote.id) {
          try {
            await api("details", { id: d.id });
            await clearDraft();
            onDone(d.id);
            return;
          } catch {
            throw Error(
              "This draft has expired. Discard it and create a new request.",
            );
          }
        }
      }
      const { files, ...fields } = d;
      const res = await request("draft", {
        ...fields,
        thumbnail: files[0]?.thumbnail || "",
        duration: files[0]?.duration || 0,
        files: files.map(({ name, size, type }) => ({ name, size, type })),
      });
      Object.assign(d, res);
      set(d);
      await persist(d);
      await upload(d, c.signal, progress, say);
      c.signal.throwIfAborted();
      say("Submitting request…");
      await request("submit", { id: d.id });
      await clearDraft();
      onDone(d.id);
    } catch (e) {
      if (c.signal.aborted)
        say("Paused. Resume to continue from the last uploaded part.");
      else err(e.message);
    } finally {
      control.current = null;
      setBusy(false);
    }
  }
  async function discard() {
    if (
      !window.confirm(
        "Discard this upload draft and remove its temporary clips?",
      )
    )
      return;
    setBusy(true);
    try {
      if (draft.id) await media("discard", { id: draft.id });
      await clearDraft();
      onClose();
    } catch (e) {
      err(e.message);
    } finally {
      setBusy(false);
    }
  }
  const total = draft.files.reduce((n, f) => n + f.size, 0),
    uploaded = bytes.reduce((a, b) => a + b, 0);
  return (
    <section>
      <header>
        <h2>New video request</h2>
        <button disabled={busy} onClick={onClose}>
          Close
        </button>
      </header>
      {loading ? (
        <p>Checking for a saved upload…</p>
      ) : (
        <>
          <p>
            {info.name} · {info.mobile}
            {draft.company && " · " + draft.company}
          </p>
          {draft.unavailable ? (
            <p>
              An upload draft exists on another device. Resume there or discard
              it here.
            </p>
          ) : (
            <>
              <fieldset disabled={busy || !!draft.id}>
                <label>
                  Video category *{" "}
                  <select
                    value={draft.category}
                    onChange={(e) => patch("category", e.target.value)}
                  >
                    <option value="">Choose a category</option>
                    {info.categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                {draft.category === "Other" && (
                  <label>
                    Custom category{" "}
                    <input
                      maxLength={100}
                      value={draft.other}
                      onChange={(e) => patch("other", e.target.value)}
                    />
                  </label>
                )}
                <label>
                  Editing instructions *
                  <textarea
                    maxLength={5000}
                    value={draft.instructions}
                    placeholder="Describe the length, clip order, music, captions and important scenes."
                    onChange={(e) => patch("instructions", e.target.value)}
                  />
                </label>
              </fieldset>
              <label>
                Select videos{" "}
                <input
                  type="file"
                  multiple
                  disabled={busy}
                  accept="video/mp4,video/quicktime,video/webm,.mov"
                  onChange={(e) => {
                    select([...e.target.files]);
                    e.target.value = "";
                  }}
                />
              </label>
              <small>
                1–5 clips · 200 MB per clip · 1 credit for the approved video
              </small>
              {draft.files.map((f, i) => (
                <article key={i} className="ve-upload-row">
                  <Preview file={f.blob} thumbnail={f.thumbnail} length={f.duration} />
                  <p>
                    {i + 1}. {f.name} · {(f.size / 1e6).toFixed(1)} MB
                  </p>
                  {(busy || draft.id || bytes[i] > 0) && <div className="ve-progress"><small>{Math.floor(100 * (bytes[i] || 0) / f.size)}% · {bytes[i] === f.size ? "Uploaded" : busy ? "Uploading / finalizing" : "Ready to resume"}</small><progress value={bytes[i] || 0} max={f.size} /></div>}
                  {!draft.id && !busy && (
                    <div className="actions">
                      <button
                        disabled={!i}
                        onClick={() => {
                          const fs = [...draft.files];
                          [fs[i - 1], fs[i]] = [fs[i], fs[i - 1]];
                          patch("files", fs);
                        }}
                      >
                        Move up
                      </button>
                      <button
                        onClick={() =>
                          patch(
                            "files",
                            draft.files.filter((_, n) => n !== i),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </article>
              ))}
              {draft.files.length > 1 && total > 0 && (busy || draft.id) && (
                <label>
                  Overall progress · {Math.floor((uploaded / total) * 100)}%
                  <progress value={uploaded} max={total} />
                </label>
              )}
              <div className="actions">
                {busy ? (
                  <button onClick={() => control.current?.abort()}>
                    Pause
                  </button>
                ) : (
                  <button className="primary" onClick={send}>
                    {draft.id ? "Resume and submit" : "Upload and submit"}
                  </button>
                )}
              </div>
            </>
          )}
          {draft.id && (
            <button disabled={busy} onClick={discard}>
              Discard draft
            </button>
          )}
        </>
      )}
      <p role="status">{msg}</p>
      <p className="error" role="alert">
        {error}
      </p>
    </section>
  );
}
