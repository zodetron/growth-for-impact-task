"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, Leaf, PenTool, Users, AlertCircle, BookOpen, Moon, Search, Sun, Upload, RefreshCw, X } from "lucide-react";
import { type Candidate, type JobId, type JobRow, classKey, warnCount } from "./model";
import { Detail } from "./Detail";
import { UploadDialog } from "./Upload";
import { AllView, MethodView, OverviewView, type Page, ReviewView, RoleView } from "./views";

interface Health {
  db: string;
  llm: { provider: string; model: string } | null;
}

const PAGES: Page[] = ["overview", "lca", "ux", "all", "review", "method"];

export function App() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [page, setPage] = useState<Page>("overview");
  const [selected, setSelected] = useState<{ id: string; job?: JobId } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async (include?: string | null) => {
    try {
      const [j, c] = await Promise.all([
        fetch("/api/jobs").then((r) => r.json()),
        fetch(`/api/candidates${include ? `?include=${include}` : ""}`).then((r) => r.json()),
      ]);
      if (c.error || j.error) throw new Error(c.error ?? j.error);
      setJobs(j.jobs);
      setCands(c.candidates);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // load() only sets state after awaiting the network
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {});
    const fromHash = () => {
      const h = window.location.hash.slice(1) as Page;
      if (PAGES.includes(h)) setPage(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [load]);

  const go = (p: Page) => {
    setPage(p);
    if (window.location.hash.slice(1) !== p) history.replaceState(null, "", `#${p}`);
    window.scrollTo({ top: 0 });
  };

  const toggleTheme = () => {
    const current = document.documentElement.dataset.theme;
    const isDark = current ? current === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = isDark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("tl-theme", next);
    } catch {}
  };

  const visible = useMemo(() => cands.filter((c) => c.in_pile || c.id === pending), [cands, pending]);
  const pile = useMemo(() => cands.filter((c) => c.in_pile), [cands]);

  const rankMaps = useMemo(() => {
    const make = (job: JobId) => {
      const m = new Map<string, number>();
      const scored = visible.filter((c) => c.scores[job]?.score != null).sort((a, b) => b.scores[job]!.score - a.scores[job]!.score);
      let last: number | null = null;
      let lastRank = 0;
      scored.forEach((c, i) => {
        const s = c.scores[job]!.score;
        const r = s === last ? lastRank : i + 1;
        m.set(c.id, r);
        last = s;
        lastRank = r;
      });
      return m;
    };
    return { lca: make("lca"), ux: make("ux") };
  }, [visible]);

  const counts: Record<Page, number | null> = useMemo(
    () => ({
      overview: null,
      lca: pile.filter((c) => ["lca", "both"].includes(classKey(c))).length,
      ux: pile.filter((c) => ["ux", "both"].includes(classKey(c))).length,
      all: pile.length,
      review: pile.filter((c) => warnCount(c) > 0 || classKey(c) === "uncertain").length,
      method: null,
    }),
    [pile],
  );

  const nav: { id: Page; label: string; icon: React.ReactNode; group: string; tint: string }[] = [
    { id: "overview", label: "Overview", icon: <LayoutGrid className="size-4" />, group: "Screening", tint: "var(--accent)" },
    { id: "lca", label: "LCA Consultant", icon: <Leaf className="size-4" />, group: "Roles", tint: "var(--lca)" },
    { id: "ux", label: "UI/UX Intern", icon: <PenTool className="size-4" />, group: "Roles", tint: "var(--ux)" },
    { id: "all", label: "All candidates", icon: <Users className="size-4" />, group: "Library", tint: "var(--accent)" },
    { id: "review", label: "Needs review", icon: <AlertCircle className="size-4" />, group: "Library", tint: "var(--warn)" },
    { id: "method", label: "Scoring method", icon: <BookOpen className="size-4" />, group: "Library", tint: "var(--muted)" },
  ];

  const selectedCand = selected ? (cands.find((c) => c.id === selected.id) ?? null) : null;
  const detailJob: JobId =
    selected?.job ?? (page === "ux" ? "ux" : page === "lca" ? "lca" : selectedCand?.classification?.lean === "ux" ? "ux" : "lca");

  const saveUpload = async (c: Candidate) => {
    await fetch(`/api/candidates/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ in_pile: true }) });
    setPending(null);
    await load();
  };
  const discardUpload = async (c: Candidate) => {
    await fetch(`/api/candidates/${c.id}`, { method: "DELETE" });
    setPending(null);
    setSelected(null);
    setCands((cs) => cs.filter((x) => x.id !== c.id));
  };

  const open = (id: string, job?: JobId) => setSelected({ id, job });

  return (
    <div className="min-h-screen lg:pl-[248px]">
      {/* sidebar (desktop) */}
      <aside className="vibrancy fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r lg:flex" style={{ borderColor: "var(--border)" }}>
        <div className="flex h-16 items-center gap-2.5 px-5">
          <div className="grid size-8 place-items-center rounded-[9px] text-[13px] font-extrabold tracking-tight text-white" style={{ background: "linear-gradient(180deg, #3a3a3d, #0b0b0c)" }}>
            TL
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold tracking-tight">Talent Lens</div>
            <div className="text-[11px] font-medium text-muted">Growth For Impact</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {["Screening", "Roles", "Library"].map((g) => (
            <div key={g} className="mt-5 first:mt-1">
              <div className="mb-1 px-2.5 text-[11px] font-semibold text-faint">{g}</div>
              {nav
                .filter((n) => n.group === g)
                .map((n) => (
                  <button key={n.id} className="nav-item" aria-current={page === n.id ? "page" : undefined} onClick={() => go(n.id)}>
                    <span style={{ color: page === n.id ? "#fff" : n.tint }}>{n.icon}</span>
                    {n.label}
                    {counts[n.id] != null && <span className="nav-count">{counts[n.id]}</span>}
                  </button>
                ))}
            </div>
          ))}
        </nav>

        <div className="border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => setUploadOpen(true)} className="btn btn-primary w-full">
            <Upload className="size-4" /> Upload resume
          </button>
          <div className="mt-3 flex items-center justify-between">
            <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] font-medium text-muted" title={health?.db === "ok" ? "Database connected" : health?.db}>
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: health?.db === "ok" ? "var(--ok)" : health ? "var(--bad)" : "var(--faint)" }} />
              {health?.llm ? `AI · ${health.llm.model.split("/").pop()}` : health ? "Rules only" : "Connecting…"}
            </span>
            <button onClick={toggleTheme} className="btn btn-icon !size-8" aria-label="Toggle theme">
              <Sun className="hidden size-3.5 dark:block" />
              <Moon className="size-3.5 dark:hidden" />
            </button>
          </div>
        </div>
      </aside>

      {/* toolbar */}
      <header className="toolbar sticky top-0 z-20 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-3 px-4 sm:px-8">
          <div className="flex shrink-0 items-center gap-2 lg:hidden">
            <div className="grid size-7 place-items-center rounded-[8px] text-[11px] font-extrabold text-white" style={{ background: "#0b0b0c" }}>
              TL
            </div>
            <span className="hidden text-[15px] font-extrabold tracking-tight sm:inline">Talent Lens</span>
          </div>
          <div className="relative w-full max-w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <input
              className="input !h-9 !rounded-full !pr-8"
              style={{ background: "color-mix(in oklab, var(--fg) 6%, transparent)", borderColor: "transparent" }}
              placeholder="Search candidates, skills, employers"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-fg" onClick={() => setQuery("")} aria-label="Clear search">
                <X className="size-4" />
              </button>
            )}
          </div>
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <button
              onClick={() => {
                setLoading(true);
                load(pending);
              }}
              className="btn"
              title="Reload from database"
            >
              <RefreshCw className={`size-3.5 ${loading ? "spin" : ""}`} /> Refresh
            </button>
            <button onClick={() => go("review")} className="btn hidden md:inline-flex">
              <AlertCircle className="size-3.5 text-warn" /> Needs review
            </button>
            <button onClick={toggleTheme} className="btn btn-icon lg:hidden" aria-label="Toggle theme">
              <Sun className="hidden size-4 dark:block" />
              <Moon className="size-4 dark:hidden" />
            </button>
            <button onClick={() => setUploadOpen(true)} className="btn btn-primary lg:hidden">
              <Upload className="size-4" /> Upload
            </button>
          </div>
          <button onClick={() => setUploadOpen(true)} className="btn btn-primary btn-icon ml-auto shrink-0 sm:hidden" aria-label="Upload resume">
            <Upload className="size-4" />
          </button>
        </div>
        {/* mobile nav */}
        <div className="scroll-thin flex gap-1.5 overflow-x-auto px-4 pb-2.5 lg:hidden">
          {nav.map((n) => (
            <button key={n.id} className="chip shrink-0" aria-pressed={page === n.id} onClick={() => go(n.id)}>
              {n.label}
              {counts[n.id] != null && <span className="tabular-nums text-faint">{counts[n.id]}</span>}
            </button>
          ))}
        </div>
      </header>

      {/* content */}
      <main className="mx-auto max-w-[1320px] px-4 pb-20 pt-8 sm:px-8">
        {error ? (
          <div className="card mx-auto mt-10 max-w-lg rounded-2xl p-8 text-center">
            <AlertCircle className="mx-auto size-6 text-bad" />
            <div className="mt-2 text-[17px] font-bold">Could not load candidates</div>
            <p className="mt-1 text-[13px] text-muted">{error}</p>
          </div>
        ) : loading && cands.length === 0 ? (
          <div className="grid gap-3">
            <div className="shimmer h-10 w-64 rounded-xl" />
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="shimmer h-24 rounded-2xl" />
              ))}
            </div>
            <div className="shimmer mt-4 h-80 rounded-2xl" />
          </div>
        ) : page === "overview" ? (
          <OverviewView pile={pile} rankMaps={rankMaps} go={go} open={open} />
        ) : page === "lca" || page === "ux" ? (
          <RoleView
            key={page}
            job={page}
            jobRow={jobs.find((j) => j.id === page) ?? null}
            cands={visible}
            rankMap={rankMaps[page]}
            query={query}
            open={(id) => open(id, page)}
            go={go}
          />
        ) : page === "all" ? (
          <AllView cands={visible} query={query} open={(id) => open(id)} />
        ) : page === "review" ? (
          <ReviewView cands={pile} open={(id) => open(id)} />
        ) : (
          <MethodView jobs={jobs} />
        )}
      </main>

      {selectedCand && (
        <Detail
          key={`${selectedCand.id}-${detailJob}`}
          candidate={selectedCand}
          all={cands}
          job={detailJob}
          onClose={() => setSelected(null)}
          footer={
            !selectedCand.in_pile ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] text-muted">This upload is not part of the pile yet.</span>
                <div className="flex gap-2">
                  <button className="btn btn-danger" onClick={() => discardUpload(selectedCand)}>
                    Discard
                  </button>
                  <button className="btn btn-primary" onClick={() => saveUpload(selectedCand)}>
                    Save to pile
                  </button>
                </div>
              </div>
            ) : undefined
          }
        />
      )}

      {uploadOpen && (
        <UploadDialog
          all={cands}
          onClose={() => setUploadOpen(false)}
          onUploaded={(c) => {
            setCands((cs) => [...cs.filter((x) => x.id !== c.id), c]);
            if (!c.in_pile) setPending(c.id);
          }}
          onSave={saveUpload}
          onDiscard={discardUpload}
          onView={(c) => {
            setUploadOpen(false);
            setSelected({ id: c.id });
          }}
        />
      )}
    </div>
  );
}
