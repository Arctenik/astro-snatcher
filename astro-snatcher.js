

//var collisionVectorElem = document.getElementById("collisionVectorElem");

var hitboxInp = document.getElementById("hitboxInp");

var canvas = document.getElementById("canvas"),
	ctx = canvas.getContext("2d");

var keyVelMax = 0.15,
	keyVelRate = 0.003,
	drag = 0.00003, // also functions as gravity
	energyDragY = 0.0003,
	energyDragX = 0.0001,
	bounceSpeed = 0.9,
	keyEnergyLoss = 0.002,
	bumpEnergyLoss = 2.5,
	clawRate = 0.1,
	clawCarryingRate = 0.025,
	clawMax = 64,
	winTimeMax = 2000;

var winMessage = "STAGE CLEAR",
	loseMessage = "GAME OVER";

var images = {},
	namedImages = {},
	scriptCallbacks = {},
	objects = {};

var levelPath = "test-level",
	level;

var controlKeys = {
	arrowup: "moveUp",
	w: "moveUp",
	arrowright: "moveRight",
	d: "moveRight",
	arrowdown: "moveDown",
	s: "moveDown",
	arrowleft: "moveLeft",
	a: "moveLeft",
	" ": "claw"
};

var score = 0,
	winTime,
	endMessage,
	gameScripts = [],
	controls = {
		moveUp: false,
		moveRight: false,
		moveDown: false,
		moveLeft: false,
		claw: false
	},
	prevControls = Object.assign({}, controls),
	camera = {
		x: 0,
		y: 0,
		width: canvas.width,
		height: canvas.height
	},
	ship = addObjectBox({
		x: 100,
		y: 100,
		energyLevel: 100,
		maxEnergy: 100,
		energySprites: [
			"ship-energy-0.png",
			"ship-energy-1.png",
			"ship-energy-2.png",
			"ship-energy-3.png",
			"ship-energy-4.png"
		],
		sprite: "ship.png",
		spriteX: -10,
		spriteY: -12,
		vertices: [
			[20, 0],
			[80, 0],
			[100, 70],
			[0, 70]
		],
		velX: 0,
		velY: 0
	}),
	claw = addObjectBox({
		updateCoords() {
			this.x = ship.x + (ship.width/2) - (this.width/2);
			this.y = ship.y + ship.height - this.height + this.extended;
			if (this.holding) {
				this.holding.x = this.x + this.holdingX;
				this.holding.y = this.y + this.holdingY;
			}
		},
		sprite: "claw.png",
		spriteX: -2,
		spriteY: -2,
		armSprite: "claw-arm.png",
		armSpriteX: 3, // (relative to claw position)
		armSpriteEnds: 5, // (amount that it continues beyond the "actual" arm on either end)
		vertices: [
			[0, 0],
			[16, 0],
			[16, 16],
			[0, 16]
		],
		extended: 0,
		holding: false
	});



document.addEventListener("keydown", e => {
	var key = e.key.toLowerCase();
	if (controlKeys[key]) controls[controlKeys[key]] = true;
});

document.addEventListener("keyup", e => {
	var key = e.key.toLowerCase();
	if (controlKeys[key]) controls[controlKeys[key]] = false;
});



function getLevel() {
	return new Promise(resolve => {
		var r = new XMLHttpRequest();
		r.open("get", levelPath + "/level.json");
		r.responseType = "json";
		r.onload = () => {
			level = new Level(r.response);
			getLevelImages().then(() => getLevelScripts().then(resolve));
			/*
			level = fillLevelProperties(r.response);
			if (level.startX !== undefined) ship.x = level.startX;
			if (level.startY !== undefined) ship.y = level.startY;
			getLevelImages().then(resolve);
			*/
		}
		r.send();
	});
}


function Level(src) {
	Object.assign(this, fillLevelProperties(readLevel(src)));
}

Level.prototype = {
	
}


function GameObject(src) {
	Object.assign(this, fillObjectProperties(src));
}

