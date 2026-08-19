// Flip clock overlay — NZ time on header/footer clock click (desktop only).
// Also appears after inactivity or when the tab is hidden; sets the title to "Tick. Tock."
(function initFlipClock() {
	var DESKTOP_MIN = 1081;
	var NZ_TZ = "Pacific/Auckland";
	var FLIP_MS = 550;
	var TICK_MS = 250;
	var SVG_NS = "http://www.w3.org/2000/svg";
	var CX = 100;
	var CY = 100;

	var overlay = document.querySelector(".flip-clock-overlay");
	var digitsMount = overlay && overlay.querySelector("[data-flip-digits]");
	var dateEl = overlay && overlay.querySelector("[data-flip-date]");
	var metaEl = overlay && overlay.querySelector("[data-flip-meta]");
	var analogMount = overlay && overlay.querySelector("[data-flip-analog]");
	if (!overlay || !digitsMount || !dateEl || !metaEl || !analogMount) return;

	var IDLE_MS = 60 * 1000;
	var IDLE_TITLE = "Tick. Tock.";
	var idleTimer = null;
	var lastActivity = Date.now();
	var openedByIdle = false;
	var defaultTitle = document.title;

	var digitEls = [];
	var currentDigits = "";
	var lastMetaKey = "";
	var tickTimer = null;
	var built = false;
	var analogBuilt = false;
	var hourHand = null;
	var minuteHand = null;
	var secondGroup = null;
	var lastAnalogKey = "";
	var cachedGmt = "";
	var cachedGmtHourKey = "";

	var partsFormatter = new Intl.DateTimeFormat("en-NZ", {
		timeZone: NZ_TZ,
		weekday: "long",
		day: "numeric",
		month: "long",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: true,
		timeZoneName: "short",
	});

	var offsetFormatter = null;
	try {
		offsetFormatter = new Intl.DateTimeFormat("en-US", {
			timeZone: NZ_TZ,
			timeZoneName: "shortOffset",
		});
	} catch (err) {
		offsetFormatter = null;
	}

	function isDesktop() {
		return window.innerWidth >= DESKTOP_MIN;
	}

	function isVisible() {
		return overlay.classList.contains("is-visible");
	}

	function ordinal(day) {
		var n = parseInt(day, 10);
		var mod100 = n % 100;
		if (mod100 >= 11 && mod100 <= 13) return n + "th";
		switch (n % 10) {
			case 1:
				return n + "st";
			case 2:
				return n + "nd";
			case 3:
				return n + "rd";
			default:
				return n + "th";
		}
	}

	function getGmt(now) {
		var hourKey = String(now.getUTCFullYear()) + "-" + now.getUTCMonth() + "-" + now.getUTCDate() + "-" + now.getUTCHours();
		if (cachedGmt && cachedGmtHourKey === hourKey) return cachedGmt;

		if (offsetFormatter) {
			var offsetParts = offsetFormatter.formatToParts(now);
			for (var i = 0; i < offsetParts.length; i++) {
				if (offsetParts[i].type === "timeZoneName") {
					cachedGmt = (offsetParts[i].value || "").replace(/^UTC/, "GMT");
					cachedGmtHourKey = hourKey;
					return cachedGmt;
				}
			}
		}

		var nzDate = new Date(now.toLocaleString("en-US", { timeZone: NZ_TZ }));
		var offset = -nzDate.getTimezoneOffset() / 60;
		cachedGmt = "GMT" + (offset >= 0 ? "+" : "") + offset;
		cachedGmtHourKey = hourKey;
		return cachedGmt;
	}

	function getNzParts() {
		var now = new Date();
		var parts = partsFormatter.formatToParts(now);
		var map = {};
		for (var i = 0; i < parts.length; i++) {
			map[parts[i].type] = parts[i].value;
		}

		var h = parseInt(map.hour, 10) || 0;
		var m = parseInt(map.minute, 10) || 0;
		var s = parseInt(map.second, 10) || 0;
		// hour12 midnight/noon can report 12; keep flip digits as 01–12.
		var hour12 = String(map.hour).padStart(2, "0");

		return {
			digits: hour12 + String(map.minute).padStart(2, "0") + String(map.second).padStart(2, "0"),
			period: (map.dayPeriod || "").toUpperCase(),
			tz: map.timeZoneName && map.timeZoneName.indexOf("DT") !== -1 ? "NZDT" : "NZST",
			gmt: getGmt(now),
			weekday: map.weekday || "",
			day: ordinal(map.day || "1"),
			month: map.month || "",
			h: h,
			m: m,
			s: s,
		};
	}

	function polar(angle, radius) {
		var rad = ((angle - 90) * Math.PI) / 180;
		return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
	}

	function buildAnalog() {
		if (analogBuilt) return;
		analogMount.textContent = "";

		var svg = document.createElementNS(SVG_NS, "svg");
		svg.setAttribute("class", "flip-clock-analog-svg");
		svg.setAttribute("viewBox", "0 0 200 200");
		svg.setAttribute("role", "img");
		svg.setAttribute("aria-label", "NZ time analog clock");

		var markersG = document.createElementNS(SVG_NS, "g");

		hourHand = document.createElementNS(SVG_NS, "line");
		hourHand.setAttribute("class", "flip-clock-analog-hand-hour");
		hourHand.setAttribute("x1", "100");
		hourHand.setAttribute("y1", "100");
		hourHand.setAttribute("x2", "100");
		hourHand.setAttribute("y2", "48");

		minuteHand = document.createElementNS(SVG_NS, "line");
		minuteHand.setAttribute("class", "flip-clock-analog-hand-minute");
		minuteHand.setAttribute("x1", "100");
		minuteHand.setAttribute("y1", "100");
		minuteHand.setAttribute("x2", "100");
		minuteHand.setAttribute("y2", "28");

		secondGroup = document.createElementNS(SVG_NS, "g");
		var secondLine = document.createElementNS(SVG_NS, "line");
		secondLine.setAttribute("class", "flip-clock-analog-hand-second");
		secondLine.setAttribute("x1", "100");
		secondLine.setAttribute("y1", "112");
		secondLine.setAttribute("x2", "100");
		secondLine.setAttribute("y2", "24");
		secondGroup.appendChild(secondLine);

		var cap = document.createElementNS(SVG_NS, "circle");
		cap.setAttribute("class", "flip-clock-analog-cap");
		cap.setAttribute("cx", "100");
		cap.setAttribute("cy", "100");
		cap.setAttribute("r", "4");

		for (var i = 0; i < 60; i++) {
			var angle = i * 6;
			var isHour = i % 5 === 0;
			var inner = polar(angle, isHour ? 77 : 79);
			var outer = polar(angle, 88);
			var line = document.createElementNS(SVG_NS, "line");
			line.setAttribute("x1", inner.x.toFixed(2));
			line.setAttribute("y1", inner.y.toFixed(2));
			line.setAttribute("x2", outer.x.toFixed(2));
			line.setAttribute("y2", outer.y.toFixed(2));
			line.setAttribute(
				"class",
				"flip-clock-analog-marker" + (isHour ? " flip-clock-analog-marker-hour" : ""),
			);
			markersG.appendChild(line);
		}

		var dialG = document.createElementNS(SVG_NS, "g");
		dialG.appendChild(markersG);
		dialG.appendChild(hourHand);
		dialG.appendChild(minuteHand);
		dialG.appendChild(secondGroup);
		dialG.appendChild(cap);

		svg.appendChild(dialG);
		analogMount.appendChild(svg);
		analogBuilt = true;
		lastAnalogKey = "";
	}

	function updateAnalog(parts) {
		if (!hourHand || !minuteHand || !secondGroup) return;
		var key = parts.h + ":" + parts.m + ":" + parts.s;
		if (key === lastAnalogKey) return;
		lastAnalogKey = key;

		// hour12 parts: map.hour is 1–12; use 24h-ish angle via period when needed.
		var hour = parts.h % 12;
		hourHand.setAttribute("transform", "rotate(" + (hour * 30 + parts.m * 0.5) + " 100 100)");
		minuteHand.setAttribute("transform", "rotate(" + (parts.m * 6 + parts.s * 0.1) + " 100 100)");
		secondGroup.setAttribute("transform", "rotate(" + parts.s * 6 + " 100 100)");
	}

	function createDigit(value) {
		var el = document.createElement("div");
		el.className = "flip-clock-digit";
		el.dataset.value = value;
		el.innerHTML =
			'<div class="flip-clock-half flip-clock-half--upper"><span>' +
			value +
			"</span></div>" +
			'<div class="flip-clock-half flip-clock-half--lower"><span>' +
			value +
			"</span></div>" +
			'<div class="flip-clock-flap" aria-hidden="true">' +
			'<div class="flip-clock-flap-face flip-clock-flap-face--front"><span>' +
			value +
			"</span></div>" +
			'<div class="flip-clock-flap-face flip-clock-flap-face--back"><span>' +
			value +
			"</span></div>" +
			"</div>";
		el._flip = {
			upper: el.querySelector(".flip-clock-half--upper span"),
			lower: el.querySelector(".flip-clock-half--lower span"),
			front: el.querySelector(".flip-clock-flap-face--front span"),
			back: el.querySelector(".flip-clock-flap-face--back span"),
			flap: el.querySelector(".flip-clock-flap"),
			spans: el.querySelectorAll(".flip-clock-half span, .flip-clock-flap-face span"),
		};
		return el;
	}

	function createSep() {
		var el = document.createElement("div");
		el.className = "flip-clock-sep";
		el.setAttribute("aria-hidden", "true");
		el.innerHTML = "<span></span><span></span>";
		return el;
	}

	function createGroup(values) {
		var group = document.createElement("div");
		group.className = "flip-clock-group";
		for (var i = 0; i < values.length; i++) {
			var digit = createDigit(values[i]);
			digitEls.push(digit);
			group.appendChild(digit);
		}
		return group;
	}

	function build() {
		if (built) return;
		var initial = getNzParts();
		digitsMount.textContent = "";
		digitEls = [];
		digitsMount.appendChild(createGroup(initial.digits.slice(0, 2)));
		digitsMount.appendChild(createSep());
		digitsMount.appendChild(createGroup(initial.digits.slice(2, 4)));
		digitsMount.appendChild(createSep());
		digitsMount.appendChild(createGroup(initial.digits.slice(4, 6)));
		currentDigits = initial.digits;
		built = true;
		renderMeta(initial);
		buildAnalog();
		updateAnalog(initial);
	}

	function setDigitStatic(el, value) {
		el.dataset.value = value;
		var spans = el._flip.spans;
		for (var i = 0; i < spans.length; i++) {
			spans[i].textContent = value;
		}
		el.classList.remove("is-flipping");
	}

	function flipDigit(el, next) {
		var prev = el.dataset.value;
		if (prev === next) return;

		// Skip mid-flip: snap to latest value.
		if (el.classList.contains("is-flipping")) {
			setDigitStatic(el, next);
			return;
		}

		var refs = el._flip;
		refs.front.textContent = prev;
		refs.back.textContent = next;
		refs.upper.textContent = next;
		refs.lower.textContent = prev;
		el.dataset.value = next;

		refs.flap.style.animation = "none";
		void refs.flap.offsetWidth;
		refs.flap.style.animation = "";

		el.classList.add("is-flipping");

		window.setTimeout(function () {
			refs.lower.textContent = next;
			refs.front.textContent = next;
			el.classList.remove("is-flipping");
			refs.flap.style.animation = "";
		}, FLIP_MS);
	}

	function renderMeta(parts) {
		var key = parts.month + "|" + parts.day + "|" + parts.weekday + "|" + parts.tz + "|" + parts.period + "|" + parts.gmt;
		if (key === lastMetaKey) return;
		lastMetaKey = key;

		dateEl.innerHTML =
			'<span class="opacity-75">' +
			parts.month +
			"</span>" +
			' <span class="opacity-25">/</span> ' +
			'<span class="opacity-75">' +
			parts.day +
			"</span>" +
			' <span class="opacity-50">(' +
			parts.weekday +
			")</span>";
		metaEl.innerHTML =
			'<span class="opacity-75">' +
			parts.tz +
			"</span>" +
			' <span class="opacity-25">/</span> ' +
			'<span class="opacity-75">' +
			parts.period +
			"</span>" +
			' <span class="opacity-50">(' +
			parts.gmt +
			")</span>";
	}

	function tick() {
		if (!isVisible()) return;
		var parts = getNzParts();
		renderMeta(parts);
		updateAnalog(parts);
		if (parts.digits === currentDigits) return;
		for (var i = 0; i < digitEls.length; i++) {
			if (parts.digits[i] !== currentDigits[i]) {
				flipDigit(digitEls[i], parts.digits[i]);
			}
		}
		currentDigits = parts.digits;
	}

	function startTick() {
		stopTick();
		tick();
		tickTimer = window.setInterval(tick, TICK_MS);
	}

	function stopTick() {
		if (tickTimer) {
			window.clearInterval(tickTimer);
			tickTimer = null;
		}
	}

	function setIdleTitle() {
		if (document.title === IDLE_TITLE) return;
		defaultTitle = document.title;
		document.title = IDLE_TITLE;
	}

	function restoreTitle() {
		if (document.title !== IDLE_TITLE) return;
		document.title = defaultTitle;
	}

	function enterIdle() {
		if (isVisible()) {
			startIdleTimer();
			return;
		}
		setIdleTitle();
		show(true);
	}

	function startIdleTimer() {
		clearTimeout(idleTimer);
		lastActivity = Date.now();
		idleTimer = setTimeout(enterIdle, IDLE_MS);
	}

	function onActivity() {
		if (isVisible() && openedByIdle) hide();
		else restoreTitle();
		startIdleTimer();
	}

	var MOUSEMOVE_THROTTLE_MS = 200;
	var lastMousemoveActivity = 0;

	function onMousemoveActivity() {
		var now = Date.now();
		if (now - lastMousemoveActivity < MOUSEMOVE_THROTTLE_MS) return;
		lastMousemoveActivity = now;
		onActivity();
	}

	function show(fromIdle) {
		if (!isDesktop() || isVisible()) return;
		openedByIdle = !!fromIdle;
		build();
		overlay.classList.add("is-visible");
		overlay.setAttribute("aria-hidden", "false");
		startTick();
	}

	function hide() {
		if (!isVisible()) return;
		openedByIdle = false;
		overlay.classList.remove("is-visible");
		overlay.classList.remove("flip-clock-no-transition");
		overlay.setAttribute("aria-hidden", "true");
		stopTick();
		restoreTitle();
		startIdleTimer();
	}

	function snapShowIdle() {
		overlay.classList.add("flip-clock-no-transition");
		setIdleTitle();
		if (!isVisible()) show(true);
	}

	function releaseOverlayTransition() {
		requestAnimationFrame(function () {
			requestAnimationFrame(function () {
				overlay.classList.remove("flip-clock-no-transition");
			});
		});
	}

	// Delegated click — typewriter can replace header-label HTML.
	document.addEventListener("click", function (e) {
		var trigger = e.target.closest(".flip-clock-trigger");
		if (!trigger) return;
		if (!isDesktop()) return;
		e.preventDefault();
		if (isVisible()) hide();
		else show();
	});

	overlay.addEventListener("click", function (e) {
		if (!isVisible()) return;
		if (e.target.closest(".flip-clock")) return;
		hide();
	});

	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape" && isVisible()) {
			e.preventDefault();
			e.stopImmediatePropagation();
			hide();
			return;
		}
		if (
			(e.key === "c" || e.key === "C") &&
			!e.repeat &&
			!e.ctrlKey &&
			!e.metaKey &&
			!e.altKey &&
			typeof colorKeyboardTargetOk === "function" &&
			colorKeyboardTargetOk()
		) {
			if (!isDesktop()) return;
			e.preventDefault();
			if (isVisible()) hide();
			else show();
		}
	});

	window.addEventListener("resize", function () {
		if (!isDesktop() && isVisible()) hide();
	});

	document.addEventListener("visibilitychange", function () {
		if (document.hidden) {
			snapShowIdle();
		} else if (overlay.classList.contains("flip-clock-no-transition")) {
			snapShowIdle();
			releaseOverlayTransition();
		} else if (Date.now() - lastActivity >= IDLE_MS) {
			enterIdle();
		}
	});

	["mousedown", "keydown", "scroll", "touchstart"].forEach(function (evt) {
		document.addEventListener(evt, onActivity, { passive: true });
	});
	document.addEventListener("mousemove", onMousemoveActivity, { passive: true });

	startIdleTimer();
})();
