/**
 * Lab secrets panel — CRUD for encrypted secrets with optional K8s sync targets.
 */
"use client";

import React from "react";
import {
  createSecretAction,
  deleteSecretAction,
  revealSecretAction,
  syncSecretToK8sAction,
  updateSecretValueAction
} from "@/actions/secrets-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { panelSubheaderClass } from "@/components/panel-styles";
import type { K8sSyncTarget, LabSecretMeta, SecretCategory } from "@/lib/types";
import { Eye, KeyRound, Plus, RefreshCw, Trash2 } from "lucide-react";

const CATEGORIES: { value: SecretCategory; label: string }[] = [
  { value: "api_key", label: "API key" },
  { value: "token", label: "Token" },
  { value: "password", label: "Password" },
  { value: "other", label: "Other" }
];

function formatTs(ms: number): string {
  return new Date(ms).toLocaleString();
}

function categoryLabel(cat: SecretCategory): string {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

interface SecretsPanelProps {
  initialSecrets: LabSecretMeta[];
}

/**
 * Table of lab secrets with add, update, reveal, delete, and sync-to-K8s actions.
 * @param props.initialSecrets - Pre-fetched secret metadata (no plaintext values).
 * @returns Secrets management panel JSX.
 */
export function SecretsPanel({ initialSecrets }: SecretsPanelProps): React.JSX.Element {
  const [secrets, setSecrets] = React.useState(initialSecrets);
  const [addOpen, setAddOpen] = React.useState(false);
  const [updateId, setUpdateId] = React.useState<string | null>(null);
  const [revealId, setRevealId] = React.useState<string | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const { toast } = useToast();

  const [addForm, setAddForm] = React.useState({
    name: "",
    category: "api_key" as SecretCategory,
    value: "",
    description: "",
    syncEnabled: false,
    namespace: "ai-inference" as K8sSyncTarget["namespace"],
    secretName: "",
    key: ""
  });

  const [updateValue, setUpdateValue] = React.useState("");
  const [revealConfirm, setRevealConfirm] = React.useState("");
  const [revealedValue, setRevealedValue] = React.useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState("");

  React.useEffect(() => {
    if (!revealedValue) return;
    const id = setTimeout(() => {
      void navigator.clipboard.writeText("").catch(() => undefined);
    }, 30000);
    return () => clearTimeout(id);
  }, [revealedValue]);

  const buildK8sSync = (): K8sSyncTarget | undefined => {
    if (!addForm.syncEnabled || !addForm.secretName || !addForm.key) return undefined;
    return {
      namespace: addForm.namespace,
      secretName: addForm.secretName,
      key: addForm.key
    };
  };

  const handleCreate = async () => {
    setBusy(true);
    try {
      const { meta, syncError } = await createSecretAction({
        name: addForm.name,
        category: addForm.category,
        value: addForm.value,
        description: addForm.description || undefined,
        k8sSync: buildK8sSync()
      });
      setSecrets((prev) => [meta, ...prev.filter((s) => s.id !== meta.id)]);
      setAddOpen(false);
      setAddForm({
        name: "",
        category: "api_key",
        value: "",
        description: "",
        syncEnabled: false,
        namespace: "ai-inference",
        secretName: "",
        key: ""
      });
      toast({
        title: "Secret saved",
        description: syncError ? `Stored, but K8s sync failed: ${syncError}` : "Encrypted and stored securely.",
        variant: syncError ? "error" : "default"
      });
    } catch (e) {
      toast({ title: "Failed to save secret", description: String(e), variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateValue = async () => {
    setBusy(true);
    try {
      const { meta, syncError } = await updateSecretValueAction({ id: updateId, value: updateValue });
      setSecrets((prev) => prev.map((s) => (s.id === meta.id ? meta : s)));
      setUpdateId(null);
      setUpdateValue("");
      toast({
        title: "Value updated",
        description: syncError ? `Updated, but K8s sync failed: ${syncError}` : undefined,
        variant: syncError ? "error" : "default"
      });
    } catch (e) {
      toast({ title: "Update failed", description: String(e), variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleReveal = async () => {
    setBusy(true);
    try {
      const value = await revealSecretAction({ id: revealId, confirm: "REVEAL" });
      setRevealedValue(value);
      setRevealConfirm("");
    } catch (e) {
      toast({ title: "Reveal failed", description: String(e), variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleCopyRevealed = async () => {
    try {
      // Copy button only renders after a successful reveal.
      await navigator.clipboard.writeText(revealedValue!);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "error" });
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteSecretAction({ id: deleteId, confirm: "DELETE" });
      setSecrets((prev) => prev.filter((s) => s.id !== deleteId));
      setDeleteId(null);
      setDeleteConfirm("");
      toast({ title: "Secret deleted" });
    } catch (e) {
      toast({ title: "Delete failed", description: String(e), variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async (id: string) => {
    setBusy(true);
    try {
      const result = await syncSecretToK8sAction({ id });
      if (result.ok) {
        toast({ title: "Synced to Kubernetes" });
      } else {
        toast({ title: "Sync failed", description: result.error, variant: "error" });
      }
    } catch (e) {
      toast({ title: "Sync failed", description: String(e), variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const revealTarget = secrets.find((s) => s.id === revealId);
  const deleteTarget = secrets.find((s) => s.id === deleteId);

  return (
    <div data-testid="secrets-panel" className="w-full self-start space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className={panelSubheaderClass}>
          SECRET VAULT
          <Badge variant="secondary" className="text-[10px]">
            encrypted
          </Badge>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} disabled={busy}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add secret
        </Button>
      </div>

      {secrets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--md-sys-shape-corner-medium)] border border-dashed border-border py-10 text-center">
          <KeyRound className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No secrets stored yet.</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Add API keys and tokens here. Values are encrypted at rest and never shown in list views.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Hint</TableHead>
              <TableHead>K8s sync</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {secrets.map((secret) => (
              <TableRow key={secret.id}>
                <TableCell className="font-medium">{secret.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">
                    {categoryLabel(secret.category)}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">••••{secret.valueHint}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {secret.k8sSync ? `${secret.k8sSync.namespace}/${secret.k8sSync.secretName}` : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatTs(secret.updatedAt)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Update value"
                      disabled={busy}
                      onClick={() => {
                        setUpdateId(secret.id);
                        setUpdateValue("");
                      }}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Reveal value"
                      disabled={busy}
                      onClick={() => {
                        setRevealId(secret.id);
                        setRevealConfirm("");
                        setRevealedValue(null);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {secret.k8sSync && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Sync to Kubernetes"
                        disabled={busy}
                        onClick={() => void handleSync(secret.id)}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      title="Delete"
                      disabled={busy}
                      onClick={() => {
                        setDeleteId(secret.id);
                        setDeleteConfirm("");
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add secret</DialogTitle>
            <DialogDescription>
              Value is encrypted immediately and only shown again via explicit reveal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="secret-name">Name</Label>
              <Input
                id="secret-name"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="hf-token"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={addForm.category}
                onValueChange={(v) => setAddForm((f) => ({ ...f, category: v as SecretCategory }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="secret-value">Value</Label>
              <Input
                id="secret-value"
                type="password"
                value={addForm.value}
                onChange={(e) => setAddForm((f) => ({ ...f, value: e.target.value }))}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="secret-desc">Description (optional)</Label>
              <Input
                id="secret-desc"
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2 rounded-md border border-border p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={addForm.syncEnabled}
                  onChange={(e) => setAddForm((f) => ({ ...f, syncEnabled: e.target.checked }))}
                />
                Sync to Kubernetes Secret
              </label>
              {addForm.syncEnabled && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Select
                    value={addForm.namespace}
                    onValueChange={(v) => setAddForm((f) => ({ ...f, namespace: v as K8sSyncTarget["namespace"] }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Namespace" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dev">dev</SelectItem>
                      <SelectItem value="ai-inference">ai-inference</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="secret name"
                    value={addForm.secretName}
                    onChange={(e) => setAddForm((f) => ({ ...f, secretName: e.target.value }))}
                  />
                  <Input
                    placeholder="KEY"
                    value={addForm.key}
                    onChange={(e) => setAddForm((f) => ({ ...f, key: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={busy || !addForm.name || !addForm.value}>
              Save encrypted
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!updateId} onOpenChange={(open) => !open && setUpdateId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace secret value</DialogTitle>
            <DialogDescription>
              The previous value cannot be viewed — enter the new value to replace it.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            value={updateValue}
            onChange={(e) => setUpdateValue(e.target.value)}
            autoComplete="new-password"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateId(null)}>
              Cancel
            </Button>
            <Button onClick={() => void handleUpdateValue()} disabled={busy || !updateValue}>
              Replace value
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!revealId}
        onOpenChange={(open) => {
          if (!open) {
            setRevealId(null);
            setRevealConfirm("");
            setRevealedValue(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reveal secret</DialogTitle>
            <DialogDescription>
              Revealing <strong>{revealTarget?.name}</strong> is audited. Type <code>REVEAL</code> to confirm.
            </DialogDescription>
          </DialogHeader>
          {!revealedValue ? (
            <Input
              value={revealConfirm}
              onChange={(e) => setRevealConfirm(e.target.value)}
              placeholder="REVEAL"
              autoComplete="off"
            />
          ) : (
            <div className="space-y-2">
              <pre className="overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-xs">
                {revealedValue}
              </pre>
              <Button variant="outline" size="sm" onClick={() => void handleCopyRevealed()}>
                Copy to clipboard
              </Button>
              <p className="text-xs text-muted-foreground">Clipboard clears after 30 seconds.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevealId(null)}>
              Close
            </Button>
            {!revealedValue && (
              <Button
                variant="destructive"
                disabled={revealConfirm !== "REVEAL" || busy}
                onClick={() => void handleReveal()}
              >
                Reveal
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete secret</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{deleteTarget?.name}</strong>. Type <code>DELETE</code> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== "DELETE" || busy}
              onClick={() => void handleDelete()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
