import * as THREE from 'https://esm.sh/three@0.179.1';
import { OrbitControls } from 'https://esm.sh/three@0.179.1/examples/jsm/controls/OrbitControls.js';
import * as CANNON from 'https://esm.sh/cannon-es@0.20.0';
import { Howl } from 'https://esm.sh/howler@2.2.4';
import { gsap } from 'https://esm.sh/gsap@3.13.0';
import Stats from 'https://esm.sh/stats.js@0.17.0';
import GUI from 'https://esm.sh/lil-gui@0.20.0';
import mitt from 'https://esm.sh/mitt@3.0.1';
import { SimplexNoise } from 'https://esm.sh/three@0.179.1/examples/jsm/math/SimplexNoise.js';
import { Pathfinding } from 'https://esm.sh/pathfinding@0.4.18';

export class MuleEngine {
  constructor({ mountNode, hudNode }) {
    this.mountNode = mountNode;
    this.hudNode = hudNode;
    this.events = mitt();

    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0e1320');

    this.camera = new THREE.PerspectiveCamera(65, 1, 0.1, 200);
    this.camera.position.set(5, 6, 12);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.mountNode.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.physics = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.physics.broadphase = new CANNON.SAPBroadphase(this.physics);

    this.pathfinding = new Pathfinding();
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
    };
    this.gui = new GUI({ title: 'Engine Controls' });
    this._setupGui();

    this.music = new Howl({
      src: ['https://cdn.pixabay.com/download/audio/2022/10/30/audio_0d994ce0f4.mp3?filename=deep-ambient-124008.mp3'],
      autoplay: false,
      loop: true,
      volume: this.guiState.musicVolume,
      html5: true,
    });

    this.rigidBodies = [];
    this.updaters = [];

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
  }

  _buildWorld() {
    this.scene.fog = new THREE.Fog('#0e1320', 8, 55);

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

    const groundMaterial = new THREE.MeshStandardMaterial({
      color: '#24354e',
      roughness: 0.94,
      metalness: 0.1,
      wireframe: false,
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.receiveShadow = true;
    this.scene.add(ground);

    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.physics.addBody(groundBody);

    const box = this._spawnPhysicsBox({
      size: 1.4,
      color: '#7dd3fc',
      position: new THREE.Vector3(0, 4, 0),
    });
    gsap.to(box.mesh.rotation, {
      y: Math.PI * 2,
      duration: 4,
      ease: 'none',
      repeat: -1,
    });

    for (let i = 0; i < 20; i += 1) {
      this._spawnPhysicsBox({
        size: 0.5 + Math.random() * 0.45,
        color: `hsl(${190 + Math.random() * 90}deg 90% 70%)`,
        position: new THREE.Vector3((Math.random() - 0.5) * 12, 7 + Math.random() * 8, (Math.random() - 0.5) * 12),
      });
    }

    const legend = document.createElement('pre');
    legend.className = 'legend';
    legend.textContent = [
      'WASD: camera orbit focus',
      'Space: impulse burst',
      'M: toggle music',
      'G: toggle GUI',
    ].join('\n');
    this.mountNode.appendChild(legend);

    this.events.emit('world:ready');
  }

  _spawnPhysicsBox({ size, color, position }) {
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.position.copy(position);
    this.scene.add(mesh);

    const shape = new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2));
    const body = new CANNON.Body({ mass: 1, shape });
    body.position.set(position.x, position.y, position.z);
    this.physics.addBody(body);

    this.rigidBodies.push({ mesh, body });
    return { mesh, body };
  }

  _bindEvents() {
    window.addEventListener('resize', this.resize);

    this.onKeyDown = (event) => {
      if (event.code === 'Space') {
        this.rigidBodies.forEach(({ body }) => {
          body.applyImpulse(
            new CANNON.Vec3((Math.random() - 0.5) * 2, 2.8 + Math.random(), (Math.random() - 0.5) * 2),
            body.position,
          );
        });
      }

      if (event.code === 'KeyM') {
        if (this.music.playing()) {
          this.music.fade(this.music.volume(), 0, 300);
          setTimeout(() => this.music.stop(), 350);
        } else {
          this.music.play();
          this.music.fade(0, this.guiState.musicVolume, 420);
        }
      }

      if (event.code === 'KeyG') {
        this.gui._hidden ? this.gui.show() : this.gui.hide();
      }
    };

    window.addEventListener('keydown', this.onKeyDown);
  }

  resize = () => {
    const { clientWidth, clientHeight } = this.mountNode;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  };

  updateHud(fps, delta) {
    this.hudNode.textContent = `FPS ${fps.toFixed(0)} • dt ${delta.toFixed(3)} • bodies ${this.rigidBodies.length}`;
  }

  start() {
    let smoothedFps = 60;

    const tick = () => {
      this.stats.begin();
      const delta = this.clock.getDelta();
      const fixedStep = 1 / 60;
      this.physics.step(fixedStep, delta, this.guiState.physicsSteps);

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
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }
}
