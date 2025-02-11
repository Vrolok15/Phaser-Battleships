const config = {
    type: Phaser.AUTO,
    width: 768,
    height: 768,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

// Add global variables for tracking selected ship
let selectedShip = null;
let followingSprite = null;
let ships = null; // Will store reference to ships array
let currentRotation = 0; // Track current rotation in degrees
let lastHoveredTile = null;
let placedShips = []; // Array to track placed ships' positions
let gameStarted = false;

// Add to global variables at the top
const DEBUG_MODE = false;
const GRID_SIZE = 32;
const GRID_DIMENSION = 10;
const GRID_SPACING = 40;
const VERTICAL_SPACING = 50;
const SHIP_Y_OFFSET = 32;
const TEXT_PADDING = 10;

const RECT_PADDING = 5;
let enemyPlacedShips = []; // Array to track enemy ships' positions
let playerWins = 0;
let computerWins = 0;
let playerShipsDestroyed = 0;
let enemyShipsDestroyed = 0;
let playerShipsDamaged = new Set();
let lastSuccessfulShot = null;
let firstHitOfSequence = null;  // Track first hit on a ship
let currentDirection = null;    // Track current firing direction
let gameOver = false;
let enemyTurn = false;

// Add global variables for tracking hits
let enemySuccessfulShots = [];  // Array to track all successful hits
let currentTargetShip = null;   // Track the ship we're currently targeting

// Add global grid position variables
let playerGridX = null;
let enemyGridX = null;

// Add global variables for sounds
let hitSounds = [];
let missSound = null;
let lostSound = null;
let sunkSound = null;
let clearSound = null;

// Add global variables for game state sounds
let startSound = null;
let winSound = null;
let gameOverSound = null;

// Add global variables for ship placement sounds
let placeSound = null;
let removeSound = null;

// Add global variable for hover sound
let hoverSound = null;

// Add global variables for shot tracking
let playerShotCount = 0;
let enemyShotCount = 0;
let playerShotText = null;
let enemyShotText = null;

// Move createButton to global scope (add after other global variables)
function createButton(scene, text, x, y, width, height, color, callback, startDisabled = false) {
    let isDisabled = startDisabled;
    
    // Create interactive rectangle zone with fill color for visibility
    const hitZone = scene.add.rectangle(
        x + width/2,
        y + height/2,
        width,
        height,
        color,
        isDisabled ? 0.1 : 0.2
    );
    
    if (!isDisabled) {
        hitZone.setInteractive();
    }

    // Add rectangle graphics for outline and hover effect
    const buttonRect = scene.add.graphics();
    
    function drawRect(color = 0xffffff, alpha = 1) {
        buttonRect.clear();
        buttonRect.lineStyle(2, isDisabled ? 0x666666 : color, alpha);
        buttonRect.strokeRect(
            x,
            y,
            width,
            height
        );
    }

    // Add button text
    const buttonText = scene.add.text(
        x + width/2,
        y + height/2,
        text,
        {
            fontSize: '24px',
            fill: '#fff'
        }
    ).setOrigin(0.5);
    
    if (isDisabled) {
        buttonText.setTint(0x666666);
    }

    // Draw initial rectangle
    drawRect();

    // Add hover effects
    hitZone.on('pointerover', () => {
        if (!isDisabled) {
            drawRect(color);
            buttonText.setTint(color);
            hoverSound.play();  // Play hover sound
        }
    });
    
    hitZone.on('pointerout', () => {
        if (!isDisabled) {
            drawRect();
            buttonText.clearTint();
        }
    });

    // Add click handler
    hitZone.on('pointerdown', () => {
        if (!isDisabled) {
            callback();
        }
    });

    // Return functions to enable/disable the button
    return {
        enable: () => {
            isDisabled = false;
            hitZone.setInteractive();
            buttonText.clearTint();
            drawRect();
            hitZone.alpha = 0.2;
        },
        disable: () => {
            isDisabled = true;
            hitZone.disableInteractive();
            buttonText.setTint(0x666666);
            drawRect();
            hitZone.alpha = 0.1;
        },
        destroy: () => {
            hitZone.destroy();
            buttonRect.destroy();
            buttonText.destroy();
        },
        hitZone
    };
}

function preload() {
    // Add loading error handler
    this.load.on('loaderror', function(file) {
        console.error('Error loading asset:', file.src);
    });

    try {
        this.load.image('water', 'assets/water.png');
        this.load.image('water-dark', 'assets/water-dark.png');
    } catch (error) {
        console.error('Error in preload:', error);
    }

    // Load ship sprites
    for (let i = 1; i <= 5; i++) {
        this.load.image(`ship-${i}`, `assets/ship-${i}.png`);
    }

    // Add new function to handle shots
    this.load.image('missed', 'assets/missed.png');
    this.load.image('missed-dark', 'assets/missed-dark.png');
    this.load.image('explosion', 'assets/explosion.png');

    // Load sound effects
    this.load.audio('clear', 'assets/SFX/clear.wav');
    this.load.audio('hit', 'assets/SFX/explosion.wav');
    this.load.audio('hit2', 'assets/SFX/explosion2.wav');
    this.load.audio('hit3', 'assets/SFX/explosion3.wav');
    this.load.audio('game-over', 'assets/SFX/game-over.wav');
    this.load.audio('lost', 'assets/SFX/lost.wav');
    this.load.audio('miss', 'assets/SFX/miss.wav');
    this.load.audio('place', 'assets/SFX/place.wav');
    this.load.audio('remove', 'assets/SFX/remove.wav');
    this.load.audio('start', 'assets/SFX/start.wav');
    this.load.audio('sunk', 'assets/SFX/sunk.wav');
    this.load.audio('win', 'assets/SFX/win.wav');
    this.load.audio('hover', 'assets/SFX/hover.wav');  // Lower volume for hover
}


function create() {
    // Add debug info to check if assets loaded
    if (!this.textures.exists('water') || !this.textures.exists('water-dark')) {
        console.error('Water textures not loaded properly');
        // Add fallback color rectangles if images fail to load
        this.add.rectangle(0, 0, GRID_SIZE, GRID_SIZE, 0x0000ff);
        return;
    }
    
    // Calculate starting positions for both grids
    const totalGridWidth = GRID_SIZE * GRID_DIMENSION;
    const startX1 = (config.width - (totalGridWidth * 2 + GRID_SPACING)) / 2;
    const startX2 = startX1 + totalGridWidth + GRID_SPACING;
    const startY = (config.height - totalGridWidth) / 6;

    // Draw both grids with coordinates
    drawBothGrids(this, startX1, startX2, startY);

    // Create grids with isEnemy parameter
    createGrid(this, startX1, startY, 'Player Grid', false);
    createGrid(this, startX2, startY, 'Enemy Grid', true);

    // Add ship selection area below player grid
    const shipY = startY + (GRID_DIMENSION * GRID_SIZE) + 32;
    createShipSelection(this, startX1, startY, shipY);

    // Add pointer move listener for the scene
    this.input.on('pointermove', function (pointer) {
        if (followingSprite) {
            followingSprite.x = pointer.x;
            followingSprite.y = pointer.y;
        }
    });

    // Change to right click handler for canceling placement
    this.input.on('pointerdown', function (pointer) {
        if (pointer.rightButtonDown()) {
            if (followingSprite) {
                followingSprite.destroy();
                followingSprite = null;
                selectedShip = null;
            }
        }
    });

    // Add mouse wheel handler for rotation
    this.input.on('wheel', function(pointer, gameObjects, deltaX, deltaY, deltaZ) {
        if (followingSprite) {
            // Rotate 90 degrees for each wheel movement
            currentRotation = (currentRotation + (deltaY > 0 ? 90 : -90)) % 360;
            if (currentRotation < 0) currentRotation += 360;
            followingSprite.setAngle(currentRotation);

            // Update highlight using last hovered tile
            if (lastHoveredTile) {
                lastHoveredTile.emit('pointerover');
            }
        }
    }.bind(this));

    // Initialize sounds
    hitSounds = [
        this.sound.add('hit', { volume: 0.4 }),
        this.sound.add('hit2', { volume: 0.4 }),
        this.sound.add('hit3', { volume: 0.4 })
    ];
    missSound = this.sound.add('miss', { volume: 0.4 });
    lostSound = this.sound.add('lost', { volume: 0.5 });
    sunkSound = this.sound.add('sunk', { volume: 0.5 });
    clearSound = this.sound.add('clear', { volume: 0.4 });
    placeSound = this.sound.add('place', { volume: 0.4 });
    removeSound = this.sound.add('remove', { volume: 0.4 });
    hoverSound = this.sound.add('hover', { volume: 0.2 });  // Lower volume for hover
    
    // Add game state sounds
    startSound = this.sound.add('start', { volume: 0.5 });
    winSound = this.sound.add('win', { volume: 0.6 });
    gameOverSound = this.sound.add('game-over', { volume: 0.6 });

    // Set global grid positions
    playerGridX = startX1;
    enemyGridX = startX2;

    // Add shot counters below grids (initially invisible)
    const counterY = startY + (GRID_DIMENSION * GRID_SIZE) + 20;
    
    enemyShotText = this.add.text(
        startX1 + (GRID_SIZE * GRID_DIMENSION) / 2,
        counterY,
        'Enemy shots: 0',
        {
            fontSize: '18px',
            fill: '#fff'
        }
    ).setOrigin(0.5).setVisible(false);  // Initially invisible

    playerShotText = this.add.text(
        startX2 + (GRID_SIZE * GRID_DIMENSION) / 2,
        counterY,
        'Player shots: 0',
        {
            fontSize: '18px',
            fill: '#fff'
        }
    ).setOrigin(0.5).setVisible(false);  // Initially invisible
}

function createGrid(scene, startX, startY, title, isEnemy = false) {
    // Add title above coordinates
    scene.add.text(startX + (GRID_SIZE * GRID_DIMENSION) / 2, startY - 45, title, {
        fontSize: '20px',
        fill: '#fff'
    }).setOrigin(0.5);

    // Add water background tiles first (depth: 0)
    for (let x = 0; x < GRID_DIMENSION; x++) {
        for (let y = 0; y < GRID_DIMENSION; y++) {
            const sprite = scene.add.sprite(
                startX + (x * GRID_SIZE) + GRID_SIZE/2,
                startY + (y * GRID_SIZE) + GRID_SIZE/2,
                isEnemy ? 'water-dark' : 'water'
            );
            sprite.setDisplaySize(GRID_SIZE, GRID_SIZE);
            sprite.setDepth(0);
        }
    }

    // Add coordinates (depth: 1)
    for (let x = 0; x < GRID_DIMENSION; x++) {
        // Add letters on top
        scene.add.text(startX + (x * GRID_SIZE) + GRID_SIZE/2, startY - 20, 
            String.fromCharCode(65 + x), {
                fontSize: '16px',
                fill: '#fff'
            }).setOrigin(0.5).setDepth(1);

        for (let y = 0; y < GRID_DIMENSION; y++) {
            if (x === 0) {
                // Add numbers on the left
                scene.add.text(startX - 20, startY + (y * GRID_SIZE) + GRID_SIZE/2, 
                    (y + 1).toString(), {
                        fontSize: '16px',
                        fill: '#fff'
                    }).setOrigin(0.5).setDepth(1);
            }
        }
    }

    // Create graphics object for grid lines (depth: 2)
    const graphics = scene.add.graphics();
    graphics.lineStyle(1, 0xffffff);
    graphics.setDepth(2);  // Set grid lines to highest depth

    // Draw vertical lines
    for (let i = 0; i <= GRID_DIMENSION; i++) {
        graphics.moveTo(startX + (i * GRID_SIZE), startY);
        graphics.lineTo(startX + (i * GRID_SIZE), startY + (GRID_DIMENSION * GRID_SIZE));
    }

    // Draw horizontal lines
    for (let i = 0; i <= GRID_DIMENSION; i++) {
        graphics.moveTo(startX, startY + (i * GRID_SIZE));
        graphics.lineTo(startX + (GRID_DIMENSION * GRID_SIZE), startY + (i * GRID_SIZE));
    }
    graphics.strokePath();

    // Create container for tile highlights - moved to end to be on top (depth: 1)
    const highlightGraphics = scene.add.graphics();
    highlightGraphics.setDepth(1);  // Set highlight below grid lines

    // Add interactive zones and hover effects
    for (let x = 0; x < GRID_DIMENSION; x++) {
        for (let y = 0; y < GRID_DIMENSION; y++) {
            const tileZone = scene.add.rectangle(
                startX + (x * GRID_SIZE) + GRID_SIZE/2,
                startY + (y * GRID_SIZE) + GRID_SIZE/2,
                GRID_SIZE,
                GRID_SIZE
            );
            tileZone.setInteractive();

            // Helper function to check if a ship placement would overlap with existing ships
            function checkShipCollision(x, y, length, isHorizontal) {
                const occupiedTiles = [];
                
                // Get all tiles that would be occupied by the new ship
                for (let i = 0; i < length; i++) {
                    if (isHorizontal) {
                        occupiedTiles.push({x: x + i, y: y});
                    } else {
                        occupiedTiles.push({x: x, y: y + i});
                    }
                }

                // Check against all placed ships
                return placedShips.some(ship => {
                    return ship.tiles.some(tile => 
                        occupiedTiles.some(newTile => 
                            newTile.x === tile.x && newTile.y === tile.y
                        )
                    );
                });
            }

            // Modify the hover effect to include game started state
            tileZone.on('pointerover', () => {
                lastHoveredTile = tileZone;
                highlightGraphics.clear();
                
                if (gameStarted && isEnemy) {
                    // In game mode, show gold highlight on enemy grid
                    highlightGraphics.fillStyle(0xffd700, 0.3);
                    highlightGraphics.fillRect(
                        startX + (x * GRID_SIZE),
                        startY + (y * GRID_SIZE),
                        GRID_SIZE,
                        GRID_SIZE
                    );
                    hoverSound.play();  // Play hover sound
                } else if (!gameStarted) {
                    if (followingSprite && selectedShip) {
                        const isHorizontal = currentRotation % 180 === 0;
                        const shipLength = selectedShip.size;
                        
                        // Check if ship fits within grid bounds
                        const fitsHorizontally = x + shipLength <= GRID_DIMENSION;
                        const fitsVertically = y + shipLength <= GRID_DIMENSION;
                        const canPlace = isHorizontal ? fitsHorizontally : fitsVertically;

                        // Check for collisions
                        const wouldCollide = checkShipCollision(x, y, shipLength, isHorizontal);
                        
                        // Set highlight color based on placement possibility and collisions
                        const highlightColor = !isEnemy ? 
                            (canPlace && !wouldCollide ? 0x00ff00 : 0xff0000) : 
                            0xff0000;

                        // Highlight all tiles the ship would occupy
                        if (!isEnemy) {
                            for (let i = 0; i < shipLength; i++) {
                                if (isHorizontal && x + i < GRID_DIMENSION) {
                                    highlightGraphics.fillStyle(highlightColor, 0.3);
                                    highlightGraphics.fillRect(
                                        startX + ((x + i) * GRID_SIZE),
                                        startY + (y * GRID_SIZE),
                                        GRID_SIZE,
                                        GRID_SIZE
                                    );
                                } else if (!isHorizontal && y + i < GRID_DIMENSION) {
                                    highlightGraphics.fillStyle(highlightColor, 0.3);
                                    highlightGraphics.fillRect(
                                        startX + (x * GRID_SIZE),
                                        startY + ((y + i) * GRID_SIZE),
                                        GRID_SIZE,
                                        GRID_SIZE
                                    );
                                }
                            }
                        }
                    } else {
                        // Check if there's a ship at these coordinates
                        const shipAtTile = placedShips.find(ship => 
                            ship.tiles.some(tile => tile.x === x && tile.y === y)
                        );

                        if (shipAtTile && !isEnemy) {
                            // Highlight all tiles of the ship in red
                            highlightGraphics.fillStyle(0xff0000, 0.3);
                            shipAtTile.tiles.forEach(tile => {
                                highlightGraphics.fillRect(
                                    startX + (tile.x * GRID_SIZE),
                                    startY + (tile.y * GRID_SIZE),
                                    GRID_SIZE,
                                    GRID_SIZE
                                );
                            });
                        } else {
                            // Default gold highlight for empty tiles
                            highlightGraphics.fillStyle(0xffd700, 0.3);
                            highlightGraphics.fillRect(
                                startX + (x * GRID_SIZE),
                                startY + (y * GRID_SIZE),
                                GRID_SIZE,
                                GRID_SIZE
                            );
                        }
                    }
                }
            });

            tileZone.on('pointerout', () => {
                lastHoveredTile = null;
                highlightGraphics.clear();
            });

            // Modify the click handler to update highlight after placement
            tileZone.on('pointerdown', (pointer) => {
                if (!isEnemy && followingSprite && !gameStarted) {
                    const isValid = tryPlaceShip(scene, x, y, startX, startY);
                    if (isValid) {
                        // Play place sound on successful placement
                        scene.time.delayedCall(100, () => {
                            placeSound.play();
                        });
                    }
                }
                if (!isEnemy) {
                    if (pointer.leftButtonDown()) {
                        if (followingSprite && selectedShip) {
                            const isHorizontal = currentRotation % 180 === 0;
                            const shipLength = selectedShip.size;
                            
                            // Check if ship fits
                            const fitsHorizontally = x + shipLength <= GRID_DIMENSION;
                            const fitsVertically = y + shipLength <= GRID_DIMENSION;
                            const canPlace = isHorizontal ? fitsHorizontally : fitsVertically;

                            // Check for collisions
                            const wouldCollide = checkShipCollision(x, y, shipLength, isHorizontal);

                            if (canPlace && !wouldCollide) {
                                // Calculate ship position based on its size and rotation
                                const shipX = startX + (x * GRID_SIZE) + (isHorizontal ? (shipLength * GRID_SIZE) / 2 : GRID_SIZE/2);
                                const shipY = startY + (y * GRID_SIZE) + (!isHorizontal ? (shipLength * GRID_SIZE) / 2 : GRID_SIZE/2);

                                const placedShip = scene.add.sprite(shipX, shipY, `ship-${selectedShip.size}`);
                                placedShip.setDisplaySize(GRID_SIZE * shipLength, GRID_SIZE);
                                placedShip.setAngle(currentRotation);

                                // Store the placed ship's position
                                const shipTiles = [];
                                for (let i = 0; i < shipLength; i++) {
                                    if (isHorizontal) {
                                        shipTiles.push({x: x + i, y: y});
                                    } else {
                                        shipTiles.push({x: x, y: y + i});
                                    }
                                }
                                placedShips.push({
                                    sprite: placedShip,
                                    tiles: shipTiles,
                                    size: shipLength,
                                    rotation: currentRotation,
                                    hits: new Set()
                                });

                                const placedShipIndex = selectedShip.index;
                                ships[placedShipIndex].amount--;
                                ships[placedShipIndex].used++;

                                if (ships[placedShipIndex].amount <= 0) {
                                    followingSprite.destroy();
                                    followingSprite = null;
                                    selectedShip = null;
                                    currentRotation = 0;
                                }

                                scene.events.emit('shipPlaced', placedShipIndex);

                                // Update highlight to show new collision areas
                                if (lastHoveredTile) {
                                    lastHoveredTile.emit('pointerover');
                                }
                            }
                        } else {
                            // Try to remove ship at clicked coordinates
                            const removed = removeShipAtCoords(scene, x, y);
                            if (removed && lastHoveredTile) {
                                // Update highlight to show new valid placement areas
                                lastHoveredTile.emit('pointerover');
                            }
                        }
                    }
                } else if (gameStarted && pointer.leftButtonDown()) {
                    // Check if this tile has been shot before
                    const hasBeenShot = scene.children.list.some(child => 
                        child.type === 'Sprite' && 
                        (child.texture.key === 'missed-dark' || child.texture.key === 'explosion') &&
                        child.x === startX + (x * GRID_SIZE) + GRID_SIZE/2 &&
                        child.y === startY + (y * GRID_SIZE) + GRID_SIZE/2
                    );

                    if (!hasBeenShot) {
                        // Check if there's a ship at these coordinates
                        const hitShip = enemyPlacedShips.find(ship => 
                            ship.tiles.some(tile => tile.x === x && tile.y === y)
                        );

                        // Calculate player grid position
                        const totalGridWidth = GRID_SIZE * GRID_DIMENSION;
                        const playerGridX = startX - totalGridWidth - GRID_SPACING;

                        handleShot(scene, x, y, startX, startY, hitShip !== undefined, playerGridX);
                    }
                }
            });
        }
    }
}

function createShipSelection(scene, gridStartX, gridStartY, startY) {
    const gridWidth = GRID_SIZE * GRID_DIMENSION;
    
    // Remove these local constants since they're now global
    // const verticalSpacing = 50;
    // const shipYOffset = 32;
    // const textPadding = 10;
    // const rectPadding = 5;

    // Center the "Player Ships:" label under the grid
    const labelText = scene.add.text(gridStartX + gridWidth/2, startY, 'Player Ships:', {
        fontSize: '20px',
        fill: '#fff'
    }).setOrigin(0.5, 0);

    // Ship configurations
    ships = [
        { size: 1, name: 'Patrol Boat', amount: 5, used: 0, destroyed: 0 },
        { size: 2, name: 'Submarine', amount: 4, used: 0, destroyed: 0 },
        { size: 3, name: 'Cruiser', amount: 3, used: 0, destroyed: 0 },
        { size: 4, name: 'Battleship', amount: 2, used: 0, destroyed: 0 },
        { size: 5, name: 'Carrier', amount: 1, used: 0, destroyed: 0 }
    ];

    ships.forEach((ship, index) => {
        const shipY = startY + SHIP_Y_OFFSET + (index * VERTICAL_SPACING);
        
        // Add ship sprite at the left side of the rectangle
        const sprite = scene.add.sprite(
            gridStartX + (ship.size * GRID_SIZE) / 2,
            shipY + GRID_SIZE/2,
            `ship-${ship.size}`
        );
        
        sprite.setDisplaySize(GRID_SIZE * ship.size, GRID_SIZE);

        // Add grid overlay on ship
        const gridOverlay = scene.add.graphics();
        gridOverlay.lineStyle(1, 0xffffff, 0.3);

        // Draw vertical grid lines
        for (let i = 0; i <= ship.size; i++) {
            gridOverlay.moveTo(gridStartX + (i * GRID_SIZE), shipY);
            gridOverlay.lineTo(gridStartX + (i * GRID_SIZE), shipY + GRID_SIZE);
        }

        // Draw horizontal grid lines
        for (let i = 0; i <= 1; i++) {
            gridOverlay.moveTo(gridStartX, shipY + (i * GRID_SIZE));
            gridOverlay.lineTo(gridStartX + (ship.size * GRID_SIZE), shipY + (i * GRID_SIZE));
        }
        gridOverlay.strokePath();

        // Add ship name and amount right after the ship sprite
        const nameText = scene.add.text(
            gridStartX + (ship.size * GRID_SIZE) + TEXT_PADDING,
            shipY + GRID_SIZE/2,
            ship.name + ' (x' + ship.amount + ')' + ' x' + ship.used + '',
            {
                fontSize: '16px',
                fill: '#fff'
            }
        ).setOrigin(0, 0.5);

        // Create interactive rectangle zone
        const hitZone = scene.add.rectangle(
            gridStartX + gridWidth/2,
            shipY + GRID_SIZE/2,
            gridWidth,
            GRID_SIZE + (RECT_PADDING * 2)
        );
        hitZone.setInteractive();

        // Add rectangle graphics for outline and hover effect
        const shipRect = scene.add.graphics();
        
        function drawRect(color = 0xffffff, alpha = 1) {
            shipRect.clear();
            shipRect.lineStyle(1, color, alpha);
            shipRect.strokeRect(
                gridStartX,
                shipY - RECT_PADDING,
                gridWidth,
                GRID_SIZE + (RECT_PADDING * 2)
            );
        }

        // Draw initial rectangle
        drawRect();

        // Add hover effects to the hit zone
        hitZone.on('pointerover', function() {
            if (ship.amount > 0) {
                drawRect(0x66ff66); // Green highlight
                sprite.setTint(0x66ff66); // Highlight ship sprite
                nameText.setTint(0x66ff66); // Highlight text
                hoverSound.play();  // Play hover sound
                
                // Hide following sprite when hovering over a different ship
                if (followingSprite && (!selectedShip || selectedShip.index !== index)) {
                    followingSprite.setVisible(false);
                }
            }
        });
        
        hitZone.on('pointerout', function() {
            if (ship.amount > 0) {
                drawRect(); // Reset to white
                sprite.clearTint(); // Reset ship sprite
                nameText.clearTint(); // Reset text
                
                // Show following sprite when leaving
                if (followingSprite) {
                    followingSprite.setVisible(true);
                }
            }
        });

        // Move click handler to hit zone
        hitZone.on('pointerdown', function(pointer) {
            if (pointer.leftButtonDown()) {
                if (ship.amount > 0) {
                    if (followingSprite) {
                        followingSprite.destroy();
                    }
                    
                    currentRotation = 0;
                    
                    followingSprite = scene.add.sprite(pointer.x, pointer.y, `ship-${ship.size}`);
                    followingSprite.setDisplaySize(GRID_SIZE * ship.size, GRID_SIZE);
                    followingSprite.setOrigin(0.5);
                    
                    selectedShip = {
                        size: ship.size,
                        name: ship.name,
                        index: index,
                        rotation: currentRotation
                    };
                }
            }
        });

        // If amount is 0, make everything appear disabled
        if (ship.amount <= 0) {
            drawRect(0x666666, 0.5);
            sprite.setTint(0x666666);
            nameText.setTint(0x666666);
        }

        sprite.on('pointerover', () => {
            if (!gameStarted && ship.amount > 0) {
                sprite.setTint(0x00ff00);
                hoverSound.play();  // Play hover sound
            }
        });
    });

    // Listen for shipPlaced event to update UI
    scene.events.on('shipPlaced', (shipIndex) => {
        const ship = ships[shipIndex];
        const shipY = startY + SHIP_Y_OFFSET + (shipIndex * VERTICAL_SPACING);
        
        // Find all relevant elements for this ship
        const elements = {
            text: scene.children.list.find(
                child => child.type === 'Text' && 
                child.y === shipY + GRID_SIZE/2 && 
                child.text.includes(ship.name)
            ),
            hitZone: scene.children.list.find(
                zone => zone.type === 'Rectangle' && 
                zone.y === shipY + GRID_SIZE/2
            ),
            sprite: scene.children.list.find(
                s => s.type === 'Sprite' && 
                s.y === shipY + GRID_SIZE/2
            ),
            graphics: scene.children.list.find(
                gfx => gfx.type === 'Graphics' && 
                Math.abs(gfx.y - shipY) < VERTICAL_SPACING
            )
        };

        if (elements.text) {
            if (ship.amount <= 0) {
                elements.text.setText(`${ship.name} x${ship.used}`);
                // Disable and gray out everything
                if (elements.graphics) {
                    elements.graphics.clear();
                    elements.graphics.lineStyle(1, 0x666666, 0.5);
                    elements.graphics.strokeRect(
                        gridStartX,
                        shipY - RECT_PADDING,
                        gridWidth,
                        GRID_SIZE + (RECT_PADDING * 2)
                    );
                }
                if (elements.sprite) {
                    elements.sprite.setTint(0x666666);
                }
                elements.text.setTint(0x666666);
                if (elements.hitZone) {
                    elements.hitZone.disableInteractive();
                }
            } else {
                // Re-enable everything if amount is greater than 0
                elements.text.setText(`${ship.name} (x${ship.amount}) x${ship.used}`);
                if (elements.graphics) {
                    elements.graphics.clear();
                    elements.graphics.lineStyle(1, 0xffffff);
                    elements.graphics.strokeRect(
                        gridStartX,
                        shipY - RECT_PADDING,
                        gridWidth,
                        GRID_SIZE + (RECT_PADDING * 2)
                    );
                }
                if (elements.sprite) {
                    elements.sprite.clearTint();
                }
                elements.text.clearTint();
                if (elements.hitZone) {
                    elements.hitZone.setInteractive();
                }
            }
        }
    });

    // After the ships forEach loop, add buttons
    const lastShipY = startY + SHIP_Y_OFFSET + ((ships.length - 1) * VERTICAL_SPACING);
    const buttonY = lastShipY + VERTICAL_SPACING;
    const buttonHeight = GRID_SIZE + (RECT_PADDING * 2);
    const buttonWidth = gridWidth * 0.45;
    const buttonGap = gridWidth * 0.1;

    // Create Random/Clear button with hover effects
    let randomClearButton = createButton(
        scene,
        'Random',  // Initial text
        gridStartX,
        buttonY,
        buttonWidth,
        buttonHeight,
        0x3399ff,  // Initial color (blue)
        () => {
            if (placedShips.length === 0) {
                // Clear any selected ship first
                if (followingSprite) {
                    followingSprite.destroy();
                    followingSprite = null;
                }
                selectedShip = null;
                currentRotation = 0;
                
                // Random placement
                placePlayerShipsRandomly(scene, gridStartX, gridStartY);
            } else {
                // Clear functionality
                handleClearClick(scene, startY, gridStartX, gridStartY, startButton);
            }
        }
    );

    // Add hover effects for Random button
    randomClearButton.hitZone.on('pointerover', () => {
        if (followingSprite) {
            followingSprite.setVisible(false);
        }
    });

    randomClearButton.hitZone.on('pointerout', () => {
        if (followingSprite) {
            followingSprite.setVisible(true);
        }
    });

    // Create Start button (disabled initially)
    const startButton = createButton(
        scene,
        'Start',
        gridStartX + buttonWidth + buttonGap,
        buttonY,
        buttonWidth,
        buttonHeight,
        0x33cc33,
        () => handleStartClick(scene, startY, gridStartX, gridStartY, buttonY, buttonWidth, buttonHeight, randomClearButton, startButton),
        true
    );

    // Update shipPlaced event to handle button appearance
    scene.events.on('shipPlaced', () => {
        if (placedShips.length === 0) {
            // Switch to Random mode
            randomClearButton.destroy();
            const newButton = createButton(
                scene,
                'Random',
                gridStartX,
                buttonY,
                buttonWidth,
                buttonHeight,
                0x3399ff,
                () => {
                    // Clear any selected ship first
                    if (followingSprite) {
                        followingSprite.destroy();
                        followingSprite = null;
                    }
                    selectedShip = null;
                    currentRotation = 0;
                    
                    // Random placement
                    placePlayerShipsRandomly(scene, gridStartX, gridStartY);
                }
            );
            randomClearButton = newButton;
            startButton.disable();
        } else {
            // Switch to Clear mode
            randomClearButton.destroy();
            const newButton = createButton(
                scene,
                'Clear',
                gridStartX,
                buttonY,
                buttonWidth,
                buttonHeight,
                0xff3333,
                () => handleClearClick(scene, startY, gridStartX, gridStartY, startButton)
            );
            randomClearButton = newButton;
            startButton.enable(); // Enable start when any ships placed
        }
    });

    return { randomClearButton, startButton };
}

function handleClearClick(scene, startY, gridStartX, gridStartY, startButton) {
    // Play clear sound
    clearSound.play();

    // Clear all placed ships and play remove sound for each
    placedShips.forEach(ship => {
        ship.sprite.destroy();
        removeSound.play();
        const originalShip = ships.find(s => s.size === ship.size);
        if (originalShip) {
            originalShip.amount++;
            originalShip.used--;
        }
    });
    placedShips = [];

    // Update ship UI
    updateShipUI(scene, ships, startY, playerGridX, enemyGridX);

    // Reset ship inventory
    ships.forEach((ship, index) => {
        ship.amount += ship.used;
        ship.used = 0;
        scene.events.emit('shipPlaced', index);
    });

    // Clear any selected ship
    if (followingSprite) {
        followingSprite.destroy();
        followingSprite = null;
    }
    selectedShip = null;
    currentRotation = 0;
    startButton.disable();

    // Reset shot counters
    playerShotCount = 0;
    enemyShotCount = 0;
    if (playerShotText) playerShotText.setText('Player shots: 0');
    if (enemyShotText) enemyShotText.setText('Enemy shots: 0');
}

// Update drawBothGrids function to remove tile creation
function drawBothGrids(scene, startX1, startX2, startY) {
    // Create graphics object for grid lines
    drawGrid(scene, startX1, startY);
    drawGrid(scene, startX2, startY);

    // Add titles above grids
    scene.add.text(startX1 + (GRID_SIZE * GRID_DIMENSION) / 2, startY - 45, 'Player Grid', {
        fontSize: '20px',
        fill: '#fff'
    }).setOrigin(0.5);

    scene.add.text(startX2 + (GRID_SIZE * GRID_DIMENSION) / 2, startY - 45, 'Enemy Grid', {
        fontSize: '20px',
        fill: '#fff'
    }).setOrigin(0.5);

    // Add coordinates to both grids
    [startX1, startX2].forEach(startX => {
        for (let x = 0; x < GRID_DIMENSION; x++) {
            // Add letters on top
            scene.add.text(startX + (x * GRID_SIZE) + GRID_SIZE/2, startY - 20, 
                String.fromCharCode(65 + x), {
                    fontSize: '16px',
                    fill: '#fff'
                }).setOrigin(0.5);

            for (let y = 0; y < GRID_DIMENSION; y++) {
                if (x === 0) {
                    // Add numbers on the left
                    scene.add.text(startX - 20, startY + (y * GRID_SIZE) + GRID_SIZE/2, 
                        (y + 1).toString(), {
                            fontSize: '16px',
                            fill: '#fff'
                        }).setOrigin(0.5);
                }
            }
        }
    });
}

// Update handleStartClick to show counters
function handleStartClick(scene, startY, gridStartX, gridStartY, buttonY, buttonWidth, buttonHeight, randomClearButton, startButton) {
    enemySuccessfulShots = [];  // Reset successful shots
    currentTargetShip = null;   // Reset current target
    gameOver = false;
    enemyTurn = false;
    // First remove only grid lines and highlights, preserving ships and ship UI
    scene.children.list
        .filter(child => {
            // Keep all placed ships
            if (child.type === 'Sprite' && placedShips.some(ship => ship.sprite === child)) {
                return false;
            }
            
            // Keep ship rectangles in selection area
            if (child.type === 'Graphics' && child.y >= startY && child.y <= buttonY) {
                return false;
            }

            // Remove everything else in ship selection area
            if (child.y >= startY && child.y <= buttonY) {
                return true;
            }

            // Remove grid lines and highlights
            if (child.type === 'Graphics' && child.y < startY) {
                return true;
            }

            return false;
        })
        .forEach(child => child.destroy());

    // Calculate grid positions once
    const totalGridWidth = GRID_SIZE * GRID_DIMENSION;
    const enemyGridX = gridStartX + totalGridWidth + GRID_SPACING;

    // Redraw grids and recreate interactive tiles
    drawBothGrids(scene, gridStartX, enemyGridX, gridStartY);
    createGrid(scene, gridStartX, gridStartY, 'Player Grid', false);
    createGrid(scene, enemyGridX, gridStartY, 'Enemy Grid', true);

    // Set game state to started
    gameStarted = true;

    // Store old ships and clear arrays
    const oldPlayerShips = [...placedShips];
    placedShips = [];

    // Redraw player ships
    oldPlayerShips.forEach(ship => {
        const newShip = placeShipOnGrid(scene, ship, gridStartX, gridStartY);
        placedShips.push(newShip);
    });

    // Place enemy ships randomly
    placeEnemyShipsRandomly(scene, enemyGridX, gridStartY, oldPlayerShips);

    // Add hit tracking to enemy ships
    enemyPlacedShips.forEach(ship => {
        ship.hits = new Set();
    });

    // Recreate elements only for used ships under player grid
    ships.forEach((ship, index) => {
        if (ship.used > 0) {
            const shipY = startY + SHIP_Y_OFFSET + (index * VERTICAL_SPACING);
            recreateShipUI(scene, ship, shipY, gridStartX);
            // Create ship UI under enemy grid
            recreateShipUI(scene, ship, shipY, enemyGridX);
        }
    });

    // Remove ability to interact with placed ships
    placedShips.forEach(ship => {
        ship.sprite.removeInteractive();
    });

    // Clear any selected ship
    if (followingSprite) {
        followingSprite.destroy();
        followingSprite = null;
    }
    selectedShip = null;

    // Remove buttons
    randomClearButton.destroy();
    startButton.destroy();

    // Disable grid interaction
    disableGridInteraction(scene);

    // Add restart button
    createButton(
        scene,
        'Restart',
        gridStartX,
        buttonY,
        buttonWidth,
        buttonHeight,
        0x3399ff,
        () => handleRestartClick(scene, startY, gridStartX, gridStartY)
    );

    // Play start sound
    startSound.play();

    // Show shot counters
    playerShotText.setVisible(true);
    enemyShotText.setVisible(true);
}

// Update handleRestartClick to hide counters
function handleRestartClick(scene, startY, gridStartX, gridStartY) {
    enemySuccessfulShots = [];  // Reset successful shots
    currentTargetShip = null;   // Reset current target
    gameOver = false;
    enemyTurn = false;
    // Reset destruction counters
    playerShipsDestroyed = 0;
    enemyShipsDestroyed = 0;
    playerShipsDamaged = new Set();
    lastSuccessfulShot = null;
    
    // First remove all graphics and shot markers
    scene.children.list
        .filter(child => 
            // Remove only graphics that aren't ship rectangles
            (child.type === 'Graphics' && !(child.y >= startY && child.y <= buttonY)) ||
            // Remove only sprites that are shot markers
            child.getData('shotMarker')
        )
        .forEach(child => child.destroy());

    // Calculate grid positions
    const totalGridWidth = GRID_SIZE * GRID_DIMENSION;
    const enemyGridX = gridStartX + totalGridWidth + GRID_SPACING;
    
    // Draw both grids with coordinates
    drawBothGrids(scene, gridStartX, enemyGridX, gridStartY);
    
    // Create interactive grids
    createGrid(scene, gridStartX, gridStartY, 'Player Grid', false);
    createGrid(scene, enemyGridX, gridStartY, 'Enemy Grid', true);

    // Reset game state
    gameStarted = false;
    
    // Clear all placed ships
    placedShips.forEach(ship => ship.sprite.destroy());
    placedShips = [];
    
    // Clear all enemy ships
    enemyPlacedShips.forEach(ship => ship.sprite.destroy());
    enemyPlacedShips = [];
    
    // Reset ship inventory including destroyed count
    ships.forEach(ship => {
        ship.amount = ship.amount + ship.used;
        ship.used = 0;
        ship.destroyed = 0;
    });
    
    // Clear any selected ship
    if (followingSprite) {
        followingSprite.destroy();
        followingSprite = null;
    }
    selectedShip = null;
    currentRotation = 0;

    // Remove all existing elements in ship selection area
    scene.children.list
        .filter(child => child.y >= startY)
        .forEach(child => child.destroy());

    // Remove all existing event listeners for shipPlaced
    scene.events.removeListener('shipPlaced');

    // Recreate the ship selection UI
    createShipSelection(scene, gridStartX, gridStartY, startY);

    // Re-enable grid interaction
    enableGridInteraction(scene);

    // Hide shot counters
    playerShotText.setVisible(false);
    enemyShotText.setVisible(false);

    // Reset shot counters
    playerShotCount = 0;
    enemyShotCount = 0;
    playerShotText.setText('Player shots: 0');
    enemyShotText.setText('Enemy shots: 0');
}

// Update recreateShipUI to add identifiers
function recreateShipUI(scene, ship, shipY, gridStartX) {
    const gridWidth = GRID_SIZE * GRID_DIMENSION;
    const isEnemyGrid = gridStartX > config.width/2;
    const gridType = isEnemyGrid ? 'enemy' : 'player';

    // Add ship sprite
    const sprite = scene.add.sprite(
        gridStartX + (ship.size * GRID_SIZE) / 2,
        shipY + GRID_SIZE/2,
        `ship-${ship.size}`
    );
    sprite.setDisplaySize(GRID_SIZE * ship.size, GRID_SIZE);

    // Add ship name and amount with destroyed count for enemy grid
    let text;
    if (isEnemyGrid) {
        const destroyedCount = enemyPlacedShips
            .filter(s => s.size === ship.size && 
                s.tiles.every(tile => s.hits.has(`${tile.x},${tile.y}`)))
            .length;
        text = `${ship.name} x${ship.used} `;
        if (ship.destroyed > 0) {
            text += `(-${ship.destroyed})`;
        }
    } else {
        const destroyedCount = placedShips
            .filter(s => s.size === ship.size && 
                s.tiles.every(tile => s.hits.has(`${tile.x},${tile.y}`)))
            .length;
        text = `${ship.name} x${ship.used} `;
        if (ship.destroyed > 0) {
            text += `(-${ship.destroyed})`;
        }
    }

    const nameText = scene.add.text(
        gridStartX + (ship.size * GRID_SIZE) + TEXT_PADDING,
        shipY + GRID_SIZE/2,
        text,
        {
            fontSize: '16px',
            fill: '#fff'
        }
    ).setOrigin(0, 0.5);
    nameText.setData('shipUIType', `${gridType}-text-${ship.size}`);

    // Add rectangle outline
    const shipRect = scene.add.graphics();
    const isFullyDestroyed = isEnemyGrid && ship.destroyed === ship.used;
    shipRect.lineStyle(1, isFullyDestroyed ? 0x666666 : 0xffffff, isFullyDestroyed ? 0.5 : 1);
    shipRect.strokeRect(
        gridStartX,
        shipY - RECT_PADDING,
        gridWidth,
        GRID_SIZE + (RECT_PADDING * 2)
    );
    shipRect.setData('shipUIType', `${gridType}-rect-${ship.size}`);

    // Gray out text if all ships of this type are destroyed
    if (isFullyDestroyed) {
        nameText.setTint(0x666666);
    }
}

function disableGridInteraction(scene) {
    scene.children.list.forEach(child => {
        // Only disable player grid tiles (those before the enemy grid)
        if (child.type === 'Rectangle' && child.width === GRID_SIZE) {
            const totalGridWidth = GRID_SIZE * GRID_DIMENSION;
            const enemyGridStart = (config.width - (totalGridWidth * 2 + GRID_SPACING)) / 2 + totalGridWidth + GRID_SPACING;
            
            // Only disable rectangles that are in the player's grid
            if (child.x < enemyGridStart) {
                child.disableInteractive();
            }
        }
    });
}

function enableGridInteraction(scene) {
    scene.children.list.forEach(child => {
        if (child.type === 'Rectangle' && child.width === GRID_SIZE) {
            child.setInteractive();
        }
    });
}

// Modify the helper function to accept scene parameter
function removeShipAtCoords(scene, x, y) {
    const shipIndex = placedShips.findIndex(ship => 
        ship.tiles.some(tile => tile.x === x && tile.y === y)
    );

    if (shipIndex !== -1) {
        const ship = placedShips[shipIndex];
        // Find the ship type to update inventory
        const shipType = ships.find(s => s.size === ship.size);
        if (shipType) {
            shipType.amount++;
            shipType.used--;
            // Emit event to update UI
            scene.events.emit('shipPlaced', ships.indexOf(shipType));
        }
        // Remove the ship sprite and from tracking array
        ship.sprite.destroy();
        placedShips.splice(shipIndex, 1);
        return true;
    }
    return false;
}

function update() {
    // No need for additional update logic as we're using event handlers
}

// Add before drawBothGrids function
function drawGrid(scene, startX, startY) {
    // Create graphics object for grid lines
    const graphics = scene.add.graphics();
    graphics.lineStyle(1, 0xffffff);

    // Draw vertical lines
    for (let i = 0; i <= GRID_DIMENSION; i++) {
        graphics.moveTo(startX + (i * GRID_SIZE), startY);
        graphics.lineTo(startX + (i * GRID_SIZE), startY + (GRID_DIMENSION * GRID_SIZE));
    }

    // Draw horizontal lines
    for (let i = 0; i <= GRID_DIMENSION; i++) {
        graphics.moveTo(startX, startY + (i * GRID_SIZE));
        graphics.lineTo(startX + (GRID_DIMENSION * GRID_SIZE), startY + (i * GRID_SIZE));
    }
    graphics.strokePath();
}

// Update function to only update existing UI elements
function updateShipUI(scene, ships, startY, playerGridX, enemyGridX) {
    ships.forEach((ship, index) => {
        if (ship.used > 0) {
            const shipY = startY + SHIP_Y_OFFSET + (index * VERTICAL_SPACING);
            
            // Find existing UI elements for both grids
            const playerElements = findShipUIElements(scene, ship, shipY, playerGridX);
            const enemyElements = findShipUIElements(scene, ship, shipY, enemyGridX);

            // Update player grid UI
            if (playerElements.text) {
                // Count destroyed player ships of this type
                const playerLostCount = placedShips
                    .filter(s => s.size === ship.size && 
                        s.tiles.every(tile => s.hits.has(`${tile.x},${tile.y}`)))
                    .length;
                
                let text = `${ship.name} x${ship.used}`;
                if (playerLostCount > 0) {
                    text += ` (-${playerLostCount})`;
                }
                playerElements.text.setText(text);

                // Update visual state if all ships of this type are destroyed
                if (playerLostCount === ship.used) {
                    playerElements.text.setTint(0x666666);
                    if (playerElements.graphics) {
                        playerElements.graphics.clear();
                        playerElements.graphics.lineStyle(1, 0x666666, 0.5);
                        playerElements.graphics.strokeRect(
                            playerGridX,
                            shipY - RECT_PADDING,
                            GRID_SIZE * GRID_DIMENSION,
                            GRID_SIZE + (RECT_PADDING * 2)
                        );
                    }
                }
            }

            // Update enemy grid UI
            if (enemyElements.text) {
                let text = `${ship.name} x${ship.used}`;
                if (ship.destroyed > 0) {
                    text += ` (-${ship.destroyed})`;
                }
                enemyElements.text.setText(text);
                
                const isFullyDestroyed = ship.destroyed === ship.used;
                if (isFullyDestroyed) {
                    enemyElements.text.setTint(0x666666);
                    if (enemyElements.graphics) {
                        enemyElements.graphics.clear();
                    }
                }
            }
        }
    });
}

// Update findShipUIElements to use identifiers
function findShipUIElements(scene, ship, shipY, gridStartX) {
    const gridType = gridStartX > config.width/2 ? 'enemy' : 'player';
    
    return {
        text: scene.children.list.find(
            child => child.getData('shipUIType') === `${gridType}-text-${ship.size}`
        ),
        graphics: scene.children.list.find(
            child => child.getData('shipUIType') === `${gridType}-rect-${ship.size}`
        )
    };
}

// Update processEnemyShot to play sounds with delay
function processEnemyShot(scene, startY, gridStartX) {
    if (gameOver) {
        if (DEBUG_MODE) {
            console.log('Game is over, no more shots allowed');
        }
        return;
    }

    enemyTurn = true;
    if (DEBUG_MODE) {
        console.log('Enemy turn starting...');
    }

    let availableShots = [];
    const shouldHuntDamagedShips = playerShipsDamaged.size > playerShipsDestroyed;

    if (shouldHuntDamagedShips) {
        if (DEBUG_MODE) {
            console.log('Hunting mode active');
        }

        // First try to continue from last successful shot
        if (lastSuccessfulShot) {
            if (!firstHitOfSequence) {
                firstHitOfSequence = {...lastSuccessfulShot};
                availableShots = getUnshotNeighbors(scene, lastSuccessfulShot.x, lastSuccessfulShot.y, gridStartX, startY);
            } else if (!currentDirection && lastSuccessfulShot !== firstHitOfSequence) {
                currentDirection = {
                    x: lastSuccessfulShot.x - firstHitOfSequence.x,
                    y: lastSuccessfulShot.y - firstHitOfSequence.y
                };
                const nextShot = {
                    x: lastSuccessfulShot.x + currentDirection.x,
                    y: lastSuccessfulShot.y + currentDirection.y
                };
                if (isValidShot(scene, nextShot, gridStartX, startY)) {
                    availableShots = [nextShot];
                }
            } else if (currentDirection) {
                const nextShot = {
                    x: lastSuccessfulShot.x + currentDirection.x,
                    y: lastSuccessfulShot.y + currentDirection.y
                };
                
                if (isValidShot(scene, nextShot, gridStartX, startY)) {
                    availableShots = [nextShot];
                } else {
                    currentDirection = {
                        x: -currentDirection.x,
                        y: -currentDirection.y
                    };
                    const oppositeShot = {
                        x: firstHitOfSequence.x + currentDirection.x,
                        y: firstHitOfSequence.y + currentDirection.y
                    };
                    
                    if (isValidShot(scene, oppositeShot, gridStartX, startY)) {
                        availableShots = [oppositeShot];
                        lastSuccessfulShot = firstHitOfSequence;
                    }
                }
            }
        }

        // If no shots available, try previous successful hits
        if (availableShots.length === 0 && enemySuccessfulShots.length > 0) {
            // Start from most recent successful hit
            for (let i = enemySuccessfulShots.length - 1; i >= 0; i--) {
                const previousHit = enemySuccessfulShots[i];
                const neighbors = getUnshotNeighbors(scene, previousHit.x, previousHit.y, gridStartX, startY);
                if (neighbors.length > 0) {
                    availableShots = neighbors;
                    firstHitOfSequence = previousHit;
                    currentDirection = null;
                    lastSuccessfulShot = previousHit;
                    break;
                }
            }
        }
    }

    // If no targeted shots available, get random shots
    if (availableShots.length === 0) {
        for (let x = 0; x < GRID_DIMENSION; x++) {
            for (let y = 0; y < GRID_DIMENSION; y++) {
                if (isValidShot(scene, {x, y}, gridStartX, startY)) {
                    availableShots.push({x, y});
                }
            }
        }
    }

    if (availableShots.length > 0) {
        const shotIndex = Math.floor(Math.random() * availableShots.length);
        const shot = availableShots[shotIndex];

        const hitShip = placedShips.find(ship => 
            ship.tiles.some(tile => tile.x === shot.x && tile.y === shot.y)
        );

        if (hitShip) {
            // Play random hit sound with delay
            scene.time.delayedCall(200, () => {
                const randomHitSound = hitSounds[Math.floor(Math.random() * hitSounds.length)];
                randomHitSound.play();
            });

            // Hit - Add explosion sprite with 0.8 alpha
            const explosion = scene.add.sprite(
                gridStartX + (shot.x * GRID_SIZE) + GRID_SIZE/2,
                startY + (shot.y * GRID_SIZE) + GRID_SIZE/2,
                'explosion'
            );
            explosion.setDisplaySize(GRID_SIZE, GRID_SIZE);
            explosion.setData('shotMarker', true);
            explosion.setAlpha(0.8);  // Set explosion alpha to 0.8

            // Track successful shot
            enemySuccessfulShots.push({...shot});
            lastSuccessfulShot = {...shot};

            hitShip.hits = hitShip.hits || new Set();
            hitShip.hits.add(`${shot.x},${shot.y}`);
            playerShipsDamaged.add(hitShip);

            const isDestroyed = hitShip.tiles.every(tile => 
                hitShip.hits.has(`${tile.x},${tile.y}`)
            );

            if (isDestroyed) {
                hitShip.sprite.setTint(0x666666);
                playerShipsDestroyed++;
                hitShip.destroyed++;

                // Play lost sound when player ship is destroyed
                scene.time.delayedCall(400, () => {
                    lostSound.play();
                });

                // Update UI using global grid positions
                updateShipUI(scene, ships, startY, playerGridX, enemyGridX);

                // Remove all tiles of destroyed ship from successful shots
                enemySuccessfulShots = enemySuccessfulShots.filter(shot => 
                    !hitShip.tiles.some(tile => 
                        tile.x === shot.x && tile.y === shot.y
                    )
                );

                // Reset targeting when ship is destroyed
                firstHitOfSequence = null;
                currentDirection = null;

                if (DEBUG_MODE) {
                    console.log('Ship destroyed - removed tiles from successful shots');
                }

                // Check for game over
                if (playerShipsDestroyed >= placedShips.length) {
                    showLossScreen(scene);
                    return;
                }
            }

            // Continue shooting
            scene.time.delayedCall(600, () => {
                processEnemyShot(scene, startY, gridStartX);
            });
        } else {
            // Play miss sound with delay
            scene.time.delayedCall(200, () => {
                missSound.play();
            });

            // Miss - Add missed shot sprite
            const missedShot = scene.add.sprite(
                gridStartX + (shot.x * GRID_SIZE) + GRID_SIZE/2,
                startY + (shot.y * GRID_SIZE) + GRID_SIZE/2,
                'missed'
            );
            missedShot.setDisplaySize(GRID_SIZE, GRID_SIZE);
            missedShot.setData('shotMarker', true);

            // On miss, end enemy turn
            enemyTurn = false;
            if (DEBUG_MODE) {
                console.log('Enemy turn ended');
            }
        }
    }

    // Increment enemy shot counter
    enemyShotCount++;
    enemyShotText.setText(`Enemy shots: ${enemyShotCount}`);
}

// Add helper function to check if a shot is valid
function isValidShot(scene, shot, gridStartX, startY) {
    if (shot.x < 0 || shot.x >= GRID_DIMENSION || 
        shot.y < 0 || shot.y >= GRID_DIMENSION) {
        return false;
    }

    const hasBeenShot = scene.children.list.some(child => 
        child.type === 'Sprite' && 
        (child.texture.key === 'missed' || child.texture.key === 'explosion') &&
        child.x === gridStartX + (shot.x * GRID_SIZE) + GRID_SIZE/2 &&
        child.y === startY + (shot.y * GRID_SIZE) + GRID_SIZE/2
    );

    return !hasBeenShot;
}

// Update placeShipOnGrid to play place sound
function placeShipOnGrid(scene, ship, startX, startY, isEnemy = false) {
    const isHorizontal = ship.rotation % 180 === 0;
    const x = ship.tiles[0].x;
    const y = ship.tiles[0].y;

    // Calculate ship position based on its size and rotation
    const shipX = startX + (x * GRID_SIZE) + (isHorizontal ? (ship.size * GRID_SIZE) / 2 : GRID_SIZE/2);
    const shipY = startY + (y * GRID_SIZE) + (!isHorizontal ? (ship.size * GRID_SIZE) / 2 : GRID_SIZE/2);

    // Create ship sprite
    const shipSprite = scene.add.sprite(shipX, shipY, `ship-${ship.size}`);
    shipSprite.setDisplaySize(GRID_SIZE * ship.size, GRID_SIZE);
    shipSprite.setAngle(ship.rotation);

    // Play place sound only for player ships
    if (!isEnemy) {
        scene.time.delayedCall(100, () => {
            placeSound.play();
        });
    }


    return {
        sprite: shipSprite,
        tiles: ship.tiles,
        size: ship.size,
        rotation: ship.rotation,
        hits: new Set()
    };
}

// Update checkVictory to use enemyPlacedShips length
function checkVictory(scene, ships) {
    // Use enemyPlacedShips length as total enemy ships
    const totalEnemyShips = enemyPlacedShips.length;
    
    if (enemyShipsDestroyed === totalEnemyShips) {
        showVictoryScreen(scene);
    }
}

// Update checkPlayerLoss to use placedShips length (already correct)
function checkPlayerLoss(scene, placedShips) {
    // Count total player ships
    const totalPlayerShips = placedShips.length;
    
    if (playerShipsDestroyed === totalPlayerShips) {
        showLossScreen(scene);
    }
}

// Add function to show victory screen
function showVictoryScreen(scene) {
    gameOver = true;
    enemyTurn = false;
    playerWins++;

    // Create semi-transparent background with high depth
    const overlay = scene.add.rectangle(
        0, 0, config.width, config.height,
        0x000000, 0.7
    );
    overlay.setOrigin(0);
    overlay.setDepth(10);  // Set high depth for overlay

    // Add victory text with high depth
    const victoryText = scene.add.text(
        config.width/2, 
        config.height/3,
        'Congratulations! You win!',
        {
            fontSize: '48px',
            fill: '#fff',
            fontStyle: 'bold'
        }
    ).setOrigin(0.5).setDepth(11);  // Set even higher depth for text

    // Add score text with high depth
    const scoreText = scene.add.text(
        config.width/2,
        config.height/2,
        `Player Wins: ${playerWins}\nComputer Wins: ${computerWins}`,
        {
            fontSize: '32px',
            fill: '#fff',
            align: 'center'
        }
    ).setOrigin(0.5).setDepth(11);

    // Add restart button with high depth
    const buttonWidth = 200;
    const buttonHeight = 50;
    const restartButton = createButton(
        scene,
        'Play Again',
        config.width/2 - buttonWidth/2,
        config.height * 2/3,
        buttonWidth,
        buttonHeight,
        0x3399ff,
        () => {
            overlay.destroy();
            victoryText.destroy();
            scoreText.destroy();
            restartButton.destroy();
            handleRestartClick(scene, startY, gridStartX, gridStartY);
        }
    );
    
    // Set high depth for all button elements
    restartButton.hitZone.setDepth(11);
    if (restartButton.graphics) restartButton.graphics.setDepth(11);
    if (restartButton.text) restartButton.text.setDepth(11);

    // Play win sound
    winSound.play();
}

// Update showLossScreen to set higher depth for overlay elements
function showLossScreen(scene) {
    gameOver = true;
    enemyTurn = false;
    firstHitOfSequence = null;
    currentDirection = null;
    lastSuccessfulShot = null;
    computerWins++;

    // Reveal all enemy ships by setting alpha to 1, keeping existing tints for hit ships
    enemyPlacedShips.forEach(ship => {
        ship.sprite.setAlpha(1);
    });

    // Create semi-transparent background with high depth
    const overlay = scene.add.rectangle(
        0, 0, config.width, config.height,
        0x000000, 0.7
    );
    overlay.setOrigin(0);
    overlay.setDepth(10);  // Set high depth for overlay

    // Add loss text with high depth
    const lossText = scene.add.text(
        config.width/2, 
        config.height/3,
        'Game Over - Computer Wins!',
        {
            fontSize: '48px',
            fill: '#ff0000',
            fontStyle: 'bold'
        }
    ).setOrigin(0.5).setDepth(11);  // Set even higher depth for text

    // Add score text with high depth
    const scoreText = scene.add.text(
        config.width/2,
        config.height/2,
        `Player Wins: ${playerWins}\nComputer Wins: ${computerWins}`,
        {
            fontSize: '32px',
            fill: '#fff',
            align: 'center'
        }
    ).setOrigin(0.5).setDepth(11);

    // Add restart button with high depth
    const buttonWidth = 200;
    const buttonHeight = 50;
    const restartButton = createButton(
        scene,
        'Try Again',
        config.width/2 - buttonWidth/2,
        config.height * 2/3,
        buttonWidth,
        buttonHeight,
        0xff3333,
        () => {
            overlay.destroy();
            lossText.destroy();
            scoreText.destroy();
            restartButton.destroy();
            handleRestartClick(scene, startY, gridStartX, gridStartY);
        }
    );
    
    // Set high depth for all button elements
    restartButton.hitZone.setDepth(11);
    if (restartButton.graphics) restartButton.graphics.setDepth(11);
    if (restartButton.text) restartButton.text.setDepth(11);

    // Play game over sound
    gameOverSound.play();
}

// Add function to get unshot neighbor tiles
function getUnshotNeighbors(scene, x, y, startX, startY) {
    const neighbors = [
        {x: x-1, y: y},   // left
        {x: x+1, y: y},   // right
        {x: x, y: y-1},   // up
        {x: x, y: y+1}    // down
    ];

    // Filter valid and unshot neighbors
    return neighbors.filter(pos => {
        // Check if position is within grid bounds
        if (pos.x < 0 || pos.x >= GRID_DIMENSION || 
            pos.y < 0 || pos.y >= GRID_DIMENSION) {
            return false;
        }

        // Check if this tile has been shot before
        const hasBeenShot = scene.children.list.some(child => 
            child.type === 'Sprite' && 
            (child.texture.key === 'missed' || child.texture.key === 'explosion') &&
            child.x === startX + (pos.x * GRID_SIZE) + GRID_SIZE/2 &&
            child.y === startY + (pos.y * GRID_SIZE) + GRID_SIZE/2
        );

        return !hasBeenShot;
    });
}

// Update splitSpace to create more usable sections
function splitSpace(space, minSize) {
    // Don't split if space is too small
    if (space.width < minSize * 2 || space.height < minSize * 2) {
        return [space];
    }

    const spaces = [];
    // Randomly choose split direction (horizontal or vertical)
    const splitHorizontal = Math.random() < 0.5;

    if (splitHorizontal) {
        // Split horizontally
        const splitPoint = Math.floor(space.height / 2);
        spaces.push(
            { x: space.x, y: space.y, width: space.width, height: splitPoint },
            { x: space.x, y: space.y + splitPoint, width: space.width, height: space.height - splitPoint }
        );
    } else {
        // Split vertically
        const splitPoint = Math.floor(space.width / 2);
        spaces.push(
            { x: space.x, y: space.y, width: splitPoint, height: space.height },
            { x: space.x + splitPoint, y: space.y, width: space.width - splitPoint, height: space.height }
        );
    }

    return spaces;
}

// Update placeEnemyShipsRandomly to use spaced placement strategy
function placeEnemyShipsRandomly(scene, enemyGridX, gridStartY, playerShips) {
    enemyPlacedShips = [];
    
    // Sort ships by size (largest first)
    const shipsToPlace = playerShips
        .map(ship => ({
            size: ship.size,
            rotation: Math.random() < 0.5 ? 0 : 90
        }))
        .sort((a, b) => b.size - a.size);

    if (DEBUG_MODE) {
        console.log('Starting enemy ship placement with ships:', 
            shipsToPlace.map(s => ({ size: s.size, rotation: s.rotation })));
    }

    // Try to place each ship
    for (const ship of shipsToPlace) {
        let placed = false;
        let attempts = 0;
        const maxSpacedAttempts = 100;  // First try with spacing

        // First try with spacing
        while (!placed && attempts < maxSpacedAttempts) {
            const x = Math.floor(Math.random() * GRID_DIMENSION);
            const y = Math.floor(Math.random() * GRID_DIMENSION);
            const isHorizontal = ship.rotation === 0;

            if (isValidEnemyShipPlacement(x, y, ship.size, isHorizontal, false)) {  // Try with spacing
                placed = tryPlaceEnemyShipAt(scene, ship, x, y, isHorizontal, enemyGridX, gridStartY);
                if (DEBUG_MODE && placed) {
                    console.log(`Placed enemy ship size ${ship.size} with spacing at (${x},${y})`);
                }
            }
            attempts++;
        }

        // If spaced placement failed, try without spacing
        if (!placed) {
            if (DEBUG_MODE) {
                console.log(`Failed to place enemy ship size ${ship.size} with spacing, trying without spacing`);
            }

            attempts = 0;
            const maxAdjacentAttempts = 100;

            while (!placed && attempts < maxAdjacentAttempts) {
                const x = Math.floor(Math.random() * GRID_DIMENSION);
                const y = Math.floor(Math.random() * GRID_DIMENSION);
                const isHorizontal = ship.rotation === 0;

                if (isValidEnemyShipPlacement(x, y, ship.size, isHorizontal, true)) {  // Allow adjacent
                    placed = tryPlaceEnemyShipAt(scene, ship, x, y, isHorizontal, enemyGridX, gridStartY);
                    if (DEBUG_MODE && placed) {
                        console.log(`Placed enemy ship size ${ship.size} without spacing at (${x},${y})`);
                    }
                }
                attempts++;
            }

            if (!placed && DEBUG_MODE) {
                console.log(`Failed to place enemy ship size ${ship.size} after all attempts`);
            }
        }
    }
}

// Helper function to try placing an enemy ship at specific coordinates
function tryPlaceEnemyShipAt(scene, ship, x, y, isHorizontal, gridStartX, gridStartY) {
    const tiles = [];
    for (let i = 0; i < ship.size; i++) {
        tiles.push({
            x: x + (isHorizontal ? i : 0),
            y: y + (!isHorizontal ? i : 0)
        });
    }

    const placedShip = placeShipOnGrid(scene, {
        tiles,
        size: ship.size,
        rotation: ship.rotation
    }, gridStartX, gridStartY, true);

    // Always set alpha to 0 initially (completely invisible)
    placedShip.sprite.setAlpha(0);

    enemyPlacedShips.push(placedShip);

    if (DEBUG_MODE) {
        console.log('Enemy ship placement successful:', {
            size: ship.size,
            position: `(${x}, ${y})`,
            orientation: isHorizontal ? 'horizontal' : 'vertical',
            rotation: ship.rotation
        });
    }

    return true;
}

// Add helper function to check if enemy ship placement is valid
function isValidEnemyShipPlacement(x, y, size, isHorizontal, allowAdjacent = false) {
    // Check if ship fits within grid
    if (isHorizontal) {
        if (x + size > GRID_DIMENSION) return false;
    } else {
        if (y + size > GRID_DIMENSION) return false;
    }

    // Check for overlaps with existing ships
    for (let i = 0; i < size; i++) {
        const checkX = x + (isHorizontal ? i : 0);
        const checkY = y + (!isHorizontal ? i : 0);

        // Check if any existing ship occupies this tile
        if (enemyPlacedShips.some(ship => 
            ship.tiles.some(tile => 
                tile.x === checkX && tile.y === checkY
            )
        )) {
            return false;
        }

        // Check adjacent tiles only if spacing is required
        if (!allowAdjacent) {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const adjacentX = checkX + dx;
                    const adjacentY = checkY + dy;
                    
                    if (adjacentX >= 0 && adjacentX < GRID_DIMENSION && 
                        adjacentY >= 0 && adjacentY < GRID_DIMENSION) {
                        if (enemyPlacedShips.some(ship => 
                            ship.tiles.some(tile => 
                                tile.x === adjacentX && tile.y === adjacentY
                            )
                        )) {
                            return false;
                        }
                    }
                }
            }
        }
    }

    return true;
}

