import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || String(error) };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, maxWidth: 560, margin: '0 auto', color: '#fecaca', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: 20, color: '#f8fafc' }}>Erro ao renderizar o painel</h1>
          <p style={{ color: '#94a3b8', lineHeight: 1.5 }}>
            Abra as Ferramentas de desenvolvedor (F12) → Consola para mais detalhes.
          </p>
          <pre style={{ background: '#1e293b', padding: 16, borderRadius: 12, overflow: 'auto', fontSize: 13 }}>
            {this.state.message}
          </pre>
          <button
            type="button"
            style={{
              marginTop: 16,
              padding: '10px 18px',
              borderRadius: 10,
              border: '1px solid #475569',
              background: '#334155',
              color: '#f1f5f9',
              cursor: 'pointer',
            }}
            onClick={() => window.location.reload()}
          >
            Recarregar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
