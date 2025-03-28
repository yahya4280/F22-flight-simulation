class FlightSimulator {
    constructor() {
        // System state initialization
        this.thrust = 50;
        this.aircraft = null;
        this.joystickActive = false;
        this.joystickPosition = { x: 0, y: 0 };
        this.pitch = 0;
        this.roll = 0;
        this.yaw = 0;
        this.currentWeapon = 0;
        this.weapons = ['GUN', 'MISSILE', 'BOMB'];

        // Debug system
        this.debug = {
            errors: 0,
            warnings: 0,
            status: 'Booting...',
            log: [],
            update: () => {
                document.getElementById('debug-status').textContent = this.debug.status;
                document.getElementById('debug-errors').textContent = this.debug.errors;
                document.getElementById('debug-warnings').textContent = this.debug.warnings;
            }
        };

        try {
            // Core initialization
            this.verifyWebGL();
            this.initScene();
            this.initCamera();
            this.initRenderer();
            this.initLighting();
            this.loadAircraftModel();
            this.initEnvironment();
            this.initControls();
            this.initHUD();
            
            // Start systems
            this.animate();
            
            this.debug.status = 'Systems operational';
            this.debug.update();
        } catch (error) {
            this.handleFatalError(error);
        }
    }

    // ======================
    // Core Systems
    // ======================

    verifyWebGL() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) throw new Error('WebGL not supported');
        this.debug.status = 'WebGL verified';
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 100, 20000);
        this.debug.status = 'Scene initialized';
    }

    initCamera() {
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 1, 100000);
        this.camera.position.set(0, 200, 500);
        this.debug.status = 'Camera ready';
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);
        this.debug.status = 'Renderer active';
    }

    initLighting() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.8);
        const directional = new THREE.DirectionalLight(0xffffff, 0.8);
        directional.position.set(100, 500, 100);
        directional.castShadow = true;
        this.scene.add(ambient, directional);
        this.debug.status = 'Lighting configured';
    }

    // ======================
    // Aircraft System
    // ======================

    loadAircraftModel() {
        const loader = new THREE.GLTFLoader();
        loader.load(
            'assets/f22_raptor.glb',
            (gltf) => {
                this.aircraft = gltf.scene;
                this.aircraft.scale.set(3, 3, 3);
                this.aircraft.position.set(0, 700 * 0.3048, 0);
                this.aircraft.rotation.y = Math.PI;
                this.scene.add(this.aircraft);
                this.debug.status = 'Aircraft loaded';
            },
            undefined,
            (error) => this.handleModelError(error)
        );
    }

    handleModelError(error) {
        this.debug.errors++;
        this.debug.status = 'Model error - Using placeholder';
        const geometry = new THREE.BoxGeometry(20, 5, 30);
        const material = new THREE.MeshPhongMaterial({ color: 0xff0000, wireframe: true });
        this.aircraft = new THREE.Mesh(geometry, material);
        this.scene.add(this.aircraft);
    }

    // ======================
    // Mobile Controls
    // ======================

    initControls() {
        const joystick = document.getElementById('joystick');
        const container = document.querySelector('.joystick-container');
        let touchId = null;

        // Joystick Handling
        container.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!touchId) {
                touchId = e.touches[0].identifier;
                this.handleJoystickStart(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });

        document.addEventListener('touchmove', (e) => {
            if (!this.joystickActive) return;
            const touch = Array.from(e.touches).find(t => t.identifier === touchId);
            if (touch) {
                e.preventDefault();
                this.handleJoystickMove(touch.clientX, touch.clientY);
            }
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            if (Array.from(e.changedTouches).some(t => t.identifier === touchId)) {
                this.handleJoystickEnd();
                touchId = null;
            }
        }, { passive: false });

        // Action Buttons
        document.getElementById('fire-btn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.fireWeapon();
        });

        document.getElementById('weapon-btn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.switchWeapon();
        });

        // Thrust Controls
        const updateThrust = (delta) => {
            this.thrust = THREE.MathUtils.clamp(this.thrust + delta, 0, 100);
            this.updateHUD();
        };

        document.getElementById('thrust-up').addEventListener('touchstart', (e) => {
            e.preventDefault();
            updateThrust(5);
        });

        document.getElementById('thrust-down').addEventListener('touchstart', (e) => {
            e.preventDefault();
            updateThrust(-5);
        });

        this.debug.status = 'Controls initialized';
    }

    handleJoystickStart(clientX, clientY) {
        const rect = document.querySelector('.joystick-container').getBoundingClientRect();
        this.joystickBaseX = rect.left + rect.width/2;
        this.joystickBaseY = rect.top + rect.height/2;
        this.joystickActive = true;
        this.handleJoystickMove(clientX, clientY);
    }

    handleJoystickMove(clientX, clientY) {
        const deltaX = clientX - this.joystickBaseX;
        const deltaY = clientY - this.joystickBaseY;
        const distance = Math.min(Math.sqrt(deltaX**2 + deltaY**2), 50);
        const angle = Math.atan2(deltaY, deltaX);

        document.getElementById('joystick').style.transform = 
            `translate(${Math.cos(angle)*distance}px, ${Math.sin(angle)*distance}px)`;

        this.roll = THREE.MathUtils.clamp(deltaX / 50, -1, 1);
        this.pitch = THREE.MathUtils.clamp(deltaY / 50, -1, 1);
    }

    handleJoystickEnd() {
        this.joystickActive = false;
        this.roll = 0;
        this.pitch = 0;
        document.getElementById('joystick').style.transform = 'translate(0, 0)';
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

    // ======================
    // Environment & HUD
    // ======================

    initEnvironment() {
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(100000, 100000),
            new THREE.MeshLambertMaterial({ color: 0x3a5f0b })
        );
        ground.rotation.x = -Math.PI/2;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    initHUD() {
        this.hudElements = {
            speed: document.getElementById('speed'),
            altitude: document.getElementById('altitude'),
            heading: document.getElementById('heading'),
            thrust: document.getElementById('thrust'),
            weapon: document.getElementById('weapon')
        };
        this.updateHUD();
    }

    updateHUD() {
        if (this.aircraft) {
            this.hudElements.speed.textContent = Math.round(this.thrust * 2.5);
            this.hudElements.altitude.textContent = Math.round(this.aircraft.position.y / 0.3048);
            this.hudElements.heading.textContent = Math.round(
                THREE.MathUtils.radToDeg(this.aircraft.rotation.y) % 360
            );
            this.hudElements.thrust.textContent = this.thrust;
        }
    }

    // ======================
    // Animation & Rendering
    // ======================

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.aircraft) {
            // Apply controls
            this.aircraft.rotation.z = THREE.MathUtils.lerp(
                this.aircraft.rotation.z, 
                -this.roll * 0.3, 
                0.1
            );
            this.aircraft.rotation.x = THREE.MathUtils.lerp(
                this.aircraft.rotation.x, 
                this.pitch * 0.3, 
                0.1
            );

            // Movement
            const forwardSpeed = Math.cos(this.aircraft.rotation.x) * this.thrust * 0.5;
            const verticalSpeed = Math.sin(this.aircraft.rotation.x) * this.thrust * 0.5;
            
            this.aircraft.position.z -= forwardSpeed;
            this.aircraft.position.y += verticalSpeed;

            // Camera follow
            this.camera.position.lerp(new THREE.Vector3(
                this.aircraft.position.x,
                this.aircraft.position.y + 100,
                this.aircraft.position.z + 200
            ), 0.1);
            this.camera.lookAt(this.aircraft.position);
        }

        this.renderer.render(this.scene, this.camera);
        this.updateHUD();
    }

    // ======================
    // Error Handling
    // ======================

    handleFatalError(error) {
        this.debug.errors++;
        this.debug.status = `FATAL: ${error.message}`;
        alert(`Simulator crashed: ${error.message}`);
    }
}

// Initialize simulator
window.addEventListener('load', () => new FlightSimulator());
