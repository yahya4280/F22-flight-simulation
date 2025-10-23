
import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.152.2/examples/jsm/loaders/GLTFLoader.js';

class FlightSimulator {
  constructor() {
    // Tunable parameters (defaults)
    this.params = {
      mass: 15000,
      wingArea: 78.04,
      wingSpan: 13.56,
      CL_alpha: 5.7,
      CL0: 0.2,
      CD0: 0.02,
      inducedFactor: 1.2 / (Math.PI * (13.56**2 / 78.04)),
      maxThrust: 312000,
      controlEffectiveness: 1,
      turbulenceIntensity: 0.6,
      windSpeed: 5,
      windDirDeg: 200
    };

    // inertia approximations
    this.I = new THREE.Vector3(10000, 20000, 30000);
    this.gravity = 9.80665;

    // State
    this.position = new THREE.Vector3(0, 2000 * 0.3048, 0);
    this.velocity = new THREE.Vector3(240 * 0.514444, 0, 0); // ~240 kt
    this.quaternion = new THREE.Quaternion();
    this.angularVelocity = new THREE.Vector3();
    this.thrustPercent = 50;
    this.elevator = 0;
    this.aileron = 0;
    this.rudder = 0;
    this.weapons = ['GUN','MISSILE','BOMB'];
    this.currentWeapon = 0;
    this.cameraMode = 'chase';

    // three.js containers
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.aircraft = null;

    // init systems
    this._initThree();
    this._initScene();
    this._initAircraft();
    this._initEnvironment();
    this._initControls();
    this._initUI();

    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // -------------------------
  // Graphics & scene
  // -------------------------
  _initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 200, 20000);

