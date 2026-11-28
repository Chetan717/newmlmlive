import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { ArrowLeft, ArrowRight, CloudUpload, Film, Play, Trash2, ChevronUp, SlidersHorizontal, Check, CheckCircle2, FileVideo, Pause, AlertCircle } from "lucide-react";
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
function Preview({ file, thumbnail }) {
  const [playing, setPlaying] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <div className="ve-local-preview"><button type="button" aria-label={playing?"Close clip preview":"Preview raw clip"} disabled={!url} onClick={()=>setPlaying(!playing)}>{thumbnail?<img src={thumbnail} alt="Raw clip"/>:<Film size={21}/>}<span className="ve-play"><Play size={12} fill="currentColor"/></span></button>{playing&&url&&createPortal(<div className="ve ve-local-modal" role="dialog" aria-label="Raw video preview"><button type="button" className="ve-modal-close" onClick={()=>setPlaying(false)}>Close preview ×</button><video controls playsInline preload="metadata" src={url}/></div>, document.body)}</div>;

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
  const navigate = useNavigate();
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
  const [step, setStep] = useState(0), [selecting,setSelecting] = useState(false);
  const selectingRef = useRef(false), formRef=useRef(null);
  useEffect(()=>{formRef.current?.closest(".layout-scroll-container")?.scrollTo({top:0});},[step]);
  const [busy, setBusy] = useState(false),
    [loading, load] = useState(true),
    [msg, say] = useState(""),
    [error, err] = useState(""),
    [bytes, progress] = useState([]),
    [activeClip, setActiveClip] = useState(null);
  const control = useRef(null), inFlight = useRef(null), latest = useRef(draft), cancelling = useRef(false), submitted = useRef(false), remoteAttempted = useRef(false);
  latest.current = draft;
  const hasDraft = Boolean(draft.id || draft.files.length || busy);
  useEffect(() => {
    if (!hasDraft) return;
    const before = event => { if (!submitted.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [hasDraft]);
  useEffect(() => {
    let active = true;
    (async () => {
      const local = await restore(),
        remote = await api("currentDraft");
      if (!active) return;
      if (remote.id && remote.token !== local?.token)
        set((d) => ({ ...d, id: remote.id, unavailable: true }));
      else if (local) {
        set({ ...local, ...(remote.id ? { id: remote.id } : {}) });
        if (remote.id || local.id) setStep(2);
      }
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
    if (!list.length || selectingRef.current) return;
    selectingRef.current=true; setSelecting(true);
    err("");
    try {
      if (list.length !== 1) throw Error("Select one clip at a time.");
      if (!draft.id && list.length + draft.files.length > 5)
        throw Error("Select up to five clips.");
      if (
        list.some(
          (f) =>
            !["video/mp4", "video/quicktime", "video/webm"].includes(
              typeOf(f),
            ) ||
            f.size < 1 ||
            f.size > (draft.id ? 200000000 : 150000000),
        )
      )
        throw Error("Use MP4, MOV or WebM files up to 150 MB each.");
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
        if (!draft.files.some(old => !old.blob && files.some(f => f.size === old.size && f.sig === old.sig && f.name === old.name)))
          throw Error("Select a missing original clip from this draft.");
        const nextDraft = { ...draft, files: merged };
        set(nextDraft);
        const warning = await persist(nextDraft);
        if (warning) say(warning);
      } else set({ ...draft, files: [...draft.files, ...files] });
    } catch (e) {
      err(e.message);
    } finally {selectingRef.current=false;setSelecting(false);}
  }
  function send() {
    if (inFlight.current || cancelling.current) return;
    const work = sendInternal();
    inFlight.current = work;
    void work.finally(() => { if (inFlight.current === work) inFlight.current = null; });
    return work;
  }
  async function sendInternal() {
    if (control.current) return;
    const c = new AbortController();
    control.current = c;
    setBusy(true);
    err("");
    try {
      const request = (action, data) =>
        retry(() => api(action, data), c.signal, say);
      const d = { ...draft };
      if (!d.files.length || !d.category || !d.instructions.trim() || (d.category === "Other" && !d.other.trim()))
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
            submitted.current = true;
            await clearDraft();
            onDone(d.id);
            return;
          } catch {
            throw Error(
              "This draft has expired. Discard it and create a new request.",
            );
          }
        }
        if (remote.id !== d.id || remote.token !== d.token) throw Error("Upload draft changed. Cancel it or resume on the original device.");
        d.partSize = remote.partSize || d.partSize || 8388608;
      }
      const { files, ...fields } = d;
      remoteAttempted.current = true;
      const res = d.id ? {id:d.id, partSize:d.partSize} : await request("draft", {
        ...fields,
        thumbnail: files[0]?.thumbnail || "",
        duration: files[0]?.duration || 0,
        files: files.map(({ name, size, type }) => ({ name, size, type })),
      });
      Object.assign(d, res);
      latest.current = d;
      set(d);
      await persist(d);
      await upload(d, c.signal, progress, say, setActiveClip);
      c.signal.throwIfAborted();
      say("Submitting request…");
      await request("submit", { id: d.id });
      submitted.current = true;
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
  async function discard(afterClose) {
    if (cancelling.current || selecting || submitted.current) return;
    if (!window.confirm("Cancel this upload? All temporary clips will be deleted.")) return;
    cancelling.current = true;
    control.current?.abort();
    try {
      await inFlight.current;
      if (submitted.current) return; // submission already won the race
      setBusy(true);
      let id = latest.current.id;
      // A draft-create response can be lost when cancelling. Check the remote token before cleanup.
      if (!id && remoteAttempted.current) {
        const remote = await api("currentDraft");
        if (remote.token === latest.current.token) id = remote.id;
      }
      if (id) {
        const result = await media("discard", { id });
        if (result.submitted) { submitted.current = true; await clearDraft(); onDone(id); return; }
      }
      await clearDraft();
      onClose();
      if (typeof afterClose === "function") afterClose();
    } catch (e) {
      err("Could not confirm cleanup. Reconnect and try Cancel Upload again. " + e.message);
    } finally {
      cancelling.current = false;
      setBusy(false);
    }
  }
  function closeForm() { if (hasDraft) void discard(); else onClose(); }
  const discardRef = useRef(discard); discardRef.current = discard;
  useEffect(() => {
    if (!hasDraft) return;
    const post = active => window.ReactNativeWebView?.postMessage(JSON.stringify({type:"VIDEO_DRAFT_GUARD",active}));
    post(true);
    const nativeBack = () => { void discardRef.current(); };
    const click = event => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor || formRef.current?.contains(anchor) || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.href === window.location.href) return;
      event.preventDefault(); event.stopPropagation();
      void discardRef.current(() => navigate(url.pathname + url.search + url.hash));
    };
    const nav = event => {
      if (typeof event.detail?.path !== "string" || event.detail.path === window.location.pathname) return;
      event.preventDefault();
      void discardRef.current(() => navigate(event.detail.path));
    };
    window.addEventListener("mlmlive-video-back", nativeBack);
    window.addEventListener("mlmlive-video-navigate", nav);
    document.addEventListener("click", click, true);
    return () => { post(false); window.removeEventListener("mlmlive-video-back", nativeBack); window.removeEventListener("mlmlive-video-navigate", nav); document.removeEventListener("click", click, true); };
  }, [hasDraft, navigate]);
  const total = draft.files.reduce((n, f) => n + f.size, 0);
  const validDetails=!!(draft.category&&draft.instructions.trim()&&(draft.category!=="Other"||draft.other.trim()));
  const allLocal=draft.files.length>0&&draft.files.every(f=>f.blob);
  function next(){err("");if(step===0&&!allLocal){err("Select at least one video to continue.");return;}if(step===1&&!validDetails){err("Choose a category and describe the editing required.");return;}setStep(i=>Math.min(2,i+1));}
  function preference(text){const lines=draft.instructions.split("\n");const next=lines.includes(text)?lines.filter(l=>l!==text).join("\n"):[draft.instructions.trim(),text].filter(Boolean).join("\n");if(next.length<=5000)patch("instructions",next);else err("Editing instructions cannot exceed 5000 characters.");}
  function back(){if(selecting)return;if(step>0&&!draft.id&&!draft.unavailable&&!busy){setStep(step-1);err("");}else closeForm();}
  const canAdd = draft.id ? draft.files.some(f => !f.blob) : draft.files.length < 5;
  const input=canAdd && <label className={`ve-upload-zone ${draft.files.length ? "ve-add-clip" : ""} ${busy||selecting ? "ve-upload-disabled" : ""}`}>
    <CloudUpload size={draft.files.length ? 23 : 32}/><strong>{draft.id ? "Reselect an original clip" : draft.files.length ? "Add another clip" : "Select your first video"}</strong>
    <small>MP4, MOV, WebM · Max 150 MB each for new requests</small><input type="file" disabled={busy||selecting} accept="video/mp4,video/quicktime,video/webm,.mov" onChange={e=>{select(Array.from(e.target.files||[]));e.target.value="";}}/>
  </label>;
  const clipList=<div className="ve-upload-list">{draft.files.map((f,i)=>{
    const complete=bytes[i]===f.size, active=busy&&activeClip===i, loaded=bytes[i]||0;
    return <div className="ve-upload-row" key={`${i}-${f.name}`}><div className="ve-upload-file">
      <Preview file={f.blob} thumbnail={f.thumbnail}/><div className="ve-upload-copy"><strong>{f.name}</strong><small>{(f.size/1e6).toFixed(1)} MB{f.duration?` · ${Math.round(f.duration)} sec`:""}</small><small className={complete?"ve-clip-done":"ve-clip-state"}>{complete?"Uploaded":active?"Uploading…":busy?"Waiting in queue":draft.id&&!f.blob?"Original may be needed to resume":draft.id?"Ready to resume":"Ready to upload"}</small></div>
      {complete&&<CheckCircle2 className="ve-clip-done" size={20}/>} 
      {!draft.id&&!busy&&!selecting&&<div className="ve-upload-actions"><button type="button" aria-label="Move clip up" disabled={!i} onClick={()=>{const fs=[...draft.files];[fs[i-1],fs[i]]=[fs[i],fs[i-1]];patch("files",fs);}}><ChevronUp size={17}/></button><button type="button" aria-label="Remove clip" onClick={()=>patch("files",draft.files.filter((_,n)=>n!==i))}><Trash2 size={17}/></button></div>}
      </div>{(active||complete||loaded>0)&&<progress className="ve-clip-progress" aria-label={`Upload progress for clip ${i+1}`} {...(active&&loaded===0?{}:{value:loaded})} max={f.size}/>}</div>;
  })}</div>;
  return <section className="ve-form" ref={formRef}>
    <header className="ve-topbar"><button aria-label="Go back" disabled={selecting||cancelling.current} onClick={back}><ArrowLeft size={21}/></button><strong>New Video Request</strong><button aria-label="Close form" disabled={selecting||cancelling.current} onClick={closeForm}>×</button></header>
    <div className="ve-form-body">
      <nav className="ve-form-steps" aria-label="Request steps">{["Upload","Details","Submit"].map((name,i)=><div key={name} className={i<=step?"active":""} aria-current={i===step?"step":undefined}><span>{i<step?<Check size={17}/>:i+1}</span><strong>{name}</strong></div>)}</nav>
      {loading?<div className="ve-empty" role="status">Checking for a saved upload…</div>:draft.unavailable?<article className="ve-panel"><h3><AlertCircle size={20}/> Existing upload draft</h3><p>An upload draft exists on another device. Resume there or discard it here.</p></article>:<>
        {(step===0||step===2)&&<article className="ve-panel ve-upload-panel"><div className="ve-upload-heading"><h3><CloudUpload size={20}/> {step===0?"Add your videos":"Your Raw Videos"}</h3><span>{draft.files.length} / 5 clips</span></div>
          {clipList}{(step===0||draft.id)&&!busy&&input}
          {step===0&&draft.files.length===5&&<small className="ve-clip-limit">Maximum 5 clips selected.</small>}
          {selecting&&<p className="ve-upload-feedback" role="status">Preparing your clip…</p>}
          {!busy&&step===0&&<p className="ve-upload-feedback">Add clips one at a time. They upload in order when you submit your request.</p>}
          {busy&&<p className="ve-upload-feedback" role="status">{activeClip===null?(draft.files.length>0&&draft.files.every((f,i)=>bytes[i]===f.size)?"Submitting your request…":"Preparing request…"):`Clip ${activeClip+1} of ${draft.files.length}`}</p>}
        </article>}
        {step===1&&<><article className="ve-panel ve-fields"><h3><FileVideo size={20}/> Video Details</h3><fieldset disabled={busy||!!draft.id}><label><span>Category <em>*</em></span><select value={draft.category} onChange={e=>patch("category",e.target.value)}><option value="">Select Category</option>{info.categories.map(c=><option key={c}>{c}</option>)}</select></label>{draft.category==="Other"&&<label><span>Custom category <em>*</em></span><input maxLength={100} value={draft.other} onChange={e=>patch("other",e.target.value)} placeholder="Enter video category"/></label>}<label><span>Editing Instructions <em>*</em></span><textarea maxLength={5000} value={draft.instructions} placeholder="Tell us what changes you want (e.g. add text, music, transitions, background, etc.)" onChange={e=>patch("instructions",e.target.value)}/></label></fieldset></article><details className="ve-panel ve-options" open><summary><SlidersHorizontal size={20}/> Additional Options</summary><p>Include these preferences in your editing instructions.</p>{["Add subtitles / captions","Change video background (if applicable)"].map(text=><label key={text}><input type="checkbox" disabled={busy||!!draft.id} checked={draft.instructions.split("\n").includes(text)} onChange={()=>preference(text)}/>{text}</label>)}</details></>}
        {step===2&&<article className="ve-panel ve-submit-summary"><h3><CheckCircle2 size={20}/> Review your request</h3><dl className="ve-info"><dt>Customer</dt><dd>{info.name}</dd><dt>Category</dt><dd>{draft.category} {draft.other}</dd><dt>Raw videos</dt><dd>{draft.files.length} · {(total/1e6).toFixed(1)} MB</dd><dt>Instructions</dt><dd className="note">{draft.instructions}</dd><dt>Credit</dt><dd>1 video credit</dd></dl><p className="ve-credit-note">Your credit is reserved at submission and consumed when you approve the final video.</p></article>}
        {step<2?<button className="primary ve-full ve-continue" disabled={selecting||busy} onClick={next}>Continue <ArrowRight size={20}/></button>:busy?<button className="ve-outline ve-full" onClick={()=>control.current?.abort()}><Pause size={18}/> Pause upload</button>:<button className="primary ve-full ve-continue" disabled={selecting||!validDetails||(!draft.id&&!allLocal)} onClick={send}><CloudUpload size={20}/> {draft.id?"Resume and submit":"Upload and submit"}</button>}
      </>}
      {hasDraft&&<button className="ve-danger ve-full" disabled={selecting||cancelling.current} onClick={discard}>Cancel Upload</button>}
      {msg&&<p className="ve-message" role="status">{msg}</p>}{error&&<p className="error" role="alert">{error}</p>}
    </div>
  </section>;
}
