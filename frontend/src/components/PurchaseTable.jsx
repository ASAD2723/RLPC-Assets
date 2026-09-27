import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Pencil, Trash2, CheckCircle2, XCircle, Inbox } from "lucide-react";

const fmt = (iso) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

export const PurchaseTable = ({ items, loading, startIndex, onEdit, onDelete }) => {
  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <div className="max-h-[620px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableHead className="w-12 text-xs font-semibold uppercase tracking-wide">#</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Employee ID</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Employee Name</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Purchase Of</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Mode of Payment</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Payment By</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Approved</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Date</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody data-testid="purchase-table-body">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={9}><div className="h-6 w-full animate-pulse rounded bg-muted" /></TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state">
                    <Inbox className="h-10 w-10 text-muted-foreground/50 mb-3" />
                    <p className="font-display text-lg font-semibold">No purchase records</p>
                    <p className="text-sm text-muted-foreground">Add a record or adjust your filters to see results.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((r, i) => (
                <TableRow key={r.id} data-testid={`purchase-row-${r.id}`} className="transition-colors hover:bg-muted/50">
                  <TableCell className="text-muted-foreground tabular-nums">{startIndex + i + 1}</TableCell>
                  <TableCell className="font-medium">{r.employee_id}</TableCell>
                  <TableCell>{r.employee_name}</TableCell>
                  <TableCell>{r.purchase_type}</TableCell>
                  <TableCell>{r.payment_mode}</TableCell>
                  <TableCell>{r.payment_by}</TableCell>
                  <TableCell>
                    {r.business_manager_approved ? (
                      <Badge className="bg-[hsl(var(--success))] text-white hover:bg-[hsl(var(--success))] gap-1" data-testid={`approved-${r.id}`}>
                        <CheckCircle2 className="h-3 w-3" /> Approved
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-muted-foreground" data-testid={`not-approved-${r.id}`}>
                        <XCircle className="h-3 w-3" /> Not Approved
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums text-sm">{fmt(r.purchase_date)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(r)} data-testid={`edit-btn-${r.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(r)} data-testid={`delete-btn-${r.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
