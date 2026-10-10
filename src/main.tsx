import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { inject } from '@vercel/analytics';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/500.css';
import '@fontsource/geist-mono/600.css';
import './index.css';

// Cookieless page counting (no React binding, so no second React instance can
// ever be involved); custom events go through src/lib/analytics.ts.
inject({ mode: import.meta.env.DEV ? 'development' : 'production' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
