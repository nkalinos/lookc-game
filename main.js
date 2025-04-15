// Create an Audio object for background music
const bgMusic = new Audio('assets/audio/lookchine.mp3');
bgMusic.loop = true;       // Loop the music indefinitely
bgMusic.volume = 0.5;      // Adjust volume if needed (range: 0.0 to 1.0)

// Start background music on first user interaction is now handled inside startGame()

// Global variables for level and scoring
let currentLevel = 0;
let totalScore = 0;
let currentExplodedCount = 0;  // Count of exploded dots this level
let chainActive = false;       // True when a chain reaction is in progress

// Level configurations: each object has the total dots and the minimum required explosion count.
const levels = [
    { dotsCount: 5,  goal: 1 },
    { dotsCount: 10, goal: 2 },
    { dotsCount: 15, goal: 3 },
    { dotsCount: 20, goal: 5 },
    { dotsCount: 25, goal: 7 },
    { dotsCount: 30, goal: 10 },
    { dotsCount: 35, goal: 15 },
    { dotsCount: 40, goal: 21 },
    { dotsCount: 45, goal: 27 },
    { dotsCount: 50, goal: 33 },
    { dotsCount: 55, goal: 44 },
    { dotsCount: 60, goal: 55 }
];

// Set up canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Arrays to hold our dots and explosions
let dots = [];
let explosions = [];

// Dot class for moving objects on the canvas
class Dot {
    constructor(x, y, dx, dy, color) {
        this.x = x;
        this.y = y;
        // dx and dy are now in pixels per second
        this.dx = dx;
        this.dy = dy;
        this.radius = 15;
        this.color = color;
        this.exploded = false;
    }

