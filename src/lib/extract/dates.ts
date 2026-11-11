import type { DateRange } from "../types";

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

type Point = { y: number; m: number; approx: boolean } | "present" | null;

const PRESENT_RE = /^(present|current|currently|ongoing|now|till date|to date|today)$/i;

export function nowYm(): { y: number; m: number } {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

function fixYear(raw: string): number {
  const n = parseInt(raw, 10);
  if (raw.length === 2) return n + 2000;
  return n;
}

function parsePoint(input: string, fallbackYear: number | null): Point {
  const s = input.trim().toLowerCase().replace(/[’‘`]/g, "'").replace(/\.$/, "");
  if (!s) return null;
  if (PRESENT_RE.test(s)) return "present";

  let m = s.match(/^(\d{1,2})\s*[/.]\s*(\d{4})$/);
  if (m) return { y: +m[2], m: Math.min(12, Math.max(1, +m[1])), approx: false };

  m = s.match(/^([a-z]{3,9})\.?\s*,?\s*'?(\d{4}|\d{2})$/);
  if (m && MONTHS[m[1]]) return { y: fixYear(m[2]), m: MONTHS[m[1]], approx: false };

  m = s.match(/^([a-z]{3,9})$/);
  if (m && MONTHS[m[1]] && fallbackYear) return { y: fallbackYear, m: MONTHS[m[1]], approx: false };

  m = s.match(/^(\d{4})$/);
  if (m) return { y: +m[1], m: 6, approx: true };

  return null;
}

function ym(p: { y: number; m: number }) {
  return `${p.y}-${String(p.m).padStart(2, "0")}`;
}

/** Parse a free-form date range like "Jul 2025 – Present", "11/2025 – 01/2026", "Sep '25 – Dec '25", "8 Months". */
export function parseDateRange(rawInput: string | null | undefined): DateRange {
  const raw = (rawInput ?? "").trim();
  const empty: DateRange = { raw, start: null, end: null, ongoing: false, months: null, approximate: false };
  if (!raw || /^(null|not specified|dates not provided|n\/?a|-)$/i.test(raw)) return empty;

  // Duration-only, e.g. "8 Months", "2 years"
  const dur = raw.match(/^(\d+(?:\.\d+)?)\s*(months?|mos?|years?|yrs?)$/i);
  if (dur) {
    const n = parseFloat(dur[1]);
    return { ...empty, months: Math.round(/^y/i.test(dur[2]) ? n * 12 : n), approximate: true };
  }
  if (PRESENT_RE.test(raw)) return { ...empty, ongoing: true };

  const parts = raw
    .replace(/[–—−]/g, "–")
    .split(/\s*–\s*|\s+-\s+|(?<=\d)-(?=[a-z\d])|\s+to\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 1) {
    const p = parsePoint(parts[0], null);
    if (p && p !== "present") {
      // a single date — treat as a ~1 month item
      return { ...empty, start: ym(p), end: ym(p), months: 1, approximate: true };
    }
    return empty;
  }

  const right = parsePoint(parts[parts.length - 1], null);
  const rightYear = right && right !== "present" ? right.y : nowYm().y;
  const left = parsePoint(parts[0], rightYear);
  if (!left || left === "present" || !right) return empty;

  const endP = right === "present" ? { ...nowYm(), approx: false } : right;
  const months = (endP.y - left.y) * 12 + (endP.m - left.m) + 1;
  return {
    raw,
    start: ym(left),
    end: ym(endP),
    ongoing: right === "present",
    months: months > 0 ? months : null,
    approximate: left.approx || (right !== "present" && right.approx),
  };
}

/** Find a trailing date range inside a line (used when the template's spacing is missing, e.g. PDFs). */
export const TRAILING_RANGE_RE =
  /((?:[A-Za-z]{3,9}\.?\s*'?’?\d{2,4}|\d{1,2}\/\d{4}|\d{4}|[A-Za-z]{3,9})\s*(?:[–—−-]|to)\s*(?:present|current|ongoing|[A-Za-z]{3,9}\.?\s*'?’?\d{2,4}|\d{1,2}\/\d{4}|\d{4}))\s*$/i;

/** Convert YYYY-MM to a month index for interval math. */
export function monthIndex(s: string): number {
  const [y, m] = s.split("-").map(Number);
  return y * 12 + (m - 1);
}

/**
 * Weighted, overlap-aware month count. Each entry covers [start, end]; when entries overlap
 * the highest weight wins for that month, so concurrent roles are not double counted.
 */
export function weightedMonths(items: { range: DateRange; weight: number }[]): number {
  const byMonth = new Map<number, number>();
  let floating = 0; // duration-only entries without anchors
  for (const { range, weight } of items) {
    if (weight <= 0) continue;
    if (range.start && range.end) {
      const a = monthIndex(range.start);
      const b = monthIndex(range.end);
      if (b < a) continue;
      for (let i = a; i <= b; i++) byMonth.set(i, Math.max(byMonth.get(i) ?? 0, weight));
    } else if (range.months) {
      floating += range.months * weight;
    }
  }
  let total = floating;
  for (const w of byMonth.values()) total += w;
  return total;
}
