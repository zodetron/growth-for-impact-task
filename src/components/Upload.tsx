"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FileUp, Loader2, UploadCloud, X, AlertTriangle, Eye, Save, Trash2 } from "lucide-react";
import { type Candidate, type JobId, classKey, displayName, headlineOf, rankFor } from "./model";
import { Avatar, ClassPill, ScoreRing } from "./ui";

const STEPS = ["Reading file", "Extracting sections & dates", "Scoring against both JDs", "Writing AI reviewer note"];

type State =
  | { kind: "idle" }
  | { kind: "working"; name: string; step: number }
  | { kind: "error"; message: string }
  | { kind: "done"; candidate: Candidate; duplicate: boolean; alreadyInPile: boolean };

export function UploadDialog({
  all,
  onClose,
  onUploaded,
  onSave,
  onDiscard,
  onView,
}: {
  all: Candidate[];
  onClose: () => void;
  onUploaded: (c: Candidate) => void;
  onSave: (c: Candidate) => Promise<void>;
  onDiscard: (c: Candidate) => Promise<void>;
  onView: (c: Candidate) => void;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState<"save" | "discard" | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && state.kind !== "working" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (timer.current) clearInterval(timer.current);
    };
  }, [onClose, state.kind]);

  async function handle(file: File) {
    if (!/\.(docx|pdf|txt)$/i.test(file.name)) {
      setState({ kind: "error", message: `"${file.name}" is not supported. Please upload a .docx, .pdf or .txt resume.` });
      return;
    }
    setState({ kind: "working", name: file.name, step: 0 });
    let step = 0;
    timer.current = setInterval(() => {
      step = Math.min(STEPS.length - 1, step + 1);
      setState((s) => (s.kind === "working" ? { ...s, step } : s));
    }, 1400);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({ error: `Server returned ${res.status}` }));
      if (!res.ok || !data.candidate) throw new Error(data.error ?? "Upload failed");
      onUploaded(data.candidate);
      setState({ kind: "done", candidate: data.candidate, duplicate: data.duplicate, alreadyInPile: data.alreadyInPile });
    } catch (e) {
      setState({ kind: "error", message: (e as Error).message });
    } finally {
      if (timer.current) clearInterval(timer.current);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal aria-label="Upload a resume">
      <button aria-label="Close" className="absolute inset-0 bg-black/30 fade-in" onClick={() => state.kind !== "working" && onClose()} />
      <div className="panel pop-in relative w-full max-w-xl rounded-lg p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Test a new resume</h2>
            <p className="mt-0.5 text-[13px] text-muted">It runs through the same extraction and ranking logic as the pile. Nothing is added until you save it.</p>
          </div>
          <button onClick={onClose} disabled={state.kind === "working"} className="btn btn-icon" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5">
          {(state.kind === "idle" || state.kind === "error") && (
            <>
              <button
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handle(f);
                }}
                onClick={() => inputRef.current?.click()}
                className="group grid w-full place-items-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors"
                style={{
                  borderColor: drag ? "var(--accent)" : "var(--border-strong)",
                  background: drag ? "var(--accent-soft)" : "var(--surface-2)",
                }}
              >
                <div className="card grid size-12 place-items-center rounded-xl">
                  <UploadCloud className="size-6" style={{ color: "var(--accent)" }} />
                </div>
                <div className="text-sm font-semibold">Drop a resume here or click to browse</div>
                <div className="text-xs text-faint">.docx, .pdf or .txt · up to 5 MB</div>
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".docx,.pdf,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handle(f);
                  e.target.value = "";
                }}
              />
              {state.kind === "error" && (
                <div className="mt-3 flex gap-2 rounded-lg p-3 text-[13px]" style={{ background: "color-mix(in oklab, var(--bad) 10%, transparent)", color: "var(--bad)" }}>
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  {state.message}
                </div>
              )}
            </>
          )}

          {state.kind === "working" && (
            <div className="well rounded-xl p-5">
              <div className="flex items-center gap-3">
                <FileUp className="size-5 text-muted" />
                <div className="truncate text-sm font-medium">{state.name}</div>
              </div>
              <ol className="mt-4 grid gap-2.5">
                {STEPS.map((s, i) => (
                  <li key={s} className="flex items-center gap-3 text-[13px]">
                    <span
                      className="grid size-6 place-items-center rounded-full"
                      style={{
                        background: i < state.step ? "color-mix(in oklab, var(--ok) 14%, transparent)" : i === state.step ? "var(--accent-soft)" : "var(--surface-3)",
                        color: i < state.step ? "var(--ok)" : "var(--accent)",
                      }}
                    >
                      {i < state.step ? <Check className="size-3.5" strokeWidth={3} /> : i === state.step ? <Loader2 className="size-3.5 spin" /> : <span className="size-1.5 rounded-full bg-[var(--faint)]" />}
                    </span>
                    <span className={i <= state.step ? "" : "text-faint"}>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {state.kind === "done" && (
            <Result
              c={state.candidate}
              all={all}
              duplicate={state.duplicate}
              alreadyInPile={state.alreadyInPile}
              busy={busy}
              onView={() => onView(state.candidate)}
              onSave={async () => {
                setBusy("save");
                await onSave(state.candidate);
                setBusy(null);
                setState({ ...state, candidate: { ...state.candidate, in_pile: true }, alreadyInPile: true });
              }}
              onDiscard={async () => {
                setBusy("discard");
                await onDiscard(state.candidate);
                setBusy(null);
                setState({ kind: "idle" });
              }}
              onAnother={() => setState({ kind: "idle" })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Result({
  c,
  all,
  duplicate,
  alreadyInPile,
  busy,
  onView,
  onSave,
  onDiscard,
  onAnother,
}: {
  c: Candidate;
  all: Candidate[];
  duplicate: boolean;
  alreadyInPile: boolean;
  busy: "save" | "discard" | null;
  onView: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onAnother: () => void;
}) {
  const name = displayName(c);
  const errors = c.issues.filter((i) => i.severity !== "info");
  return (
    <div className="fade-in">
      {duplicate && (
        <div className="mb-3 rounded-lg p-3 text-[13px]" style={{ background: "color-mix(in oklab, var(--both) 10%, transparent)", color: "var(--both)" }}>
          This exact file was uploaded before{alreadyInPile ? " and is already in the pile" : ""} — showing the existing result.
        </div>
      )}
      <div className="flex items-center gap-3">
        <Avatar text={name} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{name}</span>
            <ClassPill k={classKey(c)} lean={c.classification?.lean} small />
          </div>
          <div className="truncate text-[13px] text-muted">{headlineOf(c)}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {(["lca", "ux"] as JobId[]).map((j) => {
          const r = rankFor(all, j, c);
          return (
            <div key={j} className="well flex items-center gap-3 rounded-lg p-3">
              <ScoreRing score={c.scores[j]?.score} size={50} />
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: j === "lca" ? "var(--lca)" : "var(--ux)" }}>
                  {j === "lca" ? "LCA Consultant" : "UI/UX Intern"}
                </div>
                <div className="text-sm">{r ? <>Would rank <b>#{r.rank}</b> of {r.of}</> : "Not scored"}</div>
              </div>
            </div>
          );
        })}
      </div>

      {c.classification && <p className="mt-3 text-[13px] leading-relaxed text-muted">{c.classification.reason}</p>}
      {errors.length > 0 && (
        <div className="mt-3 grid gap-1.5">
          {errors.slice(0, 3).map((i, n) => (
            <div key={n} className="flex gap-2 rounded-xl px-3 py-2 text-xs" style={{ background: `color-mix(in oklab, ${i.severity === "error" ? "var(--bad)" : "var(--warn)"} 10%, transparent)` }}>
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" style={{ color: i.severity === "error" ? "var(--bad)" : "var(--warn)" }} />
              {i.message}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <button className="btn" onClick={onAnother}>
          <FileUp className="size-4" /> Another
        </button>
        <div className="flex flex-wrap gap-2">
          {!c.in_pile && !alreadyInPile && (
            <button className="btn btn-danger" onClick={onDiscard} disabled={!!busy}>
              {busy === "discard" ? <Loader2 className="size-4 spin" /> : <Trash2 className="size-4" />} Discard
            </button>
          )}
          <button className="btn" onClick={onView}>
            <Eye className="size-4" /> Details
          </button>
          {!c.in_pile && !alreadyInPile ? (
            <button className="btn btn-primary" onClick={onSave} disabled={!!busy}>
              {busy === "save" ? <Loader2 className="size-4 spin" /> : <Save className="size-4" />} Save to pile
            </button>
          ) : (
            <span className="btn" style={{ color: "var(--ok)" }}>
              <Check className="size-4" /> In the pile
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
