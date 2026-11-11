import type { Issue } from "../types";

export interface ReadResult {
  text: string;
  mimeType: string;
  issues: Issue[];
}

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function detectType(filename: string, bytes: Uint8Array): string {
  const lower = filename.toLowerCase();
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (isPdf || lower.endsWith(".pdf")) return "application/pdf";
  if (isZip || lower.endsWith(".docx")) return DOCX;
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text/plain";
  return "application/octet-stream";
}

export function normalizeText(t: string): string {
  return t
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    .replace(/[​﻿]/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+$/, "").replace(/^\s+/, ""))
    .filter((l, i, arr) => l !== "" || (i > 0 && arr[i - 1] !== ""))
    .join("\n")
    .trim();
}

/** Turn an uploaded file into plain text. Never throws: failures become issues. */
export async function readResume(filename: string, buffer: Buffer): Promise<ReadResult> {
  const bytes = new Uint8Array(buffer);
  const mimeType = detectType(filename, bytes);
  const issues: Issue[] = [];
  let text = "";

  try {
    if (mimeType === DOCX) {
      const mammoth = await import("mammoth");
      const res = await mammoth.extractRawText({ buffer });
      text = res.value;
    } else if (mimeType === "application/pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes);
      const res = await extractText(pdf, { mergePages: false });
      text = (res.text as string[]).join("\n");
    } else if (mimeType === "text/plain") {
      text = buffer.toString("utf8");
    } else if (mimeType === "application/msword") {
      issues.push({
        stage: "read",
        severity: "error",
        code: "UNSUPPORTED_DOC",
        message: "Legacy .doc files are not supported. Save the resume as .docx or .pdf and upload again.",
      });
    } else {
      issues.push({
        stage: "read",
        severity: "error",
        code: "UNSUPPORTED_TYPE",
        message: `Unsupported file type for "${filename}". Upload a .docx, .pdf or .txt file.`,
      });
    }
  } catch (err) {
    issues.push({
      stage: "read",
      severity: "error",
      code: "READ_FAILED",
      message: `The file could not be opened (${(err as Error).message.slice(0, 140)}). It may be corrupted or password-protected.`,
    });
  }

  text = normalizeText(text);
  if (!issues.some((i) => i.severity === "error") && text.length === 0) {
    issues.push({
      stage: "read",
      severity: "error",
      code: "EMPTY_DOCUMENT",
      message:
        mimeType === "application/pdf"
          ? "No text layer found in this PDF — it is probably a scanned image. OCR is required before it can be scored."
          : "The document opened correctly but contains no text, so nothing could be extracted or scored.",
    });
  }
  return { text, mimeType, issues };
}
