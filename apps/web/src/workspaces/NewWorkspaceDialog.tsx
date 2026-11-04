import { WORKSPACE_BACKEND_ID_PREFIX } from "@t3tools/contracts";
import { useState, type FormEvent } from "react";

import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { useDefaultWorkspaceLabel } from "./activeWorkspace";
import { toastManager } from "../components/ui/toast";
import { useWorkspacesStore } from "./workspacesStore";

export function NewWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (backendId: string) => void;
}) {
  const defaultLabel = useDefaultWorkspaceLabel();
  const setWorkspaces = useWorkspacesStore((store) => store.setWorkspaces);
  const [name, setName] = useState("");

  const createWorkspace = async (event: FormEvent) => {
    event.preventDefault();
    const bridge = window.desktopBridge;
    if (bridge === undefined) return;
    try {
      const next = await bridge.createWorkspace({ name });
      const created = next.at(-1);
      setWorkspaces(next);
      onOpenChange(false);
      setName("");
      if (created !== undefined) onCreated(`${WORKSPACE_BACKEND_ID_PREFIX}${created.id}`);
    } catch {
      toastManager.add({
        type: "error",
        title: "Could not create workspace",
        description: "The name is empty or already in use.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup>
        <form className="contents" onSubmit={(event) => void createWorkspace(event)}>
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>
              Gets its own threads and projects. Logins, tools and settings come from {defaultLabel}
              , and you can separate them in Settings.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <Input
              aria-label="Workspace name"
              autoFocus
              placeholder="Workspace name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </DialogPanel>
          <DialogFooter>
            <Button type="submit" disabled={name.trim().length === 0}>
              Create workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
