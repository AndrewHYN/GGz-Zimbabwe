import { type ReactNode } from "react";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  icon?: ReactNode;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  icon,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <div className="text-ggz-danger mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-ggz-text-primary mb-2">
        {title}
      </h3>
      <p className="text-ggz-text-secondary max-w-md mb-6">
        {message}
      </p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
