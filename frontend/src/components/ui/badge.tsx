import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--outline)] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--on-surface)] text-[var(--surface)]",
        secondary:
          "border-transparent bg-[var(--surface-container-high)] text-[var(--on-surface)]",
        destructive:
          "border-transparent bg-red-500/15 text-red-400",
        outline: "border-[var(--glass-border)] text-[var(--on-surface-variant)]",
        success: "border-transparent bg-emerald-500/15 text-emerald-400",
        info: "border-transparent bg-blue-500/15 text-blue-400",
        warning: "border-transparent bg-amber-500/15 text-amber-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