GameObject.prototype = {
	
}


function fillLevelProperties(level) {
	level.objects = [];
	if (!level.originX) level.originX = 0;
	if (!level.originY) level.originY = 0;
	level.minX = -level.originX;
	level.maxX = level.width - level.originX;
	level.minY = -level.originY;
	level.maxY = level.height - level.originY;
	level.initObjects.forEach(({name, object: obj}) => {
		obj = new GameObject(obj);
		objects[name] = obj;
		level.objects.push(obj);
	});
	level.reservedObjects.forEach(({name, object: obj}) => {
		obj = new GameObject(obj);
		objects[name] = obj;
	});
	return level;
}

function fillObjectProperties(obj) {
	//addObjectBox(obj);
	//if (obj.sprites && obj.sprite === undefined) obj.sprite = Object.keys(obj.sprites)[0];
	if (!(obj.dragMultiplierX === undefined && obj.dragMultiplierY === undefined)) {
		if (obj.dragMultiplierX === undefined) obj.dragMultiplierX = 1;
		if (obj.dragMultiplierY === undefined) obj.dragMultiplierY = 1;
		obj.velY = 0;
		obj.velX = 0;
	}
	if (obj.solidCollisions) obj.bounceMultiplier = obj.bounceMultiplier || 0;
	return obj;
}

function addObjectBox(obj) {
	var minX, maxX, minY, maxY;
	obj.vertices.forEach(([x, y]) => {
		minX = minX === undefined ? x : Math.min(minX, x);
		maxX = maxX === undefined ? x : Math.max(maxX, x);
		minY = minY === undefined ? y : Math.min(minY, y);
		maxY = maxY === undefined ? y : Math.max(maxY, y);
	});
	obj.width = maxX - minX;
	obj.height = maxY - minY;
	return obj;
}



function getLevelImages() {
	return new Promise(resolve => {
		Promise.all(level.images.map(info => getImage(info, levelPath + "/"))).then(resolve);
	});
}

function getBaseImages() {
	return Promise.all([
		ship.sprite, ...ship.energySprites,
		claw.sprite, claw.armSprite,
	].map(src => getImage({src})));
}

function getImage(info, pathPrefix = "") {
	var name = info.name,
		src = info.src;
	
	return new Promise(resolve => {
		var img = new Image();
		img.onload = () => {
			images[src] = img;
			if (name) namedImages[name] = info;
			resolve();
		}
		img.src = pathPrefix + src;
	});
}


function getLevelScripts() {
	return new Promise(resolve => {
		Promise.all(level.scripts.map(url => new Promise(resolve => {
			var r = new XMLHttpRequest();
			r.open("get", levelPath + "/" + url);
			r.onload = () => resolve(r.responseText);
			r.send();
		}))).then(scripts => {
			var globalEval = eval;
			scripts.forEach(script => {
				var scriptFunc = globalEval(script),
					scriptResult = scriptFunc(level, objects);
				
				Object.assign(scriptCallbacks, scriptResult.callbacks);
			});
			resolve();
		});
	});
}



function getObjectCollisions(obj) {
	var collisions = [],
		net, energy;
	
	for (var i = 0; i < level.objects.length; i++) {
		let levelObj = level.objects[i];
		if (obj !== levelObj && (levelObj.solid || (levelObj.net && !net) || (levelObj.energy && !energy))) {
			let collision = getSpecificCollision(obj, levelObj);
			if (collision) {
				if (levelObj.net) net = levelObj;
				else if (levelObj.energy) energy = true;
				else collisions.push(collision);
			}
		}
	}
	
	return [collisions, net, energy];
}

function getShipCollisions() {
	var collisions = [],
		energy;
	
	for (var i = 0; i < level.objects.length; i++) {
		let levelObj = level.objects[i];
		if (levelObj.solid || (levelObj.energy && !energy)) {
			let collision = getSpecificCollision(ship, levelObj);
			if (collision) {
				if (levelObj.energy) energy = true;
				else collisions.push(collision);
			}
		}
	}
	
	return [collisions, energy];
}

