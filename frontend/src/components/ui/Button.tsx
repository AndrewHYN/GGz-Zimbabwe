import { type ButtonHTMLAttributes, type ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  loading,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ggz-amber/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

  const variants = {
    primary: "bg-ggz-amber text-ggz-base hover:bg-ggz-amber-light active:bg-ggz-amber-dark",
    secondary: "bg-ggz-surface text-ggz-text-primary border border-ggz-border hover:bg-ggz-surface-hover active:bg-ggz-surface-active",
    ghost: "text-ggz-text-secondary hover:text-ggz-text-primary hover:bg-ggz-surface",
    danger: "bg-ggz-danger/10 text-ggz-danger border border-ggz-danger/20 hover:bg-ggz-danger/20",
  };

  const sizes = {
    sm: "h-8 px-3 text-sm rounded-[var(--radius-sm)]",
    md: "h-10 px-4 text-sm rounded-[var(--radius-md)]",
    lg: "h-12 px-6 text-base rounded-[var(--radius-md)]",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      )}
      {children}
    </button>
  );
}
