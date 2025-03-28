class FlightSimulator {
    constructor() {
        // Flight parameters with realistic initial values
        this.speed = 250; // knots
        this.altitude = 600; // feet (near buildings)
        this.heading = 0; // degrees
        this.thrust = 50; // percent
        this.pitch = 0; // degrees
        this.roll = 0; // degrees
        this.yaw = 0; // degrees
        this.weapon = "GUN";
        this.isFiring = false;
        this.lastFireTime = 0;
        this.projectiles = [];
        this.joystickActive = false;
        this.joystickPos = { x: 0, y: 0 };
        this.mouseX = 0;
        this.mouseY = 0;
        this.aircraft = null;
        this.cityObjects = [];
        this.clock = new THREE.Clock();
        this.cameraDistance = 50; // Camera distance from aircraft

        this.initScene();
        this.initControls();
        this.loadAircraftModel();
        this.initEnvironment();
        this.initHUD();
        this.handleResize();
        this.gameLoop();
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.0002);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 50000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 500, 100);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        this.scene.add(directionalLight);
    }

    loadAircraftModel() {
        const loader = new THREE.GLTFLoader();
        loader.load(
            'assets/f22_raptor.glb',
            (gltf) => {
                this.aircraft = gltf.scene;
                this.aircraft.scale.set(3, 3, 3);
                this.aircraft.position.set(0, this.altitude * 0.3048, 0); // Convert feet to meters
                this.scene.add(this.aircraft);
                
                // Set initial camera position
                this.updateCameraPosition();
            },
            undefined,
            (error) => {
                console.error("Error loading aircraft model:", error);
                this.createPlaceholderAircraft();
            }
        );
    }

    createPlaceholderAircraft() {
        const geometry = new THREE.BoxGeometry(20, 5, 30);
        const material = new THREE.MeshPhongMaterial({ color: 0x888888 });
        this.aircraft = new THREE.Mesh(geometry, material);
        this.aircraft.position.set(0, this.altitude * 0.3048, 0);
        this.scene.add(this.aircraft);
        this.updateCameraPosition();
    }

    initEnvironment() {
        // Ground
        const groundGeometry = new THREE.PlaneGeometry(50000, 50000);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x3a5f0b,
            side: THREE.DoubleSide
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Sky
        const skyGeometry = new THREE.SphereGeometry(40000, 32, 32);
        const skyMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x87CEEB,
            side: THREE.BackSide
        });
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(sky);

        // Create city with buildings (max height 500ft)
        this.createCity(50, 10000, 500);
    }

    createCity(buildingCount, areaSize, maxHeight) {
        const maxHeightMeters = maxHeight * 0.3048; // Convert feet to meters
        
        // Create a central cluster of buildings
        const clusterSize = areaSize / 4;
        
        for (let i = 0; i < buildingCount; i++) {
            const width = 20 + Math.random() * 80;
            const depth = 20 + Math.random() * 80;
            const height = 10 + Math.random() * maxHeightMeters;
            
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const material = new THREE.MeshLambertMaterial({ 
                color: Math.random() * 0x808080 + 0x808080 // Grayscale colors
            });
            
            const building = new THREE.Mesh(geometry, material);
            building.castShadow = true;
            building.receiveShadow = true;
            
            // Position buildings in a cluster near the center
            building.position.set(
                (Math.random() - 0.5) * clusterSize,
                height / 2,
                (Math.random() - 0.5) * clusterSize
            );
            
            this.scene.add(building);
            this.cityObjects.push(building);
        }

        // Add some trees around the buildings
        this.createTrees(100, clusterSize * 2);
    }

    createTrees(count, areaSize) {
        const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.5, 5);
        const leavesGeometry = new THREE.ConeGeometry(3, 8);
        
        const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        
        for (let i = 0; i < count; i++) {
            const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
            const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
            
            leaves.position.y = 5;
            
            const tree = new THREE.Group();
            tree.add(trunk);
            tree.add(leaves);
            
            // Position trees around the buildings
            const angle = Math.random() * Math.PI * 2;
            const distance = clusterSize + Math.random() * (areaSize - clusterSize);
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;
            
            tree.position.set(x, 0, z);
            
            tree.castShadow = true;
            this.scene.add(tree);
            this.cityObjects.push(tree);
        }
    }

    initControls() {
        // Mouse controls
        window.addEventListener('mousemove', (e) => {
            this.mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
            this.mouseY = -(e.clientY / window.innerHeight - 0.5) * 2;
        });

        // Touch controls for mobile
        const joystick = document.getElementById('joystick');
        const joystickContainer = document.querySelector('.joystick-container');
        
        joystick.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.joystickActive = true;
        });
        
        document.addEventListener('touchmove', (e) => {
            if (!this.joystickActive) return;
            e.preventDefault();
            
            const touch = e.touches[0];
            const rect = joystickContainer.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            let x = touch.clientX - centerX;
            let y = touch.clientY - centerY;
            
            const maxDist = rect.width / 3;
            const dist = Math.sqrt(x*x + y*y);
            
            if (dist > maxDist) {
                x = x * maxDist / dist;
                y = y * maxDist / dist;
            }
            
            joystick.style.transform = `translate(${x}px, ${y}px)`;
            this.joystickPos.x = x / maxDist;
            this.joystickPos.y = -y / maxDist;
            this.mouseX = this.joystickPos.x;
            this.mouseY = this.joystickPos.y;
        });
        
        document.addEventListener('touchend', () => {
            this.joystickActive = false;
            joystick.style.transform = 'translate(0, 0)';
            this.joystickPos.x = 0;
            this.joystickPos.y = 0;
            this.mouseX = 0;
            this.mouseY = 0;
        });

        // Fire button
        document.getElementById('fire-btn').addEventListener('touchstart', () => this.isFiring = true);
        document.getElementById('fire-btn').addEventListener('touchend', () => this.isFiring = false);
        document.addEventListener('mousedown', () => this.isFiring = true);
        document.addEventListener('mouseup', () => this.isFiring = false);
        
        // Weapon switch
        document.getElementById('weapon-btn').addEventListener('click', () => {
            this.weapon = this.weapon === "GUN" ? "MISSILE" : "GUN";
            document.getElementById('weapon').textContent = this.weapon;
        });
        
        // Thrust controls
        document.getElementById('thrust-up').addEventListener('touchstart', () => {
            this.thrust = Math.min(100, this.thrust + 5);
            document.getElementById('thrust').textContent = this.thrust;
        });
        
        document.getElementById('thrust-down').addEventListener('touchstart', () => {
            this.thrust = Math.max(0, this.thrust - 5);
            document.getElementById('thrust').textContent = this.thrust;
        });

        // Keyboard controls for additional movement
        window.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'w': this.thrust = Math.min(100, this.thrust + 5); break;
                case 's': this.thrust = Math.max(0, this.thrust - 5); break;
                case 'a': this.yaw = -1; break; // Left yaw
                case 'd': this.yaw = 1; break;  // Right yaw
                case 'q': this.roll = -1; break; // Left roll
                case 'e': this.roll = 1; break;  // Right roll
                case '1': this.weapon = "GUN"; break;
                case '2': this.weapon = "MISSILE"; break;
                case 'ArrowUp': this.pitch = 1; break;    // Nose up
                case 'ArrowDown': this.pitch = -1; break; // Nose down
            }
            document.getElementById('weapon').textContent = this.weapon;
            document.getElementById('thrust').textContent = this.thrust;
        });

        window.addEventListener('keyup', (e) => {
            switch(e.key) {
                case 'a': 
                case 'd': this.yaw = 0; break;
                case 'q': 
                case 'e': this.roll = 0; break;
                case 'ArrowUp': 
                case 'ArrowDown': this.pitch = 0; break;
            }
        });
    }    

    gameLoop() {
        const deltaTime = Math.min(0.1, this.clock.getDelta());
        
        if (this.aircraft) {
            // Update aircraft physics
            this.updateAircraftPhysics(deltaTime);
            
            // Update camera position
            this.updateCameraPosition();
        }
        
        // Update projectiles
        this.updateProjectiles(deltaTime);
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
        
        // Continue loop
        requestAnimationFrame(() => this.gameLoop());
    }

    updateCameraPosition() {
        if (!this.aircraft) return;
        
        // Position camera 30 units back and 10 units up from aircraft
        const cameraOffset = new THREE.Vector3(0, 10, -30);
        cameraOffset.applyQuaternion(this.aircraft.quaternion);
        cameraOffset.add(this.aircraft.position);
        
        // Smooth camera follow with lerping
        this.camera.position.lerp(cameraOffset, 0.1);
        this.camera.lookAt(this.aircraft.position);
        
        // Add slight camera rotation based on aircraft movement
        const lookAhead = new THREE.Vector3(0, 0, -50);
        lookAhead.applyQuaternion(this.aircraft.quaternion);
        lookAhead.add(this.aircraft.position);
        this.camera.lookAt(lookAhead);
    }

    updateAircraftPhysics(deltaTime) {
        // Reduced sensitivity factors
        const SENSITIVITY = 0.5;
        const PITCH_SENSITIVITY = 0.3;
        const ROLL_SENSITIVITY = 0.4;
        const YAW_SENSITIVITY = 0.2;

        // Smoother input processing with dead zone
        const deadZone = 0.1;
        let pitchInput = THREE.MathUtils.clamp(this.mouseY * SENSITIVITY + this.pitch * PITCH_SENSITIVITY, -1, 1);
        let rollInput = THREE.MathUtils.clamp(this.mouseX * SENSITIVITY + this.roll * ROLL_SENSITIVITY, -1, 1);
        let yawInput = THREE.MathUtils.clamp(this.yaw * YAW_SENSITIVITY, -1, 1);

        // Apply low-pass filter for smoother controls
        pitchInput = this.lerp(this.previousPitch, pitchInput, 0.1);
        rollInput = this.lerp(this.previousRoll, rollInput, 0.1);
        yawInput = this.lerp(this.previousYaw, yawInput, 0.1);

        // Update aircraft rotation with realistic rates
        const MAX_PITCH_RATE = 0.5 * deltaTime;
        const MAX_ROLL_RATE = 1.0 * deltaTime;
        const MAX_YAW_RATE = 0.3 * deltaTime;

        this.aircraft.rotation.x += THREE.MathUtils.clamp(pitchInput, -MAX_PITCH_RATE, MAX_PITCH_RATE);
        this.aircraft.rotation.z += THREE.MathUtils.clamp(rollInput, -MAX_ROLL_RATE, MAX_ROLL_RATE);
        this.aircraft.rotation.y += THREE.MathUtils.clamp(yawInput, -MAX_YAW_RATE, MAX_YAW_RATE);

        // Clamp rotations to realistic limits
        this.aircraft.rotation.x = THREE.MathUtils.clamp(this.aircraft.rotation.x, -0.5, 0.5); // ±30 degrees
        this.aircraft.rotation.z = THREE.MathUtils.clamp(this.aircraft.rotation.z, -0.5, 0.5); // ±30 degrees

        // Store previous values for smoothing
        this.previousPitch = pitchInput;
        this.previousRoll = rollInput;
        this.previousYaw = yawInput;

        // ... rest of physics calculations remain same ...
    }

    lerp(a, b, t) {
        return a * (1 - t) + b * t;
    }

    initHUD() {
        this.speedElement = document.getElementById("speed");
        this.altitudeElement = document.getElementById("altitude");
        this.headingElement = document.getElementById("heading");
        this.weaponElement = document.getElementById("weapon");
        this.thrustElement = document.getElementById("thrust");
    }

    handleResize() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
}

// Start the simulator when the page loads
window.addEventListener('load', () => {
    const simulator = new FlightSimulator();
    
    // Only show mobile controls on mobile devices in landscape
    if ('ontouchstart' in window && window.innerWidth > window.innerHeight) {
        document.getElementById('mobile-controls').style.display = 'flex';
    }
});