function getShipInEnergy() {
	for (var i = 0; i < level.objects.length; i++) {
		let levelObj = level.objects[i];
		if (levelObj.energy) {
			let collision = getSpecificInside(ship, levelObj);
			if (collision) return true;
		}
	}
	return false;
}

function getClawCollisions() {
	var collisions = [],
		collectible;
	
	for (var i = 0; i < level.objects.length; i++) {
		let levelObj = level.objects[i];
		if (levelObj.solid || (!collectible && levelObj.collectible)) {
			let collision = getSpecificCollision(claw, levelObj);
			if (collision) {
				if (levelObj.collectible) collectible = levelObj;
				else collisions.push(collision);
			}
		}
	}
	
	return [collisions, collectible];
}

function getSpecificCollision(a, b) { // 'a' should be the "main" object i guess??
	var result = getRectCollision(a, b) && getSatCollision(a, b);
	if (result) {
		if (b.transferVelX) result.transferVelX = b.transferVelX;
		if (b.transferVelY) result.transferVelY = b.transferVelY;
	}
	return result;
}

function getSpecificInside(a, b) { // determines whether 'a' is inside 'b'
	return getRectInside(a, b) && getSatInside(a, b);
}

function getRectCollision(a, b) {
	return segmentsIntersect1D([a.x, a.x + a.width], [b.x, b.x + b.width])
		&& segmentsIntersect1D([a.y, a.y + a.height], [b.y, b.y + b.height]);
}

function getRectInside(a, b) {
	return segmentInside1D([a.x, a.x + a.width], [b.x, b.x + b.width])
		&& segmentInside1D([a.y, a.y + a.height], [b.y, b.y + b.height]);
}

function getSatCollision(a, b) {
	var c1 = getObjSatCollision(a, a, b);
	if (c1) {
		var c2 = getObjSatCollision(b, a, b);
		if (c2) return [...c1, ...c2].sort((a, b) => a.amount - b.amount)[0];
	}
	return false;
}

function getSatInside(a, b) {
	var c1 = getObjSatInside(a, a, b);
	if (c1) {
		var c2 = getObjSatInside(b, a, b);
		if (c2) return true;
	}
	return false;
}

function getObjSatCollision(linesObj, a, b) {
	var overlaps = [];
	for (let i = 0; i < linesObj.vertices.length; i++) {
		let lineCollision = getLineSatCollision(
			linesObj.vertices[i],
			linesObj.vertices[(i + 1)%linesObj.vertices.length],
			a, b
		);
		if (lineCollision) overlaps.push(lineCollision);
		else return false;
	}
	return overlaps;
}

function getObjSatInside(linesObj, a, b) {
	for (let i = 0; i < linesObj.vertices.length; i++) {
		let lineCollision = getLineSatInside(
			linesObj.vertices[i],
			linesObj.vertices[(i + 1)%linesObj.vertices.length],
			a, b
		);
		if (!lineCollision) return false;
	}
	return true;
}

function getLineSatCollision(p1, p2, a, b) {
	return getAxisSatCollision(normalizeVector([p1[1] - p2[1], p2[0] - p1[0]]), a, b);
}

function getLineSatInside(p1, p2, a, b) {
	return getAxisSatInside(normalizeVector([p1[1] - p2[1], p2[0] - p1[0]]), a, b);
}

function getAxisSatCollision(axis, a, b) {
	var projA = projectObj(a, axis),
		projB = projectObj(b, axis);
	
	if (segmentsIntersect1D(projA, projB))
		return {
			axis,
			amount: overlapAmount(...projA, ...projB),
			dir: overlapDir(projA, projB)
		};
	else return false;
}

function getAxisSatInside(axis, a, b) {
	var projA = projectObj(a, axis),
		projB = projectObj(b, axis);
	
	if (segmentInside1D(projA, projB))
		return true;
	else return false;
}

