// Game configuration
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let gameRunning = false;
let score = 0;
let level = 1;

// Player ship
const player = {
    x: 0,
    y: 0,
    width: 60,
    height: 80,
    speed: 8,
    health: 100,
    bullets: [],
    cooldown: 0
};

// Enemies
let enemies = [];
let bullets = [];
const enemyTypes = [
    { color: '#ff4444', radius: 25, speed: 0.8, health: 1 },
    { color: '#ff8844', radius: 30, speed: 0.6, health: 2 },
    { color: '#88ff44', radius: 20, speed: 1.0, health: 1 }
];

// Particles
let particles = [];

// Mouse tracking
let mouseX = 0;
let mouseY = 0;

// Mouse movement handler
canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = canvas.height - 80; // Keep ship at bottom with offset
});

// Click to shoot
canvas.addEventListener('click', () => {
    if (gameRunning) {
        shootBullets();
    }
});

// Keys
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    w: false,
    s: false,
    a: false,
    d: false,
    Space: false
};

// Resize canvas to full screen
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    player.x = canvas.width / 2 - player.width / 2;
    player.y = mouseY;
}

window.addEventListener('resize', resize);
resize();

// Input handling
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key) || e.code === 'Space') {
        keys[e.key] = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key) || e.code === 'Space') {
        keys[e.key] = false;
    }
});

// Create player ship shape
function drawShip(x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 30, y - 40);
    ctx.lineTo(x + 60, y);
    ctx.lineTo(x + 30, y - 80);
    ctx.closePath();
    ctx.fill();

    // Engine glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff6600';
    ctx.fillStyle = '#ff4400';
    ctx.beginPath();
    ctx.moveTo(x + 30, y - 20);
    ctx.lineTo(x + 25, y - 35);
    ctx.lineTo(x + 35, y - 35);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
}

// Create enemy shape
function drawEnemy(enemy) {
    const type = enemy.type || enemyTypes[0];

    ctx.fillStyle = type.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = type.color;

    // Alien body
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

    // Enemy eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(enemy.x - 8, enemy.y - 5, 5, 0, Math.PI * 2);
    ctx.arc(enemy.x + 8, enemy.y - 5, 5, 0, Math.PI * 2);
    ctx.fill();

    // Enemy pupils
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(enemy.x - 8, enemy.y - 5, 2, 0, Math.PI * 2);
    ctx.arc(enemy.x + 8, enemy.y - 5, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
}

// Create bullet shape
function drawBullet(x, y) {
    ctx.fillStyle = '#ffff00';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffff00';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

// Create explosion particles
function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 1,
            color: color,
            size: Math.random() * 4 + 2
        });
    }
}

// Shoot bullets from player
function shootBullets() {
    if (!gameRunning) return;

    // Left bullet
    player.bullets.push({ x: player.x + 10, y: player.y - 40, vx: 0, vy: -15, active: true });
    // Right bullet
    player.bullets.push({ x: player.x + 50, y: player.y - 40, vx: 0, vy: -15, active: true });
}

// Auto-fire timer
let lastShotTime = 0;
const autoFireInterval = 200; // ms between automatic shots

// Last spawn timer - separata da lastShotTime per non confliggere
let lastSpawnTime = Date.now() - 2000; // Inizializza a 2 secondi fa

// Update auto-shot timing in game loop
function checkAutoFire() {
    const now = Date.now();
    if (gameRunning && now - lastShotTime >= autoFireInterval) {
        shootBullets();
        lastShotTime = now;
    }
}

// Spawn enemy
function spawnEnemy() {
    if (!gameRunning) return;

    const randomType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    const enemy = {
        x: Math.random() * (canvas.width - 60) + 30,
        y: -50,
        radius: randomType.radius,
        speed: randomType.speed,
        health: randomType.health,
        type: randomType
    };

    enemies.push(enemy);
}

