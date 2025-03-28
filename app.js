// Flight Simulator Main Application
class FlightSimulator {
    constructor() {
        this.initScene();
        this.initControls();
        this.initAircraft();
        this.initEnvironment();
        this.initHUD();
        this.gameLoop();
        this.handleResize();
    }

    initScene() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.shadowMap.enabled = true;
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // Lighting
        this.sun = new THREE.DirectionalLight(0xffffff, 1);
        this.sun.position.set(100, 500, 100);
        this.sun.castShadow = true;
        this.scene.add(this.sun);

        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(this.ambientLight);
    }

    initEnvironment() {
        // Ground
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x228b22 });
        const groundGeometry = new THREE.PlaneGeometry(100000, 100000);
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // Sky
        const skyGeometry = new THREE.SphereGeometry(5000, 32, 32);
        const skyMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x87CEEB, 
            side: THREE.BackSide 
        });
        this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(this.sky);
    }

    initAircraft() {
        // Placeholder aircraft if model fails to load
        const geometry = new THREE.BoxGeometry(20, 5, 30);
        const material = new THREE.MeshPhongMaterial({ color: 0x888888 });
        this.aircraft = new THREE.Mesh(geometry, material);
        this.aircraft.position.set(0, 3000, 0);
        this.scene.add(this.aircraft);

        // Try loading actual model
        const loader = new THREE.GLTFLoader();
        loader.load(
            'assets/f22_raptor.glb',
            (gltf) => {
                this.scene.remove(this.aircraft);
                this.aircraft = gltf.scene;
                this.aircraft.scale.set(10, 10, 10);
                this.aircraft.position.set(0, 3000, 0);
                this.scene.add(this.aircraft);
                console.log("Aircraft model loaded successfully");
            },
            undefined,
            (error) => {
                console.error("Error loading aircraft model:", error);
            }
        );
    }

    initControls() {
        // Flight parameters
        this.speed = 250; // knots
        this.altitude = 3000; // feet
        this.heading = 0; // degrees
        this.thrust = 50; // percent
        this.pitch = 0;
        this.roll = 0;
        this.yaw = 0;
        this.weapon = "Bullets";
        this.isFiring = false;
        this.projectiles = [];

        // Mouse controls
        this.mouseX = 0;
        this.mouseY = 0;
        window.addEventListener('mousemove', (event) => {
            this.mouseX = (event.clientX / window.innerWidth - 0.5) * 2;
            this.mouseY = -(event.clientY / window.innerHeight - 0.5) * 2;
        });

        // Touch controls for mobile
        document.getElementById('thrust-up').addEventListener('touchstart', () => {
            this.thrust = Math.min(100, this.thrust + 5);
        });
        document.getElementById('thrust-down').addEventListener('touchstart', () => {
            this.thrust = Math.max(0, this.thrust - 5);
        });

        // Keyboard controls
        window.addEventListener('keydown', (event) => {
            switch (event.key) {
                case 'w': this.thrust = Math.min(100, this.thrust + 5); break;
                case 's': this.thrust = Math.max(0, this.thrust - 5); break;
                case '1': this.weapon = "Bullets"; break;
                case '2': this.weapon = "Missiles"; break;
            }
            document.getElementById('weapon').textContent = this.weapon;
            document.getElementById('thrust').textContent = this.thrust;
        });

        // Fire controls
        window.addEventListener('mousedown', () => this.isFiring = true);
        window.addEventListener('mouseup', () => this.isFiring = false);
        window.addEventListener('touchstart', () => this.isFiring = true);
        window.addEventListener('touchend', () => this.isFiring = false);
    }

    initHUD() {
        this.speedElement = document.getElementById("speed");
        this.altitudeElement = document.getElementById("altitude");
        this.headingElement = document.getElementById("heading");
        this.weaponElement = document.getElementById("weapon");
        this.thrustElement = document.getElementById("thrust");
    }

    updateAircraft() {
        if (!this.aircraft) return;

        // Update aircraft orientation based on controls
        this.pitch = this.mouseY * 0.05;
        this.yaw = this.mouseX * 0.05;
        this.roll = this.mouseX * 0.05;

        this.aircraft.rotation.x += this.pitch;
        this.aircraft.rotation.z = this.roll;
        this.aircraft.rotation.y += this.yaw * 0.1;

        // Update flight parameters
        this.speed = this.thrust * 2.5;
        this.altitude += this.speed * Math.sin(this.pitch) * 0.1;
        this.altitude = Math.max(0, this.altitude);

        // Update HUD
        this.speedElement.textContent = Math.round(this.speed);
        this.altitudeElement.textContent = Math.round(this.altitude);
        this.heading = (this.heading + this.yaw * 5) % 360;
        this.headingElement.textContent = Math.round(this.heading < 0 ? this.heading + 360 : this.heading);
        this.thrustElement.textContent = this.thrust;

        // Move aircraft
        const direction = new THREE.Vector3();
        this.aircraft.getWorldDirection(direction);
        this.aircraft.position.addScaledVector(direction, this.speed * 0.01);

        // Check for collisions
        this.checkCollisions();
    }

    fireProjectile() {
        if (!this.aircraft || !this.isFiring) return;

        const projectileGeometry = this.weapon === "Bullets"
            ? new THREE.SphereGeometry(2)
            : new THREE.CylinderGeometry(1, 1, 10);

        const projectileMaterial = new THREE.MeshBasicMaterial({
            color: this.weapon === "Bullets" ? 0xff0000 : 0x00ff00,
        });

        const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
        projectile.position.copy(this.aircraft.position);
        projectile.rotation.copy(this.aircraft.rotation);

        const velocity = new THREE.Vector3();
        this.aircraft.getWorldDirection(velocity);
        velocity.multiplyScalar(this.weapon === "Bullets" ? 50 : 20);
        projectile.velocity = velocity;

        this.scene.add(projectile);
        this.projectiles.push(projectile);
    }

    animateProjectiles() {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            this.projectiles[i].position.add(this.projectiles[i].velocity);
            if (this.projectiles[i].position.length() > 5000) {
                this.scene.remove(this.projectiles[i]);
                this.projectiles.splice(i, 1);
            }
        }
    }

    checkCollisions() {
        if (this.altitude <= 0) {
            alert("Crash! Game Over");
            this.altitude = 100;
            this.aircraft.position.y = 100;
            this.thrust = 0;
        }
    }

    handleResize() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    gameLoop() {
        requestAnimationFrame(() => this.gameLoop());
        
        this.updateAircraft();
        this.fireProjectile();
        this.animateProjectiles();

        if (this.aircraft) {
            // Camera follows aircraft
            this.camera.position.set(
                this.aircraft.position.x - 200 * Math.sin(this.heading * (Math.PI / 180)),
                this.aircraft.position.y + 100,
                this.aircraft.position.z - 200 * Math.cos(this.heading * (Math.PI / 180))
            );
            this.camera.lookAt(this.aircraft.position);
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// Start the simulator when the page loads
window.addEventListener('load', () => {
    new FlightSimulator();
});
