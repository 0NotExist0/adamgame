// Zombie Shooter 3D - Adamzombiegame
// Multiplayer + Shooter + Shader + Zombies!

class ZombieGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.world = null;
        this.player = null;
        this.zombies = [];
        this.projectiles = [];
        this.particles = [];
        this.blockMap = new Map();

        this.health = 100;
        this.score = 0;
        this.ammo = Infinity;

        this.serverUrl = '';
        this.socket = null;
        this.isHosting = false;
        this.myClientId = null;
        this.playerList = new Map();

        this.setupThreeJS();
        this.setupWorld();
        this.setupUI();
        this.loadAssets();
    }

    setupThreeJS() {
        const container = document.body;

        // Scene con ombreggiatura per shader realistiche
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.015);

        // Camera in prima persona
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 2, 0);

        // Renderer con antialiasing e HDR
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        // Setup PointerLockControls per mouse lock FPS
        this.controls = new THREE.PointerLockControls(camera, document.body);

        // Evento pointerlockchange per UI
        this.controls.addEventListener('lock', () => {
            document.getElementById('connectionModal').style.display = 'none';
        });

        this.controls.addEventListener('unlock', () => {
            if (!this.isHosting) {
                document.getElementById('connectionModal').style.display = 'flex';
            }
        });
    }

    setupWorld() {
        // Creazione del mondo Minecraft-style

        // Texture procedure generate
        const textureLoader = new THREE.TextureLoader();

        // Generazione terreno procedurale con chunk
        this.generateChunk(0, 0);

        // Illuminazione ambiente
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        // Sole per shader dinamiche
        const sunLight = new THREE.DirectionalLight(0xffffee, 1);
        sunLight.position.set(100, 100, 50);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 500;
        sunLight.shadow.camera.left = -100;
        sunLight.shadow.camera.right = 100;
        sunLight.shadow.camera.top = 100;
        sunLight.shadow.camera.bottom = -100;
        this.scene.add(sunLight);

        // Creazione player (nave spaziale 3D)
        const geometry = new THREE.SphereGeometry(0.5, 32, 32);
        const material = new THREE.MeshStandardMaterial({
            color: 0xff6b6b,
            roughness: 0.3,
            metalness: 0.7,
            emissive: 0x440000,
            emissiveIntensity: 0.2
        });

        this.player = new THREE.Mesh(geometry, material);
        this.scene.add(this.player);

        // Sistema di particelle per esplosioni zombie
        this.setupParticleSystem();
    }

    generateChunk(chunkX, chunkZ) {
        const offset = 16;
        for (let x = -offset; x <= offset; x++) {
            for (let z = -offset; z <= offset; z++) {
                // Terreno variabile altezza tipo Minecraft
                const height = Math.sin(x * 0.3) * Math.cos(z * 0.3) * 2 + Math.random() * 1;

                const y = Math.floor(height);

                // Generazione blocchi cubi tipo Minecraft
                if (y >= 0) {
                    const geometry = new THREE.BoxGeometry(0.9, 1, 0.9);

                    // Colore verde per blocchi vegetati
                    const color = new THREE.Color();
                    color.setHSL(0.3 + Math.random() * 0.1, 0.6, 0.4);

                    const material = new THREE.MeshStandardMaterial({
                        color: color,
                        roughness: 0.8,
                        metalness: 0.2,
                        flatShading: false
                    });

                    const block = new THREE.Mesh(geometry, material);
                    block.position.set(x + chunkX * offset, y, z + chunkZ * offset);
                    block.castShadow = true;
                    block.receiveShadow = true;

                    this.scene.add(block);

                    // Mappa per collisioni - key corretta senza trim
                    const blockKey = `${chunkX},${y},${z}`;
                    this.blockMap.set(blockKey, {
                        x: x + chunkX * offset,
                        y: y,
                        z: z + chunkZ * offset,
                        height: height
                    });
                }
            }
        }
    }

    setupParticleSystem() {
        // Sistema particelle per effetti esplosioni zombie
        const particleCount = 100;

        this.particles = [];

        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.BufferGeometry();
            const vertices = new Float32Array(particleCount * 3);

            for(let j = 0; j < particleCount * 3; j++) {
                vertices[j] = (Math.random() - 0.5) * 10;
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

            const material = new THREE.PointsMaterial({
                color: Math.random() > 0.5 ? 0xffff00 : 0xff6b6b,
                size: 0.2,
                transparent: true,
                opacity: 0.8
            });

            const system = new THREE.Points(geometry, material);
            this.scene.add(system);

            this.particles.push({
                mesh: system,
                velocity: {
                    x: (Math.random() - 0.5) * 0.2,
                    y: Math.random() * 0.3 + 0.1,
                    z: (Math.random() - 0.5) * 0.2
                },
                life: 1,
                decay: Math.random() * 0.02 + 0.02
            });
        }
    }

    setupUI() {
        // Mostra o nascondi controlli mobile
        if (window.innerWidth < 769) {
            document.getElementById('mobileControls').style.display = 'block';
            document.body.classList.add('touch-enabled');
        }

        // Listener tastiera movimenti player
        window.addEventListener('keydown', (e) => {
            switch(e.key.toLowerCase()) {
                case 'w': this.moveForward = true; break;
                case 'a': this.strafeLeft = true; break;
                case 's': this.moveForward = false; break;
                case 'd': this.strafeLeft = false; break;
                case 'e': this.interact(); break;
            }
        });

        // Gestione pointer lock per FPS
        document.body.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === document.body) {
                console.log('Mouse locked! Playing now...');
            } else {
                if (!this.isHosting && this.socket && !this.socket.disconnected) {
                    document.getElementById('connectionModal').style.display = 'flex';
                }
            }
        });

        // Listener mouse per sparo e mira
        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Click sinistro - sparo
                this.shoot();
            }
        });

        // Resize finestra
        window.addEventListener('resize', (e) => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);

            if (window.innerWidth < 769) {
                document.getElementById('mobileControls').style.display = 'block';
            } else {
                document.getElementById('mobileControls').style.display = 'none';
            }
        });
    }

    onKey(event) {
        switch(event.key) {
            case 'w': this.moveForward = true; break;
            case 's': this.moveForward = false; break; // Correggo: mancava!
            case 'a': this.strafeLeft = true; break;
            case 'd': this.strafeLeft = false; break;
            case 'e': this.interact(); break;
        }
    }

    onMouseClick(event) {
        if (event.button === 0) { // Click sinistro sparo
            this.shoot();
        }
    }

    shoot() {
        // Crea proiettile dalla posizione della pistola
        const gunPos = new THREE.Vector3(
            Math.sin(this.camera.rotation.y) * 0.3,
            0,
            Math.cos(this.camera.rotation.y) * 0.3
        );

        const projectileGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const projectile = new THREE.Mesh(projectiveGeometry, projectileMaterial);

        projectile.position.copy(this.camera.position).add(gunPos);
        this.scene.add(projectile);
        this.projectiles.push(projectile);
    }

    spawnZombie() {
        // Crea zombie casuali intorno al player
        const angle = Math.random() * Math.PI * 2;
        const distance = 30 + Math.random() * 20;

        const x = this.camera.position.x + Math.cos(angle) * distance;
        const z = this.camera.position.z + Math.sin(angle) * distance;

        // Geometria zombie tipo scheletro alieno
        const geometry = new THREE.Group();

        // Corpo principale
        const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.5, 1.5, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x4ade80,
            roughness: 0.6,
            metalness: 0.2
        });

        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1;
        geometry.add(body);

        // Testa zombie
        const headGeometry = new THREE.SphereGeometry(0.35, 16, 16);
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0x69c064,
            roughness: 0.7
        });

        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 2;
        geometry.add(head);

        // Zombie Group container (non Object3D che non esiste!)
        const zombie = new THREE.Group();
        zombie.add(geometry);
        zombie.position.set(x, 1.5, z);
        zombie.lookAt(this.camera.position); // Perseguire il player

        this.scene.add(zombie);
        this.zombies.push({
            mesh: zombie,
            health: 3,
            lastAttack: 0,
            attackCooldown: 2000
        });
    }

    createExplosion(position, count = 10) {
        // Crea esplosione quando si colpiscono zombie
        for(let i = 0; i < count; i++) {
            const particleGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0xffff00 : 0xff6b6b,
                transparent: true
            });

            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            particle.position.copy(position);
            particle.position.x += (Math.random() - 0.5) * 0.5;
            particle.position.z += (Math.random() - 0.5) * 0.5;

            this.scene.add(particle);
            this.particles.push({
                mesh: particle,
                velocity: {
                    x: (Math.random() - 0.5) * 0.4,
                    y: Math.random() * 0.6 + 0.2,
                    z: (Math.random() - 0.5) * 0.4
                },
                life: 1,
                decay: 0.03
            });
        }
    }

    async setupMultiplayer() {
        // Setup WebRTC per multiplayer peer-to-peer (senza server!)
        try {
            const rtc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });

            // Aggiungi track audio/video se serve
            this.pc = rtc;

            // Gestione ICE candidate per NAT traversal
            rtc.onicecandidate = (e) => {
                if (e.candidate) {
                    console.log('ICE candidate', e.candidate);
                }
            };

            console.log('🧟 Multiplayer pronto! Peer connection ready...');
        } catch(e) {
            console.warn('WebRTC not available, playing single player mode.');
        }
    }

    async setupConnection() {
        // Setup connessione al server
        this.setupMultiplayer();

        try {
            const socket = await fetch('/api/connect', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ clientId: generateUUID() })
            }).then(r => r.json());

            this.socket = socket;
            document.getElementById('connectionModal').style.display = 'none';
        } catch(e) {
            // Fallback a single player mode
        }
    }

    loadAssets() {
        // Caricamento asset shader e texture
        console.log('🧟 Zombie Shooter 3D - Caricamento assets...');

        this.setupConnection();
        this.startGameLoop();
    }

    startGameLoop() {
        const animate = () => {
            requestAnimationFrame(animate);

            if (!this.scene) return;

            // Update player movement
            this.updatePlayer();

            // Update zombies AI perseguitazione player
            this.updateZombies();

            // Update projectiles collisioni
            this.updateProjectiles();

            // Update particles fade out
            this.updateParticles();

            // Rendering finale
            this.renderer.render(this.scene, this.camera);
        };

        animate();
    }

    updatePlayer() {
        if (!this.player) return;

        // Movimento base player WASD
        const speed = 0.15;

        // Rotazione camera mouse
        if (isPointerLocked()) {
            this.handleMouseMovement();
        }
    }
}

// Inizializzazione gioco quando caricato documento
document.addEventListener('DOMContentLoaded', () => {
    new ZombieGame();
});