    update(dt) {
        // dt is in milliseconds; convert to seconds.
        this.x += this.dx * (dt / 1000);
        this.y += this.dy * (dt / 1000);

        // Bounce off the canvas edges:
        if (this.x < 0 || this.x > canvas.width) this.dx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.dy *= -1;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

// Preload explosion sound effects
const explosionSounds = [
    new Audio('assets/audio/fsharp.mp3'),
    new Audio('assets/audio/gsharp.mp3'),
    new Audio('assets/audio/asharp.mp3'),
    new Audio('assets/audio/csharp.mp3'),
    new Audio('assets/audio/dsharp.mp3'),
    new Audio('assets/audio/gsharphigh.mp3'),
    new Audio('assets/audio/asharphigh.mp3')
];
explosionSounds.forEach(sound => {
    sound.preload = 'auto';
});

// Explosion class for the chain reaction effect - using easing for smooth behavior
class Explosion {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.maxRadius = 65;
        this.radius = 0;
        this.color = color;
        this.state = "expanding"; // "expanding", "hanging", "shrinking"

        // Adjusted durations for a faster explosion animation
        this.expansionDuration = 1100; // 1.2 seconds to expand
        this.hangDuration = 850; // 0.8 seconds to hang
        this.deflationDuration = 500; // 0.5 seconds to deflate

        // Timers for each phase
        this.expansionTime = 0;
        this.hangTime = 0;
        this.deflationTime = 0;
    }

    // Easing functions:
    easeOutQuad(t) {
        return t * (2 - t);
    }
    easeInQuad(t) {
        return t * t;
    }

    update(dt) {
        if (this.state === "expanding") {
            this.expansionTime += dt;
            let progress = this.expansionTime / this.expansionDuration;
            if (progress > 1) progress = 1;
            let easedProgress = this.easeOutQuad(progress);
            this.radius = this.maxRadius * easedProgress;
            if (progress === 1) this.state = "hanging";
        } else if (this.state === "hanging") {
            this.hangTime += dt;
            this.radius = this.maxRadius;
            if (this.hangTime >= this.hangDuration) this.state = "shrinking";
        } else if (this.state === "shrinking") {
            this.deflationTime += dt;
            let progress = this.deflationTime / this.deflationDuration;
            if (progress > 1) progress = 1;
            let easedProgress = this.easeInQuad(progress);
            this.radius = this.maxRadius * (1 - easedProgress);
            if (progress === 1) {
                this.radius = 0;
                return false;
            }
        }
        return true;
    }

    draw() {
        if (this.radius <= 0) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

// Restart the current level (does not affect overall score)
function restartLevel() {
    currentExplodedCount = 0;
    initDots();         // Reinitialize dots with the same count for the current level
    updateScoreBoard(); // Refresh scoreboard display
}

// Initialize dots based on current level
function initDots() {
    dots = [];
    const numDots = levels[currentLevel].dotsCount;
    // Set velocities in pixels per second
    const minSpeed = 45;
    const maxSpeed = 115;
    for (let i = 0; i < numDots; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * (maxSpeed - minSpeed) + minSpeed;
        const dx = Math.cos(angle) * speed;
        const dy = Math.sin(angle) * speed;
        const color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        dots.push(new Dot(x, y, dx, dy, color));
    }
}

// Check collisions between dots and explosion areas
function checkCollisions() {
    dots.forEach(dot => {
        if (!dot.exploded) {
            explosions.forEach(explosion => {
                const dist = Math.hypot(dot.x - explosion.x, dot.y - explosion.y);
                if (dist <= explosion.radius + dot.radius) {
                    dot.exploded = true;
                    currentExplodedCount++;  // Increment level's explosion count
                    explosions.push(new Explosion(dot.x, dot.y, dot.color));

                    // Play a random explosion sound effect:
                    const randomIndex = Math.floor(Math.random() * explosionSounds.length);
                    const explosionSound = explosionSounds[randomIndex].cloneNode();
                    explosionSound.volume = 0.3;
                    explosionSound.play();
                }
            });
        }
    });
    // Remove exploded dots
    dots = dots.filter(dot => !dot.exploded);
}

function updateScoreBoard() {
    document.getElementById('score').innerText = `Score: ${totalScore}`;
    document.getElementById('level').innerText = `Level: ${currentLevel + 1}`;
    const currentLevelData = levels[currentLevel];
    document.getElementById('points').innerText =
        `Points: ${currentExplodedCount}/${currentLevelData.goal} from ${currentLevelData.dotsCount}`;
}

function nextLevel() {
    currentLevel++;
    if (currentLevel >= levels.length) {
        alert('Congratulations! You completed all levels!\nGame will restart.');
        resetGame();
    } else {
        currentExplodedCount = 0;
        initDots();
        updateScoreBoard();
    }
}

function resetGame() {
    currentLevel = 0;
    totalScore = 0;
    currentExplodedCount = 0;
    initDots();
    updateScoreBoard();
}

// Main game loop using requestAnimationFrame and deltaTime
let lastTime = null;
function update(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const deltaTime = timestamp - lastTime; // milliseconds since last frame
    lastTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update and draw dots
    dots.forEach(dot => {
        dot.update(deltaTime);
        dot.draw();
    });

    // Update and draw explosions; filter out finished ones
    explosions = explosions.filter(explosion => {
        const active = explosion.update(deltaTime);
        explosion.draw();
        return active;
    });

    // Check collisions
    checkCollisions();

    // If chain reaction finished, check level results
    if (chainActive && explosions.length === 0) {
        chainActive = false;
        const levelGoal = levels[currentLevel].goal;
        if (currentExplodedCount >= levelGoal) {
            totalScore += currentExplodedCount;
            setTimeout(() => {
                showPopup(
                    `Level ${currentLevel + 1} complete!\nYou exploded ${currentExplodedCount} dots.\n(Minimum required: ${levelGoal})\nTotal Score: ${totalScore}`
                );
            }, 500);
        } else {
            setTimeout(() => {
                alert(
                    `Try Again! You exploded only ${currentExplodedCount} dots (minimum required: ${levelGoal}).\nTotal Score remains: ${totalScore}`
                );
                restartLevel();
            }, 500);
        }
    }

    updateScoreBoard();
    requestAnimationFrame(update);
}

function showPopup(message) {
    const popupOverlay = document.getElementById('popupOverlay');
    const popupMessage = document.getElementById('popupMessage');
    popupMessage.innerText = message;
    popupOverlay.style.display = 'flex';
}

function hidePopup() {
    const popupOverlay = document.getElementById('popupOverlay');
    popupOverlay.style.display = 'none';
}

document.getElementById('nextLevelButton').addEventListener('click', function() {
    hidePopup();
    nextLevel();
});

// Start the chain reaction on canvas click
canvas.addEventListener('click', function(event) {
    if (chainActive) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    chainActive = true;
    explosions.push(new Explosion(x, y, 'white'));

    const randomIndex = Math.floor(Math.random() * explosionSounds.length);
    const noteSound = explosionSounds[randomIndex].cloneNode();
    noteSound.volume = 0.3;
    noteSound.play();
});

function resizeCanvas() {
    // Set a maximum design width and calculate the new width
    const maxWidth = 800; // your original design width
    let newWidth = window.innerWidth;
    if (newWidth > maxWidth) {
        newWidth = maxWidth;
    }

    // Set canvas dimensions maintaining your aspect ratio (800×600)
    canvas.width = newWidth;
    canvas.height = newWidth * (600 / 800); // maintain the 4:3 aspect ratio

    // Calculate a scale factor based on the new width vs. the original width
    const scaleFactor = newWidth / maxWidth;

    // Update all current dots' radii based on the scale factor
    dots.forEach(dot => {
        // Assuming the original dot radius is 15 in your design,
        // scale it down proportionally for smaller screens.
        dot.radius = 15 * scaleFactor;
    });
}

// Call resizeCanvas on page load and when the window resizes
window.addEventListener('resize', resizeCanvas);
window.addEventListener('load', resizeCanvas);

// Function to start the game
function startGame() {
    // Hide the start screen overlay
    document.getElementById('startScreen').style.display = 'none';

    // Start background music
    bgMusic.play().catch(err => {
        console.log("Background music play failed:", err);
    });

    // Initialize dots and start the animation loop
    initDots();
    lastTime = null;
    requestAnimationFrame(update);
}

// Attach startGame to the start button
document.getElementById('startBtn').addEventListener('click', startGame);