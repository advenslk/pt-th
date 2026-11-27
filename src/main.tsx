import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { loadThemeMode } from './utils/userPreferences';

const initialMode = loadThemeMode();
const initialDark =
  initialMode === 'dark' ||
  (initialMode === 'auto' &&
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches);
document.documentElement.classList.toggle('dark', initialDark);

// Pterodactyl's Blade wrapper renders `#app`; the standalone Vite host uses `#root`.
const mountNode = document.getElementById('app') || document.getElementById('root');

if (!mountNode) {
    throw new Error('HelzerX mount node (#app or #root) was not found.');
}

createRoot(mountNode).render(<App />);
