export type EntryStatus =
  | "left-only"
  | "right-only"
  | "modified"
  | "equal"
  | "conflict";

export interface FileMeta {
  size: number;
  mtimeMs: number;
  /** Whether the file looks like text (only set for files small enough to diff). */
  isText?: boolean;
}

export interface CompareEntry {
  /** Path relative to the compared roots, always POSIX-style. */
  rel: string;
  type: "file" | "dir";
  status: EntryStatus;
  left?: FileMeta;
  right?: FileMeta;
  /** Populated when the entry could not be fully inspected. */
  error?: string;
}

export interface CompareRequest {
  left: string;
  right: string;
  /** gitignore-style patterns. */
  ignore: string[];
  includeHidden: boolean;
  /** Also list files that are identical on both sides (default false). */
  includeEqual?: boolean;
}

export interface CompareStats {
  "left-only": number;
  "right-only": number;
  modified: number;
  equal: number;
  conflict: number;
}

export interface CompareResult {
  entries: CompareEntry[];
  stats: CompareStats;
  /** Number of files hash-compared (potentially slow part). */
  hashed: number;
  totalScanned: number;
  durationMs: number;
  warnings: string[];
}

export interface ProgressPayload {
  phase: "walk" | "hash";
  done: number;
  total: number;
  /** Current directory being scanned during the walk phase. */
  label?: string;
}

export interface DiffGroup {
  id: string;
  name: string;
  left: string;
  right: string;
  ignore: string[];
  includeHidden: boolean;
  createdAt: number;
  updatedAt: number;
}

/** A file's readable content for a diff/preview modal. */
export type FileContent =
  | { kind: "text"; text: string; truncated: boolean; size: number }
  | { kind: "binary" | "too-large" | "missing" | "error"; size?: number; message?: string };

export type FileContentsResponse = {
  left: FileContent;
  right: FileContent;
  rel: string;
};

export type SyncDirection = "left-to-right" | "right-to-left";

export interface SyncEntryInput {
  rel: string;
  type: "file" | "dir";
  status: EntryStatus;
  /** Source-side size (bytes) used for plan estimates. */
  size?: number;
}

export interface SyncRequest {
  left: string;
  right: string;
  entries: SyncEntryInput[];
  deleteExtra: boolean;
  direction: SyncDirection;
  dryRun?: boolean;
}

export interface SyncItem {
  rel: string;
  kind: "copy" | "delete" | "skip";
  reason?: string;
}

export interface SyncPlan {
  copies: SyncItem[];
  deletions: SyncItem[];
  skipped: SyncItem[];
  copyBytes: number;
}

export interface SyncResult extends SyncPlan {
  applied: SyncItem[];
  failed: SyncItem[];
}

export interface GitRef {
  name: string;
  type: "branch" | "tag";
}

export interface GitInfo {
  isRepo: boolean;
  /** Work-tree top-level directory. */
  root?: string;
  /** Current branch name, or null when HEAD is detached. */
  branch?: string | null;
  refs?: GitRef[];
}

export interface GitCheckoutResult {
  branch: string | null;
}