// Update placePlayerShipsRandomly to try spaced placement first
function placePlayerShipsRandomly(scene, gridStartX, gridStartY) {
    // Clear existing ships first
    placedShips.forEach(ship => ship.sprite.destroy());
    placedShips = [];

    // Get available ships, expanding array based on amount
    const shipsToPlace = ships
        .filter(ship => ship.amount > 0)
        .flatMap(ship => Array(ship.amount).fill({
            size: ship.size,
            rotation: Math.random() < 0.5 ? 0 : 90,
            originalShip: ship
        }))
        .sort((a, b) => b.size - a.size);

    if (DEBUG_MODE) {
        console.log('Starting random ship placement with ships:', 
            shipsToPlace.map(s => ({ size: s.size, rotation: s.rotation })));
    }

    // Try to place ships with spacing first
    for (const ship of shipsToPlace) {
        let placed = false;
        let attempts = 0;
        const maxSpacedAttempts = 100;  // Reduced attempts for spaced placement

        // First try with spacing
        while (!placed && attempts < maxSpacedAttempts) {
            const x = Math.floor(Math.random() * GRID_DIMENSION);
            const y = Math.floor(Math.random() * GRID_DIMENSION);
            const isHorizontal = ship.rotation === 0;

            if (isValidPlayerShipPlacement(x, y, ship.size, isHorizontal, false)) {  // Try with spacing
                placed = tryPlaceShipAt(scene, ship, x, y, isHorizontal, gridStartX, gridStartY);
                if (DEBUG_MODE && placed) {
                    console.log(`Placed ship size ${ship.size} with spacing at (${x},${y})`);
                }
            }
            attempts++;
        }

        // If spaced placement failed, try without spacing
        if (!placed) {
            if (DEBUG_MODE) {
                console.log(`Failed to place ship size ${ship.size} with spacing, trying without spacing`);
            }

            attempts = 0;
            const maxAdjacentAttempts = 100;

            while (!placed && attempts < maxAdjacentAttempts) {
                const x = Math.floor(Math.random() * GRID_DIMENSION);
                const y = Math.floor(Math.random() * GRID_DIMENSION);
                const isHorizontal = ship.rotation === 0;

                if (isValidPlayerShipPlacement(x, y, ship.size, isHorizontal, true)) {  // Allow adjacent
                    placed = tryPlaceShipAt(scene, ship, x, y, isHorizontal, gridStartX, gridStartY);
                    if (DEBUG_MODE && placed) {
                        console.log(`Placed ship size ${ship.size} without spacing at (${x},${y})`);
                    }
                }
                attempts++;
            }

            if (!placed && DEBUG_MODE) {
                console.log(`Failed to place ship size ${ship.size} after all attempts`);
            }
        }
    }
}

