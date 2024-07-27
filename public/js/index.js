// Global Constants
var DEBUG_MODE = localStorage.getItem('DEBUG_MODE') === 'true';
var CONST = {};
CONST.AVAILABLE_SHIPS = ['carrier', 'battleship', 'destroyer', 'submarine', 'patrolboat'];
// You are player 0 and the computer is player 1
// The virtual player is used for generating temporary ships
// for calculating the probability heatmap
CONST.HUMAN_PLAYER = 0;
CONST.COMPUTER_PLAYER = 1;
CONST.VIRTUAL_PLAYER = 2;

CONST.CSS_TYPE_EMPTY = 'empty';
CONST.CSS_TYPE_SHIP = 'ship';
CONST.CSS_TYPE_MISS = 'miss';
CONST.CSS_TYPE_HIT = 'hit';
CONST.CSS_TYPE_SUNK = 'sunk';
CONST.CSS_TYPE_REVEAL = 'reveal';

// Grid code:
CONST.TYPE_EMPTY = 0; // 0 = water (empty)
CONST.TYPE_SHIP = 1; // 1 = undamaged ship
CONST.TYPE_MISS = 2; // 2 = water with a cannonball in it (missed shot)
CONST.TYPE_HIT = 3; // 3 = damaged ship (hit shot)
CONST.TYPE_SUNK = 4; // 4 = sunk ship
CONST.TYPE_REVEAL = 5; // 5 = missed ships at the end of the game

Game.usedShips = [CONST.UNUSED, CONST.UNUSED, CONST.UNUSED, CONST.UNUSED, CONST.UNUSED];
CONST.USED = 1;
CONST.UNUSED = 0;

// Game Statistics
class Stats {
      constructor() {
            this.shotsTaken = 0;
            this.shotsHit = 0;
            this.totalShots = +localStorage.getItem('totalShots') || 0;
            this.totalHits = +localStorage.getItem('totalHits') || 0;
            this.gamesPlayed = +localStorage.getItem('gamesPlayed') || 0;
            this.gamesWon = +localStorage.getItem('gamesWon') || 0;
            this.uuid = localStorage.getItem('uuid') || this.createUUID();
            this.skipCurrentGame = DEBUG_MODE ? true : false;
      }

      incrementShots() {
            this.shotsTaken++;
      }

      hitShot() {
            this.shotsHit++;
      }

      wonGame() {
            this.gamesPlayed++;
            this.gamesWon++;
      }

      lostGame() {
            this.gamesPlayed++;
      }

      syncStats() {
            if (!this.skipCurrentGame) {
                  this.totalShots += this.shotsTaken;
                  this.totalHits += this.shotsHit;
                  localStorage.setItem('totalShots', this.totalShots);
                  localStorage.setItem('totalHits', this.totalHits);
                  localStorage.setItem('gamesPlayed', this.gamesPlayed);
                  localStorage.setItem('gamesWon', this.gamesWon);
                  localStorage.setItem('uuid', this.uuid);
            } else {
                  this.skipCurrentGame = false;
            }
      }

      updateStatsSidebar() {
            document.getElementById('stats-wins').innerText = `${this.gamesWon} of ${this.gamesPlayed}`;
            document.getElementById('stats-accuracy').innerText = `${Math.round((100 * this.totalHits / this.totalShots) || 0)}%`;
      }

      resetStats() {
            this.skipCurrentGame = true;
            localStorage.setItem('totalShots', 0);
            localStorage.setItem('totalHits', 0);
            localStorage.setItem('gamesPlayed', 0);
            localStorage.setItem('gamesWon', 0);
            localStorage.setItem('showTutorial', true);
            this.shotsTaken = this.shotsHit = this.totalShots = this.totalHits = this.gamesPlayed = this.gamesWon = 0;
            this.updateStatsSidebar();
      }

      createUUID(len = 36, radix = 16) {
            const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
            let uuid = [];
            for (let i = 0; i < len; i++) {
                  uuid[i] = chars[0 | Math.random() * radix];
            }
            uuid[14] = '4';
            uuid[19] = chars[(parseInt(uuid[19], 16) & 0x3) | 0x8];
            return uuid.join('');
      }
}

function Game(size) {
      Game.size = size;
      this.shotsTaken = 0;
      this.createGrid();
      this.init();
}
Game.size = 10; // Default grid size is 10x10
Game.gameOver = false;
// Checks if the game is won, and if it is, re-initializes the game
Game.prototype.checkIfWon = function () {
      if (this.computerFleet.allShipsSunk()) {
            alert('Congratulations, you win!');
            Game.gameOver = true;
            Game.stats.wonGame();
            Game.stats.syncStats();
            Game.stats.updateStatsSidebar();
            this.showRestartSidebar();
      } else if (this.humanFleet.allShipsSunk()) {
            alert('Yarr! The computer sank all your ships. Try again.');
            Game.gameOver = true;
            Game.stats.lostGame();
            Game.stats.syncStats();
            Game.stats.updateStatsSidebar();
            this.revealComputerShips();
            this.showRestartSidebar();
      }
};

