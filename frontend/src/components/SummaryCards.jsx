import React from "react";
import { Card } from "../components/ui/card";
import { ShoppingCart, CheckCircle2, Clock, Smartphone, Cpu } from "lucide-react";

const CARDS = [
  { key: "total", label: "Total Purchases", icon: ShoppingCart, tint: "text-foreground", testid: "stat-total" },
  { key: "approved", label: "Approved", icon: CheckCircle2, tint: "text-[hsl(var(--success))]", testid: "stat-approved" },
  { key: "pending", label: "Pending Approval", icon: Clock, tint: "text-amber-500", testid: "stat-pending" },
  { key: "mobile", label: "Mobile Purchases", icon: Smartphone, tint: "text-[hsl(var(--accent))]", testid: "stat-mobile" },
  { key: "tech", label: "Tech Devices", icon: Cpu, tint: "text-violet-500", testid: "stat-tech" },
];

export const SummaryCards = ({ stats, loading }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4" data-testid="summary-cards">
      {CARDS.map((c) => {
        const Icon = c.icon;
        return (
          <Card
            key={c.key}
            data-testid={c.testid}
            className="relative p-4 border border-border bg-card rounded-md overflow-hidden transition-shadow hover:shadow-[0_1px_12px_rgba(0,0,0,0.06)]"
          >
            <div className="flex items-start justify-between">
              <span className="text-sm text-muted-foreground font-medium">{c.label}</span>
              <Icon className={`h-4 w-4 ${c.tint}`} strokeWidth={2} />
            </div>
            <div className="mt-3 font-display text-3xl font-bold tracking-tight tabular-nums" data-testid={`${c.testid}-value`}>
              {loading ? "—" : (stats?.[c.key] ?? 0)}
            </div>
          </Card>
        );
      })}
    </div>
  );
};
