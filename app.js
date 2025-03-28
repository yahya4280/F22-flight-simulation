class FlightSimulator {
    constructor() {
        // Initialize core properties
        this.speed = 250;
        this.altitude = 700;
        this.thrust = 50;
        this.weapon = "GUN";
        this.isFiring = false;
        this.projectiles = [];
        
        // Three.js essentials
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.aircraft = null;
        
        // Initialize systems
        this.initScene();
        this.initCamera();
        this.initRenderer();
        this.initLighting();
        this.loadAircraftModel();
        this.initEnvironment();
        this.initControls();
        this.initHUD();
        
        // Start animation loop
        this.animate();
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
            0.1,
            50000
        );
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);
    }

    initLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
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
                console.error("Error loading aircraft:", error);
                this.createPlaceholderAircraft();
            }
        );
    }

    createPlaceholderAircraft() {
        const geometry = new THREE.BoxGeometry(20, 5, 30);
        const material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        this.aircraft = new THREE.Mesh(geometry, material);
        this.aircraft.position.set(0, this.altitude * 0.3048, 0);
        this.scene.add(this.aircraft);
        this.updateCameraPosition(true);
    }

    initEnvironment() {
        // Ground
        const groundGeometry = new THREE.PlaneGeometry(50000, 50000);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x3a5f0b });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // City with buildings
        this.createCity(50, 10000, 500);
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
    }

    initControls() {
        // Mobile controls
        const joystick = document.getElementById('joystick');
        const joystickContainer = document.querySelector('.joystick-container');
        let joystickActive = false;

        joystick.addEventListener('touchstart', (e) => {
            e.preventDefault();
            joystickActive = true;
        });

        document.addEventListener('touchmove', (e) => {
            if (!joystickActive) return;
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
            this.mouseX = x / maxDist;
            this.mouseY = -y / maxDist;
        });

        document.addEventListener('touchend', () => {
            joystickActive = false;
            joystick.style.transform = 'translate(0, 0)';
            this.mouseX = 0;
            this.mouseY = 0;
        });

        // Keyboard controls
        window.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'w': this.thrust = Math.min(100, this.thrust + 5); break;
                case 's': this.thrust = Math.max(0, this.thrust - 5); break;
                case '1': this.weapon = "GUN"; break;
                case '2': this.weapon = "MISSILE"; break;
            }
            this.updateHUD();
        });
    }

    updateCameraPosition(immediate = false) {
        if (!this.aircraft) return;
        
        const cameraOffset = new THREE.Vector3(0, 15, -40);
        cameraOffset.applyQuaternion(this.aircraft.quaternion);
        cameraOffset.add(this.aircraft.position);
        
        if (immediate) {
            this.camera.position.copy(cameraOffset);
        } else {
            this.camera.position.lerp(cameraOffset, 0.1);
        }
        
        this.camera.lookAt(this.aircraft.position);
    }

    updateHUD() {
        document.getElementById('speed').textContent = Math.round(this.speed);
        document.getElementById('altitude').textContent = Math.round(this.altitude);
        document.getElementById('heading').textContent = Math.round(this.aircraft?.rotation.y * (180 / Math.PI) || 0);
        document.getElementById('weapon').textContent = this.weapon;
        document.getElementById('thrust').textContent = this.thrust;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update physics only if aircraft is loaded
        if (this.aircraft) {
            const deltaTime = 0.016; // Approximate 60fps
            
            // Basic flight controls
            this.aircraft.rotation.z += this.mouseX * 0.02;
            this.aircraft.rotation.x += this.mouseY * 0.02;
            
            // Movement
            this.speed = this.thrust * 5;
            const forward = new THREE.Vector3(0, 0, -1);
            forward.applyQuaternion(this.aircraft.quaternion);
            forward.multiplyScalar(this.speed * 0.02);
            this.aircraft.position.add(forward);
            
            // Update altitude
            this.altitude = this.aircraft.position.y / 0.3048;
            
            // Update camera
            this.updateCameraPosition();
        }
        
        // Update HUD
        this.updateHUD();
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    initHUD() {
        // Initialize HUD elements
        this.speedElement = document.getElementById("speed");
        this.altitudeElement = document.getElementById("altitude");
        this.headingElement = document.getElementById("heading");
        this.weaponElement = document.getElementById("weapon");
        this.thrustElement = document.getElementById("thrust");
        
        // Initial update
        this.updateHUD();
    }
}

// Start the simulator
window.addEventListener('load', () => {
    new FlightSimulator();
    if ('ontouchstart' in window && window.innerWidth > window.innerHeight) {
        document.getElementById('mobile-controls').style.display = 'flex';
    }
});
