import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/controls/OrbitControls.js';
import { SimplexNoise } from 'https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/math/SimplexNoise.js';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/+esm';
import { Howl } from 'https://cdn.jsdelivr.net/npm/howler@2.2.4/+esm';
import { gsap } from 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/+esm';
import Stats from 'https://cdn.jsdelivr.net/npm/stats.js@0.17.0/+esm';
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.20.0/+esm';
import mitt from 'https://cdn.jsdelivr.net/npm/mitt@3.0.1/+esm';
import { Grid } from 'https://cdn.jsdelivr.net/npm/pathfinding@0.4.18/+esm';

const SILENT_LOOP_DATA_URI =
  'data:audio/wav;base64,UklGRlQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTAAAAAA';

export class MuleEngine {
  constructor({ mountNode, hudNode }) {
    this.mountNode = mountNode;
    this.hudNode = hudNode;
    this.events = mitt();
    this.clock = new THREE.Clock();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0e1320');
    this.scene.fog = new THREE.Fog('#0e1320', 8, 55);

    this.camera = new THREE.PerspectiveCamera(65, 1, 0.1, 200);
    this.camera.position.set(5, 6, 12);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.mountNode.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 2, 0);

    this.physics = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.physics.broadphase = new CANNON.SAPBroadphase(this.physics);

    this.pathGrid = new Grid(20, 20);
    this.noise = new SimplexNoise();

    this.stats = new Stats();
    this.stats.showPanel(0);
    this.stats.dom.style.position = 'absolute';
    this.stats.dom.style.right = '0';
    this.stats.dom.style.top = '0';
    this.mountNode.appendChild(this.stats.dom);

    this.guiState = {
      exposure: 1,
      physicsSteps: 2,
      musicVolume: 0.15,
      pulseSpeed: 1,
      showHelpers: true,
    };

    this.gui = new GUI({ title: 'Engine Controls' });
    this.guiVisible = true;

    this.music = new Howl({
      src: [SILENT_LOOP_DATA_URI],
      autoplay: false,
      loop: true,
      volume: this.guiState.musicVolume,
      html5: false,
    });

    this.rigidBodies = [];

    this._setupGui();
    this._buildWorld();
    this._bindEvents();
    this.resize();
  }

  _setupGui() {
    this.gui.add(this.guiState, 'exposure', 0.2, 2, 0.05).onChange((value) => {
      this.renderer.toneMappingExposure = value;
    });
    this.gui.add(this.guiState, 'physicsSteps', 1, 6, 1);
    this.gui.add(this.guiState, 'pulseSpeed', 0.2, 4, 0.05);
    this.gui.add(this.guiState, 'musicVolume', 0, 1, 0.01).onChange((value) => {
      this.music.volume(value);
    });
    this.gui.add(this.guiState, 'showHelpers').onChange((value) => {
      this.legend.style.display = value ? 'block' : 'none';
    });
  }

  _buildWorld() {
    const hemiLight = new THREE.HemisphereLight('#b3d8ff', '#10151d', 0.8);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight('#ffffff', 1.2);
    dirLight.position.set(6, 12, 4);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    const groundGeometry = new THREE.PlaneGeometry(40, 40, 45, 45);
    groundGeometry.rotateX(-Math.PI / 2);

    const groundPositions = groundGeometry.attributes.position;
    for (let i = 0; i < groundPositions.count; i += 1) {
      const x = groundPositions.getX(i);
      const z = groundPositions.getZ(i);
      const bump = this.noise.noise(x * 0.08, z * 0.08) * 0.65;
      groundPositions.setY(i, bump);
    }
    groundGeometry.computeVertexNormals();

    const ground = new THREE.Mesh(
      groundGeometry,
      new THREE.MeshStandardMaterial({ color: '#24354e', roughness: 0.94, metalness: 0.1 }),
    );
    ground.receiveShadow = true;
    this.scene.add(ground);

    const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.physics.addBody(groundBody);

    const leader = this._spawnPhysicsBox({
      size: 1.4,
      color: '#7dd3fc',
      position: new THREE.Vector3(0, 4, 0),
    });

    gsap.to(leader.mesh.rotation, { y: Math.PI * 2, duration: 4, ease: 'none', repeat: -1 });

    for (let i = 0; i < 20; i += 1) {
      this._spawnPhysicsBox({
        size: 0.5 + Math.random() * 0.45,
        color: `hsl(${190 + Math.random() * 90}deg 90% 70%)`,
        position: new THREE.Vector3((Math.random() - 0.5) * 12, 7 + Math.random() * 8, (Math.random() - 0.5) * 12),
      });
    }

    this.legend = document.createElement('pre');
    this.legend.className = 'legend';
    this.legend.textContent = ['Mouse drag + wheel: orbit / zoom', 'Space: impulse burst', 'M: toggle audio', 'G: toggle GUI'].join(
      '\n',
    );
    this.mountNode.appendChild(this.legend);

    this.events.emit('world:ready');
  }

  _spawnPhysicsBox({ size, color, position }) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshStandardMaterial({ color }));
    mesh.castShadow = true;
    mesh.position.copy(position);
    this.scene.add(mesh);

    const body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2)),
    });
    body.position.set(position.x, position.y, position.z);
    this.physics.addBody(body);

    this.rigidBodies.push({ mesh, body });
    return { mesh, body };
  }

  _bindEvents() {
    this.onResize = () => this.resize();
    this.onKeyDown = (event) => {
      if (event.code === 'Space') {
        this.rigidBodies.forEach(({ body }) => {
          body.applyImpulse(new CANNON.Vec3((Math.random() - 0.5) * 2, 3 + Math.random(), (Math.random() - 0.5) * 2), body.position);
        });
      } else if (event.code === 'KeyM') {
        if (this.music.playing()) {
          this.music.stop();
        } else {
          this.music.play();
        }
      } else if (event.code === 'KeyG') {
        this.guiVisible = !this.guiVisible;
        if (this.guiVisible) {
          this.gui.show();
        } else {
          this.gui.hide();
        }
      }
    };

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
  }

  resize() {
    const { clientWidth, clientHeight } = this.mountNode;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  }

  updateHud(fps, delta) {
    this.hudNode.textContent = `FPS ${fps.toFixed(0)} • dt ${delta.toFixed(3)} • bodies ${this.rigidBodies.length} • grid ${this.pathGrid.width}x${this.pathGrid.height}`;
  }

  start() {
    let smoothedFps = 60;
    const tick = () => {
      this.stats.begin();
      const delta = this.clock.getDelta();
      this.physics.step(1 / 60, delta, this.guiState.physicsSteps);

      this.rigidBodies.forEach(({ mesh, body }, index) => {
        mesh.position.copy(body.position);
        mesh.quaternion.copy(body.quaternion);
        mesh.position.y += Math.sin(performance.now() * 0.0003 * this.guiState.pulseSpeed + index) * 0.001;
      });

      this.controls.update();
      this.renderer.render(this.scene, this.camera);

      smoothedFps = THREE.MathUtils.lerp(smoothedFps, 1 / Math.max(delta, 0.0001), 0.1);
      this.updateHud(smoothedFps, delta);
      this.stats.end();
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    this.gui.destroy();
    this.renderer.dispose();
    this.mountNode.innerHTML = '';
  }
}
