import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useOpsSnapshot } from '../contexts/OpsSnapshotContext.jsx';
import { AppSidebar } from '../components/AppSidebar.jsx';
import { StatusBar } from '../components/StatusBar.jsx';
import { NAV_LABEL_BY_PATH, NAV_SHORTCUTS } from '../app/navigation.js';

function MainLayoutMain() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authRequired, error } = useOpsSnapshot();
  const title = NAV_LABEL_BY_PATH[location.pathname] || 'Operação';

  React.useEffect(() => {
    function onKeyDown(e) {
      const target = e.target;
      const tag = target && target.tagName ? String(target.tagName).toLowerCase() : '';
      const editing = tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
      if (!editing && e.key === '/') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('guto:focus-nav-search'));
        return;
      }
      if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const match = NAV_SHORTCUTS.find((s) => s.shortcut === e.key);
        if (match) {
          e.preventDefault();
          navigate(match.to);
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(9, 16, 28, 0.75)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h1>
        <span style={{ color: '#64748b', fontSize: 12 }}>Navegação rápida com Alt+1..9</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Link to="/atendimento" className="btn-ghost" style={{ textDecoration: 'none' }}>
            Atendimento
          </Link>
          <Link to="/pedidos" className="btn-ghost" style={{ textDecoration: 'none' }}>
            Pedidos
          </Link>
          <Link to="/expedicao" className="btn-ghost" style={{ textDecoration: 'none' }}>
            Expedição
          </Link>
        </div>
      </div>
      {authRequired && (
        <div
          style={{
            margin: '12px 16px 0',
            padding: 14,
            borderRadius: 12,
            background: 'rgba(127, 29, 29, 0.35)',
            border: '1px solid rgba(248, 113, 113, 0.5)',
            color: '#fecaca',
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: '#fff' }}>Painel bloqueado pela API (401)</strong>
          <p style={{ margin: '8px 0 0' }}>
            Faça login pelo botão <strong>Entrar</strong> na barra de status para obter JWT operacional. Em produção com
            hardening, evite usar chave estática embutida no frontend.
          </p>
          {error && <p style={{ margin: '10px 0 0', opacity: 0.9 }}>{error}</p>}
        </div>
      )}
      <StatusBar />
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}

export default function MainLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AppSidebar />
      <MainLayoutMain />
    </div>
  );
}
