import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'secondary', loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`btn btn-${variant} ${className}`}
        {...props}
      >
        {loading ? (
          <span className="btn-spinner" aria-hidden="true">
            ⏳
          </span>
        ) : null}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
