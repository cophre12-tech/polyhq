import { Link } from 'react-router-dom'

// Shared frame for the standalone auth screens (forgot / reset password),
// matching the Login page: wordmark, subtitle, and a single card.
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/login" className="inline-block text-4xl font-semibold text-fg mb-6">
            Poly<span className="text-accent-fg">HQ</span>
          </Link>
          <h1 className="text-xl font-semibold text-fg">{title}</h1>
          {subtitle && <p className="text-fg-muted text-sm mt-2">{subtitle}</p>}
        </div>

        <div className="card p-6 sm:p-8">{children}</div>

        {footer && <div className="text-center text-sm text-fg-subtle mt-6">{footer}</div>}
      </div>
    </div>
  )
}

export function FormError({ children }) {
  return (
    <div className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-lg px-3.5 py-2.5">
      {children}
    </div>
  )
}
