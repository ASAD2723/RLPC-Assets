import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Lock } from "lucide-react";

const EMPTY = {
  employee_id: "",
  employee_name: "",
  purchase_type: "",
  payment_mode: "",
  payment_by: "",
  business_manager_approved: false,
};

export const PurchaseForm = ({ open, onOpenChange, onSubmit, config, editing, submitting }) => {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

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
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit({ ...form, employee_id: form.employee_id.trim(), employee_name: form.employee_name.trim() });
  };

  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
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

          <div className="flex items-center gap-3 rounded-md border border-border bg-secondary/50 p-3">
            <Checkbox id="approved" data-testid="checkbox-approved" checked={form.business_manager_approved}
              onCheckedChange={(v) => set("business_manager_approved", !!v)} />
            <Label htmlFor="approved" className="cursor-pointer font-medium">Approved by Business Manager</Label>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-muted-foreground"><Lock className="h-3 w-3" /> Purchase Date</Label>
            <Input readOnly disabled data-testid="input-purchase-date"
              value={editing ? fmtDate(editing.purchase_date) : "Auto-recorded on submit"}
              className="bg-muted text-muted-foreground cursor-not-allowed" />
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