Game.prototype.revealComputerShips = function () {
      const computerShips = this.computerFleet.fleetRoster;

      computerShips.forEach(ship => {
            const shipCells = ship.getAllShipCells();
            shipCells.forEach(cell => {
                  if (this.computerGrid.cells[cell.x][cell.y] != CONST.TYPE_HIT) {
                        this.computerGrid.updateCell(cell.x, cell.y, 'reveal', CONST.COMPUTER_PLAYER);
                  }
            });
      });
};


// Shoots at the target player on the grid.
// Returns {int} Constants.TYPE: What the shot uncovered
Game.prototype.shoot = function (x, y, targetPlayer) {
      let targetGrid;
      let targetFleet;

      switch (targetPlayer) {
            case CONST.HUMAN_PLAYER:
                  targetGrid = this.humanGrid;
                  targetFleet = this.humanFleet;
                  break;
            case CONST.COMPUTER_PLAYER:
                  targetGrid = this.computerGrid;
                  targetFleet = this.computerFleet;
                  break;
            default:
                  console.error("There was an error trying to find the correct player to target");
                  return null;
      }

      if (targetGrid.isDamagedShip(x, y) || targetGrid.isMiss(x, y)) {
            return null;
      }

      if (targetGrid.isUndamagedShip(x, y)) {
            // update the board/grid
            targetGrid.updateCell(x, y, 'hit', targetPlayer);
            // Increase the damage after updating the cell
            targetFleet.findShipByCoords(x, y).incrementDamage();
            this.checkIfWon();
            return CONST.TYPE_HIT;
      } else {
            targetGrid.updateCell(x, y, 'miss', targetPlayer);
            this.checkIfWon();
            return CONST.TYPE_MISS;
      }
};

// Creates click event listeners on each one of the 100 grid cells
Game.prototype.shootListener = function (e) {
      const self = e.target.self;
      // Extract coordinates from event listener
      const x = parseInt(e.target.getAttribute('data-x'), 10);
      const y = parseInt(e.target.getAttribute('data-y'), 10);

      if (self.readyToPlay) {
            const result = self.shoot(x, y, CONST.COMPUTER_PLAYER);

            if (result !== null && !Game.gameOver) {
                  Game.stats.incrementShots();
                  if (result === CONST.TYPE_HIT) {
                        Game.stats.hitShot();
                  }
                  // The AI shoots only if the player clicks on a cell that hasn't been clicked yet
                  self.robot.shoot();
            } else {
                  Game.gameOver = false;
            }
      }
};

// Creates click event listeners on each of the ship names in the roster
Game.prototype.rosterListener = function (e) {
      var self = e.target.self;
      // Remove all classes of 'placing' from the fleet roster first
      var roster = document.querySelectorAll('.fleet-roster li');
      for (var i = 0; i < roster.length; i++) {
            var classes = roster[i].getAttribute('class') || '';
            classes = classes.replace('placing', '');
            roster[i].setAttribute('class', classes);
      }

      // Set the class of the target ship to 'placing'
      Game.placeShipType = e.target.getAttribute('id');
      document.getElementById(Game.placeShipType).setAttribute('class', 'placing');
      Game.placeShipDirection = parseInt(document.getElementById('rotate-button').getAttribute('data-direction'), 10);
      self.placingOnGrid = true;
};
// Creates click event listeners on the human player's grid to handle
// ship placement after the user has selected a ship name
Game.prototype.placementListener = function (e) {
      const self = e.target.self;
      if (self.placingOnGrid) {
            // Extract coordinates from event listener
            const x = parseInt(e.target.getAttribute('data-x'), 10);
            const y = parseInt(e.target.getAttribute('data-y'), 10);

            // Attempt to place the ship
            const successful = self.humanFleet.placeShip(x, y, Game.placeShipDirection, Game.placeShipType);
            if (successful) {
                  // End placing this ship
                  self.endPlacing(Game.placeShipType);


                  self.placingOnGrid = false;

                  if (self.areAllShipsPlaced()) {
                        const el = document.getElementById('rotate-button');
                        const onTransitionEnd = function () {
                              el.setAttribute('class', 'hidden');

                              document.getElementById('start-game').removeAttribute('class');
                        };
                        el.addEventListener(transitionEndEventName(), onTransitionEnd, { once: true });
                        el.setAttribute('class', 'invisible');
                  }
            }
      }
};

