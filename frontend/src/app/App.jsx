import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout.jsx';
import DashboardPage from '../modules/dashboard/pages/DashboardPage.jsx';
import CommandCenterPage from '../modules/command-center/pages/CommandCenterPage.jsx';
import LiveOpsPage from '../modules/live-ops/pages/LiveOpsPage.jsx';
import AutopilotPage from '../modules/autopilot/pages/AutopilotPage.jsx';
import AtendimentoPage from '../modules/atendimento/pages/AtendimentoPage.jsx';
import PedidosPage from '../modules/pedidos/pages/PedidosPage.jsx';
import KdsPage from '../modules/kds/pages/KdsPage.jsx';
import ExpedicaoPage from '../modules/expedicao/pages/ExpedicaoPage.jsx';
import RoteirizacaoPage from '../modules/roteirizacao/pages/RoteirizacaoPage.jsx';
import MotoboysPage from '../modules/motoboys/pages/MotoboysPage.jsx';
import IntegracoesPage from '../modules/integracoes/pages/IntegracoesPage.jsx';
import ConfiguracoesPage from '../modules/configuracoes/pages/ConfiguracoesPage.jsx';
import DevTestPage from '../modules/dev-test/pages/DevTestPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/command-center" element={<CommandCenterPage />} />
          <Route path="/live-ops" element={<LiveOpsPage />} />
          <Route path="/autopilot" element={<AutopilotPage />} />
          <Route path="/atendimento" element={<AtendimentoPage />} />
          <Route path="/pedidos" element={<PedidosPage />} />
          <Route path="/kds" element={<KdsPage />} />
          <Route path="/expedicao" element={<ExpedicaoPage />} />
          <Route path="/roteirizacao" element={<RoteirizacaoPage />} />
          <Route path="/motoboys" element={<MotoboysPage />} />
          <Route path="/integracoes" element={<IntegracoesPage />} />
          <Route path="/configuracoes" element={<ConfiguracoesPage />} />
          <Route path="/dev-test" element={<DevTestPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
