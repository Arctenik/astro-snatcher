

var widthInp = document.querySelector("#widthInp"),
	heightInp = document.querySelector("#heightInp"),
	button = document.querySelector("button"),
	canvas = document.querySelector("canvas"),
	ctx = canvas.getContext("2d");

var starChance = 0.0002,
	minAlpha = 64,
	minSize = 1,
	maxSize = 2;



button.onclick = () => gen(widthInp.value, heightInp.value);


function gen(width, height) {
	canvas.width = width;
	canvas.height = height;
	ctx.fillStyle = "black";
	ctx.fillRect(0, 0, width, height);
	for (let x = 0; x < width; x++) {
		for (let y = 0; y < height; y++) {
			star(x, y);
		}
	}
}

function star(x, y) {
	if (Math.random() < starChance) {
		var level = Math.random(),
			alpha = ((255 - minAlpha) * level) + minAlpha,
			size = ((maxSize - minSize) * level) + minSize;
		
		circle(x, y, size, `rgba(255, 255, 255, ${alpha/255})`);
	}
}

function circle(x, y, r, color) {
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, 2 * Math.PI);
	ctx.fill();
}