// Update game loop
function update() {
    if (!gameRunning) return;

    // Move player with mouse (horizontal) and keys (vertical)
    const targetX = mouseX - player.width / 2;
    player.x += (targetX - player.x) * 0.15; // Smooth follow

    // Keep player in bounds
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));

    if (keys.ArrowUp || keys.w) player.y -= player.speed;
    if (keys.ArrowDown || keys.s) player.y += player.speed;

    // Update bullets
    player.bullets.forEach(bullet => {
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;

        if (bullet.y < 0) bullet.active = false;
    });

    // Remove inactive bullets
    player.bullets = player.bullets.filter(bullet => bullet.active);

    // Update enemies - prima aggiorniamo posizione, poi controlliamo collisioni
    enemies.forEach((enemy, index) => {
        enemy.y += enemy.type.speed || 3;

        if (enemy.y > canvas.height + 50) {
            enemies.splice(index, 1);
        }
    });

    // Update particles
    particles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= 0.02;

        if (particle.life <= 0) {
            particles.splice(index, 1);
        }
    });

    // Spawn enemies based on level with time-based throttling to prevent accumulation
    if (Date.now() - lastSpawnTime >= Math.max(200, 1000 / (level + 1))) {
        spawnEnemy();
        lastSpawnTime = Date.now();
    }

    // Update UI - dopo tutti gli aggiornamenti, non durante le collisioni
    document.getElementById('score').textContent = score;
    document.getElementById('health').textContent = Math.max(0, Math.floor(player.health)) + '%';
    document.getElementById('level').textContent = 'Livello: ' + level;

    if (player.health <= 30) {
        document.getElementById('health-bar').style.color = '#ff0000';
    } else if (player.health <= 60) {
        document.getElementById('health-bar').style.color = '#ff8800';
    } else {
        document.getElementById('health-bar').style.color = '#44ff44';
    }

    // Check collisions - ma solo se ci sono nemici e player attivi
    if (enemies.length > 0 && gameRunning) {
        checkBulletEnemyCollision();

        // Collisioni player-nemico con un piccolo ritardo per evitare multipli colpo-frame
        const collisionOccurred = false;
        if (!collisionOccurred) {
            checkEnemyPlayerCollision();
        }

        // Game over check
        if (player.health <= 0) {
            gameOver();
        }
    }
}

// Draw game
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw player - disegna se health > 0 e ci sono nemici o se è in esecuzione
    if (player.health > 0 && (enemies.length > 0 || gameRunning)) {
        drawShip(player.x, player.y, '#00ccff');
    }

    // Draw bullets
    player.bullets.forEach(bullet => {
        if (bullet.active) {
            drawBullet(bullet.x, bullet.y);
        }
    });

    // Draw enemies
    enemies.forEach(enemy => {
        drawEnemy(enemy);
    });

    // Draw particles
    particles.forEach(particle => {
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.life;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    });
}

// Game loop
function gameLoop() {
    if (!gameRunning) return;
    checkAutoFire();
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start game
function startGame() {
    if (gameRunning) return;

    gameRunning = true;
    document.getElementById('start-btn').style.display = 'none';
    score = 0;
    player.health = 100;
    enemies = []; // Reset nemici alla fine della partita precedente
    bullets = [];
    particles = [];
    level = 1;
    mouseX = canvas.width / 2; // Inizializza mouseX al centro
    mouseY = canvas.height - 80; // Inizializza mouseY nella posizione corretta
    resize();

    // Pulisci gli eventi del mouse residui
    canvas.removeEventListener('mousemove', () => {});

    gameLoop();
}

// Gestione mouse durante il gioco (rimuove handler precedente quando necessario)
canvas.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = canvas.height - 80; // Keep ship at bottom with offset
});

// Check collision between bullet and enemy
function checkBulletEnemyCollision() {
    player.bullets.forEach(bullet => {
        enemies.forEach(enemy => {
            const dx = bullet.x - enemy.x;
            const dy = bullet.y - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < enemy.radius + 5) {
                enemy.health--;
                bullet.active = false;

                if (enemy.health <= 0) {
                    createExplosion(enemy.x, enemy.y, enemy.type.color);
                    score += 100;

                    // Remove dead enemy from array
                    enemies.splice(enemies.indexOf(enemy), 1);

                    // Increase level every 1000 points
                    const newLevel = Math.floor(score / 1000) + 1;
                    if (newLevel > level) {
                        level = newLevel;
                    }
                }
            }
        });
    });
}

// Check collision between enemy and player
function checkEnemyPlayerCollision() {
    // Ignora collisioni con nemici appena entrati nella schermata (non ancora in gioco)
    enemies.forEach(enemy => {
        const dx = enemy.x - (player.x + 30);
        const dy = enemy.y - (player.y - 40);
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Il nemico deve essere in zona playble e non appena apparso
        if (enemy.y > -50 && distance < 50) {
            player.health -= 20;
            createExplosion(enemy.x, enemy.y, '#ff0000');

            // Remove enemy that hit player
            enemies.splice(enemies.indexOf(enemy), 1);

            if (player.health <= 0) {
                gameOver();
            }
        }
    });
}

// Game over
function gameOver() {
    gameRunning = false;
    document.getElementById('start-btn').textContent = 'Riprova!';
    document.getElementById('start-btn').style.display = 'block';

    // Draw explosion at player position
    createExplosion(player.x + 30, player.y - 40, '#ff4400');
}
