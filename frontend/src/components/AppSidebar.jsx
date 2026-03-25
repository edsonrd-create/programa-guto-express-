import { NavLink } from 'react-router-dom';
import { NAV_MODULES } from '../app/navigation.js';

export function AppSidebar() {
  return (
    <aside
      style={{
        width: 268,
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
      <nav style={{ display: 'grid', gap: 6 }}>
        {NAV_MODULES.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'nav-item nav-item-active' : 'nav-item')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