// Helper function to try placing a ship at specific coordinates
function tryPlaceShipAt(scene, ship, x, y, isHorizontal, gridStartX, gridStartY) {
    const tiles = [];
    for (let i = 0; i < ship.size; i++) {
        tiles.push({
            x: x + (isHorizontal ? i : 0),
            y: y + (!isHorizontal ? i : 0)
        });
    }

    const placedShip = placeShipOnGrid(scene, {
        tiles,
        size: ship.size,
        rotation: ship.rotation
    }, gridStartX, gridStartY);

    placedShips.push(placedShip);

    // Update ship inventory
    ship.originalShip.amount--;
    ship.originalShip.used++;
    scene.events.emit('shipPlaced', ships.indexOf(ship.originalShip));

    return true;
}

// Add helper function to check if player ship placement is valid
function isValidPlayerShipPlacement(x, y, size, isHorizontal, allowAdjacent = false) {
    // Check if ship fits within grid
    if (isHorizontal) {
        if (x + size > GRID_DIMENSION) return false;
    } else {
        if (y + size > GRID_DIMENSION) return false;
    }

    // Check for overlaps with existing ships
    for (let i = 0; i < size; i++) {
        const checkX = x + (isHorizontal ? i : 0);
        const checkY = y + (!isHorizontal ? i : 0);

        // Check if any existing ship occupies this tile
        if (placedShips.some(ship => 
            ship.tiles.some(tile => 
                tile.x === checkX && tile.y === checkY
            )
        )) {
            return false;
        }

        // Check adjacent tiles only if spacing is required
        if (!allowAdjacent) {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const adjacentX = checkX + dx;
                    const adjacentY = checkY + dy;
                    
                    if (adjacentX >= 0 && adjacentX < GRID_DIMENSION && 
                        adjacentY >= 0 && adjacentY < GRID_DIMENSION) {
                        if (placedShips.some(ship => 
                            ship.tiles.some(tile => 
                                tile.x === adjacentX && tile.y === adjacentY
                            )
                        )) {
                            return false;
                        }
                    }
                }
            }
        }
    }

    return true;
}

