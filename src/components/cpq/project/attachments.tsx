import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectData } from "@/lib/queries";
import { formatDateTime } from "@/lib/labels";
import { Panel, EmptyState } from "../page";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const MAX_BYTES = 10 * 1024 * 1024;

export function Attachments({ projectId, attachments, editable }: { projectId: string; attachments: ProjectData["attachments"]; editable: boolean }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["project", projectId] });

  async function upload(file: File) {
    if (file.size > MAX_BYTES) return toast.error("Bestand is groter dan 10 MB.");
    setBusy(true);
    const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-100);
    const path = `${projectId}/${crypto.randomUUID()}-${safe}`;
    const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type || "application/octet-stream" });
    if (error) {
      setBusy(false);
      return toast.error(`Upload mislukt: ${error.message}`);
    }
    const { data: user } = await supabase.auth.getUser();
    const { error: e2 } = await supabase.from("attachments").insert({ project_id: projectId, file_name: file.name.slice(0, 200), storage_path: path, mime_type: file.type || null, size_bytes: file.size, uploaded_by: user.user?.id ?? null });
    setBusy(false);
    if (e2) return toast.error(`Bijlage kon niet geregistreerd worden: ${e2.message}`);
    toast.success("Bijlage toegevoegd.");
    refresh();
  }

  async function download(path: string, name: string) {
    const { data, error } = await supabase.storage.from("attachments").createSignedUrl(path, 60, { download: name });
    if (error || !data) return toast.error("Download mislukt.");
    window.location.assign(data.signedUrl);
  }

  async function remove(id: string, path: string) {
    const { error } = await supabase.from("attachments").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(`Verwijderen mislukt: ${error.message}`);
    await supabase.storage.from("attachments").remove([path]);
    toast.success("Bijlage verwijderd.");
    refresh();
  }

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" /> Bijlagen
        </span>
      }
      actions={
        editable && (
          <>
            <input
              ref={input}
              type="file"
              className="hidden"
              aria-label="Bijlage kiezen"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> {busy ? "Uploaden…" : "Uploaden"}
            </Button>
          </>
        )
      }
    >
      {attachments.length === 0 ? (
        <EmptyState>Geen bijlagen. Upload bv. een plan of opmetingsverslag (max. 10 MB, enkel fictieve documenten).</EmptyState>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <div className="truncate font-medium">{a.file_name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(a.created_at)} · {a.size_bytes ? `${Math.ceil(a.size_bytes / 1024)} kB` : ""}
                </div>
              </div>
              <div className="flex">
                <Button size="icon" variant="ghost" onClick={() => download(a.storage_path, a.file_name)} aria-label={`Download ${a.file_name}`}>
                  <Download className="h-4 w-4" />
                </Button>
                {editable && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" aria-label={`Verwijder ${a.file_name}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Bijlage verwijderen?</AlertDialogTitle>
                        <AlertDialogDescription>{a.file_name} wordt definitief verwijderd.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuleren</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(a.id, a.storage_path)}>Verwijderen</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
