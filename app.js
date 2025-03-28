class FlightSimulator {
    constructor() {
        // Initialize core systems first
        this.initScene();
        this.initCamera();
        this.initRenderer();
        this.initLighting();
        
        // Then load content
        this.loadAircraftModel();
        this.initEnvironment();
        
        // Initialize controls and HUD
        this.initControls();
        this.initHUD();
        
        // Start animation loop
        this.animate();
        
        // Debugging
        console.log("Simulator initialized");
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 100, 20000);
    }

    initCamera() {
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            1,  // Increased near plane
            100000  // Increased far plane
        );
        this.camera.position.set(0, 100, 200);
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);
    }

    initLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 500, 100);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
    }

    loadAircraftModel() {
        const loader = new THREE.GLTFLoader();
        loader.load(
            'assets/f22_raptor.glb',
            (gltf) => {
                console.log("Aircraft model loaded");
                this.aircraft = gltf.scene;
                
                // Ensure proper scaling and position
                this.aircraft.scale.set(3, 3, 3);
                this.aircraft.position.set(0, 700 * 0.3048, 0); // 700ft to meters
                this.aircraft.rotation.set(0, Math.PI, 0); // Face forward
                
                // Add bounding box helper
                const bbox = new THREE.BoxHelper(this.aircraft, 0xffff00);
                this.scene.add(bbox);
                
                this.scene.add(this.aircraft);
                this.updateCameraPosition(true);
            },
            undefined,
            (error) => {
                console.error("Model load error:", error);
                this.createPlaceholderAircraft();
            }
        );
    }

    createPlaceholderAircraft() {
        console.log("Creating placeholder aircraft");
        const geometry = new THREE.BoxGeometry(20, 5, 30);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0xff0000,
            wireframe: true 
        });
        this.aircraft = new THREE.Mesh(geometry, material);
        this.aircraft.position.set(0, 700 * 0.3048, 0);
        this.scene.add(this.aircraft);
        this.updateCameraPosition(true);
    }

    initEnvironment() {
        // Ground
        const groundGeometry = new THREE.PlaneGeometry(50000, 50000);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x3a5f0b,
            side: THREE.DoubleSide
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // City
        this.createCity(50, 5000, 500); // Reduced area size
        
        // Add debug grid
        const gridHelper = new THREE.GridHelper(5000, 100);
        this.scene.add(gridHelper);
    }

    createCity(buildingCount, areaSize, maxHeight) {
        const maxHeightMeters = maxHeight * 0.3048;
        
        for (let i = 0; i < buildingCount; i++) {
            const width = 20 + Math.random() * 80;
            const depth = 20 + Math.random() * 80;
            const height = 10 + Math.random() * maxHeightMeters;
            
            const building = new THREE.Mesh(
                new THREE.BoxGeometry(width, height, depth),
                new THREE.MeshLambertMaterial({ color: 0x808080 })
            );
            building.position.set(
                (Math.random() - 0.5) * areaSize,
                height / 2,
                (Math.random() - 0.5) * areaSize
            );
            building.castShadow = true;
            building.receiveShadow = true;
            this.scene.add(building);
        }
        
        console.log(`Created ${buildingCount} buildings`);
    }

    updateCameraPosition(immediate = false) {
        if (!this.aircraft) return;
        
        // Camera position behind and above aircraft
        const cameraOffset = new THREE.Vector3(0, 15, -40);
        cameraOffset.applyQuaternion(this.aircraft.quaternion);
        cameraOffset.add(this.aircraft.position);
        
        // Look slightly ahead of aircraft
        const lookAtPoint = this.aircraft.position.clone();
        lookAtPoint.z -= 100;
        
        if (immediate) {
            this.camera.position.copy(cameraOffset);
            this.camera.lookAt(lookAtPoint);
        } else {
            this.camera.position.lerp(cameraOffset, 0.1);
            this.camera.lookAt(lookAtPoint);
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const deltaTime = Math.min(0.1, 16.67 / 1000); // Cap delta time
        
        if (this.aircraft) {
            // Basic movement
            this.aircraft.position.z -= this.thrust * 0.1 * deltaTime;
            
            // Update camera
            this.updateCameraPosition();
            
            // Update altitude calculation
            this.altitude = this.aircraft.position.y / 0.3048;
        }
        
        // Force HUD update
        this.updateHUD();
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    initHUD() {
        this.hudElements = {
            speed: document.getElementById('speed'),
            altitude: document.getElementById('altitude'),
            heading: document.getElementById('heading'),
            weapon: document.getElementById('weapon'),
            thrust: document.getElementById('thrust')
        };
        
        // Initial update
        this.updateHUD();
        console.log("HUD initialized:", this.hudElements);
    }

    updateHUD() {
        if (!this.hudElements) return;
        
        this.hudElements.speed.textContent = Math.round(this.thrust * 5);
        this.hudElements.altitude.textContent = Math.round(this.altitude);
        this.hudElements.thrust.textContent = this.thrust;
        
        if (this.aircraft) {
            const heading = THREE.MathUtils.radToDeg(this.aircraft.rotation.y) % 360;
            this.hudElements.heading.textContent = Math.round(heading);
        }
    }

    initControls() {
        // Thrust controls
        const updateThrust = (delta) => {
            this.thrust = THREE.MathUtils.clamp(this.thrust + delta, 0, 100);
            this.updateHUD();
        };

        document.getElementById('thrust-up').addEventListener('touchstart', () => updateThrust(5));
        document.getElementById('thrust-down').addEventListener('touchstart', () => updateThrust(-5));
        
        // Keyboard controls
        window.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'w': updateThrust(5); break;
                case 's': updateThrust(-5); break;
            }
        });
        
        console.log("Controls initialized");
    }
}

// Start the simulator
window.addEventListener('load', () => {
    const simulator = new FlightSimulator();
    console.log("Simulator started");
    
    // Mobile controls
    if ('ontouchstart' in window) {
        document.getElementById('mobile-controls').style.display = 'flex';
    }
});
