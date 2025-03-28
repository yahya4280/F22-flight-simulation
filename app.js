class FlightSimulator {
    constructor() {
        // Flight parameters
        this.speed = 250; // knots
        this.altitude = 700; // feet
        this.heading = 0; // degrees
        this.thrust = 50; // percent
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

        // Control smoothing
        this.previousPitch = 0;
        this.previousRoll = 0;
        this.previousYaw = 0;

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
        this.scene.add(directionalLight);
    }

    loadAircraftModel() {
        const loader = new THREE.GLTFLoader();
        loader.load(
            'assets/f22_raptor.glb',
            (gltf) => {
                this.aircraft = gltf.scene;
                this.aircraft.scale.set(3, 3, 3);
                this.aircraft.position.set(0, this.altitude * 0.3048, 0);
                this.scene.add(this.aircraft);
                this.updateCameraPosition(true);
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
        this.updateCameraPosition(true);
    }

    initEnvironment() {
        // Ground
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(50000, 50000),
            new THREE.MeshLambertMaterial({ color: 0x3a5f0b })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Sky
        const sky = new THREE.Mesh(
            new THREE.SphereGeometry(40000, 32, 32),
            new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide })
        );
        this.scene.add(sky);

        // City
        this.createCity(50, 1000, 500);
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
            this.scene.add(building);
        }

        this.createTrees(100, areaSize);
    }

    createTrees(count, areaSize) {
        const trunk = new THREE.CylinderGeometry(0.5, 0.5, 5);
        const leaves = new THREE.ConeGeometry(3, 8);
        
        for (let i = 0; i < count; i++) {
            const tree = new THREE.Group();
            tree.add(new THREE.Mesh(trunk, new THREE.MeshLambertMaterial({ color: 0x8B4513 })));
            const leavesMesh = new THREE.Mesh(leaves, new THREE.MeshLambertMaterial({ color: 0x228B22 }));
            leavesMesh.position.y = 5;
            tree.add(leavesMesh);
            
            tree.position.set(
                (Math.random() - 0.5) * areaSize,
                0,
                (Math.random() - 0.5) * areaSize
            );
            this.scene.add(tree);
        }
    }

    initControls() {
        // Touch controls
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
        });
        
        document.addEventListener('touchend', () => {
            this.joystickActive = false;
            joystick.style.transform = 'translate(0, 0)';
            this.joystickPos.x = 0;
            this.joystickPos.y = 0;
        });

        // Control bindings
        document.getElementById('fire-btn').addEventListener('touchstart', () => this.isFiring = true);
        document.getElementById('fire-btn').addEventListener('touchend', () => this.isFiring = false);
        document.getElementById('weapon-btn').addEventListener('click', () => this.switchWeapon());
        document.getElementById('thrust-up').addEventListener('touchstart', () => this.adjustThrust(5));
        document.getElementById('thrust-down').addEventListener('touchstart', () => this.adjustThrust(-5));
        
        // Mouse controls
        document.addEventListener('mousedown', () => this.isFiring = true);
        document.addEventListener('mouseup', () => this.isFiring = false);
        
        // Keyboard controls
        window.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'w': this.adjustThrust(5); break;
                case 's': this.adjustThrust(-5); break;
                case '1': this.weapon = "GUN"; break;
                case '2': this.weapon = "MISSILE"; break;
            }
            document.getElementById('weapon').textContent = this.weapon;
        });
    }

    updateCameraPosition(immediate = false) {
        if (!this.aircraft) return;
        
        const cameraOffset = new THREE.Vector3(0, 15, -40);
        cameraOffset.applyQuaternion(this.aircraft.quaternion);
        cameraOffset.add(this.aircraft.position);
        
        const lookAtPoint = new THREE.Vector3(0, 5, 50);
        lookAtPoint.applyQuaternion(this.aircraft.quaternion);
        lookAtPoint.add(this.aircraft.position);

        if (immediate) {
            this.camera.position.copy(cameraOffset);
            this.camera.lookAt(lookAtPoint);
        } else {
            this.camera.position.lerp(cameraOffset, 0.1);
            this.camera.lookAt(lookAtPoint);
        }
    }

    gameLoop() {
        const deltaTime = Math.min(0.1, this.clock.getDelta());
        
        if (this.aircraft) {
            this.updateAircraftPhysics(deltaTime);
            this.updateCameraPosition();
        }
        
        this.updateProjectiles(deltaTime);
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(() => this.gameLoop());
    }

    updateAircraftPhysics(deltaTime) {
        // Control inputs
        const pitchInput = THREE.MathUtils.clamp(this.joystickPos.y * 0.8 + this.previousPitch * 0.2, -1, 1);
        const rollInput = THREE.MathUtils.clamp(this.joystickPos.x * 0.8 + this.previousRoll * 0.2, -1, 1);
        
        // Aircraft rotation
        this.aircraft.rotation.x += pitchInput * 0.02 * deltaTime;
        this.aircraft.rotation.z += rollInput * 0.03 * deltaTime;
        this.aircraft.rotation.y += rollInput * 0.01 * deltaTime; // Coordinated turn
        
        // Clamp rotations
        this.aircraft.rotation.x = THREE.MathUtils.clamp(this.aircraft.rotation.x, -0.5, 0.5);
        this.aircraft.rotation.z = THREE.MathUtils.clamp(this.aircraft.rotation.z, -0.5, 0.5);

        // Update movement
        const targetSpeed = this.thrust * 5;
        this.speed += (targetSpeed - this.speed) * 0.02 * deltaTime;
        
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.aircraft.quaternion);
        forward.multiplyScalar(this.speed * 0.02 * deltaTime);
        this.aircraft.position.add(forward);
        
        // Update altitude
        this.altitude = this.aircraft.position.y / 0.3048;
        this.heading = (this.aircraft.rotation.y * (180 / Math.PI)) % 360;
        
        // Update HUD
        this.speedElement.textContent = Math.round(this.speed);
        this.altitudeElement.textContent = Math.round(this.altitude);
        this.headingElement.textContent = Math.round(this.heading);
    }

    updateProjectiles(deltaTime) {
        // Projectile update logic
    }

    adjustThrust(amount) {
        this.thrust = THREE.MathUtils.clamp(this.thrust + amount, 0, 100);
        document.getElementById('thrust').textContent = this.thrust;
    }

    switchWeapon() {
        this.weapon = this.weapon === "GUN" ? "MISSILE" : "GUN";
        document.getElementById('weapon').textContent = this.weapon;
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

// Initialize simulator
window.addEventListener('load', () => {
    new FlightSimulator();
    if ('ontouchstart' in window && window.innerWidth > window.innerHeight) {
        document.getElementById('mobile-controls').style.display = 'flex';
    }
});
