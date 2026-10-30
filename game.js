let scene, camera, renderer, world;
let carBody, carGroup, ballBody, ballMesh;
let botBody, botGroup;
let gameMode = 'freeplay';
let blueScore = 0, redScore = 0;
let boostAmount = 100;

// Key bindings & input states
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

// Controller connection listener
window.addEventListener("gamepadconnected", (e) => {
    document.getElementById("controller-status").innerText = `Controller Connected: ${e.gamepad.id}`;
});
window.addEventListener("gamepaddisconnected", (e) => {
    document.getElementById("controller-status").innerText = "No controller detected. Plug in a gamepad!";
});

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
    location.reload();
}

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

function updateCarColor(color) {
    if (carGroup) {
        carGroup.traverse((child) => {
            if (child.isMesh && child.userData.isMainBody) {
                child.material.color.set(color);
            }
        });
    }
}

// --- Creator Helper: Realistic Detailed Car Mesh ---
void function createCarMesh(primaryColor) {
    const carGroup = new THREE.Group();

    // Main Chassis Body
    const bodyGeo = new THREE.BoxGeometry(2.1, 0.6, 4.2);
    const bodyMat = new THREE.MeshStandardMaterial({ color: primaryColor, roughness: 0.2, metalness: 0.6 });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.4;
    bodyMesh.castShadow = true;
    bodyMesh.userData.isMainBody = true;
    carGroup.add(bodyMesh);

    // Cockpit Canopy
    const cockpitGeo = new THREE.BoxGeometry(1.4, 0.5, 2.0);
    const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.9 });
    const cockpitMesh = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpitMesh.position.set(0, 0.8, -0.2);
    cockpitMesh.castShadow = true;
    carGroup.add(cockpitMesh);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const wheelPositions = [
        [-1.1, 0.2, 1.3], [1.1, 0.2, 1.3],
        [-1.1, 0.2, -1.3], [1.1, 0.2, -1.3]
    ];
    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(...pos);
        wheel.castShadow = true;
        carGroup.add(wheel);
    });

    return carGroup;
}

// --- Initialize Full 3D Stadium & Physics ---
function initPhysicsAndGraphics() {
    const container = document.getElementById('canvas-container');
    container.innerHTML = '';

    // 1. Scene & Sky Background
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a16);
    scene.fog = new THREE.FogExp2(0x0a0a16, 0.012);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 12, -22);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff5e6, 0.9);
    dirLight.position.set(30, 60, -30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // 2. Cannon.js Physics World
    world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);

    // Ground Floor
    const groundMat = new CANNON.Material();
    const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: groundMat });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.add(groundBody);

    // Stadium Floor Mesh
    const floorMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(70, 120),
        new THREE.MeshStandardMaterial({ color: 0x151828, roughness: 0.7, metalness: 0.2 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Arena Walls & Stadium Structure
    const wallMaterial = new CANNON.Material();
    const createBoundary = (x, y, z, w, h, d, rotY = 0) => {
        const shape = new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2));
        const body = new CANNON.Body({ mass: 0, shape: wallMaterial });
        body.position.set(x, y, z);
        if(rotY) body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
        world.add(body);
    };
    createBoundary(0, 10, 61, 70, 20, 2);   // Back Wall
    createBoundary(0, 10, -61, 70, 20, 2);  // Front Wall
    createBoundary(-36, 10, 0, 2, 20, 122);  // Left Wall
    createBoundary(36, 10, 0, 2, 20, 122);   // Right Wall

    // --- Colored Eggs in the Audience (Stands) ---
    const eggGeo = new THREE.SphereGeometry(0.8, 16, 16);
    eggGeo.scale(1, 1.4, 1); // Egg shape
    const eggColors = [0xff3d00, 0x00e5ff, 0xffea00, 0x76ff03, 0xe040fb, 0xffffff];
    
    for (let side = -1; side <= 1; side += 2) {
        for (let row = 0; row < 5; row++) {
            for (let i = -6; i <= 6; i++) {
                const color = eggColors[Math.floor(Math.random() * eggColors.length)];
                const eggMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.4 });
                const egg = new THREE.Mesh(eggGeo, eggMat);
                egg.position.set(side * (39 + row * 1.5), 2 + row * 2, i * 8);
                scene.add(egg);
            }
        }
    }

    // 3. Player Car Setup
    const carShape = new CANNON.Box(new CANNON.Vec3(1.05, 0.5, 2.1));
    carBody = new CANNON.Body({ mass: 150, shape: carShape });
    carBody.position.set(0, 2, -30);
    carBody.linearDamping = 0.4;
    carBody.angularDamping = 0.6;
    world.add(carBody);

    carGroup = createCarMesh(0xff3d00);
    scene.add(carGroup);

    // 4. Soccer Ball Setup (Realistic Patterned Sphere)
    const ballShape = new CANNON.Sphere(1.8);
    const ballPhysicsMat = new CANNON.Material({ restitution: 0.85 });
    ballBody = new CANNON.Body({ mass: 12, shape: ballShape, material: ballPhysicsMat });
    ballBody.position.set(0, 4, 0);
    ballBody.linearDamping = 0.1;
    world.add(ballBody);

    const ballGeo = new THREE.SphereGeometry(1.8, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.3 });
    ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.castShadow = true;
    scene.add(ballMesh);

    // 5. Bot Setup
    if (gameMode === 'bot') {
        const botShape = new CANNON.Box(new CANNON.Vec3(1.05, 0.5, 2.1));
        botBody = new CANNON.Body({ mass: 150, shape: botShape });
        botBody.position.set(0, 2, 30);
        world.add(botBody);

        botGroup = createCarMesh(0x00b0ff);
        scene.add(botGroup);
    }

    animate();
}