// Add handleShot function to process player shots
function handleShot(scene, x, y, startX, startY, isHit) {
    if (gameOver || enemyTurn) {
        if (DEBUG_MODE) {
            console.log(gameOver ? 'Game is over, no more shots allowed' : 'Cannot shoot during enemy turn');
        }
        return;
    }

    // Increment player shot counter
    playerShotCount++;
    playerShotText.setText(`Player shots: ${playerShotCount}`);

    if (isHit) {
        const hitShip = enemyPlacedShips.find(ship => 
            ship.tiles.some(tile => tile.x === x && tile.y === y)
        );

        if (hitShip) {
            // Play random hit sound with delay
            scene.time.delayedCall(200, () => {
                const randomHitSound = hitSounds[Math.floor(Math.random() * hitSounds.length)];
                randomHitSound.play();
            });

            // Add explosion sprite with 0.8 alpha
            const explosion = scene.add.sprite(
                startX + (x * GRID_SIZE) + GRID_SIZE/2,
                startY + (y * GRID_SIZE) + GRID_SIZE/2,
                'explosion'
            );
            explosion.setDisplaySize(GRID_SIZE, GRID_SIZE);
            explosion.setData('shotMarker', true);
            explosion.setAlpha(0.8);  // Set explosion alpha to 0.8

            // Track hit
            hitShip.hits = hitShip.hits || new Set();
            hitShip.hits.add(`${x},${y}`);

            const isDestroyed = hitShip.tiles.every(tile => 
                hitShip.hits.has(`${tile.x},${tile.y}`)
            );

            if (isDestroyed) {
                // Make ship fully visible and tint it
                hitShip.sprite.setAlpha(1);
                hitShip.sprite.setTint(0x999999);
                enemyShipsDestroyed++;

                // Find matching ship type and update destroyed count
                const shipType = ships.find(s => s.size === hitShip.size);
                if (shipType) {
                    shipType.destroyed++;
                    
                    // Update UI using global grid positions
                    updateShipUI(scene, ships, startY, playerGridX, enemyGridX);

                    // Check for victory after updating UI
                    checkVictory(scene, ships);
                }

                // Play sunk sound when enemy ship is destroyed
                scene.time.delayedCall(400, () => {
                    sunkSound.play();
                });
            }
        }
    } else {
        // Play miss sound with delay
        scene.time.delayedCall(200, () => {
            missSound.play();
        });

        // Add missed shot sprite
        const missedShot = scene.add.sprite(
            startX + (x * GRID_SIZE) + GRID_SIZE/2,
            startY + (y * GRID_SIZE) + GRID_SIZE/2,
            'missed-dark'
        );
        missedShot.setDisplaySize(GRID_SIZE, GRID_SIZE);
        missedShot.setData('shotMarker', true);

        // After player misses, enemy gets a turn
        processEnemyShot(scene, startY, playerGridX);
    }
}

