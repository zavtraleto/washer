import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@app/App';

// Initialize Phaser before React mounts

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
