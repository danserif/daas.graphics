// ASCII map overlay — Danscii renderer on a map image (desktop only).
// Triggered from the header "Made in New Zealand" label.
(function initAsciiMap() {
	var DESKTOP_MIN = 1081;
	var MAP_SRC = "/images/aotearoa.png";
	var ENGINE_SRC = "/js/danscii.js";
	var overlay = document.querySelector(".ascii-map");
	var mount = overlay && overlay.querySelector(".ascii-map-mount");
	if (!overlay || !mount) return;

	var art = null;
	var enginePromise = null;

	/** Shared lazy loader for the Danscii engine (map + lab widget). */
	window.loadDansciiEngine = function loadDansciiEngine() {
		if (typeof Danscii !== "undefined") return Promise.resolve();
		if (enginePromise) return enginePromise;
		enginePromise = new Promise(function (resolve, reject) {
			var script = document.createElement("script");
			script.src = ENGINE_SRC;
			script.onload = function () {
				if (typeof Danscii === "undefined") {
					reject(new Error("Danscii failed to define after load"));
					return;
				}
				resolve();
			};
			script.onerror = function () {
				enginePromise = null;
				reject(new Error("Failed to load " + ENGINE_SRC));
			};
			document.head.appendChild(script);
		});
		return enginePromise;
	};

	function isDesktop() {
		return window.innerWidth >= DESKTOP_MIN;
	}

	function isVisible() {
		return overlay.classList.contains("is-visible");
	}

	function isLightMode() {
		return document.documentElement.classList.contains("light-mode");
	}

	function syncTheme() {
		if (!art) return;
		if (isLightMode()) {
			art.setMode("blue");
			art.setColors("#ffffff", "#8AA9FF");
		} else {
			art.setMode("dark");
			art.setColors("#ffffff", "#808080");
		}
	}

	/** Pin title/close to the live nav label top; mirror that inset at the bottom. */
	function syncChromeAlign() {
		var topPx = null;
		var fixedBar = document.querySelector(".header-fixed-bar.is-visible");
		var label = null;

		if (fixedBar) {
			label = fixedBar.querySelector(".header-fixed-bar-inner .header-label");
		}
		if (!label) {
			label = document.querySelector(
				".header .header-sticky-band .header-label, .header .header-label",
			);
		}
		if (label) {
			topPx = Math.round(label.getBoundingClientRect().top);
		}

		if (topPx != null && topPx >= 0) {
			overlay.style.setProperty("--ascii-map-chrome-top", topPx + "px");
			overlay.style.setProperty("--ascii-map-chrome-bottom", topPx + "px");
		} else {
			overlay.style.removeProperty("--ascii-map-chrome-top");
			overlay.style.removeProperty("--ascii-map-chrome-bottom");
		}
	}

	function ensureArt() {
		if (art) {
			syncTheme();
			return Promise.resolve(art);
		}
		return Promise.all([
			window.loadDansciiEngine(),
			document.fonts && typeof document.fonts.load === "function"
				? document.fonts.load('12px "Departure Mono"')
				: Promise.resolve(),
		]).then(function () {
			if (art) {
				syncTheme();
				return art;
			}
			art = new Danscii(mount, {
				src: MAP_SRC,
				mode: isLightMode() ? "blue" : "dark",
				densityBreakpoints: [
					{ minWidth: 2661, density: 180 },
					{ minWidth: 1641, density: 140 },
					{ minWidth: 1081, density: 110 },
					{ minWidth: 0, density: 90 },
				],
				characters: " . ,-nzn",
				invert: true,
				hoverCells: 4,
				introDuration: 1400,
				idleBurstsPerSecond: 0.25,
				idleCells: 1,
				fontFamily: '"Departure Mono", monospace',
			});
			syncTheme();
			return art;
		});
	}

	function replayIntro() {
		if (!art || !art.target || typeof art._startIntro !== "function") return;
		art._visible = true;
		art._introDone = false;
		art._startIntro();
		art._wake();
	}

	function show() {
		if (!isDesktop() || isVisible()) return;
		// Show first so Danscii's intro runs while visible (not finished off-screen).
		overlay.classList.add("is-visible");
		overlay.setAttribute("aria-hidden", "false");
		syncChromeAlign();
		requestAnimationFrame(syncChromeAlign);
		var existed = !!art;
		ensureArt()
			.then(function () {
				if (!isVisible()) return;
				if (existed) replayIntro();
			})
			.catch(function (err) {
				console.warn(err);
			});
	}

	function pauseArt() {
		if (!art) return;
		art._visible = false;
		if (typeof art._stopLoop === "function") art._stopLoop();
		if (typeof art._clearIdleWake === "function") art._clearIdleWake();
	}

	function hide() {
		if (!isVisible()) return;
		overlay.classList.remove("is-visible");
		overlay.setAttribute("aria-hidden", "true");
		overlay.style.removeProperty("--ascii-map-chrome-top");
		overlay.style.removeProperty("--ascii-map-chrome-bottom");
		pauseArt();
	}

	var closeBtn = overlay.querySelector(".ascii-map-close");
	if (closeBtn) {
		closeBtn.addEventListener("click", function (e) {
			e.preventDefault();
			e.stopPropagation();
			hide();
		});
	}

	// Delegated click — typewriter replaces .header-label innerHTML and destroys a direct listener.
	document.addEventListener("click", function (e) {
		if (e.target.closest(".ascii-map-trigger")) {
			if (!isDesktop()) return;
			e.preventDefault();
			if (isVisible()) hide();
			else show();
		}
	});

	// Backdrop click dismisses; mount + chrome keep interaction / navigation.
	overlay.addEventListener("click", function (e) {
		if (!isVisible()) return;
		if (e.target.closest(".ascii-map-mount, .ascii-map-close, .ascii-map-link-wrap")) return;
		hide();
	});

	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape" && isVisible()) hide();
	});

	window.addEventListener("resize", function () {
		if (!isDesktop() && isVisible()) {
			hide();
			return;
		}
		if (isVisible()) syncChromeAlign();
	});

	// Keep glyphs in sync when site theme toggles.
	document.addEventListener("click", function (e) {
		if (!art) return;
		if (e.target.closest(".dark-mode-toggle, .light-mode-toggle, .mode-dark, .mode-light")) {
			setTimeout(syncTheme, 0);
		}
	});
})();
