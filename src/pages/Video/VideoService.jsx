import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { api } from "./uploads";
import NewRequest from "./NewRequest";
import "./Video.css";
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
      Contact Video Editing Support
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
      cursor: more ? cursor : null,
    });
    setRows((r) => (more ? [...r, ...result.rows] : result.rows));
    page(result.cursor);
  }
  async function refresh() {
    await Promise.all([api("dashboard").then(setInfo), list()]);
  }
  useEffect(() => {
    work(refresh);
  }, []);
  async function open(id) {
    setDetail(await api("details", { id }));
    setNote("");
  }
  async function command(action, extras = {}) {
    const r = detail.row;
    await api(action, {
      id: r.id,
      version: r.version,
      op: crypto.randomUUID(),
      ...extras,
    });
    await Promise.all([open(r.id), refresh()]);
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
      <header>
        <h1>Video Editing Service</h1>
        <button
          disabled={busy}
          onClick={() =>
            work(async () => {
              await refresh();
              if (r) await open(r.id);
            })
          }
        >
          Refresh
        </button>
      </header>
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
              <header>
                <h2>{r.category}</h2>
                <button onClick={() => setDetail(null)}>
                  Back to my requests
                </button>
              </header>
              <p>
                {r.id} · {r.status}
              </p>
              <p>
                {r.name} · {r.mobile} · {r.company}
              </p>
              <p className="note">{r.instructions}</p>
              <p>Raw clips · {r.files.map((f) => f.name).join(", ")}</p>
              <p>
                <strong>
                  {r.maxRounds - r.rounds} of {r.maxRounds} free corrections
                  remaining
                </strong>
              </p>
              {r.remarks && <p>Editor remarks · {r.remarks}</p>}
              {r.status === "Under Review" && (
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
              {r.status === "Completed" && (
                <a
                  className="action primary"
                  href={r.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download final video in Google Drive
                </a>
              )}
              {r.status === "Submitted" && (
                <button
                  disabled={busy}
                  onClick={() => {
                    const reason = window.prompt(
                      "Why are you cancelling this request?",
                    );
                    if (reason?.trim())
                      work(() => command("cancel", { note: reason }));
                  }}
                >
                  Cancel request
                </button>
              )}
              <h3>Request history</h3>
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
              )}
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
              <section>
                <h2>
                  {b.eligible
                    ? "Video editing credits"
                    : "Unlock video editing"}
                </h2>
                <div className="metrics">
                  {["available", "reserved", "used", "total"].map((k) => (
                    <div key={k}>
                      <b>{b[k]}</b>
                      {k}
                    </div>
                  ))}
                </div>
                {b.expiry > 0 && <p>Active plan through {fmt(b.expiry)}</p>}
                {b.available > 0 ? (
                  <button className="primary" onClick={() => newForm(true)}>
                    Create new video request
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
                    <button
                      key={r.id}
                      disabled={busy}
                      onClick={() => work(() => open(r.id))}
                    >
                      <span>
                        {r.category}
                        <br />
                        <small>
                          {r.id} · {fmt(r.created)}
                        </small>
                      </span>
                      <b>{r.status}</b>
                    </button>
                  ))}
                </div>
                {!rows.length && <p>No requests in this view.</p>}
                {cursor && (
                  <button
                    disabled={busy}
                    onClick={() => work(() => list(status, true))}
                  >
                    Load more
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
