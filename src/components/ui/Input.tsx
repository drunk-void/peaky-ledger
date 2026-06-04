import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, id, ...props }, ref) => {
    return (
      <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {label && <label htmlFor={id}>{label}</label>}
        <input
          ref={ref}
          id={id}
          className={`${error ? 'input-error' : ''} ${className}`}
          {...props}
        />
        {error && <span className="input-error-message" style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>{error}</span>}
      </div>
    )
  }
)

Input.displayName = 'Input'
