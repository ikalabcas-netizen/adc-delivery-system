import { forwardRef, ButtonHTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size    = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant
  size?:     Size
  loading?:  boolean
  icon?:     React.ReactNode
  iconRight?: React.ReactNode
}

const variants: Record<Variant, string> = {
  primary:   'bg-adc-600 text-white hover:bg-adc-700 shadow-sm',
  secondary: 'bg-adc-50 text-adc-700 hover:bg-adc-100',
  ghost:     'text-slate-600 hover:bg-slate-100',
  danger:    'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  outline:   'border border-surface-border text-slate-700 hover:bg-slate-50',
}

const sizes: Record<Size, string> = {
  sm:  'h-8  px-3 text-xs gap-1.5',
  md:  'h-9  px-4 text-sm gap-2',
  lg:  'h-11 px-5 text-sm gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, iconRight, children, className, disabled, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={!disabled && !loading ? { scale: 1.01 } : undefined}
        whileTap={!disabled && !loading ? { scale: 0.98 } : undefined}
        transition={{ duration: 0.12 }}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-lg',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adc-500 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className,
        )}
        {...(props as any)}
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin shrink-0" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        {children}
        {iconRight && !loading && (
          <span className="shrink-0">{iconRight}</span>
        )}
      </motion.button>
    )
  }
)
Button.displayName = 'Button'
