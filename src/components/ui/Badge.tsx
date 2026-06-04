import React from 'react'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'secondary'
}

export const Badge = ({ className = '', variant = 'secondary', children, ...props }: BadgeProps) => {
  // Simple CSS badges inline styles mapped to the themes we set up
  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'rgba(37, 99, 235, 0.15)',
      color: 'var(--primary)',
    },
    success: {
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      color: 'var(--success)',
    },
    danger: {
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      color: 'var(--danger)',
    },
    warning: {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      color: 'var(--warning)',
    },
    info: {
      backgroundColor: 'rgba(6, 182, 212, 0.15)',
      color: 'var(--info)',
    },
    secondary: {
      backgroundColor: 'var(--bg-surface-hover)',
      color: 'var(--text-secondary)',
    },
  }

  return (
    <span
      className={`badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 500,
        ...variantStyles[variant],
      }}
      {...props}
    >
      {children}
    </span>
  )
}
