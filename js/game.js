const config = {
    type: Phaser.AUTO,
    width: 1024,
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

const GRID_SIZE = 32; // Changed from 40 to 32
const GRID_DIMENSION = 10; // 10x10 grid
const GRID_SPACING = 40; // Reduced spacing between grids for better fit

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
}

function create() {
    // Add debug info to check if assets loaded
    if (!this.textures.exists('water') || !this.textures.exists('water-dark')) {
        console.error('Water textures not loaded properly');
        // Add fallback color rectangles if images fail to load
        this.add.rectangle(0, 0, GRID_SIZE, GRID_SIZE, 0x0000ff);
        return;
    }
    
    // Remove the hello world text
    
    // Calculate starting positions for both grids
    const totalGridWidth = GRID_SIZE * GRID_DIMENSION;
    const startX1 = (config.width - (totalGridWidth * 2 + GRID_SPACING)) / 2;
    const startX2 = startX1 + totalGridWidth + GRID_SPACING;
    const startY = (config.height - totalGridWidth) / 4;

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
        }
    });
}

function createGrid(scene, startX, startY, title, isEnemy = false) {
    // Add title above coordinates
    scene.add.text(startX + (GRID_SIZE * GRID_DIMENSION) / 2, startY - 45, title, {
        fontSize: '20px',
        fill: '#fff'
    }).setOrigin(0.5);

    // Add water background tiles first
    for (let x = 0; x < GRID_DIMENSION; x++) {
        for (let y = 0; y < GRID_DIMENSION; y++) {
            const sprite = scene.add.sprite(
                startX + (x * GRID_SIZE) + GRID_SIZE/2,
                startY + (y * GRID_SIZE) + GRID_SIZE/2,
                isEnemy ? 'water-dark' : 'water'
            );
            sprite.setDisplaySize(GRID_SIZE, GRID_SIZE);
        }
    }

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

    // Add coordinates
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

    // Create container for tile highlights - moved to end to be on top
    const highlightGraphics = scene.add.graphics();

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

            // Add hover effects
            tileZone.on('pointerover', () => {
                highlightGraphics.clear();
                
                // Choose color based on grid type and whether a ship is selected
                let highlightColor = 0xffd700; // Default gold
                if (followingSprite) {
                    highlightColor = isEnemy ? 0xff0000 : 0x00ff00; // Red for enemy, green for player
                }
                
                highlightGraphics.fillStyle(highlightColor, 0.3);
                highlightGraphics.fillRect(
                    startX + (x * GRID_SIZE),
                    startY + (y * GRID_SIZE),
                    GRID_SIZE,
                    GRID_SIZE
                );
            });

            tileZone.on('pointerout', () => {
                highlightGraphics.clear();
            });
        }
    }
}

function createShipSelection(scene, gridStartX, gridStartY, startY) {
    const gridWidth = GRID_SIZE * GRID_DIMENSION;
    
    // Center the "Player Ships:" label under the grid
    const labelText = scene.add.text(gridStartX + gridWidth/2, startY, 'Player Ships:', {
        fontSize: '20px',
        fill: '#fff'
    }).setOrigin(0.5, 0);

    // Ship configurations
    ships = [
        { size: 1, name: 'Patrol Boat', amount: 5, used: 0 },
        { size: 2, name: 'Submarine', amount: 4, used: 0 },
        { size: 3, name: 'Cruiser', amount: 3, used: 0 },
        { size: 4, name: 'Battleship', amount: 2, used: 0 },
        { size: 5, name: 'Carrier', amount: 1, used: 0 }
    ];

    const verticalSpacing = 50;
    const shipYOffset = 32;
    const textPadding = 10;

    ships.forEach((ship, index) => {
        const shipY = startY + shipYOffset + (index * verticalSpacing);
        
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
            gridStartX + (ship.size * GRID_SIZE) + textPadding,
            shipY + GRID_SIZE/2,
            ship.name + ' (x' + ship.amount + ')',
            {
                fontSize: '16px',
                fill: '#fff'
            }
        ).setOrigin(0, 0.5);

        // Create interactive rectangle zone
        const rectPadding = 5;
        const hitZone = scene.add.rectangle(
            gridStartX + gridWidth/2,
            shipY + GRID_SIZE/2,
            gridWidth,
            GRID_SIZE + (rectPadding * 2)
        );
        hitZone.setInteractive();

        // Add rectangle graphics for outline and hover effect
        const shipRect = scene.add.graphics();
        
        function drawRect(color = 0xffffff, alpha = 1) {
            shipRect.clear();
            shipRect.lineStyle(1, color, alpha);
            shipRect.strokeRect(
                gridStartX,
                shipY - rectPadding,
                gridWidth,
                GRID_SIZE + (rectPadding * 2)
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
    });
}

function update() {
    // No need for additional update logic as we're using event handlers
} 