Game.prototype.placementMouseover = function (e) {
      const self = e.target.self;
      if (self.placingOnGrid) {
            const x = parseInt(e.target.getAttribute('data-x'), 10);
            const y = parseInt(e.target.getAttribute('data-y'), 10);

            self.humanFleet.fleetRoster.forEach(ship => {
                  if (Game.placeShipType === ship.type && ship.isLegal(x, y, Game.placeShipDirection)) {
                        ship.create(x, y, Game.placeShipDirection, true);
                        Game.placeShipCoords = ship.getAllShipCells();

                        Game.placeShipCoords.forEach(coord => {
                              const el = document.querySelector(`.grid-cell-${coord.x}-${coord.y}`);
                              let classes = el.getAttribute('class');
                              if (!classes.includes(' grid-ship')) {
                                    classes += ' grid-ship';
                                    el.setAttribute('class', classes);
                              }
                        });
                  }
            });
      }
};


Game.prototype.placementMouseout = function (e) {
      const self = e.target.self;
      if (self.placingOnGrid) {
            Game.placeShipCoords.forEach(coord => {
                  const el = document.querySelector(`.grid-cell-${coord.x}-${coord.y}`);
                  const classes = el.getAttribute('class').replace(' grid-ship', '');
                  el.setAttribute('class', classes);
            });
      }
};

// Click handler for the Rotate Ship button
Game.prototype.toggleRotation = function (e) {
      // Toggle rotation direction
      var direction = parseInt(e.target.getAttribute('data-direction'), 10);
      if (direction === Ship.DIRECTION_VERTICAL) {
            e.target.setAttribute('data-direction', '1');
            Game.placeShipDirection = Ship.DIRECTION_HORIZONTAL;
      } else if (direction === Ship.DIRECTION_HORIZONTAL) {
            e.target.setAttribute('data-direction', '0');
            Game.placeShipDirection = Ship.DIRECTION_VERTICAL;
      }
};
// Click handler for the Start Game button
Game.prototype.startGame = function (e) {
      var self = e.target.self;
      var el = document.getElementById('roster-sidebar');
      var fn = function () { el.setAttribute('class', 'hidden'); };
      el.addEventListener(transitionEndEventName(), fn, false);
      el.setAttribute('class', 'invisible');
      self.readyToPlay = true;

      el.removeEventListener(transitionEndEventName(), fn, false);
};
// Click handler for Restart Game button
Game.prototype.restartGame = function (e) {
      e.target.removeEventListener(e.type, arguments.callee);
      var self = e.target.self;
      document.getElementById('restart-sidebar').setAttribute('class', 'hidden');
      self.resetFogOfWar();
      self.init();
};
// Debugging function used to place all ships and just start
Game.prototype.placeRandomly = function (e) {
      e.target.removeEventListener(e.type, arguments.callee);
      e.target.self.humanFleet.placeShipsRandomly();
      e.target.self.readyToPlay = true;
      document.getElementById('roster-sidebar').setAttribute('class', 'hidden');
      this.setAttribute('class', 'hidden');
};
// Ends placing the current ship
Game.prototype.endPlacing = function (shipType) {
      document.getElementById(shipType).setAttribute('class', 'placed');

      // Mark the ship as 'used'
      Game.usedShips[CONST.AVAILABLE_SHIPS.indexOf(shipType)] = CONST.USED;

      // Wipe out the variable when you're done with it
      Game.placeShipDirection = null;
      Game.placeShipType = '';
      Game.placeShipCoords = [];
};
// Checks whether or not all ships are done placing
// Returns boolean
Game.prototype.areAllShipsPlaced = function () {
      var playerRoster = document.querySelectorAll('.fleet-roster li');
      for (var i = 0; i < playerRoster.length; i++) {
            if (playerRoster[i].getAttribute('class') === 'placed') {
                  continue;
            } else {
                  return false;
            }
      }
      // Reset temporary variables
      Game.placeShipDirection = 0;
      Game.placeShipType = '';
      Game.placeShipCoords = [];
      return true;
};
// Resets the fog of war
Game.prototype.resetFogOfWar = function () {
      for (var i = 0; i < Game.size; i++) {
            for (var j = 0; j < Game.size; j++) {
                  this.humanGrid.updateCell(i, j, 'empty', CONST.HUMAN_PLAYER);
                  this.computerGrid.updateCell(i, j, 'empty', CONST.COMPUTER_PLAYER);
            }
      }
      // Reset all values to indicate the ships are ready to be placed again
      Game.usedShips = Game.usedShips.map(function () { return CONST.UNUSED; });
};
// Resets CSS styling of the sidebar
Game.prototype.resetRosterSidebar = function () {
      var els = document.querySelector('.fleet-roster').querySelectorAll('li');
      for (var i = 0; i < els.length; i++) {
            els[i].removeAttribute('class');
      }
      document.getElementById('rotate-button').removeAttribute('class');
      document.getElementById('start-game').setAttribute('class', 'hidden');
      if (DEBUG_MODE) {
            document.getElementById('place-randomly').removeAttribute('class');
      }
};

