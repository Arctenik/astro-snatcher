

//var collisionVectorElem = document.getElementById("collisionVectorElem");

var hitboxInp = document.getElementById("hitboxInp");

var canvas = document.getElementById("canvas"),
	ctx = canvas.getContext("2d");

var keyVelMax = 0.15,
	keyVelRate = 0.003,
	drag = 0.00003, // also functions as gravity
	bounceSpeed = 0.9,
	clawRate = 0.1,
	clawCarryingRate = 0.025,
	clawMax = 64,
	winTimeMax = 2000;

var winMessage = "STAGE CLEAR";

var baseImageNames = ["ship.png", "claw.png", "claw-arm.png"],
	images = {};

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
		armSpriteEnds: 5, // (amount that it continues beyond the "actual" arm on either side)
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
			level = fillLevelProperties(r.response);
			getLevelImages().then(resolve);
		}
		r.send();
	});
}

function fillLevelProperties(level) {
	level.objects.forEach(obj => {
		addObjectBox(obj);
		if (obj.hasGravity) obj.velY = 0;
	});
	return level;
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
		var imageNames = [];
		if (level.background) imageNames.push(level.background);
		if (level.foreground) imageNames.push(level.foreground);
		level.objects.forEach(obj => {
			if (obj.sprite) imageNames.push(obj.sprite);
		});
		Promise.all(imageNames.map(name => getImage(name, levelPath + "/"))).then(resolve);
	});
}

function getBaseImages() {
	return Promise.all(baseImageNames.map(name => getImage(name)));
}

function getImage(name, pathPrefix = "") {
	return new Promise(resolve => {
		var img = new Image();
		img.onload = () => {
			images[name] = img;
			resolve();
		}
		img.src = pathPrefix + name;
	});
}



function getObjectCollisions(obj) {
	var collisions = [],
		net;
	
	for (var i = 0; i < level.objects.length; i++) {
		let levelObj = level.objects[i];
		if (obj !== levelObj && (levelObj.solid || (levelObj.net && !net))) {
			let collision = getSpecificCollision(obj, levelObj);
			if (collision) {
				if (levelObj.net) net = levelObj;
				else collisions.push(collision);
			}
		}
	}
	
	return [collisions, net];
}

function getShipCollisions() {
	var collisions = [];
	for (var i = 0; i < level.objects.length; i++) {
		let levelObj = level.objects[i];
		if (levelObj.solid) {
			let collision = getSpecificCollision(ship, levelObj);
			if (collision) collisions.push(collision);
		}
	}
	return collisions;
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
	return getRectCollision(a, b) && getSatCollision(a, b);
}

function getRectCollision(a, b) {
	return segmentsIntersect1D([a.x, a.x + a.width], [b.x, b.x + b.width])
		&& segmentsIntersect1D([a.y, a.y + a.height], [b.y, b.y + b.height]);
}

