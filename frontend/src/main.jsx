import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import './theme/premium.css';

const el = document.getElementById('root');
if (!el) {
  console.error('[frontend] #root em falta');
} else {
  ReactDOM.createRoot(el).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
