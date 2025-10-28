import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { AppStateProvider } from './state/AppStateContext';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Elemento root não encontrado para inicializar a aplicação.');
}

const loaderElement = document.getElementById('initial-loader');

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

if (loaderElement) {
  requestAnimationFrame(() => {
    loaderElement.classList.add('initial-loader--fade');
    const cleanup = () => loaderElement.remove();
    loaderElement.addEventListener('transitionend', cleanup, { once: true });
    // Garantir remoção caso a transição não dispare
    window.setTimeout(() => {
      if (document.body.contains(loaderElement)) {
        loaderElement.removeEventListener('transitionend', cleanup);
        loaderElement.remove();
      }
    }, 1200);
  });
}
