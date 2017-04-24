

//var collisionVectorElem = document.getElementById("collisionVectorElem");

var canvas = document.getElementById("canvas"),
	ctx = canvas.getContext("2d");

var keyVelMax = 0.15,
	keyVelRate = 0.003,
	drag = 0.00003, // also functions as gravity
	bounceSpeed = 0.9;

var level,
	background;

var upKey = false,
	rightKey = false,
	leftKey = false,
	downKey = false,
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
	});



document.addEventListener("keydown", e => {
	switch (e.key) {
		case "ArrowUp": upKey = true; break;
		case "ArrowRight": rightKey = true; break;
		case "ArrowDown": downKey = true; break;
		case "ArrowLeft": leftKey = true; break;
	}
});

document.addEventListener("keyup", e => {
	switch (e.key) {
		case "ArrowUp": upKey = false; break;
		case "ArrowRight": rightKey = false; break;
		case "ArrowDown": downKey = false; break;
		case "ArrowLeft": leftKey = false; break;
	}
});



function getLevel() {
	return new Promise(resolve => {
		var r = new XMLHttpRequest();
		r.open("get", "test-level.json");
		r.responseType = "json";
		r.onload = () => {
			level = addLevelBoxes(r.response);
			background = document.createElement("canvas");
			var bgCtx = background.getContext("2d");
			background.width = level.width;
			background.height = level.height;
			bgCtx.fillStyle = "gray";
			level.objects.forEach(obj => {
				bgCtx.beginPath();
				obj.vertices.forEach(([x, y], i) => {
					bgCtx[i ? "lineTo" : "moveTo"](x + obj.x, y + obj.y);
				});
				bgCtx.fill();
			});
			/*
			bgCtx.strokeStyle = "rgba(255, 0, 0, 0.5)";
			level.objects.forEach(obj => {
				bgCtx.strokeRect(obj.x, obj.y, obj.width, obj.height);
			});
			*/
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



function getCollisions() {
	// i think i should at some point have this detect every specific object
	// that there's a collision with??
	var collisions = [];
	for (var i = 0; i < level.objects.length; i++) {
		let collision = getSpecificCollision(ship, level.objects[i]);
		if (collision) collisions.push(collision);
	}
	return collisions;
}

function getSpecificCollision(a, b) { // "a" should be the ship i guess??
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
	
	
	var xDir, yDir;
	
	
	if (leftKey && ship.velX > -keyVelMax) {
		ship.velX -= keyVelRate;
	}
	
	if (rightKey && ship.velX < keyVelMax) {
		ship.velX += keyVelRate;
	}
	
	
	if (upKey && ship.velY > -keyVelMax) {
		ship.velY -= keyVelRate;
	}
	
	if (downKey && ship.velY < keyVelMax) {
		ship.velY += keyVelRate;
	}
	
	
	ship.x += ship.velX * d;
	ship.y += ship.velY * d;
	
	
	xDir = Math.sign(ship.velX);
	ship.velX -= drag * d * xDir;
	if (Math.sign(ship.velX) === -xDir) ship.velX = 0;
	
	ship.velY += drag * d;
	
	
	var collisions = getCollisions();
	if (collisions.length) {
		//ctx.fillStyle = "red";
		let modVector = [0, 0];
		collisions.forEach(collision => {
			modVector = addVectors(modVector, scaleVector(collision.axis, collision.dir * collision.amount));
		});
		ship.x += modVector[0];
		ship.y += modVector[1];
		[ship.velX, ship.velY] = bounceVector([ship.velX, ship.velY], normalizeVector(modVector));
		//showCollisionVector(modVector);
	} //else ctx.fillStyle = "black";
	
	
	camera.x = Math.round(ship.x - (camera.width/2) + (ship.width/2));
	camera.y = Math.round(ship.y - (camera.height/2) + (ship.height/2));
	
	if (camera.x < 0) camera.x = 0;
	else if (camera.x > level.width - camera.width) camera.x = level.width - camera.width;
	if (camera.y < 0) camera.y = 0;
	else if (camera.y > level.height - camera.height) camera.y = level.height - camera.height;
	
	
	ctx.clearRect(0, 0, camera.width, camera.height);
	
	ctx.drawImage(background, camera.x, camera.y, camera.width, camera.height, 0, 0, camera.width, camera.height);
	
	var shipRenderX = ship.x - camera.x,
		shipRenderY = ship.y - camera.y;
	
	ctx.beginPath();
	ship.vertices.forEach(([x, y], i) => {
		ctx[i ? "lineTo" : "moveTo"](shipRenderX + x, shipRenderY + y);
	});
	ctx.fill();
	
	
	prevTime = time;
	
	requestAnimationFrame(run);
	
}