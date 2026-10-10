/**
 * Signature-based classifiers for payload attacks and malicious uploads.
 *
 * These complement the behavioural Random Forest (src/lib/mlRiskEngine.ts):
 * the forest scores *how a session behaves*; this module recognises *what an
 * input contains*. Pure functions, no dependencies, so they run on both the
 * server (share inputs) and the client (upload dialog). Evaluated against a
 * labelled corpus in ml/threat_corpus.json (see ml/THREAT_CLASSIFIER.md).
 */

export type PayloadCategory = "sql_injection" | "xss" | "path_traversal" | "command_injection";
export type ThreatCategory = PayloadCategory | "malicious_upload" | "none";

export interface ThreatVerdict {
  category: ThreatCategory;
  reasons: string[];
}

const PAYLOAD_RULES: { category: PayloadCategory; name: string; pattern: RegExp }[] = [
  {
    category: "sql_injection",
    name: "tautology",
    pattern: /['"`]\s*\b(or|and)\b\s+['"`]?\w*['"`]?\s*=\s*['"`]?\w*|\b(or|and)\b\s+\d+\s*=\s*\d+/i,
  },
  {
    category: "sql_injection",
    name: "union select",
    pattern: /\bunion\b[\s/*]+(all[\s/*]+)?\bselect\b/i,
  },
  {
    category: "sql_injection",
    name: "stacked statement",
    pattern: /;\s*(drop|delete|insert|update|alter|truncate|exec)\b/i,
  },
  {
    category: "sql_injection",
    name: "comment terminator",
    pattern: /(['"`)]\s*)(--|#|\/\*)/,
  },
  {
    category: "sql_injection",
    name: "time-based",
    pattern: /\b(sleep|benchmark|pg_sleep|waitfor\s+delay)\s*\(|waitfor\s+delay\s+'/i,
  },
  { category: "xss", name: "script tag", pattern: /<\s*script\b/i },
  {
    category: "xss",
    name: "event handler",
    pattern: /\bon(error|load|click|mouseover|focus)\s*=/i,
  },
  { category: "xss", name: "javascript uri", pattern: /javascript\s*:/i },
  {
    category: "xss",
    name: "embedded frame",
    pattern: /<\s*(iframe|svg|img)\b[^>]*(src|onload|onerror)/i,
  },
  {
    category: "path_traversal",
    name: "dot-dot",
    pattern: /(\.\.+[/\\])|(%2e%2e(%2f|%5c))|(\.\.%2f)/i,
  },
  {
    category: "path_traversal",
    name: "sensitive file",
    pattern: /(\/etc\/(passwd|shadow)|[a-z]:\\windows\\|\/proc\/self)/i,
  },
  {
    category: "command_injection",
    name: "shell chaining",
    pattern: /(;|&&|\||&)\s*(cat|ls|id|whoami|wget|curl|nc|bash|sh|powershell|cmd)\b/i,
  },
  {
    category: "command_injection",
    name: "command substitution",
    pattern: /\$\([^)]+\)|`[^`]+`/,
  },
];

/** Classifies a free-text input (share code, password, form field). */
export function classifyPayload(input: string): ThreatVerdict {
  let decoded = input;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    /* keep raw text when it is not valid percent-encoding */
  }
  const candidates = decoded === input ? [input] : [input, decoded];
  for (const candidate of candidates) {
    for (const rule of PAYLOAD_RULES) {
      if (rule.pattern.test(candidate)) return { category: rule.category, reasons: [rule.name] };
    }
  }
  return { category: "none", reasons: [] };
}

const EXECUTABLE_EXT = new Set([
  "exe",
  "dll",
  "bat",
  "cmd",
  "com",
  "scr",
  "msi",
  "ps1",
  "vbs",
  "js",
  "jse",
  "wsf",
  "sh",
  "jar",
  "apk",
  "hta",
  "cpl",
  "lnk",
  "php",
  "phtml",
  "jsp",
  "asp",
  "aspx",
]);
const DOCUMENT_EXT = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "csv",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "zip",
]);
const MIME_BY_EXT: Record<string, string[]> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  gif: ["image/gif"],
  txt: ["text/plain"],
  csv: ["text/csv", "application/vnd.ms-excel", "text/plain"],
  zip: ["application/zip", "application/x-zip-compressed"],
};

/** Leading bytes of executables and scripts. */
const EXECUTABLE_MAGIC = [
  { name: "Windows PE (MZ)", bytes: [0x4d, 0x5a] },
  { name: "ELF", bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { name: "shell script", bytes: [0x23, 0x21] },
];

/**
 * Classifies an upload from its name, declared MIME type and (optionally) its
 * first bytes. `head` should be the first 8 or more bytes of the file.
 */
export function classifyUpload(
  file: { name: string; type?: string },
  head?: Uint8Array,
): ThreatVerdict {
  const reasons: string[] = [];
  const parts = file.name.toLowerCase().split(".").filter(Boolean);
  const ext = parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";

  if (EXECUTABLE_EXT.has(ext)) reasons.push(`executable extension .${ext}`);
  if (parts.length > 2) {
    const inner = parts[parts.length - 2] ?? "";
    if (DOCUMENT_EXT.has(inner) && EXECUTABLE_EXT.has(ext)) reasons.push("double extension");
  }
  // eslint-disable-next-line no-control-regex -- NUL / bidi override in a file name is the signal
  if (/[‮\u0000]/.test(file.name)) reasons.push("control character in name");

  const expected = MIME_BY_EXT[ext];
  if (expected && file.type && !expected.includes(file.type.toLowerCase()))
    reasons.push(`MIME ${file.type} does not match .${ext}`);

  if (head && head.length >= 2 && !EXECUTABLE_EXT.has(ext)) {
    for (const magic of EXECUTABLE_MAGIC) {
      if (magic.bytes.every((byte, i) => head[i] === byte))
        reasons.push(`${magic.name} content disguised as .${ext || "file"}`);
    }
  }

  return reasons.length
    ? { category: "malicious_upload", reasons }
    : { category: "none", reasons: [] };
}
