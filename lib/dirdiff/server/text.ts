import fs from "node:fs";
import { toSafePath } from "./fsutils";

export const MAX_DIFF_FETCH_BYTES = 2 * 1024 * 1024; // files larger than this are "too large" to diff
const SNIFF_BYTES = 8192;

/** Heuristic: a NUL byte in the first 8 KB almost always means binary. */
export function isProbablyTextBuffer(buf: Buffer): boolean {
  const end = Math.min(buf.length, SNIFF_BYTES);
  for (let i = 0; i < end; i++) if (buf[i] === 0) return false;
  return true;
}

function decodeBuffer(buf: Buffer): string {
  if (buf.length >= 2) {
    if (buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le", 2);
    if (buf[0] === 0xfe && buf[1] === 0xff) return Buffer.from(buf.subarray(2)).swap16().toString("utf16le");
  }
  let s = buf.toString("utf8"); // text encoding with graceful replacement
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); // strip UTF-8 BOM
  return s;
}

export type ReadTextResult =
  | { ok: true; text: string; truncated: boolean; size: number }
  | { ok: false; reason: "binary" | "too-large" | "missing" | "error"; size?: number; message?: string };

/** Read a file as text, capped at MAX_DIFF_FETCH_BYTES. */
export async function readTextFile(p: string): Promise<ReadTextResult> {
  const safe = toSafePath(p);
  let st;
  try {
    st = await fs.promises.stat(safe);
  } catch {
    return { ok: false, reason: "missing" };
  }
  if (st.size > MAX_DIFF_FETCH_BYTES) return { ok: false, reason: "too-large", size: st.size };
  let buf: Buffer;
  try {
    buf = await fs.promises.readFile(safe);
  } catch (err) {
    return { ok: false, reason: "error", size: st.size, message: (err as Error).message };
  }
  if (!isProbablyTextBuffer(buf)) return { ok: false, reason: "binary", size: st.size };
  return { ok: true, text: decodeBuffer(buf), truncated: false, size: st.size };
}

/** Cheap check that the file actually looks readable as text (buffer-sniff). */
export async function sniffText(p: string): Promise<boolean> {
  const safe = toSafePath(p);
  try {
    const fh = await fs.promises.open(safe, "r");
    try {
      const buf = Buffer.allocUnsafe(SNIFF_BYTES);
      const { bytesRead } = await fh.read(buf, 0, SNIFF_BYTES, 0);
      return isProbablyTextBuffer(buf.subarray(0, bytesRead));
    } finally {
      await fh.close();
    }
  } catch {
    return false;
  }
}