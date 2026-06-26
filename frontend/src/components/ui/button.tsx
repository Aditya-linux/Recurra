import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--outline)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--on-surface)] text-[var(--surface)] shadow-sm hover:opacity-90",
        destructive: "bg-[#dc2626] text-white hover:bg-[#b91c1c] shadow-sm",
        outline: "border border-[var(--glass-border)] bg-transparent hover:bg-[rgba(255,255,255,0.04)] text-[var(--on-surface)] transition-colors",
        secondary: "bg-[var(--surface-container)] border border-[var(--glass-border)] text-[var(--on-surface)] hover:bg-[var(--surface-container-high)] transition-colors",
        ghost: "hover:bg-[rgba(255,255,255,0.06)] text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors",
        link: "text-[var(--accent-blue)] underline-offset-4 hover:underline",
        accent: "bg-gradient-to-r from-emerald-500 via-blue-500 to-violet-500 text-white shadow-[0_4px_16px_rgba(6,214,160,0.2)] hover:shadow-[0_6px_20px_rgba(6,214,160,0.25)]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 rounded-lg px-3.5 text-[13px]",
        lg: "h-12 rounded-xl px-8 text-[15px]",
        icon: "h-10 w-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
