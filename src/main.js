import { MuleEngine } from './engine.js';

const mountNode = document.querySelector('#viewport');
const hudNode = document.querySelector('#hud');

const engine = new MuleEngine({ mountNode, hudNode });
engine.start();
