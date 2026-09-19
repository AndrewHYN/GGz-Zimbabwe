import { type InputHTMLAttributes, forwardRef } from "react";
import { SearchIcon } from "@/components/icons";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon, className = "", ...props }, ref) => {
    return (
      <div className="relative">
        {icon && (
          <SearchIcon
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ggz-text-muted"
            size={18}
          />
        )}
        <input
          ref={ref}
          className={`w-full h-10 bg-ggz-bg-2 border border-ggz-border rounded-[var(--radius-md)] text-ggz-text-primary placeholder:text-ggz-text-muted focus:outline-none focus:border-ggz-amber/50 focus:ring-1 focus:ring-ggz-amber/20 transition-colors duration-150 ${
            icon ? "pl-10 pr-4" : "px-4"
          } ${className}`}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = "Input";
