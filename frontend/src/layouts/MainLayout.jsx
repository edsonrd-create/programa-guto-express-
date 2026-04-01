import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useOpsSnapshot } from '../contexts/OpsSnapshotContext.jsx';
import { AppSidebar } from '../components/AppSidebar.jsx';
import { StatusBar } from '../components/StatusBar.jsx';
import { NAV_LABEL_BY_PATH, NAV_MODULES, NAV_SHORTCUTS } from '../app/navigation.js';

function MainLayoutMain({ isMobile, sidebarOpen, setSidebarOpen }) {
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
          setSidebarOpen(false);
        }
      }
      if (e.key === 'Escape') setSidebarOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  function handleJump(path) {
    if (!path) return;
    navigate(path);
    setSidebarOpen(false);
  }

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
        {isMobile && (
          <button type="button" className="btn-ghost" onClick={() => setSidebarOpen((v) => !v)}>
            {sidebarOpen ? 'Fechar menu' : 'Menu'}
          </button>
        )}
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h1>
        <span style={{ color: '#64748b', fontSize: 12 }}>Navegação rápida com Alt+1..9</span>
        <select
          className="select"
          style={{ maxWidth: 230, padding: '8px 10px', fontSize: 13 }}
          value=""
          onChange={(e) => {
            handleJump(e.target.value);
            e.target.value = '';
          }}
          title="Troca rápida de módulo"
        >
          <option value="">Ir para módulo…</option>
          {NAV_MODULES.map((m) => (
            <option key={m.to} value={m.to}>
              {m.label}
            </option>
          ))}
        </select>
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
  const [isMobile, setIsMobile] = React.useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 1024 : false,
  );
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    function onResize() {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      {!isMobile && <AppSidebar />}
      {isMobile && sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.6)',
            zIndex: 40,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {isMobile && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 50,
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-105%)',
            transition: 'transform 180ms ease',
          }}
        >
          <AppSidebar onNavigate={() => setSidebarOpen(false)} />
        </div>
      )}
      <MainLayoutMain isMobile={isMobile} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
    </div>
  );
}