Game.prototype.showRestartSidebar = function () {
      const sidebar = document.getElementById('restart-sidebar');
      sidebar.classList.remove('hidden');
      sidebar.classList.add('highlight');

      // Deregister listeners
      document.querySelectorAll('.computer-player .grid-cell').forEach(cell => {
            cell.removeEventListener('click', this.shootListener);
      });

      document.querySelectorAll('.fleet-roster li').forEach(item => {
            item.removeEventListener('click', this.rosterListener);
      });

      const restartButton = document.getElementById('restart-game');
      restartButton.self = this;
      restartButton.addEventListener('click', this.restartGame);
};

// Generates the HTML divs for the grid for both players
Game.prototype.createGrid = function () {
      document.querySelectorAll('.grid').forEach(gridDiv => {
            gridDiv.querySelector('.no-js')?.remove(); // Removes the no-js warning if it exists

            for (let i = 0; i < Game.size; i++) {
                  for (let j = 0; j < Game.size; j++) {
                        const el = document.createElement('div');
                        el.dataset.x = i;
                        el.dataset.y = j;
                        el.className = `grid-cell grid-cell-${i}-${j}`;
                        gridDiv.appendChild(el);
                  }
            }
      });
};

// Initializes the Game. Also resets the game if previously initialized
Game.prototype.init = function () {
      this.humanGrid = new Grid(Game.size);
      this.computerGrid = new Grid(Game.size);
      this.humanFleet = new Fleet(this.humanGrid, CONST.HUMAN_PLAYER);
      this.computerFleet = new Fleet(this.computerGrid, CONST.COMPUTER_PLAYER);

      this.robot = new AI(this);
      Game.stats = new Stats();
      Game.stats.updateStatsSidebar();

      // Reset game variables
      this.shotsTaken = 0;
      this.readyToPlay = false;
      this.placingOnGrid = false;
      Game.placeShipDirection = 0;
      Game.placeShipType = '';
      Game.placeShipCoords = [];

      this.resetRosterSidebar();

      // Add a click listener for the Grid.shoot() method for all cells
      // Only add this listener to the computer's grid
      var computerCells = document.querySelector('.computer-player').childNodes;
      for (var j = 0; j < computerCells.length; j++) {
            computerCells[j].self = this;
            computerCells[j].addEventListener('click', this.shootListener, false);
      }

      // Add a click listener to the roster	
      var playerRoster = document.querySelector('.fleet-roster').querySelectorAll('li');
      for (var i = 0; i < playerRoster.length; i++) {
            playerRoster[i].self = this;
            playerRoster[i].addEventListener('click', this.rosterListener, false);
      }

      // Add a click listener to the human player's grid while placing
      var humanCells = document.querySelector('.human-player').childNodes;
      for (var k = 0; k < humanCells.length; k++) {
            humanCells[k].self = this;
            humanCells[k].addEventListener('click', this.placementListener, false);
            humanCells[k].addEventListener('mouseover', this.placementMouseover, false);
            humanCells[k].addEventListener('mouseout', this.placementMouseout, false);
      }

      var rotateButton = document.getElementById('rotate-button');
      rotateButton.addEventListener('click', this.toggleRotation, false);
      var startButton = document.getElementById('start-game');
      startButton.self = this;
      startButton.addEventListener('click', this.startGame, false);
      var resetButton = document.getElementById('reset-stats');
      resetButton.addEventListener('click', Game.stats.resetStats, false);
      var randomButton = document.getElementById('place-randomly');
      randomButton.self = this;
      randomButton.addEventListener('click', this.placeRandomly, false);
      this.computerFleet.placeShipsRandomly();
};

// Grid object
// Constructor
class Grid {
      constructor(size) {
            this.size = size;
            this.cells = Array.from({ length: size }, () => Array(size).fill(CONST.TYPE_EMPTY));
      }

      updateCell(x, y, type, targetPlayer) {
            const playerClassMap = {
                  [CONST.HUMAN_PLAYER]: 'human-player',
                  [CONST.COMPUTER_PLAYER]: 'computer-player'
            };

            const player = playerClassMap[targetPlayer];
            if (!player) {
                  console.error("There was an error trying to find the correct player's grid");
                  return;
            }

            const typeMap = {
                  [CONST.CSS_TYPE_EMPTY]: CONST.TYPE_EMPTY,
                  [CONST.CSS_TYPE_SHIP]: CONST.TYPE_SHIP,
                  [CONST.CSS_TYPE_MISS]: CONST.TYPE_MISS,
                  [CONST.CSS_TYPE_HIT]: CONST.TYPE_HIT,
                  [CONST.CSS_TYPE_SUNK]: CONST.TYPE_SUNK,
                  [CONST.CSS_TYPE_REVEAL]: CONST.TYPE_REVEAL
            };

            this.cells[x][y] = typeMap[type] || CONST.TYPE_EMPTY;

            const cellElement = document.querySelector(`.${player} .grid-cell-${x}-${y}`);
            if (cellElement) {
                  cellElement.setAttribute('class', `grid-cell grid-cell-${x}-${y} grid-${type}`);
            } else {
                  console.error(`Cell element not found: .${player} .grid-cell-${x}-${y}`);
            }
      }


