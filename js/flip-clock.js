// Flip clock overlay — NZ time on header/footer clock click (desktop only).
(function initFlipClock() {
	var DESKTOP_MIN = 1081;
	var NZ_TZ = "Pacific/Auckland";
	var FLIP_MS = 550;
	var SVG_NS = "http://www.w3.org/2000/svg";
	var CX = 100;
	var CY = 100;

	var overlay = document.querySelector(".flip-clock-overlay");
	var digitsMount = overlay && overlay.querySelector("[data-flip-digits]");
	var dateEl = overlay && overlay.querySelector("[data-flip-date]");
	var metaEl = overlay && overlay.querySelector("[data-flip-meta]");
	var analogMount = overlay && overlay.querySelector("[data-flip-analog]");
	if (!overlay || !digitsMount || !dateEl || !metaEl || !analogMount) return;

	var digitEls = [];
	var currentDigits = "";
	var tickTimer = null;
	var built = false;
	var analogRAF = null;
	var hourHand = null;
	var minuteHand = null;
	var secondGroup = null;

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

	function getNzParts() {
		var now = new Date();
		var parts = new Intl.DateTimeFormat("en-NZ", {
			timeZone: NZ_TZ,
			weekday: "long",
			day: "numeric",
			month: "long",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: true,
			timeZoneName: "short",
		}).formatToParts(now);

		var map = {};
		for (var i = 0; i < parts.length; i++) {
			map[parts[i].type] = parts[i].value;
		}

		var nzDate = new Date(now.toLocaleString("en-US", { timeZone: NZ_TZ }));
		var offset = -nzDate.getTimezoneOffset() / 60;
		var gmt = "GMT" + (offset >= 0 ? "+" : "") + offset;
		var tz = map.timeZoneName && map.timeZoneName.indexOf("DT") !== -1 ? "NZDT" : "NZST";

		return {
			digits:
				String(map.hour).padStart(2, "0") +
				String(map.minute).padStart(2, "0") +
				String(map.second).padStart(2, "0"),
			period: (map.dayPeriod || "").toUpperCase(),
			tz: tz,
			gmt: gmt,
			weekday: map.weekday || "",
			day: ordinal(map.day || "1"),
			month: map.month || "",
		};
	}

	function getNZTime() {
		var s = new Date().toLocaleString("en-US", {
			timeZone: NZ_TZ,
			hour12: false,
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
		var parts = s.split(":");
		return {
			h: parseInt(parts[0], 10),
			m: parseInt(parts[1], 10),
			s: parseInt(parts[2], 10),
		};
	}

	function polar(angle, radius) {
		var rad = ((angle - 90) * Math.PI) / 180;
		return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
	}

	function buildAnalog() {
		analogMount.textContent = "";
		hourHand = null;
		minuteHand = null;
		secondGroup = null;

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
			var outer = polar(angle, isHour ? 88.55 : 88);
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
	}

	function updateAnalog() {
		if (!hourHand || !minuteHand || !secondGroup) return;
		var time = getNZTime();
		hourHand.setAttribute(
			"transform",
			"rotate(" + ((time.h % 12) * 30 + time.m * 0.5) + " 100 100)",
		);
		minuteHand.setAttribute("transform", "rotate(" + (time.m * 6 + time.s * 0.1) + " 100 100)");
		secondGroup.setAttribute("transform", "rotate(" + time.s * 6 + " 100 100)");
		analogRAF = requestAnimationFrame(updateAnalog);
	}

	function startAnalog() {
		stopAnalog();
		buildAnalog();
		updateAnalog();
	}

	function stopAnalog() {
		if (analogRAF) {
			cancelAnimationFrame(analogRAF);
			analogRAF = null;
		}
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
		var initial = getNzParts().digits;
		digitsMount.textContent = "";
		digitEls = [];
		digitsMount.appendChild(createGroup(initial.slice(0, 2)));
		digitsMount.appendChild(createSep());
		digitsMount.appendChild(createGroup(initial.slice(2, 4)));
		digitsMount.appendChild(createSep());
		digitsMount.appendChild(createGroup(initial.slice(4, 6)));
		currentDigits = initial;
		built = true;
		renderMeta(getNzParts());
	}

	function setDigitStatic(el, value) {
		el.dataset.value = value;
		var spans = el.querySelectorAll(".flip-clock-half span, .flip-clock-flap-face span");
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

		var upper = el.querySelector(".flip-clock-half--upper span");
		var lower = el.querySelector(".flip-clock-half--lower span");
		var front = el.querySelector(".flip-clock-flap-face--front span");
		var back = el.querySelector(".flip-clock-flap-face--back span");
		var flap = el.querySelector(".flip-clock-flap");

		// Static top reveals new digit immediately (under the flap).
		// Static bottom keeps old until the flap lands.
		front.textContent = prev;
		back.textContent = next;
		upper.textContent = next;
		lower.textContent = prev;

		el.dataset.value = next;

		// Restart animation cleanly if needed.
		flap.style.animation = "none";
		// Force reflow so the next animation starts from 0.
		void flap.offsetWidth;
		flap.style.animation = "";

		el.classList.add("is-flipping");

		window.setTimeout(function () {
			lower.textContent = next;
			front.textContent = next;
			el.classList.remove("is-flipping");
			flap.style.animation = "";
		}, FLIP_MS);
	}

	function renderMeta(parts) {
		dateEl.innerHTML =
			'<span class="opacity-75">' +
			parts.day +
			"</span>" +
			' <span class="opacity-25">/</span> ' +
			'<span class="opacity-75">' +
			parts.month +
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
		tickTimer = window.setInterval(tick, 250);
	}

	function stopTick() {
		if (tickTimer) {
			window.clearInterval(tickTimer);
			tickTimer = null;
		}
	}

	function show() {
		if (!isDesktop() || isVisible()) return;
		build();
		overlay.classList.add("is-visible");
		overlay.setAttribute("aria-hidden", "false");
		startTick();
		startAnalog();
	}

	function hide() {
		if (!isVisible()) return;
		overlay.classList.remove("is-visible");
		overlay.setAttribute("aria-hidden", "true");
		stopTick();
		stopAnalog();
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
})();
