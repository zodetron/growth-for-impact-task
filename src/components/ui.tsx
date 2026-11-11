"use client";

import { Check, CircleHelp, Minus, X } from "lucide-react";
import type { HardStatus } from "@/lib/types";
import { CLASS_META, scoreColor } from "./model";

/** Compact score: number + thin bar. Used in lists. */
export function ScoreCell({ score }: { score: number | null | undefined }) {
  const v = score == null ? 0 : Math.max(0, Math.min(100, score));
  const color = scoreColor(score);
  return (
    <div className="w-16 shrink-0 text-right" title={score == null ? "Not scored" : `${score} / 100`}>
      <div className="text-[15px] font-semibold tabular-nums tracking-tight">{score == null ? "—" : Math.round(score)}</div>
      <div className="mt-1 h-1 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: color }} />
      </div>
    </div>
  );
}

/** Larger ring, used in detail views. */
export function ScoreRing({ score, size = 52, stroke = 5 }: { score: number | null | undefined; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = score == null ? 0 : Math.max(0, Math.min(100, score));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={scoreColor(score)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-semibold tabular-nums tracking-tight" style={{ fontSize: size * 0.3 }}>
          {score == null ? "—" : Math.round(score)}
        </span>
      </div>
    </div>
  );
}

export function ClassPill({ k, lean, small }: { k: string; lean?: string | null; small?: boolean }) {
  const meta = CLASS_META[k] ?? CLASS_META.uncertain;
  const leanTxt = k === "uncertain" && lean ? ` · leans ${lean === "lca" ? "LCA" : "UI/UX"}` : "";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-medium whitespace-nowrap ${small ? "h-5 px-1.5 text-[11px]" : "h-6 px-2 text-xs"}`}
      style={{ color: meta.color, background: `color-mix(in oklab, ${meta.color} 11%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: meta.color }} />
      {meta.label}
      {leanTxt}
    </span>
  );
}

const HARD_META: Record<HardStatus, { color: string; Icon: typeof Check; word: string }> = {
  pass: { color: "var(--ok)", Icon: Check, word: "Met" },
  partial: { color: "var(--warn)", Icon: Minus, word: "Partly met" },
  fail: { color: "var(--bad)", Icon: X, word: "Not met" },
  unknown: { color: "var(--neutral)", Icon: CircleHelp, word: "Unknown" },
};

export function HardDot({ status, title }: { status: HardStatus; title?: string }) {
  const m = HARD_META[status];
  return (
    <span
      title={title ? `${title}: ${m.word}` : m.word}
      className="grid size-[18px] place-items-center rounded-[5px]"
      style={{ color: m.color, background: `color-mix(in oklab, ${m.color} 12%, transparent)` }}
    >
      <m.Icon className="size-3" strokeWidth={2.75} />
    </span>
  );
}

export function hardWord(s: HardStatus) {
  return HARD_META[s].word;
}

export function Avatar({ text, size = 36 }: { text: string; hue?: number; size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-lg font-semibold tracking-tight"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, size * 0.32),
        color: "var(--muted)",
        background: "var(--surface-3)",
        border: "1px solid var(--border)",
      }}
    >
      {text.slice(0, 3)}
    </div>
  );
}

export function hueFor(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: "width .5s ease" }} />
    </div>
  );
}
