/**
 * Cairo Chaos: Traffic Survival
 * A browser-based game simulating the chaotic traffic of Cairo, Egypt.
 * 
 * @version 1.0.0
 * @license MIT
 */

// ============================================================================
// DOM Elements
// ============================================================================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const gameOverScreen = document.getElementById("gameOverScreen");
const scoreBox = document.getElementById("scoreBox");
const hornBox = document.getElementById("hornBox");
const finalScore = document.getElementById("finalScore");
const crashReason = document.getElementById("crashReason");

// ============================================================================
// Game Configuration
// ============================================================================
const CONFIG = {
    CANVAS_WIDTH: 450,
    CANVAS_HEIGHT: 600,
    BASE_SPEED: 7,
    PLAYER_SPEED: 6,
    HORN_RADIUS_MAX: 140,
    HORN_COOLDOWN_FRAMES: 150,
    HORN_GROWTH_RATE: 8,
    SPAWN_MIN_DELAY: 600,
    SPAWN_MAX_DELAY: 1200,
    ROAD_MARGIN: 15
};

// ============================================================================
// Game State
// ============================================================================
let gameActive = false;
let score = 0;
let roadY = 0;
let animationFrameId = null;

// ============================================================================
// Player Object
// ============================================================================
const player = {
    x: 200,
    y: 480,
    width: 40,
    height: 70,
    color: "#3498db",
    hornActive: false,
    hornRadius: 0,
    hornCooldown: 0
};

// ============================================================================
// Enemy Types Configuration
// ============================================================================
const ENEMY_TYPES = [
    {
        type: 'microbus',
        color: '#f1c40f',
        width: 45,
        height: 85,
        speed: 3,
        label: 'Microbus'
    },
    {
        type: 'scooter',
        color: '#e74c3c',
        width: 20,
        height: 40,
        speed: 10,
        label: 'Tok-Tok/Scooter'
    },
    {
        type: 'oldSedan',
        color: '#95a5a6',
        width: 40,
        height: 70,
        speed: 4,
        label: 'Ancient VTI'
    }
];

// ============================================================================
// Dynamic Game Variables
// ============================================================================
let enemies = [];
const keys = {};

// ============================================================================
// Event Listeners
// ============================================================================
function setupEventListeners() {
    window.addEventListener("keydown", (e) => {
        keys[e.code] = true;
        
        // Prevent default scrolling for game keys
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
            e.preventDefault();
        }
    });
    
    window.addEventListener("keyup", (e) => {
        keys[e.code] = false;
    });
}

// ============================================================================
// Spawn Logic
// ============================================================================
function spawnEnemy() {
    if (!gameActive) return;
    
    const config = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
    const randomX = Math.random() * (canvas.width - config.width - 40) + 20;
    
    enemies.push({
        x: randomX,
        y: -100,
        width: config.width,
        height: config.height,
        color: config.color,
        speed: config.speed,
        type: config.type,
        label: config.label,
        behaviorTimer: Math.random() * 100 + 50,
        isStopping: false
    });

    // Schedule next spawn
    const nextSpawnDelay = Math.random() * 
        (CONFIG.SPAWN_MAX_DELAY - CONFIG.SPAWN_MIN_DELAY) + 
        CONFIG.SPAWN_MIN_DELAY;
    
    setTimeout(spawnEnemy, nextSpawnDelay);
}

// ============================================================================
// Player Input & Movement
// ============================================================================
function updatePlayerMovement() {
    if (keys["ArrowLeft"] || keys["KeyA"]) {
        player.x -= CONFIG.PLAYER_SPEED;
    }
    if (keys["ArrowRight"] || keys["KeyD"]) {
        player.x += CONFIG.PLAYER_SPEED;
    }

    // Constrain player to road boundaries
    player.x = Math.max(
        CONFIG.ROAD_MARGIN,
        Math.min(player.x, canvas.width - player.width - CONFIG.ROAD_MARGIN)
    );
}

// ============================================================================
// Horn Mechanics
// ============================================================================
function updateHorn() {
    // Activate horn
    if (keys["Space"] && player.hornCooldown <= 0) {
        player.hornActive = true;
        player.hornRadius = 10;
        player.hornCooldown = CONFIG.HORN_COOLDOWN_FRAMES;
    }

    // Update horn effect
    if (player.hornActive) {
        player.hornRadius += CONFIG.HORN_GROWTH_RATE;
        if (player.hornRadius > CONFIG.HORN_RADIUS_MAX) {
            player.hornActive = false;
        }
    }
    
    // Update cooldown
    if (player.hornCooldown > 0) {
        player.hornCooldown--;
    }

    // Update UI
    updateHornUI();
}

function updateHornUI() {
    const isReady = player.hornCooldown <= 0;
    hornBox.innerText = isReady ? "Horn: READY (Space)" : "Horn: Reloading...";
    hornBox.style.color = isReady ? "#2ecc71" : "#e74c3c";
}

// ============================================================================
// Enemy AI & Physics
// ============================================================================
function updateEnemies() {
    enemies.forEach((enemy, index) => {
        updateEnemyBehavior(enemy);
        moveEnemy(enemy);
        applyHornEffect(enemy);
        
        // Remove off-screen enemies
        if (isEnemyOffScreen(enemy)) {
            enemies.splice(index, 1);
            return;
        }

        // Check collision
        if (checkCollision(player, enemy)) {
            endGame(enemy);
        }
    });
}

