import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Film, Play, MessageCircle, Plus, ChevronRight, RefreshCw, Check, Clock, Download, RotateCw, Clapperboard, Coins, SlidersHorizontal, CloudUpload, Sparkles, CircleHelp, ArrowRight, Scissors, CheckCircle2, Layers } from "lucide-react";
import { Link } from "react-router";
import { api } from "./uploads";
import NewRequest from "./NewRequest";
import "./Video.css";
function drivePreview(link) {
  let u;
  try { u = new URL(link); } catch { return undefined; }
  if (u.origin !== "https://drive.google.com" || !/^\/file\/d\/[\w-]+\/view$/.test(u.pathname)) return undefined;
  u.pathname = u.pathname.replace(/\/view$/, "/preview");
  return u.href;
}
const fmt = (t) => t ? new Date(t).toLocaleString() : "";
const date = (t) => t ? new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
const duration = (n) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
const labels = {"Under Review":"For review", "Correction Requested":"Revision", Completed:"Completed", Editing:"In progress", Downloaded:"In progress"};
function Status({value}) { return <b className="ve-status" data-status={value}>{value === "Completed" ? <Check size={13}/> : value === "Correction Requested" ? <RotateCw size={12}/> : <Clock size={12}/>} {labels[value] || value}</b>; }
function Support({ info, id }) {
  const text = `Hello MLMLive Video Editing Team, I am ${info.name}. I need help with my video editing ${id ? "request " + id : "service"}.`;
  return info.support ? <a className="ve-support" target="_blank" rel="noreferrer" href={"https://wa.me/" + info.support + "?text=" + encodeURIComponent(text)}><span className="ve-support-icon"><MessageCircle size={25}/></span><span><strong>Need Help?</strong><small>Contact our support on WhatsApp</small></span><ChevronRight size={20}/></a> : <div className="ve-support"><CircleHelp size={22}/><span><strong>Need Help?</strong><small>WhatsApp support number is pending setup.</small></span></div>;
}
function Thumb({row, large=false, onPlay}) {
  const body = <>{row.thumbnail ? <img src={row.thumbnail} alt="Original clip thumbnail" loading="lazy"/> : <Film size={large?48:26}/>} {onPlay && <span className="ve-play"><Play fill="currentColor" size={large?28:14}/></span>}{row.duration>0 && <small className="ve-duration">{duration(row.duration)}</small>}</>;
  return onPlay ? <button type="button" className={`ve-thumb ${large?"ve-thumb-large":""}`} onClick={onPlay} aria-label="Play edited video">{body}</button> : <span className={`ve-thumb ${large?"ve-thumb-large":""}`}>{body}</span>;
}
function HeroArt(){return <div className="ve-hero-art" aria-hidden="true"><div className="ve-art-glow"/><Clapperboard className="ve-art-board" strokeWidth={1.6}/><Scissors className="ve-art-scissors" strokeWidth={1.8}/><Sparkles className="ve-art-spark"/></div>}
const stages = [["Request Received",["Submitted"]],["In Editing",["Downloaded","Editing"]],["For Review",["Under Review","Correction Requested"]],["Completed & Delivered",["Completed"]]];
const stageIndex = {Submitted:0,Assigned:0,Downloaded:1,Editing:1,"Under Review":2,"Correction Requested":2,Completed:3};
function Timeline({row,history}) {
  const active=stageIndex[row.status] ?? -1;
  if(active<0) return <article className="ve-panel"><h3>Request Progress</h3><p>This request is {row.status.toLowerCase()}.</p></article>;
  return <article className="ve-panel ve-progress-panel"><h3>Request Progress</h3><div className="ve-timeline">{stages.map(([label,statuses],i)=>{const reached=i<=active;const time=i===0?row.created:history.filter(h=>statuses.includes(h.status)&&h.time).map(h=>h.time).sort((a,b)=>b-a)[0];return <div key={label} className={reached?"done":""} aria-current={i===active?"step":undefined}><span className="ve-step-dot">{reached?<Check size={15}/>:i+1}</span><div><strong>{label}</strong><small>{reached&&time?fmt(time):i===active?"Current step":reached?"Done":"Pending"}</small></div></div>})}</div></article>;
}
export default function VideoService() {
  const [info, setInfo] = useState(null),
    [rows, setRows] = useState([]),
    [cursor, page] = useState(null),
    [status, filter] = useState("");
  const [detail, setDetail] = useState(null),
    [form, newForm] = useState(false),
    [playing, setPlaying] = useState(false),
    [detailTab, setDetailTab] = useState("Details"),
    [note, setNote] = useState(""),
    [err, error] = useState(""),
    [busy, loading] = useState(false);
  const running = useRef(false), pull = useRef(null);
  async function work(fn) {
    if (running.current) return;
    running.current = true;
    loading(true);
    error("");
    try {
      await fn();
    } catch (e) {
      error(e.message);
    } finally {
      running.current = false;
      loading(false);
    }
  }
  async function list(value = status, more = false) {
    const result = await api("list", {
      ...(value ? { filter: "status", value } : {}),
      size: 10,
      cursor: more ? cursor : null,
    });
    setRows((r) => (more ? [...new Map([...r, ...result.rows].map(x => [x.id, x])).values()] : result.rows));
    page(result.cursor);
  }
  async function refresh() {
    await Promise.all([api("dashboard").then(setInfo), list()]);
  }
  useEffect(() => {
    work(refresh);
  }, []);
  async function open(id, play = false, preserve = false) {
    if (!preserve) { setPlaying(play); setDetailTab(play ? "Videos" : "Details"); }
    setDetail(await api("details", { id }));
    setNote("");
  }
  function download(id) {
    if (running.current) return;
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    return work(async()=>{
      try {
        const data = await api("details", { id });
        if (data.row.status !== "Completed" || !data.row.link) throw Error("Final video is not available yet.");
        if (!drivePreview(data.row.link)) throw Error("Invalid video link.");
        if (tab) tab.location.replace(data.row.link);
        else {setDetail(data);setDetailTab("Videos");setPlaying(false);}
      } catch(e) {tab?.close();throw e;}
    });
  }
  async function command(action, extras = {}) {
    const r = detail.row;
    await api(action, {
      id: r.id,
      version: r.version,
      op: crypto.randomUUID(),
      ...extras,
    });
    await Promise.all([open(r.id, false, true), refresh()]);
  }
  const r = detail?.row, b = info?.balance;
  const playable = !!(r?.link && ["Completed","Under Review"].includes(r.status) && drivePreview(r.link));
  const scrollRef=useRef(null);
  useEffect(()=>{scrollRef.current?.closest(".layout-scroll-container")?.scrollTo({top:0});},[form,r?.id]);
  const refreshCurrent=()=>work(async()=>{await refresh();if(r)await open(r.id,false,true);});
  return <main className={`ve ${r?"ve-detail-screen":form?"ve-form-screen":"ve-home-screen"}`} ref={scrollRef} onTouchStart={e=>{const scroller=scrollRef.current?.closest(".layout-scroll-container");pull.current=!form&&!busy&&(!scroller||scroller.scrollTop<=0)?e.touches[0].clientY:null;}} onTouchEnd={e=>{if(pull.current!==null&&e.changedTouches[0].clientY-pull.current>90)refreshCurrent();pull.current=null;}} onTouchCancel={()=>{pull.current=null;}}>
    {!form && <header className="ve-topbar">
      {r ? <button aria-label="Back to requests" onClick={()=>{setDetail(null);setPlaying(false);}}><ArrowLeft size={21}/></button> : <Link to="/" aria-label="Back to home" className="ve-back"><ArrowLeft size={21}/></Link>}
      <strong>{r?"Request Details":<><span className="ve-brand-icon"><Play size={17} fill="currentColor"/></span> MLM LIVE</>}</strong>
      <button disabled={busy} aria-label="Refresh requests" onClick={refreshCurrent}><RefreshCw size={19}/></button>
    </header>}
    {err && <p role="alert" className="error">{err} <button disabled={busy} onClick={refreshCurrent}>Retry</button></p>}
    {!info && !err && <div className="ve-empty" role="status">Loading video service…</div>}
    {info && (form ? <NewRequest info={info} onClose={()=>newForm(false)} onDone={id=>{newForm(false);work(async()=>{await refresh();await open(id);});}}/> : r ? <div className="ve-detail-body">
      <article className="ve-panel ve-detail-hero">
        {playing && playable ? <div className="ve-player"><iframe title="Edited video preview" src={drivePreview(r.link)} allow="autoplay; fullscreen" allowFullScreen/><button onClick={()=>setPlaying(false)}>Close preview</button></div> : <Thumb row={r} large onPlay={playable?()=>setPlaying(true):undefined}/>}
        {r.thumbnail && !playing && <small className="ve-preview-caption">Original clip thumbnail{playable?" · Tap to play edited video":""}</small>}
        <div className="ve-detail-heading"><div><h2>#{r.id}</h2><p>{r.category}{r.other?" · "+r.other:""}</p></div><Status value={r.status}/></div>
        <nav className="ve-detail-tabs" aria-label="Request details sections">{[["Details","Overview"],["Videos","Files"],["Corrections","Revisions"],["Activity","History"]].map(([key,label])=><button type="button" aria-pressed={detailTab===key} className={detailTab===key?"primary":""} key={key} onClick={()=>setDetailTab(key)}>{label}</button>)}</nav>
      </article>
      {detailTab==="Details" && <Timeline row={r} history={detail.history}/>}
      {["Details","Videos"].includes(detailTab) && playable && <>
        <div className={`ve-ready ${r.status==="Completed"?"":"ve-review-ready"}`}><CheckCircle2 size={24}/><strong>{r.status==="Completed"?"Your edited video is ready!":"Your video is ready for review!"}</strong></div>
        <article className="ve-panel ve-final"><h3>{r.status==="Completed"?"Final Video":"Review Video"}</h3><div className="ve-final-file"><button aria-label="Play edited video" className="ve-file-play" onClick={()=>{setPlaying(true);scrollRef.current?.closest(".layout-scroll-container")?.scrollTo({top:0,behavior:"smooth"});}}><Play fill="currentColor" size={20}/></button><div><strong>{r.status==="Completed"?"Edited video":"Edited video · v"+r.version}</strong><small>Google Drive · Video preview</small></div><a className="ve-download" href={r.link} target="_blank" rel="noreferrer" aria-label={r.status==="Completed"?"Download in Google Drive":"Open review in Google Drive"}><Download size={22}/></a></div><small>{r.status==="Completed"?"Open the video in Drive to download your final file.":"Watch your video before approving or requesting changes."}</small></article>
      </>}
      {["Details","Videos","Corrections"].includes(detailTab) && r.status==="Under Review" && <article className="ve-panel ve-review-actions"><h3>Review your video</h3><p>Happy with the edit? Approve to complete delivery. Need changes? Request a free revision.</p>{r.reviewedVersion!==r.version?<button className="primary ve-full" disabled={busy} onClick={()=>work(()=>command("reviewed"))}><Check size={17}/> I have reviewed this version</button>:<><label>Describe the corrections required<textarea maxLength={4000} disabled={r.rounds>=r.maxRounds} value={note} placeholder="Tell us what needs changing…" onChange={e=>setNote(e.target.value)}/></label><button className="ve-outline ve-full" disabled={busy||r.rounds>=r.maxRounds||!note.trim()} onClick={()=>work(()=>command("correct",{note}))}><RotateCw size={18}/> Request Revision</button><button className="primary ve-full" disabled={busy} onClick={()=>{if(window.confirm("Are you satisfied with your edited video? Approving this video will complete your request and consume 1 video editing credit."))work(()=>command("approve",{confirmed:true}));}}><CheckCircle2 size={18}/> Approve final video</button></>}</article>}
      {["Details","Corrections"].includes(detailTab) && <article className="ve-panel ve-corrections"><h3><RotateCw size={18}/> Revision rounds <span>{r.rounds} / {r.maxRounds}</span></h3><p>{Math.max(0,r.maxRounds-r.rounds)} free revisions remaining · No extra credit</p>{r.status==="Completed"&&<small>Final video approved. Revisions are available during review only.</small>}{r.remarks&&<p>Editor remarks · {r.remarks}</p>}{detailTab==="Corrections"&&detail.history.filter(h=>h.correction).map((h,i)=><p key={i}>{fmt(h.time)} · {h.correction}</p>)}{detailTab==="Corrections"&&detail.cursor&&<small>Older revision history is available in History.</small>}</article>}
      {detailTab==="Details" && <details className="ve-panel ve-info-expand"><summary>Request information</summary><dl className="ve-info"><dt>Request ID</dt><dd>{r.id}</dd><dt>Category</dt><dd>{r.category} {r.other}</dd><dt>Customer</dt><dd>{r.name} · {r.mobile}</dd><dt>Company / state</dt><dd>{r.company} · {r.state}</dd><dt>Submitted</dt><dd>{fmt(r.created)}</dd><dt>Instructions</dt><dd className="note">{r.instructions}</dd></dl></details>}
      {detailTab==="Videos"&&<article className="ve-panel"><h3>Raw clips</h3>{r.rawDeleted?<p>Originals deleted</p>:(r.files||[]).map((f,i)=><div className="ve-raw-file" key={i}><Film size={20}/><span>{f.name}<small>{(f.size/1e6).toFixed(1)} MB</small></span></div>)}{r.rawCleanupPending&&<p>Raw video cleanup pending.</p>}</article>}
      {detailTab==="Details"&&r.status==="Submitted"&&<button className="ve-danger ve-full" disabled={busy} onClick={()=>{const reason=window.prompt("Why are you cancelling this request?");if(reason?.trim()&&window.confirm("Cancel this request and permanently remove its raw clips?"))work(()=>command("cancel",{note:reason}));}}>Cancel request</button>}
      {detailTab==="Activity"&&<article className="ve-panel"><h3>Request history</h3><ol className="ve-history">{detail.history.map((h,i)=><li key={i}><strong>{h.status||h.action}{h.version?" · v"+h.version:""}</strong><small>{fmt(h.time)}</small>{h.correction||h.remarks||h.reason||""}</li>)}</ol>{detail.cursor&&<button disabled={busy} onClick={()=>work(async()=>{const older=await api("details",{id:r.id,cursor:detail.cursor});setDetail({...detail,history:[...detail.history,...older.history],cursor:older.cursor});})}>Earlier history</button>}</article>}
      <Support info={info} id={r.id}/>
    </div> : <>
      <div className="ve-hero"><div><h1>Video Editing<br/>Service</h1><p>Get your videos professionally edited by our expert team.</p></div><HeroArt/></div>
      <div className="ve-home-body">
        <div className="ve-benefits">{[[SlidersHorizontal,"Professional","Editing"],[Clock,"Easy","Delivery"],[Layers,"Free","Revisions"]].map(([Icon,a,b],i)=><div key={a}><span className={`ve-benefit-icon benefit-${i}`}><Icon size={21}/></span><strong>{a}<br/>{b}</strong></div>)}</div>
        <article className="ve-panel ve-credit"><div className="ve-credit-icon"><Coins size={25}/></div><div className="ve-credit-copy"><strong>Video Credits</strong><div><b>{b.available}</b> Credits Available</div></div><Link className="primary ve-buy" to="/subscription">{b.available>0?"View Plans":"Buy Credits"}</Link></article>
        {b.available>0&&b.eligible?<button className="primary ve-new-request" onClick={()=>newForm(true)}><Plus size={23}/> New Video Request</button>:<article className="ve-panel ve-locked"><p>{b.eligible?"You have no available video credits.":"An active Video Editing Service or Combo plan is required."}</p><Link className="primary ve-full" to="/subscription">View plans <ArrowRight size={17}/></Link></article>}
        <div className="ve-list-heading"><h2>My Requests</h2><select aria-label="Filter requests by status" disabled={busy} value={status} onChange={e=>{const v=e.target.value;filter(v);work(()=>list(v));}}><option value="">All statuses</option>{info.statuses.map(s=><option key={s}>{s}</option>)}</select></div>
        <div className="ve-panel ve-request-list" aria-busy={busy}>{rows.map(row=><div className="ve-request-item" key={row.id}><button className="ve-request-card" disabled={busy} onClick={()=>work(()=>open(row.id))}><span className="ve-thumb">{row.thumbnail?<img src={row.thumbnail} alt="Original clip thumbnail" loading="lazy"/>:<Film size={24}/>} {row.version>0&&["Completed","Under Review"].includes(row.status)&&<span className="ve-play"><Play size={13} fill="currentColor"/></span>}{row.duration>0&&<small className="ve-duration">{duration(row.duration)}</small>}</span><span className="ve-card-copy"><strong>#{row.id}</strong><span>{row.category}</span><small>{date(row.created)}</small><Status value={row.status}/></span><ChevronRight size={20} className="ve-chevron"/></button>{row.version>0&&["Completed","Under Review"].includes(row.status)&&<div className="ve-card-actions"><button disabled={busy} onClick={()=>work(()=>open(row.id,true))}><Play size={15}/> Preview video</button>{row.status==="Completed"&&<button disabled={busy} onClick={()=>download(row.id)}><Download size={15}/> Download</button>}</div>}</div>)}{!rows.length&&<div className="ve-empty"><Clapperboard size={34}/><strong>{busy?"Loading requests…":"No requests yet"}</strong><small>{busy?"":"Your video requests will appear here."}</small></div>}</div>
        {cursor&&<button className="ve-outline ve-full" disabled={busy} onClick={()=>work(()=>list(status,true))}>Load more requests <ChevronRight size={16}/></button>}
        <article className="ve-panel ve-how"><h3>How It Works?</h3><div className="ve-how-steps">{[[CloudUpload,"Upload","Your Video"],[SlidersHorizontal,"Our Team","Edits It"],[Film,"Receive","Final Video"]].map(([Icon,a,b],i)=><div key={a}><span><Icon size={26}/></span><strong>{a}</strong><small>{b}</small>{i<2&&<ChevronRight className="ve-how-arrow" size={19}/>}</div>)}</div></article>
        <Support info={info}/>
      </div>
    </>)}
  </main>;
}
