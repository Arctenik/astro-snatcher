

//var collisionVectorElem = document.getElementById("collisionVectorElem");

var canvas = document.getElementById("canvas"),
	ctx = canvas.getContext("2d");

var keyVelMax = 0.15,
	keyVelRate = 0.003,
	drag = 0.00003, // also functions as gravity
	bounceSpeed = 0.9,
	clawRate = 0.1,
	clawMax = 64;

var level;

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

var controls = {
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
		vertices: [
			[10, 0],
			[90, 0],
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
		r.open("get", "test-level.json");
		r.responseType = "json";
		r.onload = () => {
			level = addLevelBoxes(r.response);
			resolve();
		}
		r.send();
	});
}

function addLevelBoxes(level) {
	level.objects.forEach(obj => addObjectBox(obj));
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
	drawPolygon(obj.x - camera.x, obj.y - camera.y, obj.vertices, obj.solid ? "gray" : (obj.collectible ? "lightgreen" : "lightgray"));
}

function drawPolygon(x, y, vertices, color) {
	ctx.beginPath();
	vertices.forEach(([vx, vy], i) => ctx[i ? "lineTo" : "moveTo"](x + vx, y + vy));
	ctx.fillStyle = color;
	ctx.fill();
}



/*
function showCollisionVector(vec) {	
	var angle = 180 * (Math.asin(vec[1])/Math.PI);
	if (vec[0] < 0) angle = 180 - angle;
	
	collisionVectorElem.style.transform = `rotateZ(${angle}deg)`;
}
*/



var prevTime;

getLevel().then(() => requestAnimationFrame(run));

function run(time) {
	
	var d = time - (prevTime === undefined ? time: prevTime);
	
	
	
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
	
	
	if (controls.claw) {
		claw.extended += clawRate * d;
		if (claw.extended > clawMax) claw.extended = clawMax;
	} else {
		claw.extended -= clawRate * d;
		if (claw.extended < 0) claw.extended = 0;
	}
	
	
	claw.updateCoords();
	
	
	var shipCollisions = getShipCollisions(),
		clawCollisions, clawCollectible;
	
	if (claw.extended) [clawCollisions, clawCollectible] = getClawCollisions();
	
	if (clawCollectible && prevControls.claw && !controls.claw) {
		claw.holding = clawCollectible;
		claw.holdingX = clawCollectible.x - claw.x;
		claw.holdingY = clawCollectible.y - claw.y;
		level.objects.splice(level.objects.indexOf(clawCollectible), 1);
	}
	
	var collisions = clawCollisions ? [...shipCollisions, ...clawCollisions] : shipCollisions;
	
	if (collisions.length) {
		//ctx.fillStyle = "red";
		let modVector = [0, 0];
		collisions.forEach(collision => {
			modVector = addVectors(modVector, scaleVector(collision.axis, collision.dir * collision.amount));
		});
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
	
	
	camera.x = Math.round(ship.x - (camera.width/2) + (ship.width/2));
	camera.y = Math.round(ship.y - (camera.height/2) + (ship.height/2));
	
	if (camera.x < 0) camera.x = 0;
	else if (camera.x > level.width - camera.width) camera.x = level.width - camera.width;
	if (camera.y < 0) camera.y = 0;
	else if (camera.y > level.height - camera.height) camera.y = level.height - camera.height;
	
	
	ctx.clearRect(0, 0, camera.width, camera.height);
	
	drawPolygon(ship.x - camera.x, ship.y - camera.y, ship.vertices, "black");
	drawPolygon(claw.x - camera.x, claw.y - camera.y, claw.vertices, "red");
	
	if (claw.holding) drawLevelObject(claw.holding);
	
	drawLevel();
	
	
	Object.assign(prevControls, controls);
	
	prevTime = time;
	
	requestAnimationFrame(run);
	
}