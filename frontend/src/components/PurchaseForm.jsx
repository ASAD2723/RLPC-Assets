import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Lock, Paperclip, X, FileCheck } from "lucide-react";
import { billUrl } from "../lib/api";

const EMPTY = {
  employee_id: "",
  employee_name: "",
  purchase_type: "",
  payment_mode: "",
  payment_by: "",
  business_manager_approved: false,
};

export const PurchaseForm = ({ open, onOpenChange, onSubmit, config, editing, submitting, canApprove }) => {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [billFile, setBillFile] = useState(null);
  const [existingBill, setExistingBill] = useState(null);
  const [datePart, setDatePart] = useState("");

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          employee_id: editing.employee_id,
          employee_name: editing.employee_name,
          purchase_type: editing.purchase_type,
          payment_mode: editing.payment_mode,
          payment_by: editing.payment_by,
          business_manager_approved: !!editing.business_manager_approved,
        });
      } else {
        setForm(EMPTY);
      }
      setErrors({});
      setBillFile(null);
      setExistingBill(editing?.bill_path ? { bill_path: editing.bill_path, bill_filename: editing.bill_filename } : null);
      setDatePart(editing?.purchase_date ? editing.purchase_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    }
  }, [open, editing]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.employee_id.trim()) e.employee_id = "Employee ID is required";
    if (!form.employee_name.trim()) e.employee_name = "Employee Name is required";
    if (!form.purchase_type) e.purchase_type = "Please select Purchase Of";
    if (!form.payment_mode) e.payment_mode = "Please select Mode of Payment";
    if (!form.payment_by) e.payment_by = "Please select Payment By";
    if (!datePart) e.purchase_date = "Please select a purchase date";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit(
      {
        ...form,
        employee_id: form.employee_id.trim(),
        employee_name: form.employee_name.trim(),
        purchase_date: `${datePart}T00:00:00`,
        bill_path: existingBill?.bill_path || null,
        bill_filename: existingBill?.bill_filename || null,
      },
      billFile,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]" data-testid="purchase-form-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-bold tracking-tight">
            {editing ? "Edit Purchase Record" : "Add Purchase Record"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {editing ? "Update the purchase details below." : "Enter employee and purchase details."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="employee_id">Employee ID <span className="text-destructive">*</span></Label>
              <Input id="employee_id" data-testid="input-employee-id" value={form.employee_id}
                onChange={(e) => set("employee_id", e.target.value)} placeholder="e.g. EMP-1024" />
              {errors.employee_id && <p className="text-xs text-destructive" data-testid="error-employee-id">{errors.employee_id}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="employee_name">Employee Name <span className="text-destructive">*</span></Label>
              <Input id="employee_name" data-testid="input-employee-name" value={form.employee_name}
                onChange={(e) => set("employee_name", e.target.value)} placeholder="e.g. John Doe" />
              {errors.employee_name && <p className="text-xs text-destructive" data-testid="error-employee-name">{errors.employee_name}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Purchase Of <span className="text-destructive">*</span></Label>
            <Select value={form.purchase_type} onValueChange={(v) => set("purchase_type", v)}>
              <SelectTrigger data-testid="select-purchase-type"><SelectValue placeholder="Select purchase type" /></SelectTrigger>
              <SelectContent>
                {config?.purchase_types?.map((o) => (
                  <SelectItem key={o} value={o} data-testid={`option-purchase-${o}`}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.purchase_type && <p className="text-xs text-destructive" data-testid="error-purchase-type">{errors.purchase_type}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Mode of Payment <span className="text-destructive">*</span></Label>
              <Select value={form.payment_mode} onValueChange={(v) => set("payment_mode", v)}>
                <SelectTrigger data-testid="select-payment-mode"><SelectValue placeholder="Select mode" /></SelectTrigger>
                <SelectContent>
                  {config?.payment_modes?.map((o) => (
                    <SelectItem key={o} value={o} data-testid={`option-mode-${o}`}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.payment_mode && <p className="text-xs text-destructive" data-testid="error-payment-mode">{errors.payment_mode}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Payment By <span className="text-destructive">*</span></Label>
              <Select value={form.payment_by} onValueChange={(v) => set("payment_by", v)}>
                <SelectTrigger data-testid="select-payment-by"><SelectValue placeholder="Select person" /></SelectTrigger>
                <SelectContent>
                  {config?.payment_by?.map((o) => (
                    <SelectItem key={o} value={o} data-testid={`option-by-${o}`}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.payment_by && <p className="text-xs text-destructive" data-testid="error-payment-by">{errors.payment_by}</p>}
            </div>
          </div>

          <div className={`flex items-center gap-3 rounded-md border p-3 ${canApprove ? "border-border bg-secondary/50" : "border-dashed border-border bg-muted/40"}`}>
            <Checkbox id="approved" data-testid="checkbox-approved" checked={form.business_manager_approved}
              disabled={!canApprove}
              onCheckedChange={(v) => set("business_manager_approved", !!v)} />
            <div className="flex flex-col">
              <Label htmlFor="approved" className={`font-medium ${canApprove ? "cursor-pointer" : "cursor-not-allowed text-muted-foreground"}`}>
                Approved by Business Manager
              </Label>
              {!canApprove && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5" data-testid="approval-locked-hint">
                  <Lock className="h-3 w-3" /> Log in as the authorized user to change approval
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" /> Bill / Receipt <span className="text-xs text-muted-foreground">(optional)</span></Label>
            {billFile ? (
              <div className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm" data-testid="bill-selected">
                <span className="flex items-center gap-2 truncate"><FileCheck className="h-4 w-4 text-[hsl(var(--success))]" /> {billFile.name}</span>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setBillFile(null)} data-testid="remove-bill-btn"><X className="h-4 w-4" /></Button>
              </div>
            ) : existingBill ? (
              <div className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm" data-testid="bill-existing">
                <a href={billUrl(existingBill.bill_path)} target="_blank" rel="noreferrer" className="flex items-center gap-2 truncate text-[hsl(var(--accent))] hover:underline">
                  <FileCheck className="h-4 w-4" /> {existingBill.bill_filename || "View current bill"}
                </a>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExistingBill(null)} data-testid="remove-existing-bill-btn"><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <Input type="file" accept="image/*,application/pdf" data-testid="bill-file-input"
                onChange={(e) => setBillFile(e.target.files?.[0] || null)} />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="purchase_date">Purchase Date <span className="text-destructive">*</span></Label>
            <Input id="purchase_date" type="date" data-testid="input-purchase-date"
              value={datePart} onChange={(e) => setDatePart(e.target.value)} />
            {errors.purchase_date && <p className="text-xs text-destructive" data-testid="error-purchase-date">{errors.purchase_date}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="cancel-form-btn">Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid="submit-purchase-btn"
            className="bg-[hsl(var(--accent))] text-white hover:bg-[hsl(var(--accent))]/90 active:scale-95 transition-transform">
            {submitting ? "Saving..." : editing ? "Save Changes" : "Submit Purchase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