function getSatCollision(a, b) {
	var c1 = getObjSatCollision(a, a, b);
	if (c1) {
		var c2 = getObjSatCollision(b, a, b);
		if (c2) return [...c1, ...c2].sort((a, b) => a.amount - b.amount)[0];
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

function getLineSatCollision(p1, p2, a, b) {
	return getAxisSatCollision(normalizeVector([p1[1] - p2[1], p2[0] - p1[0]]), a, b);
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
	return (point[0] * axis[0]) + (point[1] * axis[1]);
}

function segmentsIntersect1D(a, b) {
	return a[1] >= b[0] && b[1] >= a[0];
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

function bounceVector(vec, mirrorVec) {
	// mirrorVec should be a unit vector i guess??
	// formula taken from http://www.3dkingdoms.com/weekly/weekly.php?a=2
	return scaleVector(addVectors(scaleVector(mirrorVec, -2 * dotProduct(vec, mirrorVec)), vec), bounceSpeed);
}

function dotProduct(a, b) {
	var result = 0;
	a.forEach((n, i) => result += (n * b[i]));
	return result;
}

function scaleVector(vec, n) {
	return vec.map(vn => vn * n);
}

function addVectors(a, b) {
	return a.map((n, i) => n + b[i]);
}

function normalizeVector(vec) {
	return scaleVector(vec, 1/Math.sqrt((vec[0] ** 2) + (vec[1] ** 2)));
}




function drawLevel() {
	level.objects.forEach(obj => drawLevelObject(obj));
}

function drawLevelObject(obj) {
	if (obj.sprite) drawLevelImage(images[obj.sprite], obj.x + obj.spriteX, obj.y + obj.spriteY);
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



var effectFuncs = {
	addScore(amount) {
		score += amount;
	},
	winLevel() {
		winTime = 0;
	}
}

function evalEffects(effects) {
	if (effects) effects.forEach(effect => {
		if (effectFuncs[effect[0]])
			effectFuncs[effect[0]](...effect.slice(1));
	});
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
	
	
	var deleteObjects = [];
	
	level.objects.forEach(obj => {
		if (obj.hasGravity) {
			obj.velY += drag * d;
			obj.y += obj.velY * d;
			var [objCollisions, net] = getObjectCollisions(obj);
			if (net && obj.carriable) {
				deleteObjects.push(obj);
				evalEffects(obj.rewards);
			} else if (objCollisions.length) {
				var modVector = getDisplacementVector(objCollisions);
				obj.x += modVector[0];
				obj.y += modVector[1];
				obj.velY = 0;
			}
		}
	});
	
	deleteObjects.forEach(obj => {
		level.objects.splice(level.objects.indexOf(obj), 1);
	});
	
	
	
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
	ship.velX -= drag * d * xDir;
	if (Math.sign(ship.velX) === -xDir) ship.velX = 0;
	
	ship.velY += drag * d;
	
	
	var droppedHeldItem;
	
	if (controls.claw && !claw.holding) {
		claw.extended += clawRate * d;
		if (claw.extended > clawMax) claw.extended = clawMax;
	} else if (claw.holding && !controls.claw && prevControls.claw) {
		claw.updateCoords();
		level.objects.push(claw.holding);
		claw.holding.velY = 0;
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
				evalEffects(obj.rewards);
			}
		}
	}
	
	
	claw.updateCoords();
	
	
	var shipCollisions = getShipCollisions(),
		clawCollisions, clawCollectible;
	
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
		let dir = [ship.velX, ship.velY];
		if (clawCollisions && clawCollisions.length) {
			let clawDir = [ship.velX, (!controls.claw || claw.extended === clawMax ? 0 : clawRate) + ship.velY],
				vel = Math.max((ship.velX ** 2) + (ship.velY ** 2), Math.sqrt((clawDir[0] ** 2) + (clawDir[1] ** 2)));
					//nnnnnnot quite sure if this is the best way to do that
			
			dir = scaleVector(normalizeVector(addVectors(dir, clawDir)), vel);
		}
		[ship.velX, ship.velY] = bounceVector(dir, normalizeVector(modVector));
		//showCollisionVector(modVector);
	} //else ctx.fillStyle = "black";
	
	
	claw.updateCoords();
	
	
	if (shipCollisions.length && claw.holding && claw.holding.carriable) {
		level.objects.push(claw.holding);
		claw.holding = false;
	}
	
	
	camera.x = Math.round(ship.x - (camera.width/2) + (ship.width/2));
	camera.y = Math.round(ship.y - (camera.height/2) + (ship.height/2));
	
	if (camera.x < 0) camera.x = 0;
	else if (camera.x > level.width - camera.width) camera.x = level.width - camera.width;
	if (camera.y < 0) camera.y = 0;
	else if (camera.y > level.height - camera.height) camera.y = level.height - camera.height;
	
	
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
	
	if (claw.holding) drawLevelObject(claw.holding);
	
	drawLevel();
	
	if (level.foreground)
		ctx.drawImage(images[level.foreground], -camera.x, -camera.y);
	
	
	if (hitboxInp.checked) drawHitboxes();
	
	
	scoreElem.textContent = score;
	
	
	if (winTime !== undefined) {
		ctx.fillStyle = `rgba(0, 0, 0, ${(winTime > winTimeMax ? winTimeMax : winTime)/winTimeMax})`;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.font = "50px sans-serif";
		ctx.fillStyle = "yellow";
		let {width} = ctx.measureText(winMessage);
		ctx.fillText(winMessage, (canvas.width - width)/2, (canvas.height + 50)/2);
		winTime += d;
	}
	
	
	Object.assign(prevControls, controls);
	
	prevTime = time;
	
	if (winTime === undefined || winTime < winTimeMax) requestAnimationFrame(run);
	
}