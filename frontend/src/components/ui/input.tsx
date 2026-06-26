import * as React from "react"
import { cn } from "../../lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--surface-container)] px-3.5 py-2 text-sm text-[var(--on-surface)] placeholder:text-[var(--on-surface-variant)]/60 focus-visible:outline-none focus-visible:border-[var(--on-surface-variant)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
