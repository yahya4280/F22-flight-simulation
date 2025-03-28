class FlightSimulator {
    constructor() {
        // Flight parameters
        this.speed = 250;
        this.altitude = 3000;
        this.heading = 0;
        this.thrust = 50;
        this.pitch = 0;
        this.roll = 0;
        this.yaw = 0;
        this.weapon = "Bullets";
        this.isFiring = false;
        this.projectiles = [];
        this.joystickActive = false;
        this.joystickPos = { x: 0, y: 0 };

        this.initScene();
        this.initControls();
        this.initAircraft();
        this.initEnvironment();
        this.initHUD();
        this.gameLoop();
        this.handleResize();
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // Basic lighting
        const light = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(light);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
        dirLight.position.set(100, 500, 100);
        this.scene.add(dirLight);
    }

    initEnvironment() {
        // Ground with simple green color
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(100000, 100000),
            new THREE.MeshLambertMaterial({ color: 0x228b22 })
        );
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(ground);

        // Simple sky
        const skyGeometry = new THREE.SphereGeometry(5000, 32, 32);
        const skyMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x87CEEB, 
            side: THREE.BackSide 
        });
        this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(this.sky);

        // Add some simple trees (as cones)
        this.addSimpleTrees(100);
        
        // Add a simple river (as a blue plane)
        this.addSimpleRiver();
    }

    addSimpleTrees(count) {
        const treeGeometry = new THREE.ConeGeometry(10, 30, 8);
        const treeMaterial = new THREE.MeshLambertMaterial({ color: 0x00aa00 });
        
        for (let i = 0; i < count; i++) {
            const tree = new THREE.Mesh(treeGeometry, treeMaterial);
            tree.position.set(
                Math.random() * 2000 - 1000,
                15,
                Math.random() * 2000 - 1000
            );
            this.scene.add(tree);
        }
    }

    addSimpleRiver() {
        const river = new THREE.Mesh(
            new THREE.PlaneGeometry(1000, 100),
            new THREE.MeshLambertMaterial({ color: 0x1E90FF })
        );
        river.rotation.x = -Math.PI / 2;
        river.position.y = 0.1;
        this.scene.add(river);
    }

    initAircraft() {
        // Simple placeholder aircraft (box with wings)
        const bodyGeometry = new THREE.BoxGeometry(20, 5, 30);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x888888 });
        this.aircraft = new THREE.Mesh(bodyGeometry, bodyMaterial);
        
        // Add wings
        const wingGeometry = new THREE.BoxGeometry(40, 1, 10);
        const wing = new THREE.Mesh(wingGeometry, bodyMaterial);
        wing.position.y = -2;
        this.aircraft.add(wing);
        
        this.aircraft.position.set(0, 3000, 0);
        this.scene.add(this.aircraft);
    }

    initControls() {
        // Mouse/touch controls
        this.mouseX = 0;
        this.mouseY = 0;
        
        // Mouse movement
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
            
            // Limit joystick movement to container
            const maxDist = rect.width / 2;
            const dist = Math.sqrt(x*x + y*y);
            
            if (dist > maxDist) {
                x = x * maxDist / dist;
                y = y * maxDist / dist;
            }
            
            // Update joystick position
            joystick.style.transform = `translate(${x}px, ${y}px)`;
            
            // Normalize values (-1 to 1)
            this.joystickPos.x = x / maxDist;
            this.joystickPos.y = -y / maxDist;
            
            // Update aircraft controls
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

        // Button controls
        document.getElementById('fire-btn').addEventListener('touchstart', () => this.isFiring = true);
        document.getElementById('fire-btn').addEventListener('touchend', () => this.isFiring = false);
        
        document.getElementById('weapon-btn').addEventListener('click', () => {
            this.weapon = this.weapon === "Bullets" ? "Missiles" : "Bullets";
            document.getElementById('weapon').textContent = this.weapon;
        });
        
        document.getElementById('thrust-up').addEventListener('touchstart', () => {
            this.thrust = Math.min(100, this.thrust + 5);
            document.getElementById('thrust').textContent = this.thrust;
        });
        
        document.getElementById('thrust-down').addEventListener('touchstart', () => {
            this.thrust = Math.max(0, this.thrust - 5);
            document.getElementById('thrust').textContent = this.thrust;
        });

        // Keyboard controls
        window.addEventListener('keydown', (e) => {
            switch(e.key) {
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
    }

    initHUD() {
        this.speedElement = document.getElementById("speed");
        this.altitudeElement = document.getElementById("altitude");
        this.headingElement = document.getElementById("heading");
        this.weaponElement = document.getElementById("weapon");
        this.thrustElement = document.getElementById("thrust");
    }

    fireProjectile() {
        if (!this.isFiring) return;

        const geometry = this.weapon === "Bullets" 
            ? new THREE.SphereGeometry(2) 
            : new THREE.CylinderGeometry(1, 1, 10);
        
        const material = new THREE.MeshBasicMaterial({
            color: this.weapon === "Bullets" ? 0xff0000 : 0x00ff00
        });
        
        const projectile = new THREE.Mesh(geometry, material);
        projectile.position.copy(this.aircraft.position);
        projectile.rotation.copy(this.aircraft.rotation);
        
        const velocity = new THREE.Vector3();
        this.aircraft.getWorldDirection(velocity);
        velocity.multiplyScalar(this.weapon === "Bullets" ? 50 : 20);
        projectile.userData.velocity = velocity;
        
        this.scene.add(projectile);
        this.projectiles.push(projectile);
    }

    updateAircraft() {
        if (!this.aircraft) return;

        // Update aircraft orientation
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

        // Move aircraft
        const direction = new THREE.Vector3();
        this.aircraft.getWorldDirection(direction);
        this.aircraft.position.addScaledVector(direction, this.speed * 0.01);

        // Check for collisions
        this.checkCollisions();
    }

    checkCollisions() {
        if (this.altitude <= 0) {
            alert("Crash! Game Over");
            this.altitude = 100;
            this.aircraft.position.y = 100;
            this.thrust = 0;
        }
    }

    animateProjectiles() {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.position.add(p.userData.velocity);
            
            if (p.position.length() > 5000) {
                this.scene.remove(p);
                this.projectiles.splice(i, 1);
            }
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
    
    // Show mobile controls on mobile devices
    if ('ontouchstart' in window) {
        document.getElementById('mobile-controls').style.display = 'block';
    }
});
