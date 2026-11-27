import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Pterodactyl's Blade wrapper renders `#app`; the standalone Vite host uses `#root`.
const mountNode = document.getElementById('app') || document.getElementById('root');

if (!mountNode) {
    throw new Error('HelzerX mount node (#app or #root) was not found.');
}

createRoot(mountNode).render(<App />);
