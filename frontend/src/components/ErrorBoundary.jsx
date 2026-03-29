import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { hasError: false, message: '', stack: '', componentStack: '' };

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || String(error),
      stack: typeof error?.stack === 'string' ? error.stack : '',
    };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
    this.setState({ componentStack: info?.componentStack || '' });
  }

  render() {
    if (this.state.hasError) {
      const showDev = Boolean(import.meta.env?.DEV);
      return (
        <div style={{ padding: 32, maxWidth: 720, margin: '0 auto', color: '#fecaca', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: 20, color: '#f8fafc' }}>Erro ao renderizar o painel</h1>
          <p style={{ color: '#94a3b8', lineHeight: 1.5 }}>
            Abra o F12 → Consola. Se atualizou o código, faça um refresh completo (Ctrl+Shift+R). Erros comuns: rota ou
            contexto React, extensão do browser, ou cache antigo do Vite.
          </p>
          <pre style={{ background: '#1e293b', padding: 16, borderRadius: 12, overflow: 'auto', fontSize: 13 }}>
            {this.state.message}
          </pre>
          {showDev && this.state.stack && (
            <pre
              style={{
                background: '#0f172a',
                padding: 16,
                borderRadius: 12,
                overflow: 'auto',
                fontSize: 11,
                color: '#94a3b8',
                marginTop: 12,
              }}
            >
              {this.state.stack}
              {this.state.componentStack ? `\n\nComponent stack:${this.state.componentStack}` : ''}
            </pre>
          )}
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
