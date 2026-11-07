import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-base flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-surface border border-danger/30 rounded-2xl p-8">
            <h1 className="text-xl font-semibold text-danger mb-2">Something went wrong</h1>
            <p className="text-fg-muted text-sm mb-4">
              The app crashed with the following error. Share this with the developer.
            </p>
            <pre className="bg-base rounded-lg p-4 text-xs text-danger overflow-auto whitespace-pre-wrap break-all">
              {this.state.error?.message}
              {'\n\n'}
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary mt-4 w-full py-2.5 text-sm"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