function projectObj(obj, axis) {
	var min, max;
	obj.vertices.forEach(([x, y]) => {
		var proj = projectPoint([x + obj.x, y + obj.y], axis);
		min = min === undefined ? proj : Math.min(min, proj);
		max = max === undefined ? proj : Math.max(max, proj);
	});
	return [min, max];
}

function projectPoint(point, axis) {
	return dotProduct(point, axis);
	//return (point[0] * axis[0]) + (point[1] * axis[1]);
}

function segmentsIntersect1D(a, b) {
	return a[1] >= b[0] && b[1] >= a[0];
}

function segmentInside1D(a, b) {
	a = a.slice().sort((a, b) => a - b);
	b = b.slice().sort((a, b) => a - b);
	return a[0] >= b[0] && a[1] <= b[1];
}

function overlapAmount(...nums) { 
	// should have four args, each one a (1d) segment's endpoint
	// only works if it's known that there's an overlap
	nums.splice(nums.indexOf(Math.min(...nums)), 1);
	nums.splice(nums.indexOf(Math.max(...nums)), 1);
	return Math.abs(nums[0] - nums[1]);
}

function overlapDir(a, b) {
	var midA = a[0] + ((a[1] - a[0])/2),
		midB = b[0] + ((b[1] - b[0])/2);
	
	return Math.sign(midA - midB);
}



function getDisplacementVector(collisions) {
	var modVector = [0, 0];
	collisions.forEach(collision => {
		modVector = addVectors(modVector, scaleVector(collision.axis, collision.dir * collision.amount));
	});
	return modVector;
}

function bounceVector(vec, mirrorVec, scale = bounceSpeed) {
	// mirrorVec should be a unit vector i guess??
	// formula taken from http://www.3dkingdoms.com/weekly/weekly.php?a=2
	return scaleVector(addVectors(scaleVector(mirrorVec, -2 * dotProduct(vec, mirrorVec)), vec), scale);
}

function dotProduct(a, b) {
	var result = 0;
	a.forEach((n, i) => result += (n * b[i]));
	return result;
}

function scaleVector(vec, n) {
	return vec.map(vn => vn * n);
}

function addVectors(...vectors) {
	var result = [0, 0];
	vectors.forEach(([x, y]) => {
		result[0] += x;
		result[1] += y;
	});
	return result;
}

function normalizeVector(vec) {
	return scaleVector(vec, 1/Math.sqrt((vec[0] ** 2) + (vec[1] ** 2)));
}




function drawLevel() {
	level.objects.forEach(obj => drawLevelObject(obj));
}

function drawLevelObject(obj) {
	obj.sprites.forEach(sprite => {
		if (sprite.active) {
			drawLevelImage(images[sprite.image.src], obj.x + sprite.x, obj.y + sprite.y);
		}
	});
	/*
	if (obj.sprite !== undefined) {
		let sprite = obj.sprites[obj.sprite];
		drawLevelImage(images[sprite.image], obj.x + sprite.x, obj.y + sprite.y);
	}
	*/
}

function drawLevelImage(...args) {
	if (args[5] !== undefined) {
		args[5] -= camera.x;
		args[6] -= camera.y;
	} else {
		args[1] -= camera.x;
		args[2] -= camera.y;
	}
	ctx.drawImage(...args);
}


function drawHitboxes() {
	drawHitbox(ship);
	drawHitbox(claw);
	level.objects.forEach(obj => drawHitbox(obj));
}

function drawHitbox(obj) {
	ctx.beginPath();
	obj.vertices.forEach(([x, y], i) =>
		ctx[i ? "lineTo" : "moveTo"](x + obj.x - camera.x, y + obj.y - camera.y));
	ctx.closePath();
	ctx.setLineDash([5, 5]);
	ctx.lineDashOffset = 0;
	ctx.strokeStyle = "black";
	ctx.stroke();
	ctx.lineDashOffset = 5;
	ctx.strokeStyle = "white";
	ctx.stroke();
	ctx.lineDashOffset = 0;
	ctx.setLineDash([]);
}


