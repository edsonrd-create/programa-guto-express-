import React from 'react';
import { RoutingPanel } from '../components/RoutingPanel.jsx';
import ExpedicaoConnectedView from '../components/ExpedicaoConnectedView.jsx';
import { useExpedicaoConnected } from '../hooks/useExpedicaoConnected.js';
import { dispatchService } from '../../../services/dispatch.service.js';
import { settingsService } from '../../../services/settings.service.js';

export default function ExpedicaoPage() {
  const [tab, setTab] = React.useState('conectada');
  const x = useExpedicaoConnected();

  return (
    <div style={{ padding: 24 }} className="fade-up">
      <div className="tab-bar" style={{ marginBottom: 8 }}>
        <button
          type="button"
          className={tab === 'conectada' ? 'tab tab-active' : 'tab'}
          onClick={() => setTab('conectada')}
        >
          Expedição + roteirização
        </button>
        <button type="button" className={tab === 'rotas' ? 'tab tab-active' : 'tab'} onClick={() => setTab('rotas')}>
          Mapa Google & parâmetros
        </button>
      </div>

      {tab === 'conectada' ? (
        <ExpedicaoConnectedView
          kpis={x.kpis}
          ready={x.ready}
          plan={x.plan}
          queue={x.queue}
          drivers={x.drivers}
          deliveries={x.deliveries}
          mode={x.mode}
          setMode={x.setMode}
          planBusy={x.planBusy}
          busy={x.busy}
          setBusy={x.setBusy}
          err={x.err}
          setErr={x.setErr}
          load={x.load}
          runPlan={x.runPlan}
          skipGoogleRoutes={x.skipGoogleRoutes}
          setSkipGoogleRoutes={x.setSkipGoogleRoutes}
          dispatchService={dispatchService}
          ageMinutes={x.ageMinutes}
          slaClock={x.slaClock}
          routeForOrder={x.routeForOrder}
          priorityLabel={x.priorityLabel}
          dispatchQueueMode={x.dispatchQueueMode}
          setDispatchQueueMode={x.setDispatchQueueMode}
          patchDispatchQueueMode={async (mode) => {
            await settingsService.patch({ dispatch_queue_mode: mode });
            x.setDispatchQueueMode(mode);
            await x.load();
          }}
        />
      ) : (
        <RoutingPanel />
      )}
    </div>
  );
}
