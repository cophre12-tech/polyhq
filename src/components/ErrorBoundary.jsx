import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-slate-900 border border-rose-500/30 rounded-2xl p-8">
            <h1 className="text-xl font-bold text-rose-400 mb-2">Something went wrong</h1>
            <p className="text-slate-400 text-sm mb-4">
              The app crashed with the following error. Share this with the developer.
            </p>
            <pre className="bg-slate-950 rounded-lg p-4 text-xs text-rose-300 overflow-auto whitespace-pre-wrap break-all">
              {this.state.error?.message}
              {'\n\n'}
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
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
