class FlightSimulator {
    constructor() {
        this.thrust = 50; // % power
        this.aircraft = null;
        this.velocity = new THREE.Vector3(0, 0, -50); // initial forward speed
        this.mass = 12000; // kg (approx F22 empty weight)
        this.area = 78; // m² wing area
        this.liftCoeff = 1.0;
        this.dragCoeff = 0.02;

        this.joystickActive = false;
        this.roll = 0;
        this.pitch = 0;
        this.yaw = 0;

        this.currentWeapon = 0;
        this.weapons = ['GUN', 'MISSILE', 'BOMB'];

        // Debug
        this.debug = {
            errors: 0,
            warnings: 0,
            status: 'Booting...',
            update: () => {
                document.getElementById('debug-status').textContent = this.debug.status;
                document.getElementById('debug-errors').textContent = this.debug.errors;
                document.getElementById('debug-warnings').textContent = this.debug.warnings;
            }
        };

        try {
            this.verifyWebGL();
            this.initScene();
            this.initCamera();
            this.initRenderer();
            this.initLighting();
            this.loadAircraftModel();
            this.initEnvironment();
            this.initControls();
            this.initHUD();
            this.animate();

            this.debug.status = 'Systems operational';
            this.debug.update();
        } catch (error) {
            this.handleFatalError(error);
        }
    }

