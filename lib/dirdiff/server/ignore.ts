import ignore from "ignore";

/** Built-in rules that can never be turned off (repo metadata). */
const BUILTIN: string[] = [".git"];

function cleanPattern(raw: string): string {
  const p = raw.trim().replace(/\\/g, "/");
  if (!p || p.startsWith("#")) return "";
  return p.replace(/^\.\/+/, "");
}

/**
 * Builds a `rel -> ignored` checker following .gitignore semantics:
 * negation (`!`), directory-only suffixes (`/`), anchoring and
 * parent-directory pruning all behave as users expect.
 */
export function buildIgnoreChecker(patterns: string[]): (rel: string) => boolean {
  const ig = ignore();
  const seen = new Set<string>();
  for (const raw of [...BUILTIN, ...patterns]) {
    const p = cleanPattern(raw);
    if (p && !seen.has(p)) {
      seen.add(p);
      ig.add(p);
    }
  }
  return (rel: string) => ig.ignores(rel);
}