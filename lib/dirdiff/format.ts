export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n;
  let i = -1;
  do {
    v /= 1024;
    i++;
  } while (v >= 1024 && i < units.length - 1);
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function formatCount(n: number): string {
  return n.toLocaleString("zh-CN");
}

/** Normalize backslashes to forward slashes (for rel paths / display). */
export function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Strip leading "./" and collapse duplicate separators in a rel path. */
export function cleanRel(rel: string): string {
  return toPosix(rel).replace(/^\.\/+/, "").replace(/\/{2,}/g, "/");
}

export function basename(rel: string): string {
  const p = toPosix(rel).replace(/\/+$/, "");
  const i = p.lastIndexOf("/");
  return i === -1 ? p : p.slice(i + 1);
}