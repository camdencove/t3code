import type { ReactNode } from "react";

import { ProjectIconGlyph } from "../components/ProjectFavicon";
import { cn } from "../lib/utils";
import { workspaceColorClass, type WorkspaceOption } from "./activeWorkspace";

export function WorkspaceIcon(props: {
  readonly option: Pick<WorkspaceOption, "icon" | "workspaceId">;
  readonly fallback?: ReactNode;
}) {
  const { icon, workspaceId } = props.option;
  if (icon !== null) return <ProjectIconGlyph icon={icon} className="size-4 shrink-0" />;
  if (workspaceId === null) return props.fallback ?? null;
  return (
    <span
      aria-hidden
      className={cn("size-2.5 shrink-0 rounded-full", workspaceColorClass(workspaceId))}
    />
  );
}
