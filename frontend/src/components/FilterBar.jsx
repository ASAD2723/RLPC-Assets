import React from "react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Search, X, FileSpreadsheet, FileText } from "lucide-react";

const ALL = "__all__";

export const FilterBar = ({ filters, setFilters, config, onExportXlsx, onExportPdf, exporting, total }) => {
  const update = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const selVal = (v) => (v === "" || v == null ? ALL : v);
  const onSel = (k, v) => update(k, v === ALL ? "" : v);

  const hasFilters =
    filters.search || filters.purchase_type || filters.payment_mode || filters.payment_by ||
    filters.approved !== "" || filters.date_from || filters.date_to;

  const clearAll = () =>
    setFilters({ search: "", purchase_type: "", payment_mode: "", payment_by: "", approved: "", date_from: "", date_to: "" });

  return (
    <div className="space-y-4" data-testid="filter-bar">
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input data-testid="search-input" placeholder="Search by Employee ID or Name"
              value={filters.search} onChange={(e) => update("search", e.target.value)} className="pl-9" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onExportXlsx} disabled={exporting} data-testid="export-xlsx-btn"
            className="active:scale-95 transition-transform">
            <FileSpreadsheet className="h-4 w-4 mr-2 text-[hsl(var(--success))]" /> XLSX
          </Button>
          <Button variant="outline" onClick={onExportPdf} disabled={exporting} data-testid="export-pdf-btn"
            className="active:scale-95 transition-transform">
            <FileText className="h-4 w-4 mr-2 text-destructive" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Purchase Of</Label>
          <Select value={selVal(filters.purchase_type)} onValueChange={(v) => onSel("purchase_type", v)}>
            <SelectTrigger data-testid="filter-purchase-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {config?.purchase_types?.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Mode of Payment</Label>
          <Select value={selVal(filters.payment_mode)} onValueChange={(v) => onSel("payment_mode", v)}>
            <SelectTrigger data-testid="filter-payment-mode"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {config?.payment_modes?.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Payment By</Label>
          <Select value={selVal(filters.payment_by)} onValueChange={(v) => onSel("payment_by", v)}>
            <SelectTrigger data-testid="filter-payment-by"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {config?.payment_by?.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Approval</Label>
          <Select value={filters.approved === "" ? ALL : String(filters.approved)}
            onValueChange={(v) => update("approved", v === ALL ? "" : v === "true")}>
            <SelectTrigger data-testid="filter-approved"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              <SelectItem value="true">Approved</SelectItem>
              <SelectItem value="false">Not Approved</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">From Date</Label>
          <Input type="date" data-testid="filter-date-from" value={filters.date_from}
            onChange={(e) => update("date_from", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">To Date</Label>
          <Input type="date" data-testid="filter-date-to" value={filters.date_to}
            onChange={(e) => update("date_to", e.target.value)} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground" data-testid="filter-result-count">
          {total} record{total === 1 ? "" : "s"} match current filters
        </span>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} data-testid="clear-filters-btn" className="text-muted-foreground">
            <X className="h-4 w-4 mr-1" /> Clear filters
          </Button>
        )}
      </div>
    </div>
  );
};
