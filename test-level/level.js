(level, objects) => ({
	callbacks: {
		treasureRewards() {
			level.addScore(300);
			level.win();
		},
		trinketRewards() {
			level.addScore(25);
		},
		alienLoop(obj) {
			level.gameLoop(function*() {
				yield* obj.slideTo(590, 400, 2000);
				yield* obj.slideTo(680, 250, 2000);
			});
		},
		ventLoop(obj) {
			level.gameLoop(function*() {
				yield* level.wait(12500);
				objects.bubble.copy().insert(obj.x + 60, obj.y - 20);
			});
		}
	}
})