function updateEnemyBehavior(enemy) {
    enemy.behaviorTimer--;
    
    if (enemy.behaviorTimer <= 0) {
        enemy.behaviorTimer = Math.random() * 150 + 50;
        
        switch (enemy.type) {
            case 'microbus':
                // Microbuses spontaneously stop to grab passengers
                enemy.isStopping = !enemy.isStopping;
                break;
                
            case 'scooter':
                // Scooters swerve aggressively
                enemy.speed = Math.random() * 5 + 8;
                enemy.x += (Math.random() > 0.5 ? 40 : -40);
                break;
                
            case 'oldSedan':
                // Old sedans randomly change speed
                enemy.speed = Math.random() * 3 + 2;
                break;
        }
    }
}

function moveEnemy(enemy) {
    const currentSpeed = enemy.isStopping ? -CONFIG.BASE_SPEED : (enemy.speed - CONFIG.BASE_SPEED);
    enemy.y -= currentSpeed;
}

function applyHornEffect(enemy) {
    if (!player.hornActive) return;
    
    const dx = (enemy.x + enemy.width / 2) - (player.x + player.width / 2);
    const dy = (enemy.y + enemy.height / 2) - (player.y + player.height / 2);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < player.hornRadius && distance > player.hornRadius - 30) {
        enemy.x += dx > 0 ? 8 : -8;
    }
}

function isEnemyOffScreen(enemy) {
    return enemy.y > canvas.height + 100 || enemy.y < -200;
}

// ============================================================================
// Collision Detection
// ============================================================================
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// ============================================================================
// Rendering
// ============================================================================
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawRoad();
    drawHornEffect();
    drawPlayer();
    drawEnemies();
}

function drawRoad() {
    // Asphalt base
    ctx.fillStyle = "#3a3a3a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dirt shoulders
    ctx.fillStyle = "#cca673";
    ctx.fillRect(0, 0, CONFIG.ROAD_MARGIN, canvas.height);
    ctx.fillRect(
        canvas.width - CONFIG.ROAD_MARGIN, 
        0, 
        CONFIG.ROAD_MARGIN, 
        canvas.height
    );

    // Lane markers
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    for (let i = roadY - 60; i < canvas.height; i += 60) {
        ctx.fillRect(145, i, 4, 30);
        ctx.fillRect(295, i, 4, 30);
    }
}

function drawHornEffect() {
    if (!player.hornActive) return;
    
    ctx.strokeStyle = "rgba(243, 156, 18, 0.5)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(
        player.x + player.width / 2,
        player.y + player.height / 2,
        player.hornRadius,
        0,
        Math.PI * 2
    );
    ctx.stroke();
}

function drawPlayer() {
    // Car body
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    
    // Headlights
    ctx.fillStyle = "#ffffaa";
    ctx.fillRect(player.x + 4, player.y - 4, 8, 5);
    ctx.fillRect(player.x + player.width - 12, player.y - 4, 8, 5);
}

function drawEnemies() {
    enemies.forEach(enemy => {
        // Enemy body
        ctx.fillStyle = enemy.color;
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);

        // Hazard lights for stopping microbuses
        if (enemy.isStopping && enemy.type === 'microbus') {
            ctx.fillStyle = "#ff3300";
            ctx.fillRect(enemy.x, enemy.y + enemy.height - 5, 10, 8);
            ctx.fillRect(enemy.x + enemy.width - 10, enemy.y + enemy.height - 5, 10, 8);
        }
    });
}

// ============================================================================
// Game State Management
// ============================================================================
function endGame(hitEnemy) {
    gameActive = false;
    
    // Cancel animation frame
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    
    // Show game over screen
    gameOverScreen.style.display = "flex";
    finalScore.innerText = `You managed to survive ${score} meters.`;
    
    // Set crash reason based on enemy type
    const crashReasons = {
        'microbus': "A Microbus stopped short instantly in front of you to pull over!",
        'scooter': "A delivery scooter cut across your lane lane-splitting dynamically.",
        'oldSedan': "An old bumperless sedan braked out of nowhere without brake lights."
    };
    
    crashReason.innerText = crashReasons[hitEnemy.type] || "You crashed!";
}

function resetGame() {
    // Reset game state
    enemies = [];
    score = 0;
    player.x = 200;
    player.hornCooldown = 0;
    player.hornActive = false;
    
    // Reset UI
    gameOverScreen.style.display = "none";
    scoreBox.innerText = "Score: 0";
    updateHornUI();
    
    // Restart game
    gameActive = true;
    gameLoop();
}

// ============================================================================
// Main Game Loop
// ============================================================================
function gameLoop() {
    if (!gameActive) return;

    update();
    draw();
    
    animationFrameId = requestAnimationFrame(gameLoop);
}

function update() {
    // Move road background effect
    roadY += CONFIG.BASE_SPEED;
    if (roadY >= 60) roadY = 0;

    // Update game elements
    updatePlayerMovement();
    updateHorn();
    updateEnemies();
    
    // Update score
    score++;
    scoreBox.innerText = `Score: ${score}`;
}

// ============================================================================
// Initialize Game
// ============================================================================
function initGame() {
    setupEventListeners();
    gameActive = true;
    spawnEnemy();
    gameLoop();
}

// Start the game when page loads
window.addEventListener('load', initGame);
