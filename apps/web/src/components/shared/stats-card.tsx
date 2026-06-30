import { cn } from "@/lib/utils";

interface StatsCardProps {
  label: string;
  value: string | number;
  prefix?: string;
  className?: string;
}

export function StatsCard({ label, value, prefix, className }: StatsCardProps) {
  const displayValue = prefix ? `${prefix}${value}` : value;
  return (
    <div
      className={cn(
        " border border-border bg-card p-6",
        className,
      )}
    >
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl font-bold text-foreground">
        {displayValue}
      </p>
    </div>
  );
}