      isUndamagedShip(x, y) {
            return this.cells[x][y] === CONST.TYPE_SHIP;
      }

      isMiss(x, y) {
            return this.cells[x][y] === CONST.TYPE_MISS;
      }

      isDamagedShip(x, y) {
            return [CONST.TYPE_HIT, CONST.TYPE_SUNK].includes(this.cells[x][y]);
      }
}


// Fleet object
// This object is used to keep track of a player's portfolio of ships
// Constructor
class Fleet {
      constructor(playerGrid, player) {
            this.numShips = CONST.AVAILABLE_SHIPS.length;
            this.playerGrid = playerGrid;
            this.player = player;
            this.fleetRoster = [];
            this.populate();
      }
      // Populates a fleet
      populate() {
            for (var i = 0; i < this.numShips; i++) {
                  // loop over the ship types when numShips > Constants.AVAILABLE_SHIPS.length
                  var j = i % CONST.AVAILABLE_SHIPS.length;
                  this.fleetRoster.push(new Ship(CONST.AVAILABLE_SHIPS[j], this.playerGrid, this.player));
            }
      }

      // Places the ship and returns whether or not the placement was successful
      placeShip(x, y, direction, shipType) {
            const ship = this.fleetRoster.find(ship => ship.type === shipType);

            if (ship && ship.isLegal(x, y, direction)) {
                  ship.create(x, y, direction, false);
                  const shipCoords = ship.getAllShipCells();

                  shipCoords.forEach(coord => {
                        this.playerGrid.updateCell(coord.x, coord.y, 'ship', this.player);
                  });

                  return true;
            }

            return false;
      }


      // Helper function to mark surrounding cells as off-limits
      markBufferZone(shipCoords) {
            for (const coord of shipCoords) {
                  for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                              const newX = coord.x + dx;
                              const newY = coord.y + dy;
                              if (this.isWithinBounds(newX, newY)) {
                                    this.bufferGrid[newX][newY] = CONST.BUFFER_ZONE;
                              }
                        }
                  }
            }
      }

      // Helper function to check if the placement is within bounds
      isWithinBounds(x, y) {
            return x >= 0 && x < Game.size && y >= 0 && y < Game.size;
      }

      // Check if the placement of the ship respects the buffer zone
      isPlacementLegal(x, y, direction) {
            for (let i = 0; i < this.fleetRoster[i].shipLength; i++) {
                  const newX = direction === Ship.DIRECTION_VERTICAL ? x + i : x;
                  const newY = direction === Ship.DIRECTION_VERTICAL ? y : y + i;
                  if (!this.isWithinBounds(newX, newY) || this.bufferGrid[newX][newY] === CONST.BUFFER_ZONE) {
                        return false;
                  }
            }
            return true;
      }

      placeShipsRandomly() {
            // Initialize the buffer grid
            this.bufferGrid = Array.from({ length: Game.size }, () => Array(Game.size).fill(0));

            for (let i = 0; i < this.fleetRoster.length; i++) {
                  // Skip already placed ships for the human player
                  if (this.player === CONST.HUMAN_PLAYER && Game.usedShips[i] === CONST.USED) {
                        continue;
                  }

                  let shipPlaced = false;

                  while (!shipPlaced) {
                        const randomX = Math.floor(Game.size * Math.random());
                        const randomY = Math.floor(Game.size * Math.random());
                        const randomDirection = Math.floor(2 * Math.random());

                        if (this.fleetRoster[i].isLegal(randomX, randomY, randomDirection) &&
                              this.isPlacementLegal(randomX, randomY, randomDirection)) {
                              this.fleetRoster[i].create(randomX, randomY, randomDirection, false);
                              const shipCoords = this.fleetRoster[i].getAllShipCells();
                              this.markBufferZone(shipCoords);
                              shipPlaced = true;

                              // Update the player grid for the human player
                              if (this.player === CONST.HUMAN_PLAYER && Game.usedShips[i] !== CONST.USED) {
                                    for (const coord of shipCoords) {
                                          this.playerGrid.updateCell(coord.x, coord.y, 'ship', this.player);
                                    }
                                    Game.usedShips[i] = CONST.USED;
                              }
                        }
                  }
            }
      }


      // Finds a ship by location
      findShipByCoords(x, y) {
            for (const ship of this.fleetRoster) {
                  if (ship.direction === Ship.DIRECTION_VERTICAL) {
                        if (y === ship.yPosition && x >= ship.xPosition && x < ship.xPosition + ship.shipLength) {
                              return ship;
                        }
                  } else {
                        if (x === ship.xPosition && y >= ship.yPosition && y < ship.yPosition + ship.shipLength) {
                              return ship;
                        }
                  }
            }
            return null;
      }

      // Finds a ship by its type
      // Param shipType is a string
      // Returns the ship object that is of type shipType
      // If no ship exists, this returns null.
      findShipByType(shipType) {
            for (var i = 0; i < this.fleetRoster.length; i++) {
                  if (this.fleetRoster[i].type === shipType) {
                        return this.fleetRoster[i];
                  }
            }
            return null;
      }
      // Checks to see if all ships have been sunk
      // Returns boolean
      allShipsSunk() {
            for (var i = 0; i < this.fleetRoster.length; i++) {
                  // If one or more ships are not sunk, then the sentence "all ships are sunk" is false.
                  if (this.fleetRoster[i].sunk === false) {
                        return false;
                  }
            }
            return true;
      }
}

