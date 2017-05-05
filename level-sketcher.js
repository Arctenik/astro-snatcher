

var inp = document.querySelector("input"),
	button = document.querySelector("button"),
	canvas = document.querySelector("canvas"),
	ctx = canvas.getContext("2d");


button.onclick = () => {
	var r = new XMLHttpRequest();
	r.open("get", inp.value + "/level.json");
	r.responseType = "json";
	r.onload = () => {
		var level = r.response;
		canvas.width = level.width;
		canvas.height = level.height;
		ctx.fillStyle = "white";
		ctx.fillRect(0, 0, level.width, level.height);
		level.objects.forEach(obj => drawLevelObject(obj));
	}
	r.send();
}

function drawLevelObject(obj) {
	drawPolygon(obj.x, obj.y, obj.vertices, obj.solid ? "gray" : (obj.collectible ? "lightgreen" : "lightgray"));
}

function drawPolygon(x, y, vertices, color) {
	ctx.beginPath();
	vertices.forEach(([vx, vy], i) => ctx[i ? "lineTo" : "moveTo"](x + vx, y + vy));
	ctx.closePath();
	ctx.fillStyle = color;
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;
	ctx.globalAlpha = 0.5;
	ctx.fill();
	ctx.globalAlpha = 1;
	ctx.stroke();
}