    verifyWebGL() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
        if (!gl) throw new Error('WebGL not supported');
        this.debug.status = 'WebGL verified';
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 500, 5000);
    }

    initCamera() {
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 100000);
        this.camera.position.set(0, 3, -10);
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
    }

    initLighting() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        const sun = new THREE.DirectionalLight(0xffffff, 1.0);
        sun.position.set(1000, 2000, 1000);
        this.scene.add(ambient, sun);
    }

    loadAircraftModel() {
        const loader = new THREE.GLTFLoader();
        loader.load(
            'assets/f22_raptor.glb',
            (gltf) => {
                this.aircraft = gltf.scene;
                this.aircraft.scale.set(3, 3, 3);
                this.aircraft.position.set(0, 2000, 0);
                this.aircraft.rotation.y = Math.PI;
                this.scene.add(this.aircraft);
                this.debug.status = 'Aircraft loaded';
            },
            undefined,
            () => this.handleModelError()
        );
    }

    handleModelError() {
        this.debug.errors++;
        const geom = new THREE.BoxGeometry(20, 5, 30);
        const mat = new THREE.MeshPhongMaterial({ color: 0xff0000, wireframe: true });
        this.aircraft = new THREE.Mesh(geom, mat);
        this.aircraft.position.set(0, 2000, 0);
        this.scene.add(this.aircraft);
        this.debug.status = 'Model error - placeholder active';
    }

    initEnvironment() {
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(20000, 20000, 10, 10),
            new THREE.MeshLambertMaterial({ color: 0x228B22 })
        );
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(ground);
    }

    initControls() {
        const joystick = document.getElementById('joystick');
        const container = document.querySelector('.joystick-container');
        let touchId = null;

        container.addEventListener('touchstart', (e) => {
            if (!touchId) {
                touchId = e.touches[0].identifier;
                this.handleJoystickStart(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (!this.joystickActive) return;
            const touch = Array.from(e.touches).find(t => t.identifier === touchId);
            if (touch) this.handleJoystickMove(touch.clientX, touch.clientY);
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (Array.from(e.changedTouches).some(t => t.identifier === touchId)) {
                this.handleJoystickEnd();
                touchId = null;
            }
        }, { passive: false });

        document.getElementById('fire-btn').addEventListener('touchstart', () => this.fireWeapon());
        document.getElementById('weapon-btn').addEventListener('touchstart', () => this.switchWeapon());

        const updateThrust = (delta) => {
            this.thrust = THREE.MathUtils.clamp(this.thrust + delta, 0, 100);
            this.updateHUD();
        };
        document.getElementById('thrust-up').addEventListener('touchstart', () => updateThrust(5));
        document.getElementById('thrust-down').addEventListener('touchstart', () => updateThrust(-5));
    }

    handleJoystickStart(x, y) {
        const rect = document.querySelector('.joystick-container').getBoundingClientRect();
        this.joystickBaseX = rect.left + rect.width / 2;
        this.joystickBaseY = rect.top + rect.height / 2;
        this.joystickActive = true;
        this.handleJoystickMove(x, y);
    }

    handleJoystickMove(x, y) {
        const dx = x - this.joystickBaseX;
        const dy = y - this.joystickBaseY;
        const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), 50);
        const angle = Math.atan2(dy, dx);

        document.getElementById('joystick').style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`;
        this.roll = THREE.MathUtils.clamp(dx / 50, -1, 1);
        this.pitch = THREE.MathUtils.clamp(dy / 50, -1, 1);
    }

    handleJoystickEnd() {
        this.joystickActive = false;
        this.roll = 0;
        this.pitch = 0;
        document.getElementById('joystick').style.transform = 'translate(0,0)';
    }

    fireWeapon() {
        const hudWeapon = document.getElementById('weapon');
        hudWeapon.textContent = 'FIRING';
        setTimeout(() => hudWeapon.textContent = this.weapons[this.currentWeapon], 200);
    }

    switchWeapon() {
        this.currentWeapon = (this.currentWeapon + 1) % this.weapons.length;
        document.getElementById('weapon').textContent = this.weapons[this.currentWeapon];
    }

    initHUD() {
        this.hudElements = {
            speed: document.getElementById('speed'),
            altitude: document.getElementById('altitude'),
            heading: document.getElementById('heading'),
            thrust: document.getElementById('thrust'),
            weapon: document.getElementById('weapon')
        };
    }

    updateHUD() {
        if (this.aircraft) {
            const speed = this.velocity.length();
            this.hudElements.speed.textContent = Math.round(speed * 1.94384); // m/s → knots
            this.hudElements.altitude.textContent = Math.round(this.aircraft.position.y / 0.3048);
            const headingDeg = (Math.round(THREE.MathUtils.radToDeg(this.aircraft.rotation.y)) + 360) % 360;
            this.hudElements.heading.textContent = headingDeg;
            this.hudElements.thrust.textContent = this.thrust;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.aircraft) {
            // Apply roll/pitch controls
            this.aircraft.rotation.z = THREE.MathUtils.lerp(this.aircraft.rotation.z, -this.roll * 0.5, 0.05);
            this.aircraft.rotation.x = THREE.MathUtils.lerp(this.aircraft.rotation.x, this.pitch * 0.4, 0.05);

            // Compute forces
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.aircraft.quaternion);
            const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.aircraft.quaternion);

            const speed = this.velocity.length();
            const thrustForce = forward.clone().multiplyScalar(this.thrust * 500);
            const liftForce = up.clone().multiplyScalar(0.5 * 1.225 * speed ** 2 * this.area * this.liftCoeff * Math.cos(this.aircraft.rotation.x));
            const dragForce = this.velocity.clone().multiplyScalar(-this.dragCoeff * speed);
            const gravity = new THREE.Vector3(0, -9.81 * this.mass, 0);

            const netForce = new THREE.Vector3().add(thrustForce).add(liftForce).add(dragForce).add(gravity);
            const acceleration = netForce.divideScalar(this.mass);
            this.velocity.add(acceleration);

            this.aircraft.position.add(this.velocity.clone().multiplyScalar(0.016)); // assume ~60fps

            // Camera follow
            const offset = new THREE.Vector3(0, 5, -15).applyQuaternion(this.aircraft.quaternion);
            this.camera.position.lerp(this.aircraft.position.clone().add(offset), 0.1);
            this.camera.lookAt(this.aircraft.position.clone().add(forward.multiplyScalar(50)));
        }

        this.renderer.render(this.scene, this.camera);
        this.updateHUD();
    }

    handleFatalError(error) {
        this.debug.errors++;
        this.debug.status = `FATAL: ${error.message}`;
        alert(`Simulator crashed: ${error.message}`);
    }
}

window.addEventListener('load', () => new FlightSimulator());
