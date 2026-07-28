window.LabWidgets = window.LabWidgets || {};

LabWidgets.danscii = function (mountEl) {
	if (!mountEl || mountEl.dataset.dansciiRunning === "true") {
		return Promise.resolve();
	}
	mountEl.dataset.dansciiRunning = "true";
	mountEl.dataset.labScript = "danscii";
	mountEl.classList.add("lab-danscii");
	mountEl.textContent = "";

	function isLightMode() {
		return document.documentElement.classList.contains("light-mode");
	}

	function loadEngine() {
		if (typeof window.loadDansciiEngine === "function") {
			return window.loadDansciiEngine();
		}
		if (typeof Danscii !== "undefined") return Promise.resolve();
		return new Promise(function (resolve, reject) {
			var script = document.createElement("script");
			script.src = "/js/danscii.js";
			script.onload = function () {
				if (typeof Danscii === "undefined") {
					reject(new Error("Danscii failed to define after load"));
					return;
				}
				resolve();
			};
			script.onerror = function () {
				reject(new Error("Failed to load /js/danscii.js"));
			};
			document.head.appendChild(script);
		});
	}

	return loadEngine()
		.then(function () {
			var art = new Danscii(mountEl, {
				src: "/images/lab/danscii.jpg",
				mode: isLightMode() ? "blue" : "dark",
				density: 300,
				densityBreakpoints: null,
				characters: " .01░▒▓",
				hoverCells: 4,
				introDuration: 1200,
				idleBurstsPerSecond: 0.3,
				idleCells: 1,
				fontFamily: '"Departure Mono", monospace',
			});

			mountEl._danscii = art;

			function syncMode() {
				if (!art) return;
				if (isLightMode()) {
					art.setMode("blue");
					art.setColors("#ffffff", "#ffffff");
				} else {
					art.setMode("dark");
				}
			}

			syncMode();
			mountEl._dansciiSyncTheme = syncMode;

			var modeObserver = new MutationObserver(syncMode);
			modeObserver.observe(document.documentElement, {
				attributes: true,
				attributeFilter: ["class"],
			});

			mountEl._labCleanup = function () {
				modeObserver.disconnect();
				if (art && typeof art.destroy === "function") {
					art.destroy();
				}
				art = null;
				delete mountEl._danscii;
				delete mountEl._dansciiSyncTheme;
				mountEl.dataset.dansciiRunning = "false";
			};
		})
		.catch(function (err) {
			mountEl.dataset.dansciiRunning = "false";
			console.warn(err);
			throw err;
		});
};
