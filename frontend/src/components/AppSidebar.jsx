import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_SECTIONS } from '../app/navigation.js';

export function AppSidebar() {
  const [query, setQuery] = React.useState('');
  const normalized = query.trim().toLowerCase();
  const sections = React.useMemo(() => {
    if (!normalized) return NAV_SECTIONS;
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => item.label.toLowerCase().includes(normalized)),
    })).filter((section) => section.items.length > 0);
  }, [normalized]);

  React.useEffect(() => {
    const onFocusSearch = () => {
      const el = document.getElementById('sidebar-nav-search');
      if (el) el.focus();
    };
    window.addEventListener('guto:focus-nav-search', onFocusSearch);
    return () => window.removeEventListener('guto:focus-nav-search', onFocusSearch);
  }, []);

  return (
    <aside
      style={{
        width: 290,
        background: '#111827',
        color: '#fff',
        padding: '20px 16px',
        minHeight: '100vh',
        borderRight: '1px solid #1f2937',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Guto Express</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Plataforma operacional
      </div>
      <input
        id="sidebar-nav-search"
        className="input"
        placeholder="Buscar módulo… (atalho: /)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ maxWidth: '100%', marginBottom: 12, fontSize: 13, padding: '9px 10px' }}
      />
      <nav style={{ display: 'grid', gap: 10 }}>
        {sections.map((section) => (
          <section key={section.key}>
            <div
              style={{
                fontSize: 11,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                margin: '2px 6px 6px',
              }}
            >
              {section.label}
            </div>
            <div style={{ display: 'grid', gap: 5 }}>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? 'nav-item nav-item-active' : 'nav-item')}
                >
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <span style={{ fontSize: 11, color: '#93c5fd', opacity: 0.9 }}>Alt+{item.shortcut}</span>
                  )}
                </NavLink>
              ))}
            </div>
          </section>
        ))}
      </nav>
      <div
        style={{
          marginTop: 16,
          fontSize: 11,
          color: '#94a3b8',
          lineHeight: 1.5,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingTop: 10,
        }}
      >
        Atalhos: <strong style={{ color: '#e2e8f0' }}>Alt+1..9</strong> navega rápido · <strong style={{ color: '#e2e8f0' }}>/</strong>{' '}
        busca módulo.
      </div>
    </aside>
  );
}
