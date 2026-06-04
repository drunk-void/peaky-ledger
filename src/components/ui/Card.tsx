import React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', hoverable = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`card ${hoverable ? 'card-hover' : ''} ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'
