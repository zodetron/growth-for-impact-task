export interface JobProfile {
  id: "lca" | "ux";
  title: string;
  shortTitle: string;
  sourceFile: string;
  company: string;
  location: string;
  employment: string;
  experienceBand: string;
  pitch: string;
  mustHave: string[];
  niceToHave: string[];
  criteria: { key: string; label: string; weight: number; how: string }[];
}

export const JOBS: Record<"lca" | "ux", JobProfile> = {
  lca: {
    id: "lca",
    title: "LCA Consultant (Chennai based / relocate)",
    shortTitle: "LCA Consultant",
    sourceFile: "JD1.pdf",
    company: "Global sustainability consultancy (client-deployed)",
    location: "Chennai · onsite, relocation supported",
    employment: "Full-time · min. 1-year commitment · extensive travel across India",
    experienceBand: "2–3 years running LCA projects independently",
    pitch:
      "Build Life Cycle Inventory datasets, run ISO 14040/44 LCA studies in GaBi or SimaPro and benchmark results against industry peers for manufacturing clients.",
    mustHave: [
      "2–3 years running LCA projects independently",
      "Hands-on GaBi or SimaPro",
      "At least 3 completed LCA projects",
      "Follows ISO 14040 / ISO 14044",
      "Willing to work onsite in Chennai and travel",
    ],
    niceToHave: [
      "EPD (Environmental Product Declaration) experience",
      "Environmental-domain degree",
      "Basic business finance & accounting",
    ],
    criteria: [
      { key: "experience", label: "Relevant LCA experience", weight: 25, how: "Months in roles with LCA work count fully; adjacent sustainability/GHG roles count 25%; internships count half. Overlapping roles are not double counted. ≥2 years earns full marks." },
      { key: "software", label: "GaBi / SimaPro", weight: 20, how: "20 if GaBi or SimaPro appears in experience or projects, 15 if only listed under skills, 8 for other LCA tools only (openLCA, One Click LCA, Air.e, EIME, Umberto)." },
      { key: "projects", label: "Completed LCA projects", weight: 15, how: "Counts distinct LCA studies in experience bullets and projects (and stated EPD counts). ≥3 = 15, 2 = 10, 1 = 5." },
      { key: "methods", label: "LCA methodology depth", weight: 15, how: "LCI building, system boundaries, functional unit, cradle-to-gate/grave, ecoinvent, impact methods, hotspots, data validation, benchmarking… 2.5 pts each when applied, 1 when only listed." },
      { key: "standards", label: "ISO 14040/14044 & standards", weight: 10, how: "10 for explicit ISO 14040/14044; 7 when the anonymiser stripped the digits but an ISO reference sits in LCA context; 5 for related standards (ISO 14067, EN 15804, PCR, GHG Protocol)." },
      { key: "education", label: "Education", weight: 10, how: "Environmental / sustainability degree = 10, engineering or science = 6, other degree = 3." },
      { key: "epd", label: "EPD experience (preferred)", weight: 5, how: "5 if EPD / PEP work appears in experience or projects, 3 if only mentioned." },
    ],
  },
  ux: {
    id: "ux",
    title: "UI/UX Design Internship — Growth For Impact",
    shortTitle: "UI/UX Intern",
    sourceFile: "JD2.pdf",
    company: "Growth For Impact — “LinkedIn for sustainability”",
    location: "Fully remote",
    employment: "Internship · ₹10,000–15,000 / month · first design hire",
    experienceBand: "0–1 year (fresh graduates welcome)",
    pitch:
      "Revamp the website and design the job board end-to-end in Figma, grounded in user research and a strong sense of user psychology and aesthetics.",
    mustHave: [
      "Figma and prototyping",
      "Understanding of user psychology / user research",
      "Creative, experimental portfolio",
      "Eye for detail & aesthetic sense",
    ],
    niceToHave: ["Website or job-board / marketplace design", "Design systems & accessibility", "Interest in sustainability"],
    criteria: [
      { key: "tools", label: "Figma & prototyping", weight: 20, how: "Figma used in experience/projects = 14 (listed only = 10) plus 6 for prototyping evidence (prototypes, Framer, ProtoPie, Adobe XD)." },
      { key: "research", label: "User research & psychology", weight: 20, how: "User research, interviews, usability testing, personas, journey maps, heuristic evaluation, card sorting, A/B tests, behavioural UX… 4 pts each when applied, 2 when only listed." },
      { key: "portfolio", label: "Portfolio & projects", weight: 15, how: "Distinct design projects and design roles: 1 = 6, 2 = 9, 3 = 12, 4+ = 15." },
      { key: "craft", label: "UI craft & visual design", weight: 15, how: "Visual hierarchy, typography, design systems, responsive, accessibility/WCAG, micro-interactions, high-fidelity UI… 2.5 each when applied, 1.5 when listed." },
      { key: "fit", label: "Experience fit (0–1 yr)", weight: 15, how: "Design experience up to ~1.5 years = 15; none but 2+ projects = 9; 1.5–3 years = 11 (beyond intern band); >3 years = 7 (likely over-qualified)." },
      { key: "education", label: "Education", weight: 10, how: "Design / HCI degree = 10, CS / IT / engineering = 6, other = 4; +2 for a UX certificate (max 10)." },
      { key: "domain", label: "Website / job-board relevance", weight: 5, how: "Websites, landing pages, hiring/job platforms, dashboards, SaaS or sustainability work: 1.5 each (max 5)." },
    ],
  },
};
