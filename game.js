/**
 * Cairo Chaos: Traffic Survival
 * A mobile-friendly browser game simulating the chaotic traffic of Cairo, Egypt.
 * 
 * @version 1.0.0
 * @license MIT
 * @author Your Name
 */

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    
    // ========================================================================
    // DOM Elements
    // ========================================================================
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const gameOverScreen = document.getElementById('gameOverScreen');
    const scoreBox = document.getElementById('scoreBox');
    const hornBox = document.getElementById('hornBox');
    const finalScore = document.getElementById('finalScore');
    const crashReason = document.getElementById('crashReason');
    const gameContainer = document.getElementById('gameContainer');

    // Mobile control buttons
    const leftBtn = document.getElementById('leftBtn');
    const rightBtn = document.getElementById('rightBtn');
    const hornBtn = document.getElementById('hornBtn');

    // ========================================================================
    // Game Configuration
    // ========================================================================
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

    // ========================================================================
    // Game State
    // ========================================================================
    let gameActive = false;
    let score = 0;
    let roadY = 0;
    let animationFrameId = null;
    let spawnTimeoutId = null;

    // ========================================================================
    // Player Object
    // ========================================================================
    const player = {
        x: 200,
        y: 480,
        width: 40,
        height: 70,
        color: '#3498db',
        hornActive: false,
        hornRadius: 0,
        hornCooldown: 0
    };

    // ========================================================================
    // Enemy Types Configuration
    // ========================================================================
    const ENEMY_TYPES = [
        { type: 'microbus', color: '#f1c40f', width: 45, height: 85, speed: 3, label: 'Microbus' },
        { type: 'scooter', color: '#e74c3c', width: 20, height: 40, speed: 10, label: 'Tok-Tok/Scooter' },
        { type: 'oldSedan', color: '#95a5a6', width: 40, height: 70, speed: 4, label: 'Ancient VTI' }
    ];

    // ========================================================================
    // Dynamic Variables
    // ========================================================================
    let enemies = [];
    const keys = {};
    let touchActive = { left: false, right: false, horn: false };

    // ========================================================================
    // Resize Handler
    // ========================================================================
    function resizeCanvas() {
        const container = gameContainer;
        const maxWidth = Math.min(window.innerWidth * 0.95, 450);
        const maxHeight = Math.min(window.innerHeight * 0.7, 600);
        
        // Maintain aspect ratio
        const aspectRatio = CONFIG.CANVAS_WIDTH / CONFIG.CANVAS_HEIGHT;
        
        if (maxWidth / maxHeight > aspectRatio) {
            canvas.style.height = maxHeight + 'px';
            canvas.style.width = (maxHeight * aspectRatio) + 'px';
        } else {
            canvas.style.width = maxWidth + 'px';
            canvas.style.height = (maxWidth / aspectRatio) + 'px';
        }
    }

    // ========================================================================
    // Event Listeners
    // ========================================================================
    function setupEventListeners() {
        // Keyboard controls
        window.addEventListener('keydown', (e) => {
            keys[e.code] = true;
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            keys[e.code] = false;
        });

        // Mobile touch controls
        if (leftBtn && rightBtn && hornBtn) {
            // Left button
            leftBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                touchActive.left = true;
            });
            leftBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                touchActive.left = false;
            });
            leftBtn.addEventListener('touchcancel', () => {
                touchActive.left = false;
            });

            // Right button
            rightBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                touchActive.right = true;
            });
            rightBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                touchActive.right = false;
            });
            rightBtn.addEventListener('touchcancel', () => {
                touchActive.right = false;
            });

            // Horn button
            hornBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                touchActive.horn = true;
            });
            hornBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                touchActive.horn = false;
            });
            hornBtn.addEventListener('touchcancel', () => {
                touchActive.horn = false;
            });

            // Mouse fallback for desktop testing
            leftBtn.addEventListener('mousedown', () => { touchActive.left = true; });
            leftBtn.addEventListener('mouseup', () => { touchActive.left = false; });
            leftBtn.addEventListener('mouseleave', () => { touchActive.left = false; });

            rightBtn.addEventListener('mousedown', () => { touchActive.right = true; });
            rightBtn.addEventListener('mouseup', () => { touchActive.right = false; });
            rightBtn.addEventListener('mouseleave', () => { touchActive.right = false; });

            hornBtn.addEventListener('mousedown', () => { touchActive.horn = true; });
            hornBtn.addEventListener('mouseup', () => { touchActive.horn = false; });
            hornBtn.addEventListener('mouseleave', () => { touchActive.horn = false; });
        }

        // Prevent zooming on double tap
        document.addEventListener('dblclick', (e) => {
            if (e.target.closest('.mobile-btn') || e.target.closest('canvas')) {
                e.preventDefault();
            }
        }, { passive: false });

        // Handle resize
        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('orientationchange', () => {
            setTimeout(resizeCanvas, 100);
        });
    }

    // ========================================================================
    // Spawn Logic
    // ========================================================================
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

        if (gameActive) {
            const nextDelay = Math.random() * 
                (CONFIG.SPAWN_MAX_DELAY - CONFIG.SPAWN_MIN_DELAY) + 
                CONFIG.SPAWN_MIN_DELAY;
            spawnTimeoutId = setTimeout(spawnEnemy, nextDelay);
        }
    }

    // ========================================================================
    // Player Input & Movement
    // ========================================================================
    function updatePlayerMovement() {
        const isMovingLeft = keys['ArrowLeft'] || keys['KeyA'] || touchActive.left;
        const isMovingRight = keys['ArrowRight'] || keys['KeyD'] || touchActive.right;

        if (isMovingLeft) player.x -= CONFIG.PLAYER_SPEED;
        if (isMovingRight) player.x += CONFIG.PLAYER_SPEED;

        // Constrain player to road boundaries
        player.x = Math.max(
            CONFIG.ROAD_MARGIN,
            Math.min(player.x, canvas.width - player.width - CONFIG.ROAD_MARGIN)
        );
    }

    // ========================================================================
    // Horn Mechanics
    // ========================================================================
    function updateHorn() {
        const hornPressed = keys['Space'] || touchActive.horn;

        // Activate horn
        if (hornPressed && player.hornCooldown <= 0) {
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
        if (player.hornCooldown > 0) player.hornCooldown--;

        // Update UI
        updateHornUI();
    }

    function updateHornUI() {
        if (!hornBox) return;
        const isReady = player.hornCooldown <= 0;
        hornBox.innerText = isReady ? 'Horn: READY' : 'Horn: Reloading...';
        hornBox.style.color = isReady ? '#2ecc71' : '#e74c3c';
    }

    // ========================================================================
    // Enemy AI & Physics
    // ========================================================================
    function updateEnemies() {
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];

            updateEnemyBehavior(enemy);
            moveEnemy(enemy);
            applyHornEffect(enemy);

            // Remove off-screen enemies
            if (isEnemyOffScreen(enemy)) {
                enemies.splice(i, 1);
                continue;
            }

            // Check collision
            if (checkCollision(player, enemy)) {
                endGame(enemy);
                return;
            }
        }
    }

    function updateEnemyBehavior(enemy) {
        enemy.behaviorTimer--;

        if (enemy.behaviorTimer <= 0) {
            enemy.behaviorTimer = Math.random() * 150 + 50;

            switch (enemy.type) {
                case 'microbus':
                    enemy.isStopping = !enemy.isStopping;
                    break;
                case 'scooter':
                    enemy.speed = Math.random() * 5 + 8;
                    enemy.x += (Math.random() > 0.5 ? 40 : -40);
                    enemy.x = Math.max(
                        CONFIG.ROAD_MARGIN,
                        Math.min(enemy.x, canvas.width - enemy.width - CONFIG.ROAD_MARGIN)
                    );
                    break;
                case 'oldSedan':
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

        if (distance < player.hornRadius) {
            enemy.x += dx > 0 ? 6 : -6;
        }
    }

    function isEnemyOffScreen(enemy) {
        return enemy.y > canvas.height + 100 || enemy.y < -200;
    }

    // ========================================================================
    // Collision Detection
    // ========================================================================
    function checkCollision(rect1, rect2) {
        // Add a small collision tolerance for mobile (slightly forgiving hitboxes)
        const tolerance = 3;
        return rect1.x + tolerance < rect2.x + rect2.width - tolerance &&
               rect1.x + rect1.width - tolerance > rect2.x + tolerance &&
               rect1.y + tolerance < rect2.y + rect2.height - tolerance &&
               rect1.y + rect1.height - tolerance > rect2.y + tolerance;
    }

    // ========================================================================
    // Rendering
    // ========================================================================
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawRoad();
        drawHornEffect();
        drawEnemies();
        drawPlayer();
    }

    function drawRoad() {
        // Asphalt base
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Dirt shoulders
        ctx.fillStyle = '#cca673';
        ctx.fillRect(0, 0, CONFIG.ROAD_MARGIN, canvas.height);
        ctx.fillRect(
            canvas.width - CONFIG.ROAD_MARGIN,
            0,
            CONFIG.ROAD_MARGIN,
            canvas.height
        );

        // Lane markers
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        for (let i = roadY - 60; i < canvas.height; i += 60) {
            ctx.fillRect(145, i, 4, 30);
            ctx.fillRect(295, i, 4, 30);
        }
    }

    function drawHornEffect() {
        if (!player.hornActive) return;

        ctx.strokeStyle = 'rgba(243, 156, 18, 0.5)';
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
        ctx.fillStyle = '#ffffaa';
        ctx.fillRect(player.x + 4, player.y - 4, 8, 5);
        ctx.fillRect(player.x + player.width - 12, player.y - 4, 8, 5);

        // Windows
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(player.x + 8, player.y + 10, 10, 15);
        ctx.fillRect(player.x + player.width - 18, player.y + 10, 10, 15);
    }

    function drawEnemies() {
        enemies.forEach(enemy => {
            // Enemy body
            ctx.fillStyle = enemy.color;
            ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);

            // Hazard lights for stopping microbuses
            if (enemy.isStopping && enemy.type === 'microbus') {
                ctx.fillStyle = '#ff3300';
                ctx.beginPath();
                ctx.arc(enemy.x + 5, enemy.y + enemy.height - 5, 4, 0, Math.PI * 2);
                ctx.arc(enemy.x + enemy.width - 5, enemy.y + enemy.height - 5, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    // ========================================================================
    // Game State Management
    // ========================================================================
    function endGame(hitEnemy) {
        gameActive = false;

        // Clear timers
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (spawnTimeoutId) {
            clearTimeout(spawnTimeoutId);
            spawnTimeoutId = null;
        }

        // Show game over screen
        if (gameOverScreen) gameOverScreen.style.display = 'flex';
        if (finalScore) finalScore.innerText = `You managed to survive ${score} meters.`;

        const crashReasons = {
            'microbus': 'A Microbus stopped short instantly in front of you to pull over!',
            'scooter': 'A delivery scooter cut across your lane lane-splitting dynamically.',
            'oldSedan': 'An old bumperless sedan braked out of nowhere without brake lights.'
        };

        if (crashReason) crashReason.innerText = crashReasons[hitEnemy.type] || 'You crashed!';
    }

    function resetGame() {
        // Clear timers
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (spawnTimeoutId) {
            clearTimeout(spawnTimeoutId);
            spawnTimeoutId = null;
        }

        // Reset state
        enemies = [];
        score = 0;
        player.x = 200;
        player.hornCooldown = 0;
        player.hornActive = false;
        player.hornRadius = 0;
        touchActive = { left: false, right: false, horn: false };

        // Reset UI
        if (gameOverScreen) gameOverScreen.style.display = 'none';
        if (scoreBox) scoreBox.innerText = 'Score: 0';
        updateHornUI();

        // Restart
        gameActive = true;
        gameLoop();
        spawnEnemy();
    }

    // ========================================================================
    // Main Game Loop
    // ========================================================================
    function gameLoop() {
        if (!gameActive) return;

        update();
        draw();
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    function update() {
        // Road animation
        roadY += CONFIG.BASE_SPEED;
        if (roadY >= 60) roadY = 0;

        // Game updates
        updatePlayerMovement();
        updateHorn();
        updateEnemies();

        // Score
        score++;
        if (scoreBox) scoreBox.innerText = `Score: ${score}`;
    }

    // ========================================================================
    // Initialize Game
    // ========================================================================
    function initGame() {
        resizeCanvas();
        setupEventListeners();
        gameActive = true;
        gameLoop();
        spawnEnemy();
        console.log('🚗 Cairo Chaos initialized! Ready to play.');
    }

    // Expose reset function globally for HTML button
    window.resetGame = resetGame;

    // Start the game
    initGame();
});
