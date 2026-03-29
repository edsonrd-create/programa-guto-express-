import { Outlet } from 'react-router-dom';
import { OpsSnapshotProvider, useOpsSnapshot } from '../contexts/OpsSnapshotContext.jsx';
import { AppSidebar } from '../components/AppSidebar.jsx';
import { StatusBar } from '../components/StatusBar.jsx';

function MainLayoutMain() {
  const { authRequired, error } = useOpsSnapshot();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
            O servidor está com <code style={{ color: '#fde68a' }}>ADMIN_API_KEY</code>. No computador onde corre o Vite,
            crie o ficheiro <code style={{ color: '#fde68a' }}>frontend/.env</code> com:{' '}
            <code style={{ color: '#fde68a' }}>VITE_ADMIN_API_KEY=</code> (mesmo valor do backend). Guarde, pare o{' '}
            <code>npm run dev</code> e inicie outra vez. Sem reiniciar, o Vite não lê o .env.
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
      <OpsSnapshotProvider httpPollMs={10000}>
        <MainLayoutMain />
      </OpsSnapshotProvider>
    </div>
  );
}