    this.camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 200000);
    this.renderer = new THREE.WebGLRenderer({ antialias:true });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(innerWidth, innerHeight);
    document.body.appendChild(this.renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(1000,2000,1000);
    this.scene.add(ambient, sun);

    window.addEventListener('resize', () => {
      this.camera.aspect = innerWidth/innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    }, { passive:true });
  }

  _initScene() {
    const grid = new THREE.GridHelper(30000, 300, 0x222222, 0x2b2b2b);
    grid.position.y = -0.2;
    this.scene.add(grid);
  }

  _initAircraft() {
    // Placeholder visual while GLB loads (or if load fails)
    const fus = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6,1.2,6,8),
      new THREE.MeshStandardMaterial({ color:0x8899aa, metalness:0.5, roughness:0.4 })
    );
    fus.rotation.z = Math.PI/2;
    fus.scale.set(2.3,2.3,2.3);
    this.aircraft = new THREE.Group();
    this.aircraft.add(fus);

    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.15, 24),
      new THREE.MeshStandardMaterial({ color:0x667788 })
    );
    wing.position.set(1.2,0,0);
    wing.rotation.z = Math.PI/12;
    this.aircraft.add(wing);

    this.aircraft.position.copy(this.position);
    this.aircraft.quaternion.copy(this.quaternion);
    this.scene.add(this.aircraft);

    // compute a correct absolute URL for the GLB relative to this module file
    const modelURL = new URL('./assets/f22_raptor.glb', import.meta.url).href;

    // create loader and attempt to load model
    const loader = new GLTFLoader();
    // keep a placeholder reference so we can remove it if model loads
    this.placeholder = this.aircraft;

    loader.load(
      modelURL,
      (gltf) => {
        this.aircraft = gltf.scene;
        this.aircraft.scale.set(6,6,6);
        this.aircraft.rotation.y = Math.PI;
        // remove placeholder if present
        if (this.placeholder && this.scene) this.scene.remove(this.placeholder);
        this.scene.add(this.aircraft);
        this._setDebug('Model loaded');
      },
      (xhr) => {
        // optional progress logging (xhr.total can be 0 on some servers)
        if (xhr.total) {
          console.debug(`Model ${Math.round((xhr.loaded/xhr.total)*100)}%`);
        }
      },
      (error) => {
        console.error('GLB load failed', error);
        this._setDebug('Model load failed — using placeholder');
        // fallback: keep placeholder already present (no crash)
      }
    );
  }

  _initEnvironment(){
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(50000,50000), new THREE.MeshLambertMaterial({ color:0x3a5f0b }));
    ground.rotation.x = -Math.PI/2;
    ground.position.y = 0;
    this.scene.add(ground);

    // runway visual
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(800,40), new THREE.MeshStandardMaterial({ color:0x222222 }));
    runway.rotation.x = -Math.PI/2;
    runway.position.set(0, 0.02, 2000);
    this.scene.add(runway);
  }

  // -------------------------
  // Controls
  // -------------------------
  _initControls(){
    // joystick pointer handling
    const joyArea = document.getElementById('joy-area');
    const knob = document.getElementById('joystick');
    if (joyArea && knob) {
      const rectSize = 96;
      const centerOffset = (rectSize - knob.offsetWidth)/2;
      knob.style.transform = `translate(${centerOffset}px,${centerOffset}px)`;

      let pointerId = null;
      joyArea.addEventListener('pointerdown', (e) => { joyArea.setPointerCapture(e.pointerId); pointerId = e.pointerId; this._joyMove(e, joyArea, knob); });
      joyArea.addEventListener('pointermove', (e) => { if (pointerId===e.pointerId) this._joyMove(e, joyArea, knob); });
      const release = (e) => { if (pointerId !== null && e.pointerId!==pointerId) return; pointerId = null; knob.style.transform = `translate(${centerOffset}px,${centerOffset}px)`; this.aileron=0; this.elevator=0; };
      joyArea.addEventListener('pointerup', release);
      joyArea.addEventListener('pointercancel', release);
      joyArea.addEventListener('pointerleave', release);
    }

    // buttons
    const fire = document.getElementById('fire-btn');
    const weap = document.getElementById('weapon-btn');
    const cam = document.getElementById('camera-btn');
    const thrUp = document.getElementById('thrust-up');
    const thrDown = document.getElementById('thrust-down');

    if (fire) fire.addEventListener('click', ()=> this._fireWeapon());
    if (weap) weap.addEventListener('click', ()=> this._switchWeapon());
    if (cam) cam.addEventListener('click', ()=> this._toggleCamera());
    if (thrUp) thrUp.addEventListener('click', ()=> this._adjustThrust(5));
    if (thrDown) thrDown.addEventListener('click', ()=> this._adjustThrust(-5));

    // keyboard
    window.addEventListener('keydown', (e) => {
      if (e.code==='ArrowUp' || e.code==='KeyW') this.elevator = 0.8;
      if (e.code==='ArrowDown' || e.code==='KeyS') this.elevator = -0.8;
      if (e.code==='ArrowLeft' || e.code==='KeyA') this.aileron = -0.8;
      if (e.code==='ArrowRight' || e.code==='KeyD') this.aileron = 0.8;
      if (e.code==='KeyQ') this._adjustThrust(-5);
      if (e.code==='KeyE') this._adjustThrust(5);
      if (e.code==='Space') this._fireWeapon();
      if (e.code==='KeyR') this._switchWeapon();
    });
    window.addEventListener('keyup', (e) => {
      if (['ArrowUp','ArrowDown','KeyW','KeyS'].includes(e.code)) this.elevator = 0;
      if (['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(e.code)) this.aileron = 0;
    });

    // tune panel
    const maxT = document.getElementById('maxThrust');
    const ctl = document.getElementById('ctlEff');
    if (maxT) {
      maxT.addEventListener('input', (ev) => { this.params.maxThrust = +ev.target.value; document.getElementById('T-val').textContent = Math.round(this.params.maxThrust); });
    }
    if (ctl) {
      ctl.addEventListener('input', (ev) => { this.params.controlEffectiveness = +ev.target.value; document.getElementById('ctl-val').textContent = ev.target.value; });
    }

    // orientation overlay logic (robust; hides overlay on desktop Chrome/Windows)
    const overlay = document.getElementById('orientation-overlay');

    // determine whether the device is likely a touch/mobile device
    const isTouchDevice = (() => {
      try {
        return (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
               ('ontouchstart' in window) ||
               (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      } catch (e) {
        return false;
      }
    })();

    const checkOrientation = () => {
      // If not a touch-capable device (desktop/laptop), always hide the overlay.
      if (!isTouchDevice) {
        if (overlay) {
          overlay.hidden = true;
          overlay.setAttribute('aria-hidden', 'true');
        }
        return;
      }

      // For touch devices, prefer matchMedia but fall back to comparing dimensions.
      let portrait = false;
      if (window.matchMedia) {
        try {
          portrait = window.matchMedia('(orientation: portrait)').matches;
        } catch (e) {
          portrait = window.innerHeight > window.innerWidth;
        }
      } else {
        portrait = window.innerHeight > window.innerWidth;
      }

      // Treat perfectly square viewports as landscape (don't ask to rotate).
      if (window.innerHeight === window.innerWidth) portrait = false;

      if (overlay) {
        overlay.hidden = !portrait;
        overlay.setAttribute('aria-hidden', String(!portrait));
      }
    };

    window.addEventListener('resize', checkOrientation, { passive:true });
    window.addEventListener('orientationchange', checkOrientation);
    checkOrientation();
  }

  _joyMove(e, container, knob){
    const rect = container.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const cx = rect.width/2, cy = rect.height/2;
    const dx = localX - cx, dy = localY - cy;
    const max = 36; const dist = Math.hypot(dx,dy), angle = Math.atan2(dy,dx);
    const clamped = Math.min(max, dist);
    const nx = cx + Math.cos(angle) * clamped; const ny = cy + Math.sin(angle) * clamped;
    knob.style.transform = `translate(${nx - knob.offsetWidth/2}px, ${ny - knob.offsetHeight/2}px)`;
    this.aileron = THREE.MathUtils.clamp((nx - cx) / max, -1, 1);
    this.elevator = THREE.MathUtils.clamp(-(ny - cy) / max, -1, 1);
  }

  // -------------------------
  // UI helpers / weapons
  // -------------------------
  _fireWeapon() {
    const el = document.getElementById('weapon');
    if (!el) return;
    const prev = el.textContent;
    el.textContent = 'FIRING';
    setTimeout(()=> el.textContent = prev, 200);
  }
  _switchWeapon() { this.currentWeapon = (this.currentWeapon + 1) % this.weapons.length; }
  _toggleCamera() { this.cameraMode = (this.cameraMode==='chase') ? 'third' : 'chase'; }
  _adjustThrust(d) { this.thrustPercent = THREE.MathUtils.clamp((this.thrustPercent||50) + d, 0, 100); document.getElementById('thrust').textContent = Math.round(this.thrustPercent); }
  _setDebug(text) { const dbg = document.getElementById('debug-status'); if (dbg) dbg.textContent = text; }

  // -------------------------
  // Aerodynamics & integration
  // -------------------------
  airDensity(alt) {
    const rho0 = 1.225, T0 = 288.15, g = 9.80665, R = 287.05, lapse = 0.0065;
    const h = Math.max(0, alt);
    const exponent = g / (R * lapse);
    const rho = rho0 * Math.pow(1 - (lapse * h / T0), exponent);
    return Math.max(0.18, rho);
  }

  estimateAoA() {
    const vWorld = this.velocity.clone();
    const qConj = this.quaternion.clone().conjugate();
    const bodyVel = vWorld.clone().applyQuaternion(qConj);
    if (bodyVel.length() < 1e-3) return 0;
    return Math.atan2(bodyVel.y, bodyVel.x);
  }

  computeAerodynamics() {
    const rho = this.airDensity(this.position.y);
    const speed = this.velocity.length();
    const q = 0.5 * rho * speed * speed;
    const aoa = this.estimateAoA();
    let CL = this.params.CL0 + this.params.CL_alpha * aoa;
    let CD = this.params.CD0 + this.params.inducedFactor * CL * CL;
    const stallAoA = THREE.MathUtils.degToRad(14);
    let stalled = false;
    if (Math.abs(aoa) > stallAoA) {
      stalled = true;
      const factor = Math.max(0.05, 1 - (Math.abs(aoa) - stallAoA) / (Math.PI/2 - stallAoA));
      CL *= factor;
      CD += 1.5;
    }
    const lift = q * this.params.wingArea * CL;
    const drag = q * this.params.wingArea * CD;
    return { rho, speed, q, aoa, CL, CD, lift, drag, stalled };
  }

  integrate(dt) {
    // wind + turbulence
    const wd = (this.params.windDirDeg + 180) % 360; const windRad = THREE.MathUtils.degToRad(wd);
    const windVec = new THREE.Vector3(Math.cos(windRad)*this.params.windSpeed, 0, Math.sin(windRad)*this.params.windSpeed);
    const turb = new THREE.Vector3((Math.random()*2-1)*this.params.turbulenceIntensity, (Math.random()*2-1)*this.params.turbulenceIntensity, (Math.random()*2-1)*this.params.turbulenceIntensity);
    const relWind = windVec.clone().add(turb).sub(this.velocity);
    const airspeed = relWind.length();

    const aero = this.computeAerodynamics();

    const thrustN = (this.thrustPercent/100) * this.params.maxThrust;
    const bodyForward = new THREE.Vector3(1,0,0).applyQuaternion(this.quaternion);
    const thrustForce = bodyForward.clone().multiplyScalar(thrustN);

    const dragForce = (airspeed>0.001) ? relWind.clone().normalize().multiplyScalar(-aero.drag) : new THREE.Vector3();

    const bodyUp = new THREE.Vector3(0,1,0).applyQuaternion(this.quaternion);
    const liftForce = bodyUp.clone().multiplyScalar(aero.lift);

    const weight = new THREE.Vector3(0, -this.params.mass * this.gravity, 0);

    const totalForce = new THREE.Vector3().add(thrustForce).add(liftForce).add(dragForce).add(weight);
    const accel = totalForce.clone().multiplyScalar(1 / this.params.mass);

    this.velocity.add(accel.multiplyScalar(dt));
    this.position.add(this.velocity.clone().multiplyScalar(dt));

    // ground collision
    if (this.position.y <= 0) {
      if (this.velocity.y < -8) this.velocity.y *= -0.15; else { this.position.y = 0; if (Math.abs(this.velocity.y) < 2) this.velocity.y = 0; }
    }

    // rotational dynamics (control torques scaled by dynamic pressure)
    const qDyn = aero.q;
    const elevatorEffect = 60000, aileronEffect = 45000, rudderEffect = 15000;
    const qRef = 0.5 * 1.225 * (100**2);
    const elevatorTorque = this.elevator * elevatorEffect * (qDyn / qRef) * this.params.controlEffectiveness;
    const aileronTorque = this.aileron * aileronEffect * (qDyn / qRef) * this.params.controlEffectiveness;
    const rudderTorque = this.rudder * rudderEffect * (qDyn / qRef) * this.params.controlEffectiveness;
    const damping = this.angularVelocity.clone().multiplyScalar(-1000);
    const torqueBody = new THREE.Vector3(aileronTorque + damping.x, rudderTorque + damping.y, elevatorTorque + damping.z);
    const angAcc = new THREE.Vector3(torqueBody.x / this.I.x, torqueBody.y / this.I.y, torqueBody.z / this.I.z);
    this.angularVelocity.add(angAcc.multiplyScalar(dt));

    const w = this.angularVelocity.clone();
    const wMag = w.length();
    if (wMag > 1e-6) {
      const axis = w.clone().normalize();
      const dQ = new THREE.Quaternion().setFromAxisAngle(axis, wMag * dt);
      this.quaternion.multiply(dQ).normalize();
    }

    // update aircraft transform
    if (this.aircraft) {
      this.aircraft.position.copy(this.position);
      this.aircraft.quaternion.copy(this.quaternion);
    }

    return { aero, thrustN, relWind, stalled: aero.stalled };
  }

  // -------------------------
  // Camera & HUD
  // -------------------------
  updateCamera(dt) {
    const chaseOffset = new THREE.Vector3(-18, 6, 0).applyQuaternion(this.quaternion).add(this.position);
    this.camera.position.lerp(chaseOffset, Math.min(1, dt*3));
    const forward = new THREE.Vector3(1,0,0).applyQuaternion(this.quaternion);
    const lookAt = this.position.clone().add(forward.clone().multiplyScalar(60));
    this.camera.lookAt(lookAt);
  }

  updateHUD(aeroInfo) {
    const v = this.velocity.length();
    document.getElementById('speed').textContent = Math.round(v * 1.94384);
    document.getElementById('altitude').textContent = Math.round(this.position.y / 0.3048);
    const euler = new THREE.Euler().setFromQuaternion(this.quaternion, 'ZYX');
    const yawDeg = (THREE.MathUtils.radToDeg(euler.y) + 360) % 360;
    document.getElementById('heading').textContent = Math.round(yawDeg);
    document.getElementById('pitch').textContent = THREE.MathUtils.radToDeg(euler.x).toFixed(1);
    document.getElementById('roll').textContent = THREE.MathUtils.radToDeg(euler.z).toFixed(1);
    document.getElementById('aoa').textContent = (THREE.MathUtils.radToDeg(aeroInfo.aoa)).toFixed(1);
    document.getElementById('thrust').textContent = Math.round(this.thrustPercent);
    document.getElementById('weapon').textContent = this.weapons[this.currentWeapon];
    this._setDebug(`V=${Math.round(v)} m/s  AoA=${(THREE.MathUtils.radToDeg(aeroInfo.aoa)).toFixed(1)}°  Thrust=${Math.round(this.thrustPercent)}%`);
  }

  // -------------------------
  // Main loop
  // -------------------------
  loop(now) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    const info = this.integrate(dt);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.updateHUD(info.aero);

    requestAnimationFrame(this.loop);
  }
}

// Initialize
window.addEventListener('load', () => {
  try {
    window.sim = new FlightSimulator();
  } catch (err) {
    console.error('Simulator failed', err);
    alert('Simulator error: ' + err.message);
  }
});
