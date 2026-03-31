/** Estrutura de navegação por contexto operacional. */
export const NAV_SECTIONS = [
  {
    key: 'visao-geral',
    label: 'Visão geral',
    items: [
      { to: '/', label: 'Dashboard', end: true, shortcut: '1' },
      { to: '/command-center', label: 'Command Center', shortcut: '2' },
      { to: '/live-ops', label: 'Live Ops', shortcut: '3' },
      { to: '/autopilot', label: 'Autopilot', shortcut: '4' },
    ],
  },
  {
    key: 'operacao',
    label: 'Operação',
    items: [
      { to: '/atendimento', label: 'Atendimento', shortcut: '5' },
      { to: '/cardapio', label: 'Cardápio', shortcut: '6' },
      { to: '/pedidos', label: 'Pedidos', shortcut: '7' },
      { to: '/kds', label: 'KDS', shortcut: '8' },
      { to: '/expedicao', label: 'Expedição', shortcut: '9' },
      { to: '/roteirizacao', label: 'Roteirização' },
      { to: '/motoboys', label: 'Motoboys' },
    ],
  },
  {
    key: 'suporte',
    label: 'Suporte',
    items: [
      { to: '/integracoes', label: 'Integrações' },
      { to: '/configuracoes', label: 'Configurações' },
      { to: '/dev-test', label: 'Teste' },
    ],
  },
];

/** Compatibilidade: lista plana para usos existentes. */
export const NAV_MODULES = NAV_SECTIONS.flatMap((s) => s.items);

/** Atalhos globais Alt+1..9. */
export const NAV_SHORTCUTS = NAV_MODULES.filter((m) => m.shortcut);

export const NAV_LABEL_BY_PATH = Object.fromEntries(NAV_MODULES.map((m) => [m.to, m.label]));
