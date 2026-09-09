import { execFile } from "node:child_process";
import { NextRequest, NextResponse } from "next/server";
import type { GitCheckoutResult, GitInfo } from "@/lib/dirdiff/types";

function runGit(path: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["-C", path, ...args],
      { windowsHide: true, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        const e = err as (Error & { code?: number }) | null;
        resolve({
          code: e?.code ?? (err ? 1 : 0),
          stdout: String(stdout ?? "").trim(),
          stderr: String(stderr ?? "").trim(),
        });
      },
    );
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { action?: unknown; path?: unknown; ref?: unknown } | null;
  const path = typeof body?.path === "string" && body.path.trim() ? body.path.trim() : null;
  if (!path) return NextResponse.json({ error: "缺少路径" }, { status: 400 });

  if (body?.action === "checkout") {
    const ref = typeof body.ref === "string" ? body.ref.trim() : "";
    if (!ref || !/^[A-Za-z0-9._/+-]+$/.test(ref) || ref.startsWith("-") || ref.includes("..")) {
      return NextResponse.json({ error: "非法分支 / 标签名" }, { status: 400 });
    }
    const res = await runGit(path, ["checkout", "--quiet", ref]);
    if (res.code !== 0) {
      return NextResponse.json({ error: res.stderr || res.stdout || "git checkout 失败" }, { status: 400 });
    }
    const branch = await runGit(path, ["branch", "--show-current"]);
    const result: GitCheckoutResult = { branch: branch.stdout || null };
    return NextResponse.json(result);
  }

  if (body?.action === "status") {
    const inside = await runGit(path, ["rev-parse", "--is-inside-work-tree"]);
    if (inside.code !== 0) return NextResponse.json({ info: { isRepo: false } satisfies GitInfo });
    const [root, branch] = await Promise.all([
      runGit(path, ["rev-parse", "--show-toplevel"]),
      runGit(path, ["branch", "--show-current"]),
    ]);
    const [heads, tags] = await Promise.all([
      runGit(path, ["for-each-ref", "refs/heads", "--format=%(refname:short)"]),
      runGit(path, ["for-each-ref", "refs/tags", "--format=%(refname:short)"]),
    ]);
    const refs: GitInfo["refs"] = [
      ...heads.stdout.split("\n").filter(Boolean).map((name) => ({ name, type: "branch" as const })),
      ...tags.stdout.split("\n").filter(Boolean).map((name) => ({ name, type: "tag" as const })),
    ];
    const info: GitInfo = {
      isRepo: true,
      root: root.stdout,
      branch: branch.stdout || null,
      refs,
    };
    return NextResponse.json({ info });
  }

  return NextResponse.json({ error: "未知操作" }, { status: 400 });
}