// Update tryPlaceShip function to include debug logging
function tryPlaceShip(scene, x, y, startX, startY) {
    if (!followingSprite || !selectedShip) {
        if (DEBUG_MODE) console.log('No ship selected for placement');
        return false;
    }

    const isHorizontal = currentRotation % 180 === 0;
    const shipLength = selectedShip.size;
    
    if (DEBUG_MODE) {
        console.log(`Attempting to place ship:`, {
            size: shipLength,
            position: `(${x}, ${y})`,
            orientation: isHorizontal ? 'horizontal' : 'vertical',
            rotation: currentRotation
        });
    }
    
    // Check if ship fits within grid bounds
    const fitsHorizontally = x + shipLength <= GRID_DIMENSION;
    const fitsVertically = y + shipLength <= GRID_DIMENSION;
    const canPlace = isHorizontal ? fitsHorizontally : fitsVertically;

    if (DEBUG_MODE && !canPlace) {
        console.log(`Ship doesn't fit:`, {
            fitsHorizontally,
            fitsVertically,
            gridSize: GRID_DIMENSION,
            requiredSpace: shipLength
        });
    }

    // Check for collisions with other ships
    const wouldCollide = checkShipCollision(x, y, shipLength, isHorizontal);

    if (DEBUG_MODE && wouldCollide) {
        console.log('Ship placement blocked by collision');
    }

    if (canPlace && !wouldCollide) {
        if (DEBUG_MODE) {
            console.log('Ship placement successful:', {
                size: shipLength,
                position: `(${x}, ${y})`,
                orientation: isHorizontal ? 'horizontal' : 'vertical',
                rotation: currentRotation,
                remainingShips: ships[selectedShip.index].amount - 1
            });
        }

        // ... rest of placement code ...

        return true;
    }

    return false;
} 

