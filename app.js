class FlightSimulator {
    constructor() {
        // Debug system initialization
        this.debug = {
            errors: 0,
            warnings: 0,
            status: 'Booting...',
            log: [],
            update: () => {
                document.getElementById('debug-status').textContent = this.debug.status;
                document.getElementById('debug-errors').textContent = this.debug.errors;
                document.getElementById('debug-warnings').textContent = this.debug.warnings;
                console.log(this.debug.status);
            }
        };

        try {
            // Core initialization sequence
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
            this.addTestObjects();
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
        if (!gl) {
            throw new Error('WebGL not supported! Try different browser or update GPU drivers');
        }
        this.debug.status = 'WebGL verified';
        this.debug.update();
    }

    initScene() {
        try {
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x87CEEB);
            this.scene.fog = new THREE.Fog(0x87CEEB, 100, 20000);
            this.debug.status = 'Scene initialized';
            this.debug.update();
        } catch (error) {
            this.handleFatalError(error);
        }
    }

    initCamera() {
        try {
            this.camera = new THREE.PerspectiveCamera(
                75,
                window.innerWidth / window.innerHeight,
                1,    // Near plane
                100000 // Far plane
            );
            this.camera.position.set(0, 200, 500);
            this.camera.lookAt(0, 0, 0);
            this.debug.status = 'Camera initialized';
            this.debug.update();
        } catch (error) {
            this.handleFatalError(error);
        }
    }

    initRenderer() {
        try {
            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                powerPreference: "high-performance"
            });
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.shadowMap.enabled = true;
            document.body.appendChild(this.renderer.domElement);
            
            this.debug.status = 'Renderer active';
            this.debug.update();
        } catch (error) {
            this.handleFatalError(new Error('Renderer failed: ' + error.message));
        }
    }

    initLighting() {
        try {
            // Ambient light
            const ambient = new THREE.AmbientLight(0xffffff, 0.8);
            this.scene.add(ambient);

            // Directional light
            const directional = new THREE.DirectionalLight(0xffffff, 0.8);
            directional.position.set(100, 500, 100);
            directional.castShadow = true;
            directional.shadow.mapSize.width = 2048;
            directional.shadow.mapSize.height = 2048;
            directional.shadow.camera.near = 0.5;
            directional.shadow.camera.far = 5000;
            this.scene.add(directional);

            this.debug.status = 'Lighting configured';
            this.debug.update();
        } catch (error) {
            this.handleFatalError(error);
        }
    }

    // ======================
    // Aircraft System
    // ======================

    loadAircraftModel() {
        try {
            const loader = new THREE.GLTFLoader();
            
            loader.load(
                'assets/f22_raptor.glb',
                (gltf) => {
                    try {
                        this.aircraft = gltf.scene;
                        this.aircraft.name = 'F-22_Raptor';
                        
                        // Transformations
                        this.aircraft.scale.set(3, 3, 3);
                        this.aircraft.position.set(0, 700 * 0.3048, 0); // Convert feet to meters
                        this.aircraft.rotation.y = Math.PI; // Face forward
                        
                        // Debug visualization
                        const bbox = new THREE.BoxHelper(this.aircraft, 0xffff00);
                        bbox.name = 'Aircraft_BoundingBox';
                        this.aircraft.add(bbox);
                        
                        this.scene.add(this.aircraft);
                        this.debug.status = 'Aircraft loaded';
                        this.debug.update();
                    } catch (error) {
                        this.handleModelError(error);
                    }
                },
                (progress) => {
                    this.debug.status = `Loading: ${Math.round(progress.loaded / progress.total * 100)}%`;
                    this.debug.update();
                },
                (error) => {
                    this.handleModelError(error);
                }
            );
        } catch (error) {
            this.handleModelError(error);
        }
    }

    handleModelError(error) {
        this.debug.errors++;
        this.debug.status = 'Model error! Using placeholder';
        this.debug.update();
        console.error('Model Error:', error);
        this.createPlaceholderAircraft();
    }

    createPlaceholderAircraft() {
        try {
            const geometry = new THREE.BoxGeometry(20, 5, 30);
            const material = new THREE.MeshPhongMaterial({
                color: 0xff0000,
                wireframe: true,
                transparent: true,
                opacity: 0.8
            });
            
            this.aircraft = new THREE.Mesh(geometry, material);
            this.aircraft.position.set(0, 700 * 0.3048, 0);
            this.aircraft.name = 'Placeholder_Aircraft';
            this.scene.add(this.aircraft);
            
            this.debug.warnings++;
            this.debug.status = 'Placeholder active';
            this.debug.update();
        } catch (error) {
            this.handleFatalError(error);
        }
    }

    // ======================
    // Environment System
    // ======================

    initEnvironment() {
        try {
            // Ground plane
            const ground = new THREE.Mesh(
                new THREE.PlaneGeometry(10000, 10000),
                new THREE.MeshLambertMaterial({ color: 0x3a5f0b })
            );
            ground.rotation.x = -Math.PI / 2;
            ground.receiveShadow = true;
            ground.name = 'Ground';
            this.scene.add(ground);

            // City buildings
            this.createCity(50, 5000, 500);
            
            // Debug grid
            const grid = new THREE.GridHelper(5000, 100, 0x444444, 0x888888);
            grid.name = 'Debug_Grid';
            this.scene.add(grid);

            this.debug.status = 'Environment built';
            this.debug.update();
        } catch (error) {
            this.handleFatalError(error);
        }
    }

    createCity(buildingCount, areaSize, maxHeight) {
        try {
            const maxHeightMeters = maxHeight * 0.3048;
            
            for (let i = 0; i < buildingCount; i++) {
                const building = new THREE.Mesh(
                    new THREE.BoxGeometry(
                        20 + Math.random() * 80,  // Width
                        10 + Math.random() * maxHeightMeters, // Height
                        20 + Math.random() * 80   // Depth
                    ),
                    new THREE.MeshLambertMaterial({ color: 0x808080 })
                );
                
                building.position.set(
                    (Math.random() - 0.5) * areaSize,
                    building.geometry.parameters.height / 2,
                    (Math.random() - 0.5) * areaSize
                );
                building.castShadow = true;
                building.receiveShadow = true;
                building.name = `Building_${i}`;
                this.scene.add(building);
            }
        } catch (error) {
            this.debug.warnings++;
            this.debug.status = 'Partial city generated';
            this.debug.update();
        }
    }

    // ======================
    // Control System
    // ======================

    initControls() {
        try {
            // Thrust controls
            const updateThrust = (delta) => {
                this.thrust = THREE.MathUtils.clamp(this.thrust + delta, 0, 100);
                this.updateHUD();
            };

            // Mobile controls
            document.getElementById('thrust-up').addEventListener('touchstart', () => updateThrust(5));
            document.getElementById('thrust-down').addEventListener('touchstart', () => updateThrust(-5));

            // Keyboard controls
            window.addEventListener('keydown', (e) => {
                switch(e.key) {
                    case 'w': updateThrust(5); break;
                    case 's': updateThrust(-5); break;
                }
            });

            this.debug.status = 'Controls bound';
            this.debug.update();
        } catch (error) {
            this.debug.errors++;
            this.debug.status = 'Control init failed';
            this.debug.update();
        }
    }

    // ======================
    // HUD System
    // ======================

    initHUD() {
        try {
            this.hudElements = {
                speed: document.getElementById('speed'),
                altitude: document.getElementById('altitude'),
                heading: document.getElementById('heading'),
                weapon: document.getElementById('weapon'),
                thrust: document.getElementById('thrust')
            };

            // Initial update
            this.updateHUD();
            this.debug.status = 'HUD operational';
            this.debug.update();
        } catch (error) {
            this.debug.errors++;
            this.debug.status = 'HUD impaired';
            this.debug.update();
        }
    }

    updateHUD() {
        try {
            if (this.aircraft) {
                this.hudElements.speed.textContent = Math.round(this.thrust * 5);
                this.hudElements.altitude.textContent = Math.round(this.aircraft.position.y / 0.3048);
                this.hudElements.heading.textContent = Math.round(THREE.MathUtils.radToDeg(this.aircraft.rotation.y) % 360);
                this.hudElements.thrust.textContent = this.thrust;
            }
        } catch (error) {
            this.debug.errors++;
        }
    }

    // ======================
    // Animation & Rendering
    // ======================

    animate() {
        try {
            requestAnimationFrame(() => this.animate());
            
            // Basic animation
            if (this.aircraft) {
                this.aircraft.position.z -= this.thrust * 0.1;
                this.aircraft.rotation.y += 0.01;
            }

            // Camera follow
            if (this.aircraft) {
                this.camera.position.lerp(
                    new THREE.Vector3(
                        this.aircraft.position.x,
                        this.aircraft.position.y + 100,
                        this.aircraft.position.z + 200
                    ),
                    0.1
                );
                this.camera.lookAt(this.aircraft.position);
            }

            this.renderer.render(this.scene, this.camera);
            this.updateHUD();
        } catch (error) {
            this.handleFatalError(error);
        }
    }

    // ======================
    // Debug Utilities
    // ======================

    addTestObjects() {
        try {
            // Test cube (always visible)
            const testCube = new THREE.Mesh(
                new THREE.BoxGeometry(10, 10, 10),
                new THREE.MeshBasicMaterial({ color: 0x00ff00 })
            );
            testCube.position.set(0, 50, -100);
            testCube.name = 'Test_Cube';
            this.scene.add(testCube);
        } catch (error) {
            this.debug.errors++;
        }
    }

    handleFatalError(error) {
        this.debug.errors++;
        this.debug.status = `FATAL: ${error.message}`;
        this.debug.update();
        console.error('Critical Failure:', error);
        alert(`Simulator crashed: ${error.message}`);
    }
}

// Launch sequence
window.addEventListener('load', () => {
    try {
        new FlightSimulator();
        console.log('%c=== SIMULATOR LAUNCHED ===', 'color: green; font-weight: bold;');
    } catch (error) {
        document.body.innerHTML = `<h1 style="color: red">CRASH: ${error.message}</h1>`;
        console.error('Launch failure:', error);
    }
});
