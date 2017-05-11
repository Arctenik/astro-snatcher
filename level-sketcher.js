

var inp = document.querySelector("input"),
	button = document.querySelector("button"),
	canvas = document.querySelector("canvas"),
	ctx = canvas.getContext("2d");


var path = queryVar("level");
if (path) {
	inp.value = path;
	draw(path);
}

button.onclick = () => {
	location = "?level=" + inp.value;
}

function draw(folderPath) {
	var r = new XMLHttpRequest();
	r.open("get", folderPath + "/level.json");
	r.responseType = "json";
	r.onload = () => {
		drawLevel(r.response);
	}
	r.send();
}

function drawLevel(level) {
	canvas.width = level.width;
	canvas.height = level.height;
	ctx.fillStyle = "white";
	ctx.fillRect(0, 0, level.width, level.height);
	level.objects.forEach(obj => drawLevelObject(level.originX || 0, level.originY || 0, obj));
}

function drawLevelObject(ox, oy, obj) {
	drawPolygon(ox, oy, obj.x, obj.y, obj.vertices, getObjectColor(obj));
}

function getObjectColor(obj) {
	if (obj.carriable) return "green";
	if (obj.collectible) return "lightgreen";
	if (obj.energy) return "gold";
	if (obj.bubble) return "goldenrod";
	if (obj.net) return "aquamarine";
	if (obj.onStart) return "darkorchid";
	if (obj.solid) return "gray";
	return "lightgray";
}

function drawPolygon(ox, oy, x, y, vertices, color) {
	ctx.beginPath();
	vertices.forEach(([vx, vy], i) => ctx[i ? "lineTo" : "moveTo"](x + vx + ox, y + vy + oy));
	ctx.closePath();
	ctx.fillStyle = color;
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;
	ctx.globalAlpha = 0.5;
	ctx.fill();
	ctx.globalAlpha = 1;
	ctx.stroke();
}

function queryVar(name) {
	for (let item of location.search.substring(1).split("&")) {
		let [key, val] = item.split("=");
		if (key === name) return val;
	}
	return false;
}