function drawPolygon(x, y, vertices, color) {
	ctx.beginPath();
	vertices.forEach(([vx, vy], i) => ctx[i ? "lineTo" : "moveTo"](x + vx, y + vy));
	ctx.fillStyle = color;
	ctx.fill();
}



function copyObject(obj) {
	var result = {};
	for (let key in obj) {
		let val = obj[key];
		if (Array.isArray(val)) result[key] = val.slice();
		else if (val && typeof val === "object")
			result[key] = copyObject(val);
		else result[key] = val;
	}
	return result;
}



var effectsInfo = {
	gameScript: {
		syntax: true,
		func: function(info, ...effects) {
			gameScripts.push({
				info, effects,
				index: 0
			});
		}
	},
	gameLoop: {
		syntax: true,
		func: function(info, ...effects) {
			gameScripts.push({
				info, effects,
				loop: true,
				index: 0
			});
		}
	},
	wait: {
		func: function(info, duration) {
			return {
				isRunner: true,
				start: info.time,
				end: info.time + duration
			}
		}
	},
	slideTo: {
		func: function(info, x, y, duration) {
			var prevX = info.object.x,
				prevY = info.object.y,
				lengthX = x - prevX,
				lengthY = y - prevY;
			
			return {
				isRunner: true,
				start: info.time,
				end: info.time + duration,
				runStart: function() {
					info.object.transferVelX = lengthX/duration;
					info.object.transferVelY = lengthY/duration;
				},
				runEnd: function() {
					info.object.transferVelX = undefined;
					info.object.transferVelY = undefined;
				},
				run: function(elapsed) {
					var fraction = elapsed/duration;
					info.object.x = prevX + (fraction * lengthX);
					info.object.y = prevY + (fraction * lengthY);
				}
			}
		}
	},
	/*
	create: {
		func: function(i, obj, x, y) {
			obj = copyObject(obj);
			fillObjectProperties(obj);
			obj.x = x;
			obj.y = y;
			level.objects.push(obj);
		}
	},
	*/
	copy: {
		func: function(i, src /* parameters for properties and scripts to come */) {
			return copyObject(typeof src === "string" ? objects[src] : src);
		}
	},
	insert: {
		func: function(i, obj, x, y) {
			if (x !== undefined) obj.x = x;
			if (y !== undefined) obj.y = y;
			level.objects.push(obj);
		}
	},
	/*
	var: {
		func: function(i, name) {
			return level.variables[name];
		}
	},
	*/
	relativeX: {
		func: function(info, coord) {
			return info.object.x + coord;
		}
	},
	relativeY: {
		func: function(info, coord) {
			return info.object.y + coord;
		}
	},
	addScore: {
		func: function(i, amount) {
			score += amount;
		}
	},
	winLevel: {
		func: function() {
			winTime = 0;
			endMessage = winMessage;
		}
	},
	"console.log": {
		func: function(i, ...args) {
			console.log(...args);
		}
	}
}

function evalEffects(info, effects) {
	if (Array.isArray(effects)) return effects.map(e => evalEffect(info, e));
	else return effects;
}

function evalEffect(info, effect) {
	if (Array.isArray(effect)) {
		if (effectsInfo[effect[0]]) {
			let effectInfo = effectsInfo[effect[0]],
				args = effect.slice(1);
			
			return effectInfo.func(info, ...(effectInfo.syntax ? args : evalEffects(info, args)));
		} else console.error("Unknown effect " + JSON.stringify(effect[0]));
	} else return effect;
}



/*
function showCollisionVector(vec) {	
	var angle = 180 * (Math.asin(vec[1])/Math.PI);
	if (vec[0] < 0) angle = 180 - angle;
	
	collisionVectorElem.style.transform = `rotateZ(${angle}deg)`;
}
*/



