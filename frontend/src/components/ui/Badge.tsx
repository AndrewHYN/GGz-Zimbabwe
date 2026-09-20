import { type ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({ children, variant = "default", size = "sm", className = "" }: BadgeProps) {
  const variants = {
    default: "bg-ggz-surface text-ggz-text-secondary border-ggz-border",
    success: "bg-ggz-success/10 text-ggz-success border-ggz-success/20",
    warning: "bg-ggz-amber/10 text-ggz-amber border-ggz-amber/20",
    danger: "bg-ggz-danger/10 text-ggz-danger border-ggz-danger/20",
    info: "bg-ggz-info/10 text-ggz-info border-ggz-info/20",
    purple: "bg-ggz-purple/10 text-ggz-purple-light border-ggz-purple/20",
  };

  const sizes = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
  };

  return (
    <span className={`inline-flex items-center font-medium border rounded-full ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
}