// Ship object
// Constructor
class Ship {
      constructor(type, playerGrid, player) {
            this.damage = 0;
            this.type = type;
            this.playerGrid = playerGrid;
            this.player = player;

            switch (this.type) {
                  case CONST.AVAILABLE_SHIPS[0]:
                        this.shipLength = 5;
                        break;
                  case CONST.AVAILABLE_SHIPS[1]:
                        this.shipLength = 4;
                        break;
                  case CONST.AVAILABLE_SHIPS[2]:
                        this.shipLength = 3;
                        break;
                  case CONST.AVAILABLE_SHIPS[3]:
                        this.shipLength = 3;
                        break;
                  case CONST.AVAILABLE_SHIPS[4]:
                        this.shipLength = 2;
                        break;
                  default:
                        this.shipLength = 3;
                        break;
            }
            this.maxDamage = this.shipLength;
            this.sunk = false;
      }

      // Checks to see if the placement of a ship is legal
      isLegal(x, y, direction) {
            // Check if the ship is within the grid
            if (!this.withinBounds(x, y, direction)) {
                  return false;
            }

            // Define a helper function to check cell content
            const isOccupied = (x, y) => {
                  const cell = this.playerGrid.cells[x][y];
                  return cell === CONST.TYPE_SHIP || cell === CONST.TYPE_MISS || cell === CONST.TYPE_SUNK;
            };

            // Check for collision with another ship
            for (let i = 0; i < this.shipLength; i++) {
                  if (direction === Ship.DIRECTION_VERTICAL) {
                        if (isOccupied(x + i, y)) {
                              return false;
                        }
                  } else {
                        if (isOccupied(x, y + i)) {
                              return false;
                        }
                  }
            }

            return true;
      }


      // Checks to see if the ship is within bounds of the grid
      // Returns boolean
      withinBounds(x, y, direction) {
            if (direction === Ship.DIRECTION_VERTICAL) {
                  return x + this.shipLength <= Game.size;
            } else {
                  return y + this.shipLength <= Game.size;
            }
      }
      // Increments the damage counter of a ship
      // Returns Ship
      incrementDamage() {
            this.damage++;
            if (this.isSunk()) {
                  this.sinkShip(false); // Sinks the ship
            }
      }
      // Checks to see if the ship is sunk
      // Returns boolean
      isSunk() {
            return this.damage >= this.maxDamage;
      }
      // Sinks the ship
      sinkShip(virtual) {
            this.damage = this.maxDamage; // Force the damage to exceed max damage
            this.sunk = true;

            // Make the CSS class sunk, but only if the ship is not virtual
            if (!virtual) {
                  this.getAllShipCells().forEach(cell => {
                        this.playerGrid.updateCell(cell.x, cell.y, 'sunk', this.player);
                  });
            }
      }


      getAllShipCells() {
            return Array.from({ length: this.shipLength }, (_, i) => ({
                  x: this.direction === Ship.DIRECTION_VERTICAL ? this.xPosition + i : this.xPosition,
                  y: this.direction === Ship.DIRECTION_VERTICAL ? this.yPosition : this.yPosition + i
            }));
      }

      // Initializes a ship with the given coordinates and direction (bearing).
      // If the ship is declared "virtual", then the ship gets initialized with
      // its coordinates but DOESN'T get placed on the grid.
      create(x, y, direction, virtual) {
            // This function assumes that you've already checked that the placement is legal
            this.xPosition = x;
            this.yPosition = y;
            this.direction = direction;

            // If the ship is virtual, don't add it to the grid.
            if (!virtual) {
                  for (let i = 0; i < this.shipLength; i++) {
                        if (this.direction === Ship.DIRECTION_VERTICAL) {
                              this.playerGrid.cells[x + i][y] = CONST.TYPE_SHIP;
                        } else {
                              this.playerGrid.cells[x][y + i] = CONST.TYPE_SHIP;
                        }
                  }
            }
      }

}
// direction === 0 when the ship is facing north/south
// direction === 1 when the ship is facing east/west
Ship.DIRECTION_VERTICAL = 0;
Ship.DIRECTION_HORIZONTAL = 1;

