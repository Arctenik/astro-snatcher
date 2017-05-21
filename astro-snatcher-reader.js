

var objProps = {
	"on start": "onStart",
	"bounce multiplier": "bounceMultiplier",
	"drag multiplier y": "dragMultiplierY",
	"drag multiplier x": "dragMultiplierX",
	"solid collisions": "solidCollisions",
	"solid": "solid",
	"collectible": "collectible",
	"rewards": "rewards",
	"carriable": "carriable",
	"energy": "energy",
	"net": "net"
}

function convertProps({properties}, conversions, target) {
	if (properties) {
		for (let key in properties) {
			let keyLower = key.toLowerCase();
			if (conversions[keyLower])
				target[conversions[keyLower]] = properties[key];
		}
	}
	return target;
}


function readLevel(level) {
	let levelSprites = [],
		images = [],
		initObjects = [],
		reservedObjects = [];
	
	let nextZ = 0;
	
	level.layers.forEach(layer => {
		let layerX = layer.x + (layer.offsetx || 0),
			layerY = layer.y + (layer.offsety || 0);
		
		if (layer.type === "group") {
			if (layer.name === "_images") {
				layer.layers.forEach(sublayer => {
					if (sublayer.type === "imagelayer") {
						images.push({
							name: sublayer.name,
							src: sublayer.image
						});
					}
				});
			} else {
				let hitboxes = [],
					sprites = [];
				
				let layerZ = nextZ++;
				
				layer.layers.forEach(sublayer => {
					let sublayerX = layerX + sublayer.x + (sublayer.offsetx || 0),
						sublayerY = layerY + sublayer.y + (sublayer.offsety || 0);
					
					if (sublayer.type === "objectgroup") {
						let polygons = [];
						
						sublayer.objects.forEach(sublayerObj => {
							if (sublayerObj.polygon) {
								polygons.push(...partition(sublayerObj.polygon).map(p => convertPolygon(p, sublayerX + sublayerObj.x, sublayerY + sublayerObj.y)));
							} else {
								let left = sublayerX + sublayerObj.x,
									top = sublayerY + sublayerObj.y,
									right = left + sublayerObj.width,
									bottom = top + sublayerObj.height;
								
								polygons.push([
									[left, top],
									[right, top],
									[right, bottom],
									[left, bottom]
								]);
							}
						});
						
						let xs = [], ys = [];
						polygons.forEach(p => p.forEach(([x, y]) => {
							xs.push(x);
							ys.push(y);
						}));
						
						let minX = Math.min(...xs),
							maxX = Math.max(...xs),
							minY = Math.min(...ys),
							maxY = Math.max(...ys);
						
						hitboxes.push({
							name: sublayer.name,
							active: sublayer.visible,
							x: minX,
							y: minY,
							width: maxX - minX,
							height: maxY - minY,
							polygons: polygons.map(p => p.map(([x, y]) => [x - minX, y - minY]))
						});
					} else if (sublayer.type === "imagelayer") {
						let image = {
							src: sublayer.image
						};
						images.push(image);
						sprites.push({
							name: sublayer.name,
							x: sublayerX,
							y: sublayerY,
							z: layerZ,
							image,
							active: sublayer.visible
						});
					}
				});
				
				let xs = [], ys = [];
				
				(hitboxes.length ? hitboxes : sprites).forEach(({x, y}, i, a) => {
					xs.push(x);
					ys.push(y);
				});
				
				let minX = Math.min(...xs),
					minY = Math.min(...ys);
				
				hitboxes.forEach(hb => {
					hb.x -= minX;
					hb.y -= minY;
				});
				
				sprites.forEach(sprite => {
					sprite.x -= minX;
					sprite.y -= minY;
				});
				
				(layer.visible ? initObjects : reservedObjects).push({
					name: layer.name,
					object: convertProps(layer, objProps, {
						x: minX,
						y: minY,
						sprites,
						hitboxes
					})
				});
			}
		} else if (layer.type === "imagelayer") {
			let image = {
				src: layer.image
			};
			images.push(image);
			levelSprites.push({
				name: layer.name,
				x: layerX,
				y: layerY,
				z: nextZ++,
				image,
				active: layer.visible,
				parallax: layer.properties && layer.properties.parallax
			});
		}
	});
	
	let scripts = [];
	if (level.properties) {
		for (let key in level.properties) {
			if (/^script\d*$/.test(key.toLowerCase()))
				scripts.push(level.properties[key]);
		}
	}
	
	return {
		images,
		scripts,
		initObjects,
		reservedObjects,
		width: level.width * level.tilewidth,
		height: level.height * level.tileheight,
		sprites: levelSprites
	};
}

function convertPolygon(polygon, px, py) {
	return polygon.map(({x, y}) => [x + px, y + py]);
}


// should probably note that all these rely on keeping the same point objects

function partition(vertices) {
	if (windingDirection(vertices) === -1) {
		vertices = vertices.slice().reverse();
	}
	
	var isConvex = true;
	for (let i = 0; i < vertices.length; i++) {
		if (!isConvexAngle(vertices[(i || vertices.length) - 1], vertices[i], vertices[(i + 1)%vertices.length])) {
			isConvex = false;
			break;
		}
	}
	if (isConvex) return [vertices];
	
	var polygons = triangulate(vertices);
	for (let i = 0; i < polygons.length; i++) {
		let newPolygons = true;
		while (newPolygons) {
			newPolygons = makeNextJoin(polygons, i);
			if (newPolygons) polygons = newPolygons;
		}
	}
	return polygons;
}