// Update checkShipCollision function to be more lenient
function checkShipCollision(x, y, size, isHorizontal) {
    // Check each tile the ship would occupy
    for (let i = 0; i < size; i++) {
        const checkX = x + (isHorizontal ? i : 0);
        const checkY = y + (!isHorizontal ? i : 0);

        // Skip if outside grid
        if (checkX < 0 || checkX >= GRID_DIMENSION || 
            checkY < 0 || checkY >= GRID_DIMENSION) {
            return true;
        }

        // Check if any existing ship occupies this tile
        if (placedShips.some(ship => 
            ship.tiles.some(tile => 
                tile.x === checkX && tile.y === checkY
            )
        )) {
            return true;
        }

        // Check only orthogonally adjacent tiles (no diagonals)
        const adjacentPositions = [
            {x: checkX - 1, y: checkY},  // left
            {x: checkX + 1, y: checkY},  // right
            {x: checkX, y: checkY - 1},  // up
            {x: checkX, y: checkY + 1}   // down
        ];

        for (const pos of adjacentPositions) {
            // Skip if outside grid
            if (pos.x < 0 || pos.x >= GRID_DIMENSION || 
                pos.y < 0 || pos.y >= GRID_DIMENSION) {
                continue;
            }

            // Check if any ship occupies adjacent tile
            if (placedShips.some(ship => 
                ship.tiles.some(tile => 
                    tile.x === pos.x && tile.y === pos.y
                )
            )) {
                return true;
            }
        }
    }

    return false;
} 