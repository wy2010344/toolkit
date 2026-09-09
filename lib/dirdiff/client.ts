import type {
  CompareRequest,
  CompareResult,
  DiffGroup,
  FileContentsResponse,
  ProgressPayload,
  SyncPlan,
  SyncRequest,
  SyncResult,
} from "./types";

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as T & { error?: string };
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json;
}

export async function fetchGroups(): Promise<DiffGroup[]> {
  const res = await fetch("/api/dirdiff/groups");
  const json = (await res.json()) as { groups: DiffGroup[] };
  return json.groups ?? [];
}

/** POST a compare job and read the NDJSON progress stream until completion. */
export async function streamCompare(
  req: CompareRequest,
  onProgress?: (p: ProgressPayload) => void,
): Promise<CompareResult> {
  const res = await fetch("/api/dirdiff/compare", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok || !res.body) {
    const j = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(j?.error ?? `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: CompareResult | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as { type: string } & Record<string, unknown>;
      if (msg.type === "progress") onProgress?.(msg as unknown as ProgressPayload);
      else if (msg.type === "done") result = msg.result as CompareResult;
      else if (msg.type === "error") throw new Error((msg as unknown as { message?: string }).message ?? "对比失败");
    }
  }
  if (!result) throw new Error("对比未能完成");
  return result;
}

export async function fetchContents(
  left: string,
  right: string,
  rel: string,
): Promise<FileContentsResponse> {
  return postJson<FileContentsResponse>("/api/dirdiff/contents", { left, right, rel });
}

export async function previewSync(req: SyncRequest): Promise<SyncPlan> {
  const { plan } = await postJson<{ plan: SyncPlan }>("/api/dirdiff/sync", { ...req, dryRun: true });
  return plan;
}

export async function executeSync(req: SyncRequest): Promise<SyncResult> {
  const { result } = await postJson<{ result: SyncResult }>("/api/dirdiff/sync", { ...req, dryRun: false });
  return result;
}