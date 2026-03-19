import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.css';
import { GameContainer } from './components/GameContainer.jsx';
import { DEV_MODE } from './engine/constants.js';

// Load dev test suite — only in development; tree-shaken in production
if (DEV_MODE) {
  import('./utils/testSuite.js');
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<GameContainer />);
