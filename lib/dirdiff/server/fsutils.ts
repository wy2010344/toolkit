import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Windows long paths: prefix absolute paths with `\\?\` so Node can access
 * paths beyond the 260-char limit. Normal paths are left untouched to keep
 * output and relative computations clean. UNC paths use the `\\?\UNC\` form.
 */
export function toSafePath(p: string): string {
  if (process.platform !== "win32") return p;
  if (/^\\\\\?\\/.test(p)) return p;
  if (p.length < 248) return p;
  if (/^\\\\[^\\]+\\/.test(p)) return `\\\\?\\UNC\\${p.slice(2)}`;
  if (path.isAbsolute(p)) return `\\\\?\\${p}`;
  return p;
}

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(toSafePath(p));
    return true;
  } catch {
    return false;
  }
}

export async function statOrNull(p: string): Promise<fs.Stats | null> {
  try {
    return await fs.promises.stat(toSafePath(p));
  } catch {
    return null;
  }
}

/** Stream a file and return its SHA-1 hex digest. */
export async function sha1File(p: string): Promise<string> {
  const hash = crypto.createHash("sha1");
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(toSafePath(p));
    stream.on("data", (c) => hash.update(c));
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });
  return hash.digest("hex");
}

/** Run `fn` over `items` with at most `limit` tasks in flight. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/** Copy a file between roots, preserving the source mtime. */
export async function copyFilePreservingMtime(src: string, dest: string): Promise<void> {
  const safeSrc = toSafePath(src);
  await fs.promises.mkdir(path.dirname(toSafePath(dest)), { recursive: true });
  await fs.promises.copyFile(safeSrc, toSafePath(dest));
  const st = await fs.promises.stat(safeSrc);
  await fs.promises.utimes(toSafePath(dest), st.atime, st.mtime);
}

/** Best-effort removal of a dir and its empty ancestors up to (not incl.) `root`. */
export async function removeEmptyAncestors(dir: string, root: string): Promise<void> {
  let current = path.dirname(toSafePath(dir));
  const stop = toSafePath(root);
  while (current.startsWith(stop) && current !== stop && current.length > stop.length) {
    await fs.promises.rmdir(current).catch(() => {});
    current = path.dirname(current);
  }
}

/**
 * Guard against path traversal: `rel` must stay inside `root` after resolving.
 * Throws on `..`/absolute/UNC attempts.
 */
export function assertRelInside(root: string, rel: string): void {
  const resolved = path.resolve(root, rel);
  const fromRoot = path.relative(path.resolve(root), resolved);
  if (fromRoot.startsWith("..") || path.isAbsolute(fromRoot)) {
    throw new Error(`非法路径: ${rel}`);
  }
}