window.LabWidgets = window.LabWidgets || {};

LabWidgets.clock = function (mountEl) {
	if (!mountEl || mountEl.dataset.clockRunning === "true") return;
	mountEl.dataset.clockRunning = "true";

	var SVG_NS = "http://www.w3.org/2000/svg";
	var CX = 100;
	var CY = 100;

	mountEl.classList.add("lab-clock");
	mountEl.textContent = "";

	var svg = document.createElementNS(SVG_NS, "svg");
	svg.setAttribute("class", "lab-clock-svg");
	svg.setAttribute("viewBox", "0 0 200 200");
	svg.setAttribute("role", "img");
	svg.setAttribute("aria-label", "NZ time analog clock");

	var markersG = document.createElementNS(SVG_NS, "g");
	var numeralsG = document.createElementNS(SVG_NS, "g");

	var logoG = document.createElementNS(SVG_NS, "g");
	logoG.setAttribute("class", "lab-clock-logo");
	logoG.setAttribute("transform", "translate(100, 64) scale(0.038) translate(-324, -232.5)");
	var pathN = document.createElementNS(SVG_NS, "path");
	pathN.setAttribute(
		"d",
		"M647.998 464.382H589.951L589.952 188.645C589.946 180.638 583.459 174.148 575.451 174.143H546.407C538.402 174.148 531.912 180.638 531.905 188.645V464.382H473.857C473.857 464.382 473.857 174.158 473.857 174.143C473.857 142.083 499.847 116.095 531.905 116.095C531.912 116.095 589.951 116.095 589.954 116.095C622.014 116.095 648 142.083 648 174.143C647.998 174.158 647.998 464.382 647.998 464.382Z",
	);
	var pathA = document.createElementNS(SVG_NS, "path");
	pathA.setAttribute(
		"d",
		"M419.78 58.0475C419.78 58.0608 419.78 464.382 419.78 464.382H361.73V319.263H286.269V464.382H228.221C228.221 464.382 228.221 58.0608 228.221 58.0475C228.221 25.9878 254.209 0 286.269 0C286.274 0 361.728 0 361.731 0C393.791 0 419.78 25.9895 419.78 58.0475ZM347.233 58.0475H300.772C292.766 58.0525 286.275 64.5428 286.27 72.5494V261.215H361.733V72.5494C361.725 64.5428 355.238 58.0541 347.233 58.0475Z",
	);
	var pathD = document.createElementNS(SVG_NS, "path");
	pathD.setAttribute("fill-rule", "evenodd");
	pathD.setAttribute(
		"d",
		"M116.095 116.095C148.154 116.095 174.163 142.083 174.163 174.145L174.142 406.335C174.142 438.396 148.154 464.382 116.095 464.382H0V116.095H116.095ZM58.0473 174.143V405.394C58.0473 405.394 93.587 405.399 101.594 405.394C109.6 405.389 116.09 398.899 116.095 390.893C116.1 382.883 116.095 188.644 116.095 188.644C116.09 180.638 109.6 174.149 101.594 174.143H58.0473Z",
	);
	logoG.appendChild(pathN);
	logoG.appendChild(pathA);
	logoG.appendChild(pathD);

	var tzText = document.createElementNS(SVG_NS, "text");
	tzText.setAttribute("class", "lab-clock-tz");
	tzText.setAttribute("x", "100");
	tzText.setAttribute("y", "81");

	var tzParts = new Intl.DateTimeFormat("en-NZ", {
		timeZone: "Pacific/Auckland",
		timeZoneName: "short",
	}).formatToParts(new Date());
	for (var t = 0; t < tzParts.length; t++) {
		if (tzParts[t].type === "timeZoneName") {
			tzText.textContent = tzParts[t].value;
			break;
		}
	}

	var hourHand = document.createElementNS(SVG_NS, "line");
	hourHand.setAttribute("class", "lab-clock-hand-hour");
	hourHand.setAttribute("x1", "100");
	hourHand.setAttribute("y1", "100");
	hourHand.setAttribute("x2", "100");
	hourHand.setAttribute("y2", "48");

	var minuteHand = document.createElementNS(SVG_NS, "line");
	minuteHand.setAttribute("class", "lab-clock-hand-minute");
	minuteHand.setAttribute("x1", "100");
	minuteHand.setAttribute("y1", "100");
	minuteHand.setAttribute("x2", "100");
	minuteHand.setAttribute("y2", "28");

	var secondGroup = document.createElementNS(SVG_NS, "g");
	var secondLine = document.createElementNS(SVG_NS, "line");
	secondLine.setAttribute("class", "lab-clock-hand-second");
	secondLine.setAttribute("x1", "100");
	secondLine.setAttribute("y1", "112");
	secondLine.setAttribute("x2", "100");
	secondLine.setAttribute("y2", "24");
	secondGroup.appendChild(secondLine);

	var cap = document.createElementNS(SVG_NS, "circle");
	cap.setAttribute("class", "lab-clock-cap");
	cap.setAttribute("cx", "100");
	cap.setAttribute("cy", "100");
	cap.setAttribute("r", "4");

	svg.appendChild(markersG);
	svg.appendChild(numeralsG);
	svg.appendChild(logoG);
	svg.appendChild(tzText);
	svg.appendChild(hourHand);
	svg.appendChild(minuteHand);
	svg.appendChild(secondGroup);
	svg.appendChild(cap);
	mountEl.appendChild(svg);

	function polar(angle, radius) {
		var rad = ((angle - 90) * Math.PI) / 180;
		return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
	}

	for (var i = 0; i < 60; i++) {
		var angle = i * 6;
		var isHour = i % 5 === 0;
		var inner = polar(angle, isHour ? 78 : 82);
		var outerR = isHour ? 88.55 : 88;
		var outer = polar(angle, outerR);
		var line = document.createElementNS(SVG_NS, "line");
		line.setAttribute("x1", inner.x.toFixed(2));
		line.setAttribute("y1", inner.y.toFixed(2));
		line.setAttribute("x2", outer.x.toFixed(2));
		line.setAttribute("y2", outer.y.toFixed(2));
		line.setAttribute(
			"class",
			"lab-clock-marker " + (isHour ? "lab-clock-marker-hour" : "lab-clock-marker-minute"),
		);
		markersG.appendChild(line);
	}

	for (var n = 1; n <= 12; n++) {
		var a = n * 30;
		var p = polar(a, 65.5);
		var txt = document.createElementNS(SVG_NS, "text");
		txt.setAttribute("x", p.x.toFixed(2));
		txt.setAttribute("y", p.y.toFixed(2));
		txt.setAttribute("class", "lab-clock-numeral");
		txt.textContent = n;
		numeralsG.appendChild(txt);
	}

	var clockRAF = null;

	function getNZTime() {
		var s = new Date().toLocaleString("en-US", {
			timeZone: "Pacific/Auckland",
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

	function updateClock() {
		var time = getNZTime();
		var secAngle = time.s * 6;
		var minAngle = time.m * 6 + time.s * 0.1;
		var hourAngle = (time.h % 12) * 30 + time.m * 0.5;
		hourHand.setAttribute("transform", "rotate(" + hourAngle + " 100 100)");
		minuteHand.setAttribute("transform", "rotate(" + minAngle + " 100 100)");
		secondGroup.setAttribute("transform", "rotate(" + secAngle + " 100 100)");
		clockRAF = requestAnimationFrame(updateClock);
	}

	updateClock();

	mountEl._clockCleanup = function () {
		if (clockRAF) {
			cancelAnimationFrame(clockRAF);
			clockRAF = null;
		}
		mountEl.dataset.clockRunning = "false";
	};
};
