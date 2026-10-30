// --- Game Configuration & State ---
let scene, camera, renderer, world;
let carBody, carMesh, ballBody, ballMesh;
let botBody, botMesh;
let gameMode = 'freeplay';
let blueScore = 0, redScore = 0;
let boostAmount = 100;

// Key bindings dictionary
let bindings = {
    throttleUp: 'KeyW',
    throttleDown: 'KeyS',
    steerLeft: 'KeyA',
    steerRight: 'KeyD',
    boost: 'ShiftLeft',
    jump: 'Space'
};
let activeKeys = {};
let waitingForKey = null;

// Setup UI Screen navigation
function openScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
    if(screenId === 'main-menu') {
        document.getElementById('game-hud').classList.add('hidden');
    }
}

function startGame(mode) {
    gameMode = mode;
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('game-hud').classList.remove('hidden');
    initPhysicsAndGraphics();
}

function returnToMenu() {
    location.reload(); // Simple reset back to main menu
}

// --- Keybinding Logic ---
function rebindKey(action) {
    waitingForKey = action;
    const span = document.getElementById(`bind-${action}`);
    span.innerText = "Press any key...";
}

window.addEventListener('keydown', (e) => {
    if (waitingForKey) {
        bindings[waitingForKey] = e.code;
        document.getElementById(`bind-${waitingForKey}`).innerText = e.code.replace('Key','').replace('Digit','');
        waitingForKey = null;
        return;
    }
    activeKeys[e.code] = true;
});

window.addEventListener('keyup', (e) => {
    activeKeys[e.code] = false;
});

// --- Car Customization ---
function updateCarColor(color) {
    if (carMesh) {
        carMesh.material.color.set(color);
    }
}

// --- 3D Physics & Graphics Initialization ---
function initPhysicsAndGraphics() {
    const container = document.getElementById('canvas-container');
    container.innerHTML = '';

    // 1. Three.js Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, -18);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 40, -20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 2. Cannon.js Physics World Setup
    world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);

    // Arena Floor & Walls
    const groundMat = new CANNON.Material();
    const groundBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Plane(),
        material: groundMat
    });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.add(groundBody);

    const floorMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 100),
        new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.8 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // 3. Player Car Setup (Realistic Rigid Body Physics)
    const carShape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 2));
    carBody = new CANNON.Body({ mass: 150, shape: carShape });
    carBody.position.set(0, 2, -20);
    carBody.linearDamping = 0.4;
    carBody.angularDamping = 0.6;
    world.add(carBody);

    const carGeo = new THREE.BoxGeometry(2, 1, 4);
    const carMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.3 });
    carMesh = new THREE.Mesh(carGeo, carMat);
    carMesh.castShadow = true;
    scene.add(carMesh);

    // 4. Soccer Ball Setup (Bouncy Physics Material)
    const ballShape = new CANNON.Sphere(1.5);
    const ballPhysicsMat = new CANNON.Material({ restitution: 0.8 });
    ballBody = new CANNON.Body({ mass: 15, shape: ballShape, material: ballPhysicsMat });
    ballBody.position.set(0, 3, 0);
    ballBody.linearDamping = 0.1;
    world.add(ballBody);

    const ballGeo = new THREE.SphereGeometry(1.5, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.castShadow = true;
    scene.add(ballMesh);

    // 5. Bot Setup (if mode is 'bot')
    if (gameMode === 'bot') {
        const botShape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 2));
        botBody = new CANNON.Body({ mass: 150, shape: botShape });
        botBody.position.set(0, 2, 20);
        world.add(botBody);

        const botMat = new THREE.MeshStandardMaterial({ color: 0x0000ff });
        botMesh = new THREE.Mesh(carGeo, botMat);
        scene.add(botMesh);
    }

    // Start Game Loop
    animate();
}

// --- Main Game Loop ---
let clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    let dt = clock.getDelta();
    if (dt > 0.1) dt = 0.1;

    world.step(1 / 60, dt, 3);

    // --- Handle Player Controls ---
    let moveForce = 1200;
    let turnSpeedVal = 4.0;

    if (activeKeys[bindings.throttleUp]) {
        carBody.applyForce(carBody.world.vectorToLocal(new CANNON.Vec3(0, 0, moveForce), new CANNON.Vec3()), carBody.position);
    }
    if (activeKeys[bindings.throttleDown]) {
        carBody.applyForce(carBody.world.vectorToLocal(new CANNON.Vec3(0, 0, -moveForce * 0.5), new CANNON.Vec3()), carBody.position);
    }
    if (activeKeys[bindings.steerLeft]) {
        carBody.angularVelocity.y = turnSpeedVal;
    } else if (activeKeys[bindings.steerRight]) {
        carBody.angularVelocity.y = -turnSpeedVal;
    } else {
        carBody.angularVelocity.y *= 0.9; // damping turning
    }

    // Boost mechanic
    if (activeKeys[bindings.boost] && boostAmount > 0) {
        carBody.applyForce(carBody.world.vectorToLocal(new CANNON.Vec3(0, 0, moveForce * 1.8), new CANNON.Vec3()), carBody.position);
        boostAmount = Math.max(0, boostAmount - 30 * dt);
    } else {
        boostAmount = Math.min(100, boostAmount + 15 * dt); // recharge boost
    }
    document.getElementById('boost-val').innerText = Math.round(boostAmount);

    // Jump mechanic
    if (activeKeys[bindings.jump] && Math.abs(carBody.position.y - 0.5) < 0.2) {
        carBody.velocity.y = 7;
    }

    // --- Bot AI Logic (if active) ---
    if (gameMode === 'bot' && botBody) {
        // Simple AI: Move towards the ball
        let dirX = ballBody.position.x - botBody.position.x;
        let dirZ = ballBody.position.z - botBody.position.z;
        botBody.velocity.x = dirX * 1.5;
        botBody.velocity.z = dirZ * 1.5;
    }

    // --- Sync Physics with 3D Meshes ---
    carMesh.position.copy(carBody.position);
    carMesh.quaternion.copy(carBody.quaternion);

    ballMesh.position.copy(ballBody.position);
    ballMesh.quaternion.copy(ballBody.quaternion);

    if (botBody && botMesh) {
        botMesh.position.copy(botBody.position);
        botMesh.quaternion.copy(botBody.quaternion);
    }

    // --- Goal Detection ---
    if (ballBody.position.z > 48) {
        blueScore++;
        document.getElementById('blue-score').innerText = blueScore;
        resetBallAndCars();
    } else if (ballBody.position.z < -48) {
        redScore++;
        document.getElementById('red-score').innerText = redScore;
        resetBallAndCars();
    }

    // Camera follow player car smoothly
    camera.position.x = carMesh.position.x;
    camera.position.y = carMesh.position.y + 6;
    camera.position.z = carMesh.position.z - 12;
    camera.lookAt(carMesh.position);

    renderer.render(scene, camera);
}

function resetBallAndCars() {
    ballBody.position.set(0, 3, 0);
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);

    carBody.position.set(0, 2, -20);
    carBody.velocity.set(0, 0, 0);
    carBody.angularVelocity.set(0, 0, 0);

    if (botBody) {
        botBody.position.set(0, 2, 20);
        botBody.velocity.set(0, 0, 0);
    }
}
