import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// Apply saved theme immediately so the login screen and first paint are themed correctly.
document.documentElement.setAttribute('data-theme', localStorage.getItem('ledger_theme') || 'light')

// Catches any render-time error instead of showing a blank page.
class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err, info) { console.error('Ledger crashed:', err, info) }
  render() {
    if (this.state.err) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="auth-card" style={{ maxWidth: 460, textAlign: 'center' }}>
            <div className="brand"><div className="brand-mark">₹</div><span className="serif" style={{ fontSize: 22 }}>Ledger</span></div>
            <h2 style={{ fontSize: 18, marginTop: 18 }}>Something went wrong loading the app</h2>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.6 }}>
              This can happen if older saved data doesn't match the latest version, or if the
              Supabase tables aren't set up yet. Check the browser console for details.
            </p>
            <pre style={{ textAlign: 'left', background: 'var(--paper-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 10, fontSize: 11.5, color: 'var(--red)', overflow: 'auto', marginTop: 14 }}>{String((this.state.err && this.state.err.message) || this.state.err)}</pre>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => location.reload()}>Reload</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
