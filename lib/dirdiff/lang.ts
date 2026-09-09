import hljs from "highlight.js/lib/core";
import type { LanguageFn } from "highlight.js";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import markdown from "highlight.js/lib/languages/markdown";
import yaml from "highlight.js/lib/languages/yaml";
import css from "highlight.js/lib/languages/css";
import scss from "highlight.js/lib/languages/scss";
import less from "highlight.js/lib/languages/less";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import kotlin from "highlight.js/lib/languages/kotlin";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import ruby from "highlight.js/lib/languages/ruby";
import php from "highlight.js/lib/languages/php";
import bash from "highlight.js/lib/languages/bash";
import powershell from "highlight.js/lib/languages/powershell";
import sql from "highlight.js/lib/languages/sql";
import ini from "highlight.js/lib/languages/ini";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import makefile from "highlight.js/lib/languages/makefile";
import diff from "highlight.js/lib/languages/diff";
import plaintext from "highlight.js/lib/languages/plaintext";

const REGISTERED: Array<{ name: string; fn: LanguageFn }> = [
  { name: "javascript", fn: javascript },
  { name: "typescript", fn: typescript },
  { name: "json", fn: json },
  { name: "xml", fn: xml },
  { name: "markdown", fn: markdown },
  { name: "yaml", fn: yaml },
  { name: "css", fn: css },
  { name: "scss", fn: scss },
  { name: "less", fn: less },
  { name: "python", fn: python },
  { name: "java", fn: java },
  { name: "kotlin", fn: kotlin },
  { name: "c", fn: c },
  { name: "cpp", fn: cpp },
  { name: "csharp", fn: csharp },
  { name: "go", fn: go },
  { name: "rust", fn: rust },
  { name: "ruby", fn: ruby },
  { name: "php", fn: php },
  { name: "bash", fn: bash },
  { name: "powershell", fn: powershell },
  { name: "sql", fn: sql },
  { name: "ini", fn: ini },
  { name: "dockerfile", fn: dockerfile },
  { name: "makefile", fn: makefile },
  { name: "diff", fn: diff },
  { name: "plaintext", fn: plaintext },
];

for (const { name, fn } of REGISTERED) {
  if (!hljs.getLanguage(name)) hljs.registerLanguage(name, fn);
}

const EXT_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "json",
  avsc: "json",
  md: "markdown",
  markdown: "markdown",
  mdx: "markdown",
  yml: "yaml",
  yaml: "yaml",
  html: "xml",
  htm: "xml",
  xml: "xml",
  svg: "xml",
  xhtml: "xml",
  css: "css",
  scss: "scss",
  less: "less",
  py: "python",
  pyw: "python",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  hh: "cpp",
  hxx: "cpp",
  cs: "csharp",
  go: "go",
  rs: "rust",
  rb: "ruby",
  php: "php",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  ps1: "powershell",
  psd1: "powershell",
  psm1: "powershell",
  sql: "sql",
  ini: "ini",
  toml: "ini",
  conf: "ini",
  cfg: "ini",
  diff: "diff",
  patch: "diff",
  txt: "plaintext",
  log: "plaintext",
};

const DOTFILE_NAMES = new Set(["dockerfile", "makefile"]);

export function detectLanguage(name: string): string {
  const lower = name.toLowerCase();
  const base = lower.split("/").pop() ?? lower;
  if (DOTFILE_NAMES.has(base)) return base;
  if (base.startsWith(".")) return "ini";
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "plaintext";
  return EXT_MAP[base.slice(dot + 1)] ?? "plaintext";
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}