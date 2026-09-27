import React, { useState, useEffect, useCallback } from "react";
import "@/App.css";
import axios from "axios";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { Button } from "./components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "./components/ui/alert-dialog";
import { Plus, ChevronLeft, ChevronRight, Boxes } from "lucide-react";
import { FilterBar } from "./components/FilterBar";
import { PurchaseTable } from "./components/PurchaseTable";
import { PurchaseForm } from "./components/PurchaseForm";
import * as api from "./lib/api";

const PAGE_SIZE = 50;
const EMPTY_FILTERS = {
  search: "", purchase_type: "", payment_mode: "", payment_by: "", approved: "", date_from: "", date_to: "",
};

function App() {
  const [config, setConfig] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.getConfig().then(setConfig).catch(() => toast.error("Failed to load configuration"));
  }, []);

  // debounce filters (for search typing)
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedFilters(filters); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [filters]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listPurchases(debouncedFilters, page, PAGE_SIZE);
      setData({ items: list.items, total: list.total });
    } catch (e) {
      toast.error("Failed to load records");
    } finally {
      setLoading(false);
    }
  }, [debouncedFilters, page]);

  useEffect(() => { refresh(); }, [refresh]);

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const showingFrom = data.total === 0 ? 0 : startIndex + 1;
  const showingTo = Math.min(startIndex + PAGE_SIZE, data.total);

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (r) => { setEditing(r); setFormOpen(true); };

  const handleSubmit = async (formData) => {
    setSubmitting(true);
    try {
      if (editing) {
        await api.updatePurchase(editing.id, formData);
        toast.success("Purchase record updated successfully.");
      } else {
        await api.createPurchase(formData);
        toast.success("Purchase record added successfully.");
      }
      setFormOpen(false);
      setEditing(null);
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to save record");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deletePurchase(deleteTarget.id);
      toast.success("Purchase record deleted.");
      setDeleteTarget(null);
      if (data.items.length === 1 && page > 1) setPage((p) => p - 1);
      else await refresh();
    } catch (e) {
      toast.error("Failed to delete record");
    } finally {
      setDeleting(false);
    }
  };

  const download = async (kind) => {
    setExporting(true);
    try {
      const url = api.exportUrl(kind, debouncedFilters);
      const res = await axios.get(url, { responseType: "blob" });
      const blob = new Blob([res.data]);
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      const ext = kind === "xlsx" ? "xlsx" : "pdf";
      link.download = `purchase_records.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(link.href);
      toast.success(`${kind.toUpperCase()} exported (${data.total} records).`);
    } catch (e) {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div className="App min-h-screen bg-background">
      <Toaster position="top-right" richColors />

      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[hsl(var(--accent))]">
              <Boxes className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight leading-none" data-testid="app-title">RLPC IT Assets Records</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Employee purchase management</p>
            </div>
          </div>
          <Button onClick={openAdd} data-testid="add-purchase-btn"
            className="bg-[hsl(var(--accent))] text-white hover:bg-[hsl(var(--accent))]/90 active:scale-95 transition-transform">
            <Plus className="h-4 w-4 mr-2" /> Add Purchase
          </Button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 space-y-8">
        <section className="rounded-md border border-border bg-card p-4 md:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold tracking-tight">Purchase Records</h2>
          </div>
          <FilterBar
            filters={filters} setFilters={setFilters} config={config}
            onExportXlsx={() => download("xlsx")} onExportPdf={() => download("pdf")}
            exporting={exporting} total={data.total}
          />

          <PurchaseTable
            items={data.items} loading={loading} startIndex={startIndex}
            onEdit={openEdit} onDelete={setDeleteTarget}
          />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground" data-testid="pagination-summary">
              {data.total === 0 ? "No records" : `Showing ${showingFrom}–${showingTo} of ${data.total} records`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1" data-testid="pagination">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)} data-testid="page-prev">
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                {pageNumbers.map((n, i) =>
                  n === "..." ? (
                    <span key={`e${i}`} className="px-2 text-muted-foreground">…</span>
                  ) : (
                    <Button key={n} variant={n === page ? "default" : "outline"} size="sm"
                      className={n === page ? "bg-[hsl(var(--accent))] text-white hover:bg-[hsl(var(--accent))]/90 w-9" : "w-9"}
                      onClick={() => setPage(n)} data-testid={`page-${n}`}>
                      {n}
                    </Button>
                  )
                )}
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} data-testid="page-next">
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        </section>
      </main>

      <PurchaseForm
        open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        onSubmit={handleSubmit} config={config} editing={editing} submitting={submitting}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent data-testid="delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete purchase record?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this purchase record{deleteTarget ? ` for ${deleteTarget.employee_name}` : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete-btn">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} data-testid="confirm-delete-btn"
              className="bg-destructive text-white hover:bg-destructive/90">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

export default App;
