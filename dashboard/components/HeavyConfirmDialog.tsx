/**
 * Heavy workload confirmation dialog — requires typing "yes" before starting large models.
 */
"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HeavyConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelLabel: string;
  onConfirm: () => void;
}

/** Guards destructive inference starts with an explicit typed confirmation. */
export function HeavyConfirmDialog({ open, onOpenChange, modelLabel, onConfirm }: HeavyConfirmDialogProps) {
  const [value, setValue] = React.useState("");

  const handleOpenChange = (next: boolean) => {
    if (!next) setValue("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Heavy workload confirmation</DialogTitle>
          <DialogDescription>
            Starting <strong>{modelLabel}</strong> requests significant GPUs and memory. Can make SSH unresponsive if
            limits are exceeded. Type <code className="text-xs">yes</code> to confirm.
          </DialogDescription>
        </DialogHeader>
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="yes" autoComplete="off" />
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={value !== "yes"}
            onClick={() => {
              onConfirm();
              handleOpenChange(false);
            }}
          >
            Confirm start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
