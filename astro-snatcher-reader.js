

function readLevel(level) {
	level.layers.forEach(layer => {
		if (layer.type === "group") {
			layer.layers.forEach(layer => {
				if (layer.type === "objectgroup") {
					layer.objects.forEach(obj => {
						if (obj.polygon) {
							
						}
					});
				}
			});
		}
	});
}


// should probably note that all these rely on keeping the same point objects

function partition(vertices) {
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