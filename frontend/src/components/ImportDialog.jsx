import React, { useState, useRef } from "react";
import axios from "axios";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Upload, FileDown, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { API } from "../lib/api";
import { toast } from "sonner";

const TEMPLATE = `Employee ID,Employee Name,Purchase Of,Mode of Payment,Payment By,Approved by Business Manager,Date
EMP-1001,John Doe,Mobile Purchase,Cash,Jogy Joseph,Yes,2026-05-01
EMP-1002,Jane Smith,Tech Device,Credit Card,Mohammad Omer,No,2026-05-03`;

export const ImportDialog = ({ open, onOpenChange, onImported }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const reset = () => { setFile(null); setResult(null); setUploading(false); if (inputRef.current) inputRef.current.value = ""; };

  const handleOpenChange = (o) => { if (!o) reset(); onOpenChange(o); };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = "purchase_records_template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(link.href);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API}/purchases/import`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setResult(res.data);
      if (res.data.imported > 0) {
        toast.success(`${res.data.imported} record${res.data.imported === 1 ? "" : "s"} imported.`);
        onImported();
      } else {
        toast.error("No records were imported. Check the errors below.");
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Import failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[560px]" data-testid="import-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-bold tracking-tight">Import from CSV</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Bulk-upload past purchases. Required columns: Employee ID, Employee Name, Purchase Of, Mode of Payment, Payment By. Optional: Approved by Business Manager, Date.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Button variant="outline" onClick={downloadTemplate} data-testid="download-template-btn" className="w-full justify-start">
            <FileDown className="h-4 w-4 mr-2 text-[hsl(var(--accent))]" /> Download CSV template
          </Button>

          <label
            htmlFor="csv-file"
            className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-secondary/40 p-8 text-center cursor-pointer transition-colors hover:border-[hsl(var(--accent))]"
            data-testid="csv-dropzone"
          >
            <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
            {file ? (
              <span className="text-sm font-medium">{file.name}</span>
            ) : (
              <>
                <span className="text-sm font-medium">Click to choose a .csv file</span>
                <span className="text-xs text-muted-foreground">or drag it here</span>
              </>
            )}
            <input
              id="csv-file" ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
              data-testid="csv-file-input"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); }}
            />
          </label>

          {result && (
            <div className="rounded-md border border-border p-3 space-y-2 text-sm" data-testid="import-result">
              <div className="flex items-center gap-2 text-[hsl(var(--success))] font-medium">
                <CheckCircle2 className="h-4 w-4" /> {result.imported} imported
              </div>
              {result.failed > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-amber-600 font-medium">
                    <AlertTriangle className="h-4 w-4" /> {result.failed} skipped
                  </div>
                  <ul className="max-h-40 overflow-auto text-xs text-muted-foreground list-disc pl-5 space-y-0.5">
                    {result.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} data-testid="close-import-btn">
            {result ? "Done" : "Cancel"}
          </Button>
          <Button onClick={upload} disabled={!file || uploading} data-testid="upload-csv-btn"
            className="bg-[hsl(var(--accent))] text-white hover:bg-[hsl(var(--accent))]/90 active:scale-95 transition-transform">
            <Upload className="h-4 w-4 mr-2" /> {uploading ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
