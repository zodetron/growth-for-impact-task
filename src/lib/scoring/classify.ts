import type { Classification, Issue, JobScore } from "../types";

export const THRESHOLDS = { match: 50, possible: 28 };

/**
 * Two independent scores → one label.
 *  - both ≥ 50            → Both
 *  - one ≥ 50             → that role
 *  - best in [28, 50)     → Uncertain (leans to best)
 *  - best < 28            → Neither
 * Extraction failures force "Uncertain" with low confidence so a human looks at it.
 */
export function classify(lca: JobScore | null, ux: JobScore | null, issues: Issue[]): Classification {
  if (!lca || !ux) {
    const err = issues.find((i) => i.severity === "error");
    return {
      label: "uncertain",
      lean: null,
      confidence: "low",
      reason: err ? `Could not be scored: ${err.message}` : "Could not be scored.",
    };
  }
  const { match, possible } = THRESHOLDS;
  const a = lca.score;
  const b = ux.score;
  const best = Math.max(a, b);
  const lean = a >= b ? "lca" : "ux";
  const gap = Math.abs(a - b);
  const damaged = issues.some((i) => i.code === "REDACTION_DAMAGE" || i.code === "SPARSE" || i.code === "DATE_UNPARSED");

  let label: Classification["label"];
  let reason: string;
  if (a >= match && b >= match) {
    label = "both";
    reason = `Clears the match bar for both roles (LCA ${a}, UI/UX ${b}).`;
  } else if (best >= match) {
    label = lean;
    reason = `${lean === "lca" ? "LCA" : "UI/UX"} score ${best} clears the ${match}-point match bar; the other role scores ${Math.min(a, b)}.`;
  } else if (best >= possible) {
    label = "uncertain";
    reason = `Partial fit — best score ${best} (${lean === "lca" ? "LCA" : "UI/UX"}) is between ${possible} and ${match}. Needs human review.`;
  } else {
    label = "neither";
    reason = `Scores are low for both roles (LCA ${a}, UI/UX ${b}); profile is outside both job descriptions.`;
  }

  let confidence: Classification["confidence"] = "high";
  if (label === "uncertain" || Math.abs(best - match) < 6 || gap < 15) confidence = "medium";
  if (damaged && confidence === "high") confidence = "medium";
  if (label === "uncertain" && damaged) confidence = "low";

  return { label, lean: label === "neither" ? null : lean, confidence, reason };
}
