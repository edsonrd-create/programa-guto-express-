import { Outlet } from 'react-router-dom';
import { OpsSnapshotProvider } from '../contexts/OpsSnapshotContext.jsx';
import { AppSidebar } from '../components/AppSidebar.jsx';
import { StatusBar } from '../components/StatusBar.jsx';

export default function MainLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AppSidebar />
      <OpsSnapshotProvider httpPollMs={10000}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <StatusBar />
          <main style={{ flex: 1, overflow: 'auto' }}>
            <Outlet />
          </main>
        </div>
      </OpsSnapshotProvider>
    </div>
  );
}