// AI Object
// Optimal battleship-playing AI
// Constructor
class AI {
      constructor(gameObject) {
            this.gameObject = gameObject;
            this.virtualGrid = new Grid(Game.size);
            this.virtualFleet = new Fleet(this.virtualGrid, CONST.VIRTUAL_PLAYER);

            this.probGrid = []; // Probability Grid
            this.initProbs();
            this.updateProbs();
      }
      // Scouts the grid based on max probability, and shoots at the cell
      shoot() {
            let maxProbability = 0;
            let maxProbs = [];

            // Add the AI's opening book to the probability grid
            AI.OPENINGS.forEach(cell => {
                  if (this.probGrid[cell.x][cell.y] !== 0) {
                        this.probGrid[cell.x][cell.y] += cell.weight;
                  }
            });

            // Find the cell with the highest probability
            for (let x = 0; x < Game.size; x++) {
                  for (let y = 0; y < Game.size; y++) {
                        const prob = this.probGrid[x][y];
                        if (prob > maxProbability) {
                              maxProbability = prob;
                              maxProbs = [{ x, y }];
                        } else if (prob === maxProbability) {
                              maxProbs.push({ x, y });
                        }
                  }
            }

            const maxProbCoords = Math.random() < AI.RANDOMNESS
                  ? maxProbs[Math.floor(Math.random() * maxProbs.length)]
                  : maxProbs[0];

            const result = this.gameObject.shoot(maxProbCoords.x, maxProbCoords.y, CONST.HUMAN_PLAYER);

            // If the game ends, skip the next lines.
            if (Game.gameOver) {
                  Game.gameOver = false;
                  return;
            }

            this.virtualGrid.cells[maxProbCoords.x][maxProbCoords.y] = result;

            // If you hit a ship, check if you've sunk it.
            if (result === CONST.TYPE_HIT) {
                  const humanShip = this.findHumanShip(maxProbCoords.x, maxProbCoords.y);
                  if (humanShip.isSunk()) {
                        const index = this.virtualFleet.fleetRoster.findIndex(ship => ship.type === humanShip.type);
                        if (index !== -1) {
                              this.virtualFleet.fleetRoster.splice(index, 1);
                        }

                        // Update the virtual grid with the sunk ship's cells
                        humanShip.getAllShipCells().forEach(cell => {
                              this.virtualGrid.cells[cell.x][cell.y] = CONST.TYPE_SUNK;
                        });
                  }
            }

            // Update the probability grid after each shot
            this.updateProbs();
      }



      // Update the probability grid
      updateProbs() {
            const roster = this.virtualFleet.fleetRoster;
            this.resetProbs();

            const updateProbabilityGrid = (coords, weight) => {
                  coords.forEach(coord => {
                        this.probGrid[coord.x][coord.y] += weight;
                  });
            };

            const processShip = (ship, x, y, direction) => {
                  if (ship.isLegal(x, y, direction)) {
                        ship.create(x, y, direction, true);
                        const coords = ship.getAllShipCells();
                        const weight = this.passesThroughHitCell(coords) ?
                              AI.PROB_WEIGHT * this.numHitCellsCovered(coords) : 1;
                        updateProbabilityGrid(coords, weight);
                  }
            };

            const processCell = (x, y) => {
                  roster.forEach(ship => {
                        processShip(ship, x, y, Ship.DIRECTION_VERTICAL);
                        processShip(ship, x, y, Ship.DIRECTION_HORIZONTAL);
                  });
                  if (this.virtualGrid.cells[x][y] === CONST.TYPE_HIT) {
                        this.probGrid[x][y] = 0;
                  }
            };

            for (let x = 0; x < Game.size; x++) {
                  for (let y = 0; y < Game.size; y++) {
                        processCell(x, y);
                  }
            }
      }

      // Initializes the probability grid for targeting
      initProbs() {
            for (var x = 0; x < Game.size; x++) {
                  var row = [];
                  this.probGrid[x] = row;
                  for (var y = 0; y < Game.size; y++) {
                        row.push(0);
                  }
            }
      }
      // Resets the probability grid to all 0.
      resetProbs() {
            for (var x = 0; x < Game.size; x++) {
                  for (var y = 0; y < Game.size; y++) {
                        this.probGrid[x][y] = 0;
                  }
            }
      }
      metagame() {
            // Inputs:
            // Proximity of hit cells to edge
            // Proximity of hit cells to each other
            // Edit the probability grid by multiplying each cell with a new probability weight (e.g. 0.4, or 3). Set this as a CONST and make 1-CONST the inverse for decreasing, or 2*CONST for increasing
      }
      // Finds a human ship by coordinates
      // Returns Ship
      findHumanShip(x, y) {
            return this.gameObject.humanFleet.findShipByCoords(x, y);
      }
      // Checks whether or not a given ship's cells passes through
      // any cell that is hit.
      // Returns boolean
      passesThroughHitCell(shipCells) {
            for (var i = 0; i < shipCells.length; i++) {
                  if (this.virtualGrid.cells[shipCells[i].x][shipCells[i].y] === CONST.TYPE_HIT) {
                        return true;
                  }
            }
            return false;
      }
      // Gives the number of hit cells the ships passes through. The more
      // cells this is, the more probable the ship exists in those coordinates
      // Returns int
      numHitCellsCovered(shipCells) {
            var cells = 0;
            for (var i = 0; i < shipCells.length; i++) {
                  if (this.virtualGrid.cells[shipCells[i].x][shipCells[i].y] === CONST.TYPE_HIT) {
                        cells++;
                  }
            }
            return cells;
      }
}
AI.PROB_WEIGHT = 5000; // arbitrarily big number
// how much weight to give to the opening book's high probability cells
AI.OPEN_HIGH_MIN = 20;
AI.OPEN_HIGH_MAX = 30;
// how much weight to give to the opening book's medium probability cells
AI.OPEN_MED_MIN = 15;
AI.OPEN_MED_MAX = 25;
// how much weight to give to the opening book's low probability cells
AI.OPEN_LOW_MIN = 10;
AI.OPEN_LOW_MAX = 20;
// Amount of randomness when selecting between cells of equal probability
AI.RANDOMNESS = 0.1;
// AI's opening book.
// This is the pattern of the first cells for the AI to target
function createOpening(x, y, minWeight, maxWeight) {
      return { 'x': x, 'y': y, 'weight': getRandom(minWeight, maxWeight) };
}