// --- Main Game Loop ---
let clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    let dt = clock.getDelta();
    if (dt > 0.1) dt = 0.1;

    world.step(1 / 60, dt, 3);

    // --- Inputs: Keyboard & Controller Combined ---
    let moveForce = 1400;
    let turnSpeedVal = 4.2;
    let throttleInput = 0;
    let steerInput = 0;
    let isBoostPressed = false;
    let isJumpPressed = false;

    // Keyboard Check
    if (activeKeys[bindings.throttleUp]) throttleInput += 1;
    if (activeKeys[bindings.throttleDown]) throttleInput -= 0.5;
    if (activeKeys[bindings.steerLeft]) steerInput -= 1;
    if (activeKeys[bindings.steerRight]) steerInput += 1;
    if (activeKeys[bindings.boost]) isBoostPressed = true;
    if (activeKeys[bindings.jump]) isJumpPressed = true;

    // Gamepad / Controller Check
    const gamepads = navigator.getGamepads();
    if (gamepads && gamepads[0]) {
        const gp = gamepads[0];
        const leftStickX = gp.axes[0];
        const leftStickY = gp.axes[1]; // Up is negative on standard gamepads

        if (Math.abs(leftStickY) > 0.15) {
            throttleInput = -leftStickY; 
        }
        if (Math.abs(leftStickX) > 0.15) {
            steerInput = leftStickX;
        }

        // Button 0 = A / Cross (Jump), Button 2 = X / Square (Boost)
        if (gp.buttons[2] && gp.buttons[2].pressed) isBoostPressed = true;
        if (gp.buttons[0] && gp.buttons[0].pressed) isJumpPressed = true;
    }

    // Apply Throttle & Steering Physics
    if (throttleInput !== 0) {
        carBody.applyForce(carBody.world.vectorToLocal(new CANNON.Vec3(0, 0, moveForce * throttleInput), new CANNON.Vec3()), carBody.position);
    }
    if (steerInput !== 0) {
        carBody.angularVelocity.y = -steerInput * turnSpeedVal;
    } else {
        carBody.angularVelocity.y *= 0.9;
    }

    // Boost Mechanic
    if (isBoostPressed && boostAmount > 0) {
        carBody.applyForce(carBody.world.vectorToLocal(new CANNON.Vec3(0, 0, moveForce * 1.8), new CANNON.Vec3()), carBody.position);
        boostAmount = Math.max(0, boostAmount - 35 * dt);
    } else {
        boostAmount = Math.min(100, boostAmount + 18 * dt);
    }
    document.getElementById('boost-val').innerText = Math.round(boostAmount);

    // Jump Mechanic
    if (isJumpPressed && Math.abs(carBody.position.y - 0.5) < 0.25) {
        carBody.velocity.y = 8;
    }

    // --- Bot AI Logic ---
    if (gameMode === 'bot' && botBody && botGroup) {
        let dirX = ballBody.position.x - botBody.position.x;
        let dirZ = ballBody.position.z - botBody.position.z;
        botBody.velocity.x = dirX * 1.6;
        botBody.velocity.z = dirZ * 1.6;

        botGroup.position.copy(botBody.position);
        botGroup.quaternion.copy(botBody.quaternion);
    }

    // --- Sync Physics with 3D Meshes ---
    carGroup.position.copy(carBody.position);
    carGroup.quaternion.copy(carBody.quaternion);

    ballMesh.position.copy(ballBody.position);
    ballMesh.quaternion.copy(ballBody.quaternion);

    // --- Goal Detection ---
    if (ballBody.position.z > 58) {
        blueScore++;
        document.getElementById('blue-score').innerText = blueScore;
        resetBallAndCars();
    } else if (ballBody.position.z < -58) {
        redScore++;
        document.getElementById('red-score').innerText = redScore;
        resetBallAndCars();
    }

    // Smooth Camera Follow
    camera.position.x = carGroup.position.x;
    camera.position.y = carGroup.position.y + 7;
    camera.position.z = carGroup.position.z - 14;
    camera.lookAt(carGroup.position);

    renderer.render(scene, camera);
}

function resetBallAndCars() {
    ballBody.position.set(0, 4, 0);
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);

    carBody.position.set(0, 2, -30);
    carBody.velocity.set(0, 0, 0);
    carBody.angularVelocity.set(0, 0, 0);

    if (botBody) {
        botBody.position.set(0, 2, 30);
        botBody.velocity.set(0, 0, 0);
    }
}
