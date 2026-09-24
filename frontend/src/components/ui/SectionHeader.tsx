import Link from "next/link";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  description?: string;
  href?: string;
  actionLabel?: string;
  icon?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, description, href, actionLabel, icon, className = "mb-5" }: SectionHeaderProps) {
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {icon && <div className="mb-1.5 text-ggz-amber">{icon}</div>}
        <h2 className="text-xl font-semibold text-ggz-text-primary md:text-2xl">{title}</h2>
        {description && <p className="mt-1 text-sm text-ggz-text-secondary">{description}</p>}
      </div>
      {href && actionLabel && (
        <Link
          href={href}
          className="shrink-0 text-sm font-medium text-ggz-amber transition-colors hover:text-ggz-amber-light"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
