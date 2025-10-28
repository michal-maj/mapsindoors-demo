import './index.css';
import { createApp } from './createApp.js';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element with id "root" was not found');
}

createApp(rootElement);
