import { useAtomValue } from "@effect/atom-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { WORKSPACE_JUMP_KEYBINDING_COMMANDS } from "@t3tools/contracts";
import { BoxesIcon, GripVerticalIcon } from "lucide-react";

import { updateClientSettings } from "../../hooks/useSettings";
import { shortcutLabelForCommand } from "../../keybindings";
import { cn } from "../../lib/utils";
import { primaryServerKeybindingsAtom } from "../../state/server";
import {
  useWorkspaceOptions,
  workspaceOptionKey,
  type WorkspaceOption,
} from "../../workspaces/activeWorkspace";
import { WorkspaceIcon } from "../../workspaces/WorkspaceIcon";
import { SettingsSection } from "./settingsLayout";

function SortableWorkspaceRow({
  option,
  position,
  shortcut,
}: {
  option: WorkspaceOption;
  position: number;
  shortcut: string | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: workspaceOptionKey(option) });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2.5 border-t border-border/60 px-4 py-2 first:border-t-0 sm:px-5",
        isDragging && "relative z-10 rounded-md bg-background shadow-md",
      )}
    >
      <WorkspaceIcon option={option} fallback={<BoxesIcon className="size-4 shrink-0" />} />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{option.label}</span>
      {shortcut === null ? null : (
        <kbd className="shrink-0 font-sans text-xs text-muted-foreground">{shortcut}</kbd>
      )}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${option.label}, position ${position}`}
        className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:text-foreground"
      >
        <GripVerticalIcon className="size-3.5" />
      </button>
    </li>
  );
}

export function WorkspaceOrderSection() {
  const options = useWorkspaceOptions();
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const order = options.map(workspaceOptionKey);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (event.over === null || event.active.id === event.over.id) return;
    void updateClientSettings({
      workspaceOrder: arrayMove(
        order,
        order.indexOf(String(event.active.id)),
        order.indexOf(String(event.over.id)),
      ),
    });
  };

  return (
    <SettingsSection id="workspace-order" title="Order">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ol aria-label="Workspaces in switcher order">
            {options.map((option, index) => {
              const command = WORKSPACE_JUMP_KEYBINDING_COMMANDS[index];
              return (
                <SortableWorkspaceRow
                  key={workspaceOptionKey(option)}
                  option={option}
                  position={index + 1}
                  shortcut={
                    command ? (shortcutLabelForCommand(keybindings, command) ?? null) : null
                  }
                />
              );
            })}
          </ol>
        </SortableContext>
      </DndContext>
    </SettingsSection>
  );
}
