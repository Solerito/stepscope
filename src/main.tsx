import '@fontsource-variable/atkinson-hyperlegible-next/wght.css';
import '@fontsource-variable/atkinson-hyperlegible-mono/wght.css';
import './ui/styles/tokens.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';

const root = document.getElementById('root');
if (!root) throw new Error('Falta el elemento #root');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
