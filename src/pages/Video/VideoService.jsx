import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Film, Play, MessageCircle, Plus, ChevronRight, RefreshCw, Check, ClipboardList, Clock, Download, RotateCw } from "lucide-react";
import { Link } from "react-router";
import { api } from "./uploads";
import NewRequest from "./NewRequest";
import "./Video.css";
function drivePreview(link) {
  const u = new URL(link);
  if (u.origin !== "https://drive.google.com" || !/^\/file\/d\/[\w-]+\/view$/.test(u.pathname)) return undefined;
  u.pathname = u.pathname.replace(/\/view$/, "/preview");
  return u.href;
}
const fmt = (t) => new Date(t).toLocaleString();
function Support({ info, id }) {
  const text =
    "Hello MLMLive Video Editing Team, I am " +
    info.name +
    ". I need help with my video editing " +
    (id ? "request " + id : "service") +
    ".";
  return info.support ? (
    <a
      className="action"
      target="_blank"
      rel="noreferrer"
      href={
        "https://wa.me/" + info.support + "?text=" + encodeURIComponent(text)
      }
    >
      <MessageCircle size={18} /> WhatsApp Support
    </a>
  ) : (
    <small>Video editing WhatsApp support number is pending setup.</small>
  );
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
  const running = useRef(false),
    pull = useRef(null);
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
  const r = detail?.row,
    b = info?.balance;
  return (
    <main
      className="ve"
      onTouchStart={(e) => {
        pull.current =
          !form &&
          !busy &&
          window.scrollY === 0 &&
          e.currentTarget.getBoundingClientRect().top >= -2
            ? e.touches[0].clientY
            : null;
      }}
      onTouchEnd={(e) => {
        if (
          pull.current !== null &&
          e.changedTouches[0].clientY - pull.current > 90
        )
          work(async () => {
            await refresh();
            if (r) await open(r.id);
          });
        pull.current = null;
      }}
    >
      {!r && <header>
        <div className="ve-title">{r ? <button aria-label="Back to requests" onClick={()=>{setDetail(null);}}><ArrowLeft size={18}/></button> : form ? null : <Link to="/" className="action" aria-label="Back to Home"><ArrowLeft size={18}/></Link>}<div><h1>Video Editing</h1><small>Professional video editing service</small></div></div>
        <button
          disabled={busy}
          onClick={() =>
            work(async () => {
              await refresh();
              if (r) await open(r.id);
            })
          }
        >
          <RefreshCw size={17} aria-label="Refresh" />
        </button>
      </header>}
      {err && (
        <p role="alert" className="error">
          {err}
        </p>
      )}
      {!info && !err && <p>Loading video service…</p>}
      {info && (
        <>
          <Support info={info} id={r?.id} />
          {r ? (
            <section>
              <header><div className="ve-title"><button aria-label="Back to requests" onClick={()=>setDetail(null)}><ArrowLeft size={18}/></button><div><h2>Request Details</h2><small>{r.id}</small></div></div></header>
              <article className="ve-detail-hero"><span className="ve-thumb">{r.thumbnail?<img src={r.thumbnail} alt="Raw clip preview"/>:<Film size={26}/>}</span><div><h2>{r.category}</h2><small>Submitted {fmt(r.created)}</small><p><b className="ve-status" data-status={r.status}>{r.status}</b></p></div></article>
              <div className="ve-timeline" aria-label="Request progress">{[["Submitted",ClipboardList],["Editing",Film],["In Review",Clock],["Delivered",Check]].map(([label,Icon],i)=>{const steps={Submitted:0,Assigned:0,Downloaded:1,Editing:1,"Under Review":2,"Correction Requested":2,Completed:3};const active=steps[r.status] ?? -1;return <div key={label} className={active>=i?"done":""}><span><Icon size={18}/></span><small>{label}</small></div>})}</div>
              <nav className="ve-detail-tabs" aria-label="Request details sections">{["Details","Videos","Corrections","Activity"].map(t=><button className={detailTab===t?"primary":""} key={t} onClick={()=>setDetailTab(t)}>{t}</button>)}</nav>
              {detailTab === "Details" && <article><h3>Request information</h3><dl className="ve-info"><dt>Request ID</dt><dd>{r.id}</dd><dt>Video category</dt><dd>{r.category} {r.other}</dd><dt>Customer</dt><dd>{r.name} · {r.mobile}</dd><dt>Company / state</dt><dd>{r.company} · {r.state}</dd><dt>Submitted</dt><dd>{fmt(r.created)}</dd><dt>Instructions</dt><dd className="note">{r.instructions}</dd></dl></article>}
              {["Details","Videos"].includes(detailTab) && <article><h3>Raw clips</h3>{r.rawDeleted?<p>Originals deleted</p>:r.files.map((f,i)=><p key={i}>{f.name} · {(f.size/1e6).toFixed(1)} MB</p>)}{r.rawCleanupPending && <p>Raw video cleanup pending.</p>}</article>}
              {["Details","Videos"].includes(detailTab) && r.link && ["Completed", "Under Review"].includes(r.status) && <article className="ve-preview"><h3>{r.status==="Completed"?"Delivered video":"Review video"}</h3><div className="actions"><button className="primary" onClick={()=>setPlaying(!playing)}><Play size={18}/>{playing?"Close preview":"Play video"}</button><a className="action" href={r.link} target="_blank" rel="noreferrer"><Download size={16}/>{r.status==="Completed"?"Download in Drive":"Open in Drive"}</a></div>{playing && <iframe title="Edited video preview" src={drivePreview(r.link)} allow="autoplay; fullscreen" allowFullScreen/>}</article>}
              {["Details","Corrections"].includes(detailTab) && <article className="ve-corrections"><h3><RotateCw size={16}/> Correction rounds</h3><strong>{r.rounds} / {r.maxRounds} used</strong><p>{r.maxRounds-r.rounds} free corrections remaining · No extra credit</p>{r.remarks && <p>Editor remarks · {r.remarks}</p>}{detailTab==="Corrections" && detail.history.filter(h=>h.correction).map((h,i)=><p key={i}>{fmt(h.time)} · {h.correction}</p>)}{detailTab==="Corrections" && detail.cursor && <small>Older correction history is available in Activity.</small>}</article>}
              {["Details","Corrections","Videos"].includes(detailTab) && r.status === "Under Review" && (
                <article>
                  <h3>Review version {r.version}</h3>
                  <a
                    className="action"
                    href={r.link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open review video
                  </a>
                  {r.reviewedVersion !== r.version ? (
                    <button
                      disabled={busy}
                      onClick={() => work(() => command("reviewed"))}
                    >
                      I have reviewed this version
                    </button>
                  ) : (
                    <>
                      <label>
                        Describe the Corrections Required
                        <textarea
                          maxLength={4000}
                          disabled={r.rounds >= r.maxRounds}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                        />
                      </label>
                      <div className="actions">
                        <button
                          disabled={
                            busy || r.rounds >= r.maxRounds || !note.trim()
                          }
                          onClick={() =>
                            work(() => command("correct", { note }))
                          }
                        >
                          Request correction
                        </button>
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Are you satisfied with your edited video? Approving this video will complete your request and consume 1 video editing credit.",
                              )
                            )
                              work(() =>
                                command("approve", { confirmed: true }),
                              );
                          }}
                        >
                          Approve final video
                        </button>
                      </div>
                    </>
                  )}
                </article>
              )}
              {detailTab === "Details" && r.status === "Submitted" && (
                <button
                  disabled={busy}
                  onClick={() => {
                    const reason = window.prompt(
                      "Why are you cancelling this request?",
                    );
                    if (reason?.trim() && window.confirm("Cancel this request and permanently remove its raw clips?"))
                      work(() => command("cancel", { note: reason }));
                  }}
                >
                  Cancel request
                </button>
              )}
              {detailTab === "Activity" && <><h3>Request history</h3>
              <ol>
                {detail.history.map((h, i) => (
                  <li key={i}>
                    {fmt(h.time)} · {h.status || h.action}
                    {h.version ? " · v" + h.version : ""}{" "}
                    {h.correction || h.remarks || h.reason || ""}
                  </li>
                ))}
              </ol>
              {detail.cursor && (
                <button
                  disabled={busy}
                  onClick={() =>
                    work(async () => {
                      const older = await api("details", {
                        id: r.id,
                        cursor: detail.cursor,
                      });
                      setDetail({
                        ...detail,
                        history: [...detail.history, ...older.history],
                        cursor: older.cursor,
                      });
                    })
                  }
                >
                  Earlier history
                </button>
              )}</>}
            </section>
          ) : form ? (
            <NewRequest
              info={info}
              onClose={() => newForm(false)}
              onDone={(id) => {
                newForm(false);
                work(async () => {
                  await refresh();
                  await open(id);
                });
              }}
            />
          ) : (
            <>
              <section className="ve-credit">
                <h2>
                  {b.eligible
                    ? "Video editing credits"
                    : "Unlock video editing"}
                </h2>
                <div className="ve-credit-hero"><div><strong>{b.available} Credits</strong><p>1 credit = 1 edited video</p></div><Film size={46}/></div>
                <small className="ve-credit-meta">{b.reserved} reserved · {b.used} used · {b.total} total</small>
                {b.expiry > 0 && <p>Active plan through {fmt(b.expiry)}</p>}
                {b.available > 0 ? (
                  <button className="primary" onClick={() => newForm(true)}>
                    <Plus size={18} /> Create new video request
                  </button>
                ) : (
                  <>
                    <p>
                      {b.eligible
                        ? "You have no available video credits."
                        : "An active Video Editing Service or Combo plan with video credits is required."}
                    </p>
                    <Link className="action" to="/subscription">
                      View plans
                    </Link>
                  </>
                )}
              </section>
              <section>
                <header>
                  <h2>My video requests · {info.stats.total || 0}</h2>
                  <select
                    aria-label="Filter requests by status"
                    disabled={busy}
                    value={status}
                    onChange={(e) => {
                      const v = e.target.value;
                      filter(v);
                      work(() => list(v));
                    }}
                  >
                    <option value="">All statuses</option>
                    {info.statuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </header>
                <p className="quiet">
                  {info.statuses
                    .map((s, i) =>
                      info.stats["s" + i]
                        ? s + " " + info.stats["s" + i]
                        : null,
                    )
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="panel-list">
                  {rows.map((r) => (
                    <article className="ve-request-shell" key={r.id}><button className="ve-request-card"
                      disabled={busy}
                      onClick={() => work(() => open(r.id))}
                    >
                      <span className="ve-thumb">{r.thumbnail ? <img src={r.thumbnail} alt="Raw clip preview" loading="lazy"/> : r.version > 0 ? <Play size={20} /> : <Film size={20} />}{r.duration > 0 && <small className="ve-duration">{r.duration}s</small>}</span>
                      <span className="ve-card-copy">
                        {r.category}
                        <br />
                        <small>
                          {r.id} · {fmt(r.created)}
                        </small>
                      </span>
                      <span className="ve-card-end"><b className="ve-status" data-status={r.status}>{r.status}</b><small>View details <ChevronRight size={12}/></small></span>
                    </button>{r.version > 0 && ["Completed","Under Review"].includes(r.status) && <div className="ve-card-actions"><button disabled={busy} onClick={()=>work(()=>open(r.id,true))}><Play size={15}/> Preview video</button>{r.status === "Completed" && <button disabled={busy} onClick={()=>download(r.id)}><Download size={15}/> Download</button>}</div>}</article>
                  ))}
                </div>
                {!rows.length && <p>No requests in this view.</p>}
                {cursor && (
                  <button
                    disabled={busy}
                    onClick={() => work(() => list(status, true))}
                  >
                    Load more requests
                  </button>
                )}
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
