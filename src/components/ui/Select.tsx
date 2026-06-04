import React from 'react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: SelectOption[]
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, error, options, id, ...props }, ref) => {
    return (
      <div className="select-wrapper" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {label && <label htmlFor={id}>{label}</label>}
        <select
          ref={ref}
          id={id}
          className={`${error ? 'select-error' : ''} ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="select-error-message" style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>{error}</span>}
      </div>
    )
  }
)

Select.displayName = 'Select'
