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
import { Plus, ChevronLeft, ChevronRight, Boxes, Upload, LogIn, LogOut, ShieldCheck, CheckCircle2, X } from "lucide-react";
import { FilterBar } from "./components/FilterBar";
import { PurchaseTable } from "./components/PurchaseTable";
import { PurchaseForm } from "./components/PurchaseForm";
import { ImportDialog } from "./components/ImportDialog";
import { LoginDialog } from "./components/LoginDialog";
import * as api from "./lib/api";

const PAGE_SIZE = 50;
const AUTH_KEY = "rlpc_auth";
const EMPTY_FILTERS = {
  search: "", purchase_type: "", payment_mode: "", payment_by: "", approved: "", date_from: "", date_to: "",
};

function App() {
  const [config, setConfig] = useState(null);
  const [auth, setAuth] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkApproving, setBulkApproving] = useState(false);

  useEffect(() => {
    api.getConfig().then(setConfig).catch(() => toast.error("Failed to load configuration"));
    try {
      const saved = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
      if (saved?.token) {
        api.setAuthToken(saved.token);
        api.getMe().then(() => setAuth(saved)).catch(() => { api.setAuthToken(null); localStorage.removeItem(AUTH_KEY); });
      }
    } catch { /* ignore */ }
  }, []);

  const handleLoggedIn = (data) => {
    api.setAuthToken(data.token);
    localStorage.setItem(AUTH_KEY, JSON.stringify(data));
    setAuth(data);
  };

  const handleLogout = () => {
    api.setAuthToken(null);
    localStorage.removeItem(AUTH_KEY);
    setAuth(null);
    toast.success("Logged out");
  };

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
      setSelectedIds([]);
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

  const handleSubmit = async (formData, billFile) => {
    setSubmitting(true);
    try {
      let payload = formData;
      if (billFile) {
        const up = await api.uploadBill(billFile);
        payload = { ...formData, bill_path: up.bill_path, bill_filename: up.bill_filename };
      }
      if (editing) {
        await api.updatePurchase(editing.id, payload);
        toast.success("Purchase record updated successfully.");
      } else {
        await api.createPurchase(payload);
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

  const handleToggleApprove = async (r) => {
    setTogglingId(r.id);
    const next = !r.business_manager_approved;
    try {
      await api.setApproval(r.id, next);
      setData((d) => ({ ...d, items: d.items.map((x) => (x.id === r.id ? { ...x, business_manager_approved: next } : x)) }));
      toast.success(next ? "Marked as approved." : "Approval removed.");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to update approval");
    } finally {
      setTogglingId(null);
    }
  };

  const toggleSelect = (id) =>
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const toggleSelectAll = (pageIds) =>
    setSelectedIds((s) => (pageIds.every((id) => s.includes(id)) ? s.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...s, ...pageIds]))));

  const bulkApprove = async () => {
    setBulkApproving(true);
    try {
      const res = await api.bulkApproval(selectedIds, true);
      toast.success(`${res.updated} record${res.updated === 1 ? "" : "s"} approved.`);
      setSelectedIds([]);
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Bulk approval failed");
    } finally {
      setBulkApproving(false);
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
          <div className="flex items-center gap-2">
            {auth ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-sm font-medium" data-testid="auth-username">
                  <ShieldCheck className="h-4 w-4 text-[hsl(var(--success))]" /> {auth.username}
                </span>
                <Button variant="outline" onClick={handleLogout} data-testid="logout-btn" className="active:scale-95 transition-transform">
                  <LogOut className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setLoginOpen(true)} data-testid="login-btn" className="active:scale-95 transition-transform">
                <LogIn className="h-4 w-4 mr-2" /> Login
              </Button>
            )}
            <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="import-csv-btn"
              className="active:scale-95 transition-transform">
              <Upload className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Import CSV</span>
            </Button>
            <Button onClick={openAdd} data-testid="add-purchase-btn"
              className="bg-[hsl(var(--accent))] text-white hover:bg-[hsl(var(--accent))]/90 active:scale-95 transition-transform">
              <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Add Purchase</span>
            </Button>
          </div>
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

          {auth && selectedIds.length > 0 && (
            <div className="flex items-center justify-between rounded-md border border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/5 px-4 py-2.5" data-testid="bulk-action-bar">
              <span className="text-sm font-medium" data-testid="bulk-selected-count">{selectedIds.length} selected</span>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={bulkApprove} disabled={bulkApproving} data-testid="bulk-approve-btn"
                  className="bg-[hsl(var(--success))] text-white hover:bg-[hsl(var(--success))]/90 active:scale-95 transition-transform">
                  <CheckCircle2 className="h-4 w-4 mr-2" /> {bulkApproving ? "Approving..." : "Approve selected"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])} data-testid="bulk-clear-btn" className="text-muted-foreground">
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              </div>
            </div>
          )}

          <PurchaseTable
            items={data.items} loading={loading} startIndex={startIndex}
            onEdit={openEdit} onDelete={setDeleteTarget}
            canApprove={!!auth} onToggleApprove={handleToggleApprove} togglingId={togglingId}
            selectedIds={selectedIds} onToggleSelect={toggleSelect} onToggleSelectAll={toggleSelectAll}
            canEdit={!!auth}
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
        canApprove={!!auth}
      />

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} onLoggedIn={handleLoggedIn} />

      <ImportDialog
        open={importOpen} onOpenChange={setImportOpen}
        onImported={() => { setPage(1); refresh(); }}
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
