import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Pencil, Trash2, CheckCircle2, XCircle, Inbox, Paperclip, Lock } from "lucide-react";
import { Checkbox } from "../components/ui/checkbox";
import { billUrl } from "../lib/api";

const fmt = (iso) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

const fmtShort = (iso) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch { return iso; }
};

export const PurchaseTable = ({ items, loading, startIndex, onEdit, onDelete, canApprove, onToggleApprove, togglingId, canSafetyApprove, onToggleSafety, togglingSafetyId, selectedIds = [], onToggleSelect, onToggleSelectAll, canEdit, canDelete }) => {
  const colCount = canApprove ? 11 : 10;
  const selectedSet = new Set(selectedIds);
  const pageIds = items.map((r) => r.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));
  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <div className="max-h-[620px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow className="border-b border-border hover:bg-transparent">
              {canApprove && (
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={() => onToggleSelectAll(pageIds)} data-testid="select-all-checkbox" aria-label="Select all on page" />
                </TableHead>
              )}
              <TableHead className="w-12 text-xs font-semibold uppercase tracking-wide">#</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Employee ID</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Employee Name</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Purchase Of</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Mode of Payment</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Payment By</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Business Approved</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Safety Approved</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Date</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody data-testid="purchase-table-body">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={colCount}><div className="h-6 w-full animate-pulse rounded bg-muted" /></TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount}>
                  <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state">
                    <Inbox className="h-10 w-10 text-muted-foreground/50 mb-3" />
                    <p className="font-display text-lg font-semibold">No purchase records</p>
                    <p className="text-sm text-muted-foreground">Add a record or adjust your filters to see results.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((r, i) => (
                <TableRow key={r.id} data-testid={`purchase-row-${r.id}`} data-state={selectedSet.has(r.id) ? "selected" : undefined} className="transition-colors hover:bg-muted/50 data-[state=selected]:bg-[hsl(var(--accent))]/5">
                  {canApprove && (
                    <TableCell>
                      <Checkbox checked={selectedSet.has(r.id)} onCheckedChange={() => onToggleSelect(r.id)} data-testid={`select-row-${r.id}`} aria-label="Select row" />
                    </TableCell>
                  )}
                  <TableCell className="text-muted-foreground tabular-nums">{startIndex + i + 1}</TableCell>
                  <TableCell className="font-medium">{r.employee_id}</TableCell>
                  <TableCell>{r.employee_name}</TableCell>
                  <TableCell>{r.purchase_type}</TableCell>
                  <TableCell>{r.payment_mode || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{r.payment_by || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {(() => {
                      const badge = r.business_manager_approved ? (
                        <Badge className="bg-[hsl(var(--success))] text-white hover:bg-[hsl(var(--success))] gap-1" data-testid={`approved-${r.id}`}>
                          <CheckCircle2 className="h-3 w-3" /> Approved
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground" data-testid={`not-approved-${r.id}`}>
                          <XCircle className="h-3 w-3" /> Not Approved
                        </Badge>
                      );
                      if (!canApprove) return badge;
                      const control = (
                        <button type="button" data-testid={`approve-toggle-${r.id}`} disabled={togglingId === r.id}
                          onClick={() => onToggleApprove(r)} title="Click to toggle approval"
                          className="rounded-md transition-transform hover:opacity-80 active:scale-95 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]">
                          {badge}
                        </button>
                      );
                      return control;
                    })()}
                    {r.business_manager_approved && r.business_approved_by && (
                      <div className="text-[10px] leading-tight text-muted-foreground mt-0.5" data-testid={`business-trail-${r.id}`}>by {r.business_approved_by} · {fmtShort(r.business_approved_at)}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const badge = r.safety_team_approved ? (
                        <Badge className="bg-[hsl(var(--success))] text-white hover:bg-[hsl(var(--success))] gap-1" data-testid={`safety-approved-${r.id}`}>
                          <CheckCircle2 className="h-3 w-3" /> Approved
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground" data-testid={`safety-not-approved-${r.id}`}>
                          <XCircle className="h-3 w-3" /> Not Approved
                        </Badge>
                      );
                      if (!canSafetyApprove) return badge;
                      return (
                        <button type="button" data-testid={`safety-toggle-${r.id}`} disabled={togglingSafetyId === r.id}
                          onClick={() => onToggleSafety(r)} title="Click to toggle safety approval"
                          className="rounded-md transition-transform hover:opacity-80 active:scale-95 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]">
                          {badge}
                        </button>
                      );
                    })()}
                    {r.safety_team_approved && r.safety_approved_by && (
                      <div className="text-[10px] leading-tight text-muted-foreground mt-0.5" data-testid={`safety-trail-${r.id}`}>by {r.safety_approved_by} · {fmtShort(r.safety_approved_at)}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums text-sm">{fmt(r.purchase_date)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {r.bill_path && (
                        <a href={billUrl(r.bill_path)} target="_blank" rel="noreferrer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[hsl(var(--accent))] hover:bg-muted"
                          title={r.bill_filename || "View bill"} data-testid={`bill-link-${r.id}`}>
                          <Paperclip className="h-4 w-4" />
                        </a>
                      )}
                      {canEdit && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(r)} data-testid={`edit-btn-${r.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(r)} data-testid={`delete-btn-${r.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {!canEdit && !canDelete && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground pr-1" data-testid={`readonly-${r.id}`}>
                          <Lock className="h-3 w-3" /> Login to edit
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