AI.OPENINGS = [
      createOpening(7, 3, AI.OPEN_LOW_MIN, AI.OPEN_LOW_MAX),
      createOpening(6, 2, AI.OPEN_LOW_MIN, AI.OPEN_LOW_MAX),
      createOpening(3, 7, AI.OPEN_LOW_MIN, AI.OPEN_LOW_MAX),
      createOpening(2, 6, AI.OPEN_LOW_MIN, AI.OPEN_LOW_MAX),
      createOpening(6, 6, AI.OPEN_LOW_MIN, AI.OPEN_LOW_MAX),
      createOpening(3, 3, AI.OPEN_LOW_MIN, AI.OPEN_LOW_MAX),
      createOpening(5, 5, AI.OPEN_LOW_MIN, AI.OPEN_LOW_MAX),
      createOpening(4, 4, AI.OPEN_LOW_MIN, AI.OPEN_LOW_MAX),
      createOpening(0, 8, AI.OPEN_MED_MIN, AI.OPEN_MED_MAX),
      createOpening(1, 9, AI.OPEN_HIGH_MIN, AI.OPEN_HIGH_MAX),
      createOpening(8, 0, AI.OPEN_MED_MIN, AI.OPEN_MED_MAX),
      createOpening(9, 1, AI.OPEN_HIGH_MIN, AI.OPEN_HIGH_MAX),
      createOpening(9, 9, AI.OPEN_HIGH_MIN, AI.OPEN_HIGH_MAX),
      createOpening(0, 0, AI.OPEN_HIGH_MIN, AI.OPEN_HIGH_MAX)
];

// Start the game
var mainGame = new Game(10);

if (!Array.prototype.indexOf) {
      Array.prototype.indexOf = function (searchElement, fromIndex) {
            if (this == null) {
                  throw new TypeError('"this" is null or not defined');
            }

            var O = Object(this);
            var len = O.length >>> 0;
            if (len === 0) {
                  return -1;
            }

            var n = fromIndex | 0;
            if (n >= len) {
                  return -1;
            }

            var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
            while (k < len) {
                  if (k in O && O[k] === searchElement) {
                        return k;
                  }
                  k++;
            }
            return -1;
      };
}


if (!Array.prototype.map) {
      Array.prototype.map = function (callback, thisArg) {
            if (this == null) {
                  throw new TypeError("this is null or not defined");
            }
            if (typeof callback !== "function") {
                  throw new TypeError(callback + " is not a function");
            }

            var O = Object(this);
            var len = O.length >>> 0;
            var A = new Array(len);
            var T = thisArg;
            var k = 0;

            while (k < len) {
                  if (k in O) {
                        A[k] = callback.call(T, O[k], k, O);
                  }
                  k++;
            }
            return A;
      };
}


// Browser compatability workaround for transition end event names.
// From modernizr: http://stackoverflow.com/a/9090128
function transitionEndEventName() {
      var i,
            undefined,
            el = document.createElement('div'),
            transitions = {
                  'transition': 'transitionend',
                  'OTransition': 'otransitionend',  // oTransitionEnd in very old Opera
                  'MozTransition': 'transitionend',
                  'WebkitTransition': 'webkitTransitionEnd'
            };

      for (i in transitions) {
            if (transitions.hasOwnProperty(i) && el.style[i] !== undefined) {
                  return transitions[i];
            }
      }
}

// Returns a random number between min (inclusive) and max (exclusive)
function getRandom(min, max) {
      return Math.random() * (max - min) + min;
}

// Toggles on or off DEBUG_MODE
function setDebug(val) {
      DEBUG_MODE = val;
      localStorage.setItem('DEBUG_MODE', val);
      localStorage.setItem('showTutorial', 'false');
      window.location.reload();
}