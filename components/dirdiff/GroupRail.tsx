"use client";

import { Plus, Trash } from "@phosphor-icons/react/dist/ssr";
import { IconButton, cn } from "@/components/ui";
import { basename } from "@/lib/dirdiff/format";
import type { DiffGroup } from "@/lib/dirdiff/types";

export function GroupRail({
  groups,
  activeId,
  isDirty,
  onSelect,
  onDelete,
  onNew,
}: {
  groups: DiffGroup[];
  activeId: string | null;
  isDirty: boolean;
  onSelect: (g: DiffGroup) => void;
  onDelete: (g: DiffGroup) => void;
  onNew: () => void;
}) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="flex-1 text-[13px] font-semibold tracking-wide text-ink">对比方案</h2>
        <button
          onClick={onNew}
          className="inline-flex h-6 items-center gap-1 rounded-md bg-ink px-2 text-[11px] font-medium text-white transition-colors hover:bg-ink-soft active:scale-[0.98]"
        >
          <Plus size={12} weight="bold" /> 新建
        </button>
      </div>

      <div className="scroll-area min-h-0 flex-1 overflow-y-auto py-1">
        {groups.length === 0 && (
          <p className="px-4 py-6 text-center text-[12px] leading-relaxed text-faint">
            还没有保存的方案。
            <br />
            填好左右目录后点「保存方案」。
          </p>
        )}
        {groups.map((g) => {
          const active = g.id === activeId;
          return (
            <div
              key={g.id}
              className={cn(
                "group relative flex cursor-pointer flex-col gap-0.5 border-l-2 px-4 py-2.5 transition-colors",
                active ? "border-ink bg-surface-mute" : "border-transparent hover:bg-surface-mute/60",
              )}
              onClick={() => onSelect(g)}
            >
              <div className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                  {g.name}
                  {active && isDirty && <span className="ml-1.5 text-[11px] font-normal text-acc-yellow-fg">未保存</span>}
                </span>
                <IconButton
                  label="删除方案"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(g);
                  }}
                >
                  <Trash size={13} />
                </IconButton>
              </div>
              <div className="truncate font-mono text-[11px] text-faint">
                {basename(g.left) || g.left} <span className="text-line-strong">→</span> {basename(g.right) || g.right}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-line px-4 py-3">
        <p className="font-mono text-[10.5px] leading-relaxed text-faint">
          方案保存在 data/dirdiff-groups.json,仅本机可见。
        </p>
      </div>
    </aside>
  );
}