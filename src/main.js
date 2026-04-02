import { MuleEngine } from './engine.js';

const mountNode = document.querySelector('#viewport');
const hudNode = document.querySelector('#hud');

if (!mountNode || !hudNode) {
  throw new Error('Required DOM nodes #viewport and #hud were not found.');
}

const engine = new MuleEngine({ mountNode, hudNode });
engine.start();