var prevTime;

getBaseImages().then(() => getLevel().then(() => requestAnimationFrame(run)));

function run(time) {
	var d = time - (prevTime === undefined ? time: prevTime);
	
	
	if (prevTime === undefined) level.objects.forEach(obj => {
		evalEffects({
			object: obj,
			time,
			delta: d
		}, obj.onStart);
	});
	
	
	if (gameScripts.length) {
		let finishedScripts = [];
		
		gameScripts.forEach(script => {
			if (script.running) {
				let runTime, finished;
				
				if (time >= script.running.end) {
					runTime = script.running.end - script.running.start;
					finished = true;
				} else {
					runTime = time - script.running.start
				}
				
				if (script.running.run) script.running.run(runTime);
				
				if (finished) {
					if (script.running.runEnd) script.running.runEnd();
					script.running = false;
					script.index += 1;
				} else return;
			}
			
			while (script.index < script.effects.length) {
				let result = evalEffect({
						object: script.info.object,
						time,
						delta: d
					}, script.effects[script.index]);
				
				if (result && result.isRunner) {
					script.running = result;
					if (result.runStart) result.runStart();
					return;
				}
				script.index += 1;
			}
			
			if (script.loop) script.index = 0;
			else finishedScripts.push(script);
		});
		
		finishedScripts.forEach(script =>
			gameScripts.splice(gameScripts.indexOf(script), 1));
	}
	
	
	var deleteObjects = [];
	
	level.objects.forEach(obj => {
		if (obj.dragMultiplierX !== undefined) {
			let xDir = Math.sign(obj.velX);
			obj.velX -= drag * obj.dragMultiplierX * xDir * d;
			if (obj.velX * xDir < 0) obj.velX = 0;
			obj.x += obj.velX * d;
		}
		
		if (obj.dragMultiplierY !== undefined) {
			obj.velY += drag * obj.dragMultiplierY * d; // this should probably be sensitive to energy >.>
			obj.y += obj.velY * d;
		}
		
		if (obj.solidCollisions) { // the net + bubble stuff needs to be moved to a separate thing....
			var [objCollisions, net, energy] = getObjectCollisions(obj);
			if (net && obj.carriable) {
				deleteObjects.push(obj);
				evalEffects({
					object: obj,
					time,
					delta: d
				}, obj.rewards);
			} else if (obj.bubble) {
				if (energy) {
					deleteObjects.push(obj);
				} else if (getSpecificCollision(obj, ship)) {
					ship.energyLevel = ship.maxEnergy;
					deleteObjects.push(obj);
				} 
			} else if (objCollisions.length) {
				var modVector = getDisplacementVector(objCollisions);
				obj.x += modVector[0];
				obj.y += modVector[1];
				[obj.velX, obj.velY] = bounceVector([obj.velX, obj.velY], normalizeVector(modVector), obj.bounceMultiplier * bounceSpeed);
			}
		}
	});
	
	deleteObjects.forEach(obj => {
		level.objects.splice(level.objects.indexOf(obj), 1);
	});
	
	
	
	var inEnergy = getShipInEnergy(),
		currentDragX = inEnergy ? energyDragX : drag,
		currentDragY = inEnergy ? energyDragY : drag;
	
	
	
	if (controls.moveLeft || controls.moveRight || controls.moveUp || controls.moveDown) {
		ship.energyLevel -= keyEnergyLoss * d;
	}
	
	
	
	if (controls.moveLeft && ship.velX > -keyVelMax) {
		ship.velX -= keyVelRate;
	}
	
	if (controls.moveRight && ship.velX < keyVelMax) {
		ship.velX += keyVelRate;
	}
	
	
	if (controls.moveUp && ship.velY > -keyVelMax) {
		ship.velY -= keyVelRate;
	}
	
	if (controls.moveDown && ship.velY < keyVelMax) {
		ship.velY += keyVelRate;
	}
	
	
	ship.x += ship.velX * d;
	ship.y += ship.velY * d;
	
	
	var xDir = Math.sign(ship.velX);
	ship.velX -= currentDragX * d * xDir;
	if (Math.sign(ship.velX) === -xDir) ship.velX = 0;
	
	ship.velY += currentDragY * d;
	
	
	var droppedHeldItem;
	
	if (controls.claw && !claw.holding) {
		claw.extended += clawRate * d;
		if (claw.extended > clawMax) claw.extended = clawMax;
	} else if (claw.holding && claw.holding.carriable && !controls.claw && prevControls.claw) {
		claw.updateCoords();
		level.objects.push(claw.holding);
		if (claw.holding.dragMultiplierX !== undefined) claw.holding.velX = 0;
		if (claw.holding.dragMultiplierY !== undefined) claw.holding.velY = 0;
		claw.holding = false;
		droppedHeldItem = true;
	} else if (claw.holding && claw.holding.carriable) {
		claw.extended += clawCarryingRate * d;
		if (claw.extended > clawMax) claw.extended = clawMax;
	} else {
		claw.extended -= clawRate * d;
		if (claw.extended <= 0) {
			claw.extended = 0;
			if (claw.holding && !claw.holding.carriable) {
				let obj = claw.holding;
				claw.holding = false;
				evalEffects({
					object: obj,
					time,
					delta: d
				}, obj.rewards);
			}
		}
	}
	
	
	claw.updateCoords();
	
	
	var [shipCollisions, touchingEnergy] = getShipCollisions(),
		clawCollisions, clawCollectible;
	
	if (touchingEnergy) ship.energyLevel = ship.maxEnergy;
	
	if (claw.extended) [clawCollisions, clawCollectible] = getClawCollisions();
	
	if (clawCollectible && !claw.holding && !droppedHeldItem && prevControls.claw && !controls.claw) {
		claw.holding = clawCollectible;
		claw.holdingX = clawCollectible.x - claw.x;
		claw.holdingY = clawCollectible.y - claw.y;
		level.objects.splice(level.objects.indexOf(clawCollectible), 1);
	}
	
	var collisions = clawCollisions ? [...shipCollisions, ...clawCollisions] : shipCollisions;
	
	if (collisions.length) {
		//ctx.fillStyle = "red";
		let modVector = getDisplacementVector(collisions);
		
		ship.x += modVector[0];
		ship.y += modVector[1];
		
		let vectors = [[ship.velX, ship.velY]];
		
		if (clawCollisions && clawCollisions.length) {
			vectors.push([ship.velX, (!controls.claw || claw.extended === clawMax ? 0 : clawRate) + ship.velY]);
			
			/*
			let clawDir = [ship.velX, (!controls.claw || claw.extended === clawMax ? 0 : clawRate) + ship.velY],
				vel = Math.max(Math.sqrt((ship.velX ** 2) + (ship.velY ** 2)), Math.sqrt((clawDir[0] ** 2) + (clawDir[1] ** 2)));
					
			
			dir = scaleVector(normalizeVector(addVectors(dir, clawDir)), vel);
			*/
		}
		
		/*
		collisions.forEach(collision => {
			if (collision.transferVelX || collision.transferVelY)
				vectors.push([collision.transferVelX || 0, collision.transferVelY || 0]);
		});
		*/
		
		let magnitude = Math.max(...vectors.map(([x, y]) => Math.sqrt((x ** 2) + (y ** 2)))),
				//nnnnnnot quite sure if this is the best way to do that
			dir = scaleVector(normalizeVector(addVectors(...vectors)), magnitude),
			unitModVector = normalizeVector(modVector),
			shipDir = bounceVector(dir, unitModVector);
		
		collisions.forEach(collision => {
			if (collision.transferVelX || collision.transferVelY) {
				let dp = dotProduct([collision.transferVelX || 0, collision.transferVelY || 0], unitModVector);
				shipDir[0] += dp * unitModVector[0];
				shipDir[1] += dp * unitModVector[1];
				// i kinda doubt this is the best way to do this??
				// i really need to figure out how this stuff should actually be done at some point
			}
		});
		
		[ship.velX, ship.velY] = shipDir;
		//showCollisionVector(modVector);
	} //else ctx.fillStyle = "black";
	
	
	claw.updateCoords();
	
	
	if (shipCollisions.length) {
		
		ship.energyLevel -= bumpEnergyLoss;
		
		if (claw.holding && claw.holding.carriable) {
			level.objects.push(claw.holding);
			claw.holding = false;
		}
		
	}
	
	
	camera.x = Math.round(ship.x - (camera.width/2) + (ship.width/2));
	camera.y = Math.round(ship.y - (camera.height/2) + (ship.height/2));
	
	if (camera.x < level.minX) camera.x = level.minX;
	else if (camera.x > level.maxX - camera.width) camera.x = level.maxX - camera.width;
	if (camera.y < level.minY) camera.y = level.minY;
	else if (camera.y > level.maxY - camera.height) camera.y = level.maxY - camera.height;
	
	
	ctx.clearRect(0, 0, camera.width, camera.height);
	
	if (level.background)
		ctx.drawImage(images[level.background], 0, 0);
	
	var armImage = images[claw.armSprite],
		armDimensions = [armImage.width, (claw.armSpriteEnds * 2) + claw.extended];
	
	drawLevelImage(
		armImage,
		0, armImage.height - (claw.armSpriteEnds * 2) - claw.extended,
		...armDimensions,
		claw.x + claw.armSpriteX, ship.y + ship.height - claw.height - claw.armSpriteEnds,
		...armDimensions
	);
	
	drawLevelImage(images[claw.sprite], claw.x + claw.spriteX, claw.y + claw.spriteY);
	
	drawLevelImage(images[ship.sprite], ship.x + ship.spriteX, ship.y + ship.spriteY);
	
	let energySpriteIndex = Math.floor((ship.energyLevel/ship.maxEnergy) * ship.energySprites.length);
	if (energySpriteIndex >= ship.energySprites.length) energySpriteIndex = ship.energySprites.length - 1;
	else if (energySpriteIndex < 0) energySpriteIndex = 0;
	drawLevelImage(images[ship.energySprites[energySpriteIndex]], ship.x + ship.spriteX, ship.y + ship.spriteY);
	
	if (claw.holding) drawLevelObject(claw.holding);
	
	drawLevel();
	
	if (level.foreground)
		ctx.drawImage(images[level.foreground], level.minX-camera.x, level.minY-camera.y);
	
	
	if (hitboxInp.checked) drawHitboxes();
	
	
	scoreElem.textContent = score;
	
	
	if (ship.energyLevel < 0 && winTime === undefined) {
		winTime = 0;
		endMessage = loseMessage;
	}
	
	
	if (winTime !== undefined) {
		ctx.fillStyle = `rgba(0, 0, 0, ${(winTime > winTimeMax ? winTimeMax : winTime)/winTimeMax})`;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.font = "50px sans-serif";
		ctx.fillStyle = "yellow";
		let width = ctx.measureText(endMessage).width,
			messageY = (canvas.height + 50)/2;
		ctx.fillText(endMessage, (canvas.width - width)/2, messageY);
		if (winTime > winTimeMax/2) {
			let scoreMessage = "Score: " + score;
			ctx.font = "30px sans-serif";
			let scoreWidth = ctx.measureText(scoreMessage).width;
			ctx.fillText(scoreMessage, (canvas.width - scoreWidth)/2, messageY + 50);
		}
		winTime += d;
	}
	
	
	Object.assign(prevControls, controls);
	
	prevTime = time;
	
	if (winTime === undefined || winTime < winTimeMax) requestAnimationFrame(run);
	
}