function makeNextJoin(polygons, start) {
	var p = polygons[start];
	for (var i = start + 1; i < polygons.length; i++) {
		let side = getSharedSide(p, polygons[i]);
		if (side) {
			let joined = makeJoin(polygons, start, i, side);
			if (joined) return joined;
		}
	}
}

function getSharedSide(a, b) {
	for (let i = 0; i < a.length; i++) {
		let v1 = a[i],
			bi = b.indexOf(v1);
		
		if (bi !== -1) {
			let i2 = (i + 1)%a.length,
				bi2 = (bi || b.length) - 1;
			
			if (b[bi2] === a[i2]) return [i, i2, bi, bi2];
		}
	}
}

function makeJoin(polygons, ai, bi, [a1i, a2i, b1i, b2i]) {
	var a = polygons[ai],
		b = polygons[bi];
	
	if (
		isConvexAngle(a[(a1i || a.length) - 1], a[a1i], b[(b1i + 1)%b.length]) &&
		isConvexAngle(b[(b2i || b.length) - 1], b[b2i], a[(a2i + 1)%a.length])
	) {
		let newA = a.slice(),
			newFromB;
		
		if (b1i) newFromB = [...b.slice(b1i + 1), ...b.slice(0, b2i)];
		else newFromB = b.slice(1, b.length - 1);
		
		newA.splice(a2i, 0, ...newFromB);
		
		let result = polygons.slice();
		result[ai] = newA;
		result.splice(bi, 1);
		return result;
	}
}


function triangulate(vertices) {
	var triangles = [];
	while (vertices.length > 3) {
		let [triangle, newVertices] = getNextTriangle(vertices);
		triangles.push(triangle);
		vertices = newVertices;
	}
	triangles.push(vertices);
	return triangles;
}

function getNextTriangle(vertices) {
	for (let i = 0; i < vertices.length; i++) {
		let a = vertices[(i || vertices.length) - 1],
			b = vertices[i],
			c = vertices[(i + 1)%vertices.length];
		
		if (isConvexAngle(a, b, c) && isEar([a, b, c], vertices)) {
			vertices = vertices.slice();
			vertices.splice(i, 1);
			return [[a, b, c], vertices];
		}
	}
}

function isConvexAngle(a, b, c) {
	return ((Math.PI * 2) + (getAngle(b, c) - getAngle(b, a)))%(Math.PI * 2) <= Math.PI;
}

function getAngle(a, b) {
	var dx = b.x - a.x,
		dy = b.y - a.y,
		dirX = Math.sign(dx),
		dirY = Math.sign(dy);
	
	return Math.atan(dy/dx) + (dirX === -1 ? Math.PI : (dirY > -1 ? 0 : Math.PI * 2));
}

function isEar(triangle, vertices) {
	for (let vertex of vertices) {
		if (!triangle.includes(vertex) && pointInTriangle(vertex, triangle)) return false;
	}
	return true;
}

function pointInTriangle(point, triangle) {
	for (let i = 0; i < triangle.length; i++) {
		let p1 = triangle[i],
			p2 = triangle[(i + 1)%triangle.length],
			axis = normalizeVector([p1.y - p2.y, p2.x - p1.x]),
			[min, max] = projectVertices(triangle, axis),
			proj = projectPoint([point.x, point.y], axis);
		
		if (proj < min || proj > max) return false;
	}
	return true;
}

function projectVertices(vertices, axis) {
	var min, max;
	vertices.forEach(({x, y}) => {
		var proj = projectPoint([x, y], axis);
		min = min === undefined ? proj : Math.min(min, proj);
		max = max === undefined ? proj : Math.max(max, proj);
	});
	return [min, max];
}

function windingDirection(vertices) {
	var sum = 0;
	vertices.forEach(({x: x1, y: y1}, i) => {
		var {x: x2, y: y2} = vertices[(i + 1)%vertices.length];
		sum += (x2 - x1) * (y2 + y1);
	});
	return Math.sign(sum);
}







// (for debugging)
function drawNormalizedPolygon(vertices) {
	var xs = [], ys = [];
	vertices.forEach(({x, y}) => {
		xs.push(x);
		ys.push(y);
	});
	var minX = Math.min(...xs),
		minY = Math.min(...ys),
		maxX = Math.max(...xs),
		maxY = Math.max(...ys);
	
	canvas.width = maxX - minX;
	canvas.height = maxY - minY;
	ctx.beginPath();
	vertices.forEach(({x, y}, i) => ctx[i ? "lineTo" : "moveTo"](x - minX, y - minY));
	ctx.lineWidth = 3;
	ctx.strokeStyle = "#8000ff";
	ctx.closePath();
	ctx.stroke();
	
	vertices.forEach(({x, y}, i) => {
		var r = Math.round((i/(vertices.length - 1)) * 255),
			gb = 255 - r;
		ctx.fillStyle = `rgb(${r}, ${gb}, ${gb})`;
		ctx.fillRect(x - minX - 5, y - minY - 5, 10, 10);
	});
}