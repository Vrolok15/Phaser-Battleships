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

    // Add ship selection area below grids
    const shipY = startY + (GRID_DIMENSION * GRID_SIZE) + 32; // 40px padding below grids
    createShipSelection(this, config.width / 3, shipY);
}

function createGrid(scene, startX, startY, title, isEnemy = false) {
    // Add title above coordinates
    scene.add.text(startX + (GRID_SIZE * GRID_DIMENSION) / 2, startY - 45, title, {
        fontSize: '20px',
        fill: '#fff'
    }).setOrigin(0.5);

    // Add water background tiles
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

    // Create graphics object for grid
    const graphics = scene.add.graphics();
    
    // Set line style
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

    // Add grid coordinates
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
}

function createShipSelection(scene, centerX, startY) {
    // Add "Ships:" label
    const labelX = centerX - 300;
    scene.add.text(labelX, startY, 'Ships:', {
        fontSize: '20px',
        fill: '#fff'
    });

    // Ship configurations
    const ships = [
        { size: 1, name: 'Patrol Boat', amount: 5, used: 0 },
        { size: 2, name: 'Submarine', amount: 4, used: 0 },
        { size: 3, name: 'Cruiser', amount: 3, used: 0 },
        { size: 4, name: 'Battleship', amount: 2, used: 0 },
        { size: 5, name: 'Carrier', amount: 1, used: 0 }
    ];


    // Display ships vertically aligned to the left
    const shipStartX = labelX;
    const verticalSpacing = 50;
    const shipYOffset = 32;

    ships.forEach((ship, index) => {
        const shipY = startY + shipYOffset + (index * verticalSpacing);
        
        // Add ship sprite
        const sprite = scene.add.sprite(
            shipStartX + (ship.size * GRID_SIZE) / 2,
            shipY + GRID_SIZE/2,
            `ship-${ship.size}`
        );
        
        // Scale ship to match grid size
        sprite.setDisplaySize(GRID_SIZE * ship.size, GRID_SIZE);

        // Add ship name to the right of the ship
        scene.add.text(
            shipStartX + (ship.size * GRID_SIZE) + 10,
            shipY + GRID_SIZE/2, // Align with center of ship
            ship.name + ' (x' + ship.amount + ')',
            {
                fontSize: '16px',
                fill: '#fff'
            }
        ).setOrigin(0, 0.5);

        // Make ship interactive
        sprite.setInteractive();
        
        // Add hover effect
        sprite.on('pointerover', function() {
            this.setTint(0x66ff66);
        });
        
        sprite.on('pointerout', function() {
            this.clearTint();
        });
    });
}

function update() {
    // Game loop updates here
} 