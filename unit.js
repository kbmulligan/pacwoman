// unit.js - everything regarding units

const TAU = 2 * Math.PI;
const DEFAULT_HP = 50;
const DEFAULT_ATTACK = 10;
const DEFAULT_SIGHT_RANGE = 250;
const DEFAULT_COLOR = "gray";
const DEFAULT_SIZE = 10;
const THRESHOLD_CLOSE = 0.5;

const COLLISION_BUFFER = 0;
const VULNERABLE_TIME = 300;

const DIR_LEFT = Math.PI;
const DIR_RIGHT = 0;
const DIR_UP = 2 * 0.75 * Math.PI;
const DIR_DOWN = 2 * 0.25 * Math.PI;

function Unit(x, y, owner, color, r=DEFAULT_SIZE) {

  this.owner = owner;

  // grid coords
  this.gx = 16;
  this.gy = 16;

  this.x = x;
  this.y = y;
  this.r = r;
  this.vx = 0;
  this.vy = 0;
  this.maxv = 2;
  this.target = null;
  this.color = color;
  this.direction = 2 * 0.0 * Math.PI;
  this.facing = this.direction;

  this.maxMouthAngle = 0.10;
  this.mouthAngle = this.maxMouthAngle;
  this.mouthAngleInc = 0.008;
  this.mouthOpening = false;
  this.animateMouth = true;

  this.visible = true;

  this.type = "GHOST";  // either GHOST or PACWOMAN

  this.idString = Math.floor(Math.random() * 10000).toString().padStart(5,'0');
  this.name = this.color + "-" +  this.type + "-" + this.idString; 
  this.hp = DEFAULT_HP;
  this.attack = DEFAULT_ATTACK;

  this.state = "INACTIVE";    // one of INACTIVE, ALERT, MOVING, VULNERABLE, DEAD

  this.score = 0;

  this.enemies = [];

  this.commandQ = [];
 
  // AI portion
  this.interval = 10;
  this.timer = 0;
  this.nextBehavior = null;
  
  this.getLocation = function() {
    return {x: this.x, y: this.y};
  }

  this.setMoveTarget = function(moveToPt) {
      this.target = moveToPt;
      if (this.target) {
          this.state = "MOVING";
      }
      //console.log("MOVE CMD ISSUED: ", this.name, this.target);
  }

  this.setAttackTarget = function(targetUnit) {
      this.targetAttack = targetUnit;
      if (this.targetAttack) {
          this.facing = Math.atan(this.targetAttack.y - this.y, this.targetAttack.x - this.x);
          this.state = "ATTACKING";
      }

  }
  
  this.resetDirection = function() {
    this.direction = 2 * Math.random() * Math.PI;
  }

  this.injure = function(dmg) {
      this.hp -= dmg;
      this.hp = Math.max(this.hp, 0);

      if (this.hp == 0) {
          this.state = "DEAD";
          this.maxv = 0;
      }
  } 

  this.inRange = function(target) {
      return distance(this, target) < this.attackRange;
  }

  this.isDead = function() {
      return this.hp <= 0;
  }

  this.isAlert = function() {
      return this.state == "ALERT";
  }

  this.contains = function(x,y) {

    //square collision

    let dx = Math.abs(this.x - x)
    if (dx > this.r) return false;
    let dy = Math.abs(this.y - y)
    if (dy > this.r) return false;
    return true;
  }

  this.draw = function(ctx) {
    if (this.visible) {
        
        ctx.fillStyle = this.color;
        ctx.strokeStyle = this.color;
        
        if (this.state == "VULNERABLE") {
            ctx.fillStyle = "blue";
        }
            
        ctx.beginPath();
        let startAngle = this.direction + this.mouthAngle * TAU;
        let finishAngle = this.direction + TAU - this.mouthAngle * TAU;
        ctx.arc(this.x, this.y, this.r, startAngle, finishAngle);
        ctx.lineTo(this.x, this.y);
        //ctx.lineTo(Math.cos(this.startAngle) * this.r, Math.sin(this.startAngle) * this.r);
        //ctx.stroke();
        ctx.fill();
       

        if (this.state == "DEAD") {
          ctx.strokeStyle = "BLACK";
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.r, 0, TAU);
          let temp = ctx.lineWidth;
          ctx.lineWidth = 6
          ctx.stroke();
          ctx.lineWidth = temp;
        }
    } 
  }

  // returns true if unit has any left/right movement
  this.movingLeftRight = function () {
      return Math.abs(this.vx) > 0;
  }

  // returns true if unit has any up/down movement
  this.movingUpDown = function () {
      return Math.abs(this.vy) > 0;
  }


  // movement and its rules

  // given a world, attempt to make the char move left
  // returns true on success, false if stored
  this.moveLeft = function (w, sub=null) {
      let success = false;
      if ( (this.direction == DIR_RIGHT 
            || isCentered(this.x, this.y, this.gx, this.gy))
            && toLeftOf(w.map, this.gx, this.gy) != WALL) { 
          this.direction = DIR_LEFT;
          this.vx = -this.maxv;
          this.vy = 0;
          this.success = true;
      } else {
          this.storeCommand("LEFT");
      }
      return success;
  }

  // given a world, attempt to make the char move right
  // returns true on success, false if stored
  this.moveRight = function (w, sub=null) {
      let success = false;
      if ( (this.direction == DIR_LEFT 
            || isCentered(this.x, this.y, this.gx, this.gy))  
            && toRightOf(w.map, this.gx, this.gy) != WALL) { 
          this.direction = DIR_RIGHT;
          this.vx = this.maxv;
          this.vy = 0;
          this.success = true;
      } else {
          this.storeCommand("RIGHT");
      }
      return success;
  }

  // given a world, attempt to make the char move up
  // returns true on success, false if stored
  this.moveUp = function (w, sub=null) {
      let success = false;
      if ( (this.direction == DIR_DOWN  
            || isCentered(this.x, this.y, this.gx, this.gy)) 
            && above(w.map, this.gx, this.gy) != WALL) { 
          this.direction = DIR_UP;
          this.vx = 0;
          this.vy = -this.maxv;
      } else {
          this.storeCommand("UP");
      }
      return success;
  }

  // given a world, attempt to make the char move down 
  // returns true on success, false if stored
  this.moveDown = function (w, sub=null) {
      let success = false;
      if ( (this.direction == DIR_UP
            || isCentered(this.x, this.y, this.gx, this.gy))
            && below(w.map, this.gx, this.gy) != WALL) { 
          this.direction = DIR_DOWN;
          this.vx = 0;
          this.vy = this.maxv;
      } else {
          this.storeCommand("DOWN");
      }
      return success;
  }

  // if this char has a stored command, returns true
  this.hasCommand = function () {
      return this.commandQ.length > 0;
  }

  // stores a command (function) in the queue for this char
  this.storeCommand = function (cmd) {
      if (this.type == "PACWOMAN") {
          this.commandQ.push(cmd);
      }
      if (this.commandQ.length > 0) {
          this.commandQ = this.commandQ.slice(-1);
      }
  }

  // executes the next command in the queue for this char
  this.executeCommand = function (w) {
      let cmd = this.commandQ.pop();
      
      if (cmd == "LEFT") {
           this.moveLeft(w);
      }
      if (cmd == "RIGHT") {
           this.moveRight(w);
      }
      if (cmd == "UP") {
           this.moveUp(w);
      }
      if (cmd == "DOWN") {
           this.moveDown(w);
      }
      
      if (this.commandQ.length > 0) {
          this.commandQ = [];
          console.log("Command queue too long, truncating...");
      }
  }


  this.update = function (world) {

    // DO REGARDLESS OF UNIT STATE

    if (this.isDead()) {
        // DO ONLY IF UNIT IS DEAD 

        // immobilize
        this.maxv = 0;

        // remove targets
        this.targetAttack = null; 
        this.target = null; 

        console.log("YUP, DEAD!");

    } else {
        // DO ONLY IF UNIT IS ALIVE

        if (this.hasCommand() && isCentered(this.x, this.y, this.gx, this.gy)) {
            this.executeCommand(world);
        }
        
        this.x += this.vx;
        this.y += this.vy;

        // keep from crossing walls
        this.wallCollision(world);

        // detect dots, power pellets, and other power ups / bonuses
        this.resourceCollision(world);

        // detect ghosts
        this.ghostCollision(world);

        // keep within map
        this.bound(world); 

        if (this.animateMouth) {
            if (this.mouthOpening) {
                this.mouthAngle += this.mouthAngleInc;
                if (this.mouthAngle >= this.maxMouthAngle) {
                    this.mouthAngle = this.maxMouthAngle;
                    this.mouthOpening = false;
                }
            } else {
                this.mouthAngle -= this.mouthAngleInc;
                if (this.mouthAngle <= 0) {
                    this.mouthAngle = 0;
                    this.mouthOpening = true; 
                }
            }
        }


        if (this.stateTimer > 0) {
            this.stateTimer -= 1;
        } else {
            this.state = "MOVING";
        } 
    }

  }

  // select next behavior to employ
  this.changeBehavior = function (w) {
      //this.nextBehavior = null;
      let possibleBehaviors = [
                                  this.moveToPlayer,
                                  this.moveUp, 
                                  this.moveLeft, 
                                  this.moveRight, 
                                  this.moveDown,
                              ];

      if (this.timer > this.interval) {
          this.nextBehavior = getRandom(possibleBehaviors); 
          this.timer = 0;
      } else {
          this.timer += 1;
      }
  }

  this.moveToPlayer = function (w) {
      // grid coords
      let goal = {x: w.player.gx, y: w.player.gy};
      let move = null;

      if (this.gx > goal.x) {
          this.moveLeft(w);
      } else if (this.gx < goal.x) {
          this.moveRight(w); 
      }
      if (this.gy > goal.y) {
          this.moveUp(w); 
      } else if (this.gy < goal.y) {
          this.moveDown(w); 
      }

      return;
  }

  // employ currently selected behavior 
  this.executeBehavior = function (w) {
      if (this.nextBehavior) {
          //console.log("EXECUTING BEHAVIOR: ", this.name, this.nextBehavior);
          this.nextBehavior(w);
      } 
  }
  
  // power pellet bonuses
  this.eatPowerPellet = function (w) {
      console.log("FOUND POWER PELLET");
      this.enemies.forEach( x => x.activateVulnerable());
  }

  // dot bonuses
  this.eatDot = function (w) {
      console.log("FOUND DOT");
      this.score += 1;
      console.log("SCORE: ", this.score);
  }

  // if you run into ghost, then you die
  this.ghostCollision = function (w) {
      ;
  }

  // ghost turn vulnerable
  this.activateVulnerable = function () {
     this.state = "VULNERABLE";
     this.stateTimer = VULNERABLE_TIME;
  }

  // eat dots if you run into them, but not if GHOST type
  this.resourceCollision = function (w) {
      if (this.type == "PACWOMAN") {
          let newGridCoords = getGridCoords(this.x, this.y);
          let bx = newGridCoords.x;
          let by = newGridCoords.y;

          if (w.map[by][bx] == DOT) {
              //console.log("FOUND DOT");
              this.eatDot(w);
              w.map[by][bx] = BLANK; 
          }
          if (w.map[by][bx] == PP) {
              this.eatPowerPellet(w);
              w.map[by][bx] = BLANK; 
          }
      }
  }

  // return list of valid directions this char can move
  this.validDirections = function (w) {
      const LEFT = "LEFT";
      const RIGHT = "RIGHT";
      const UP = "UP";
      const DOWN = "DOWN";

      let clearSpaces = [];
      
      // get current grid coords
      let gridCoords = getGridCoords(this.x, this.y);
      let bx = gridCoords.x;
      let by = gridCoords.y;

      // if going left / right
      if (this.vx != 0) {
          

      }
       
      return clearSpaces;
  }

  // prevent object from colliding into any units in the world
  this.wallCollision = function (w) {
      
      // get current grid coords
      let gridCoords = getGridCoords(this.x, this.y);
      let bx = gridCoords.x;
      let by = gridCoords.y;
       
      // if moving left check for wall collision
      if (this.vx < 0) {
          // check for wall
          if (w.map[by][bx - 1] == WALL) {
              // bound x coord if there's a wall to the left
              if (this.x < (bx) * B + this.r + COLLISION_BUFFER) {
                  this.x = (bx) * B + this.r + COLLISION_BUFFER;
                  this.vx = 0;
              }
          }
      }

      // if moving right check for wall collision
      if (this.vx > 0) {
          // check for wall
          if (w.map[by][bx + 1] == WALL) {
              // bound x coord if there's a wall to the right
              if (this.x > (bx + 1) * B - this.r - COLLISION_BUFFER) {
                  this.x = (bx + 1) * B - this.r - COLLISION_BUFFER;
                  this.vx = 0;
              }
          }
      }

      // if moving up check for wall collision
      if (this.vy < 0) {
          // check for wall
          if (w.map[by - 1][bx] == WALL) {
              // bound y coord if there's a wall above
              if (this.y < (by) * B + this.r + COLLISION_BUFFER) {
                  this.y = (by) * B + this.r + COLLISION_BUFFER;
                  this.vy = 0;
              }
          }
      }

      // if moving down check for wall collision
      if (this.vy > 0) {
          // check for wall
          if (w.map[by + 1][bx] == WALL) {
              // bound y coord if there's a wall below
              if (this.y > (by + 1) * B - this.r - COLLISION_BUFFER) {
                  this.y = (by + 1) * B - this.r - COLLISION_BUFFER;
                  this.vy = 0;
              }
          }
      }



      // update grid coords
      let newGridCoords = getGridCoords(this.x, this.y);
      this.gx = newGridCoords.x;
      this.gy = newGridCoords.y;

      return;
  }


  // wraps around so units can move through tunnels
  this.bound = function (w) {

      if (this.x <= 0) {
          this.x = MAP_W * B;
      } else if (this.x >= MAP_W * B) {
          this.x = 0;
      }

      if (this.y <= 0) {
          this.y = MAP_H * B;
      } else if (this.y >= MAP_H * B) {
          this.y = 0;
      }
      
  }

}
// END UNIT /////////////////////////////////////////////////////////

function getGridCoords (x, y) {
    let bx = Math.floor(x / B); 
    let by = Math.floor(y / B); 
    return {x: bx, y: by}
}

// return distance between 2 pts given by pythagorean theorem
function distance(pt1, pt2) {
  let dx = pt1.x - pt2.x;
  let dy = pt1.y - pt2.y;
  return Math.sqrt(dx*dx + dy*dy);
}

function closeTo(a, b, threshold = THRESHOLD_CLOSE) {
  return Math.abs(a-b) <= threshold;
}

function closeToPts(pt1, pt2, threshold = THRESHOLD_CLOSE) {
  return closeTo(pt1.x, pt2.x, threshold) && closeTo(pt1.y, pt2.y, threshold);
}

function withinGridSpace(pt1, pt2) {
  let i1 = Math.floor(pt1.y / B);
  let i2 = Math.floor(pt2.y / B);
  if (i1 != i2) return false;
  let j1 = Math.floor(pt1.x / B);
  let j2 = Math.floor(pt2.x / B);
  if (j1 != j2) return false;
  return true;
}

function getRandom(list) {
  return list[Math.floor(Math.random()*list.length)];
}
