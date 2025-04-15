// Create an Audio object for background music
const bgMusic = new Audio('assets/audio/lookchine.mp3');
bgMusic.loop = true;       // Loop the music indefinitely
bgMusic.volume = 0.5;      // Adjust volume if needed (range: 0.0 to 1.0)

// Start the music when the user first clicks on the canvas (or any interaction)
document.addEventListener('click', function startMusic() {
    bgMusic.play().catch(err => console.log('User interaction required for music', err));
    // Remove the event listener so this only happens once.
    document.removeEventListener('click', startMusic);
});

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
        this.dx = dx;  // x velocity
        this.dy = dy;  // y velocity
        this.radius = 15;  // 3 times larger (was 5)
        this.color = color;
        this.exploded = false;
    }

    // Update dot position, and reverse direction when hitting canvas borders
    update() {
        this.x += this.dx;
        this.y += this.dy;

        if (this.x < 0 || this.x > canvas.width) this.dx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.dy *= -1;
    }

    // Draw the dot on the canvas
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
// Optional: Set them to preload
explosionSounds.forEach(sound => {
    sound.preload = 'auto';
});

// Explosion class for the chain reaction effect - using easing for smooth behavior
class Explosion {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.maxRadius = 60;      // Larger maximum radius
        this.radius = 0;
        this.color = color;
        this.state = "expanding"; // "expanding", "hanging", "shrinking"

        // Durations in frames (at ~60fps)
        this.expansionDuration = 120;  // e.g. 2 seconds to fully expand
        this.hangDuration = 90;        // e.g. 1.5 seconds at max size
        this.deflationDuration = 120;  // e.g. 2 seconds to deflate

        // Timers for each phase
        this.expansionTime = 0;
        this.hangTime = 0;
        this.deflationTime = 0;
    }

    // Easing functions:
    // Ease out quadratic: fast start, slows near the end.
    easeOutQuad(t) {
        return t * (2 - t);
    }
    // Ease in quadratic: slow start, speeds up later.
    easeInQuad(t) {
        return t * t;
    }

    update() {
        if (this.state === "expanding") {
            // Increment the expansion time
            this.expansionTime++;
            let progress = this.expansionTime / this.expansionDuration;
            if (progress > 1) progress = 1;
            // Use ease-out quadratic easing so that the expansion is fast initially and slows as it reaches max size.
            let easedProgress = this.easeOutQuad(progress);
            this.radius = this.maxRadius * easedProgress;
            // If expansion is complete, switch to hanging phase.
            if (progress === 1) {
                this.state = "hanging";
            }
        } else if (this.state === "hanging") {
            this.hangTime++;
            // Hold radius at max for hangDuration frames.
            this.radius = this.maxRadius;
            if (this.hangTime >= this.hangDuration) {
                this.state = "shrinking";
            }
        } else if (this.state === "shrinking") {
            this.deflationTime++;
            let progress = this.deflationTime / this.deflationDuration;
            if (progress > 1) progress = 1;
            // Use ease-in quadratic easing so that the deflation starts slowly and then speeds up.
            let easedProgress = this.easeInQuad(progress);
            this.radius = this.maxRadius * (1 - easedProgress);
            // End explosion when fully deflated.
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
    updateScoreBoard(); // Refresh the scoreboard if necessary
}

// Initialize a bunch of random dots based on the current level
function initDots() {
    dots = [];
    const numDots = levels[currentLevel].dotsCount;
    // Define minimum and maximum speed magnitudes
    const minSpeed = 0.3;
    const maxSpeed = 0.8;
    for (let i = 0; i < numDots; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        // Random angle and random speed between minSpeed and maxSpeed:
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
                // Standard circle collision: when the distance is less than or equal
                // to the sum of the explosion's radius and the dot's radius
                if (dist <= explosion.radius + dot.radius) {
                    dot.exploded = true;
                    currentExplodedCount++;  // Update the level's counter
                    explosions.push(new Explosion(dot.x, dot.y, dot.color));

                    // Play a random explosion sound effect:
                    const randomIndex = Math.floor(Math.random() * explosionSounds.length);
                    // Clone so overlapping is allowed
                    const explosionSound = explosionSounds[randomIndex].cloneNode();
                    // Adjust the volume for explosion sound effects here:
                    explosionSound.volume = 0.3;  // Adjust this value as desired
                    explosionSound.play();
                }
            });
        }
    });
    // Remove dots that have exploded
    dots = dots.filter(dot => !dot.exploded);
}

function updateScoreBoard() {
    // Update overall score and level
    document.getElementById('score').innerText = `Score: ${totalScore}`;
    document.getElementById('level').innerText = `Level: ${currentLevel + 1}`;

    // Get the current level configuration from the levels array
    const currentLevelData = levels[currentLevel];

    // Update the points display. It will show something like "Points: 3/1 from 5"
    // Here, currentExplodedCount is your current explosion count,
    // currentLevelData.goal is the minimum required, and
    // currentLevelData.dotsCount is the total dots on that level.
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

// Main game loop using requestAnimationFrame for smooth animation
function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update and draw each dot
    dots.forEach(dot => {
        dot.update();
        dot.draw();
    });

    // Update and draw explosions; remove those that are completed
    explosions = explosions.filter(explosion => {
        const active = explosion.update();
        explosion.draw();
        return active;
    });

    // Check collisions between dots and current explosions
    checkCollisions();

    // When a chain reaction is active but no explosions remain (chain is finished)
    if (chainActive && explosions.length === 0) {
        chainActive = false;
        const levelGoal = levels[currentLevel].goal;
        // Check if the level's minimum goal is met
        if (currentExplodedCount >= levelGoal) {
            // Only add the level's exploded dots to totalScore if the level passes
            totalScore += currentExplodedCount;
            setTimeout(() => {
                showPopup(
                    `Level ${currentLevel + 1} complete!\nYou exploded ${currentExplodedCount} dots.\n(Minimum required: ${levelGoal})\nTotal Score: ${totalScore}`
                );
            }, 500);
        } else {
            setTimeout(() => {
                alert(
                    `Game Over! You exploded only ${currentExplodedCount} dots (minimum required: ${levelGoal}).\nTotal Score remains: ${totalScore}`
                );
                restartLevel();  // Restart the same level without adding points
            }, 500);
        }
    }

    // Update the on-screen scoreboard
    updateScoreBoard();

    // Request next animation frame
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

// Listen for a click to start the chain reaction
canvas.addEventListener('click', function(event) {
    if (chainActive) return;  // Ignore clicks during an active chain

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    chainActive = true;
    explosions.push(new Explosion(x, y, 'white'));

    // Play a random note for the click event:
    const randomIndex = Math.floor(Math.random() * explosionSounds.length);
    const noteSound = explosionSounds[randomIndex].cloneNode();
    // Adjust volume for the note hit if needed:
    noteSound.volume = 0.3; // or any value between 0.0 and 1.0
    noteSound.play();
});

// Initialize the game
// initDots();
// update();
// Create an Audio object for background music (if not already created)

// Function to start the game
function startGame() {
    // Hide the start screen overlay
    const startScreen = document.getElementById('startScreen');
    startScreen.style.display = 'none';

    // Start background music
    bgMusic.play().catch(err => {
        console.log("Background music play failed:", err);
    });

    // Initialize the game and start the animation loop
    initDots();
    update();
}

// Add a click event listener to the start button
document.getElementById('startBtn').addEventListener('click', startGame);