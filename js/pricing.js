(function () {
	var PRICING_PLANS = {
		"D-01": {
			id: "D-01",
			name: "Coaching",
			nameSubtitle: "(Sessions)",
			description:
				"For founders navigating startups, leaders managing teams, or individuals needing support with their career.",
			image: "/images/plans/d-01.png",
			status: "Limited availability",
			pricePrefix: "Starting at",
			priceAmount: "$250",
			priceSuffix: "(USD) P/H",
			planNote:
				"D-01 is available to be booked for hourly sessions and can include the following coaching support: ",
			features: [
				"Actionable advice and guidance.",
				"Feedback on work, products, and strategy.",
				"Review pitches, talks, and presentations.",
				"Plan goals and ways to manage challenges.",
				"Discuss career development and progression.",
				"Support and advice for new team managers.",
				"CV, portfolio, and job application reviews.",
				"Student and out-of-work discounts available.",
			],
			ctaIcon: "D-01 /",
			ctaLabel: "Email",
			ctaHref: "mailto:dan@newman.is?subject=D-01%20%2F%20Coaching",
		},
		"D-02": {
			id: "D-02",
			name: "Advising",
			nameSubtitle: "(Leadership)",
			description:
				"For startups, teams, and businesses needing leadership support, creative direction, strategy, and recruitment.",
			image: "/images/plans/d-02.png",
			status: "Limited availability",
			pricePrefix: "Starting at",
			priceAmount: "$10,000",
			priceSuffix: "(USD) P/M",
			planNote:
				"D-02 is available to be booked monthly and can include the following advice and leadership services: ",
			features: [
				"Support for founders and founding teams.",
				"Design, brand, and product strategy.",
				"Product reviews and design feedback.",
				"Hiring and recruitment support.",
				"Establishing design practices.",
				"Creative direction for design teams.",
				"Guidance for marketing and launching.",
				"Help growing from zero to one.",
			],
			ctaIcon: "D-02 /",
			ctaLabel: "Email",
			ctaHref: "mailto:dan@newman.is?subject=D-02%20%2F%20Advising",
		},
		"D-03": {
			id: "D-03",
			name: "Designing",
			nameSubtitle: "(Brands)",
			description:
				"For startups and businesses needing to refine existing design work, or to create unique branding from scratch.",
			image: "/images/plans/d-03.png",
			status: "Fully Booked",
			pricePrefix: "Starting at",
			priceAmount: "$7,000",
			priceSuffix: "(USD) P/W",
			planNote:
				"D-03 is available to be booked weekly and can include the following branding and design services: ",
			features: [
				"Branding and identity design.",
				"Creative direction and art direction.",
				"Landing pages and website design.",
				"Style guides and brand systems.",
				"Marketing, social content, and sales collateral.",
				"Campaigns and advertising materials.",
				"Conferences, booths, and swag design.",
				"Pitch decks and presentations.",
			],
			ctaIcon: "D-03 /",
			ctaLabel: "Waitlist",
			ctaHref: "mailto:dan@newman.is?subject=D-03%20%2F%20Designing",
		},
		"D-04": {
			id: "D-04",
			name: "Vibing",
			nameSubtitle: "(Expansion Pack)",
			description:
				"Create a custom plan that works for your startup or business with add-ons configured exactly as needed.",
			image: "/images/plans/d-04.png",
			status: "Limited availability",
			pricePrefix: "Custom",
			priceAmount: "$TBC",
			priceSuffix: "(USD) P/M",
			planNote:
				"If you’re vibing with Dan as a Service and need to customize your plan it could include the following: ",
			features: [
				"Help with AI to design and build your product.",
				"Long-term partnerships and support.",
				"Add trusted people from Dan’s network.",
				"Setup a multi-discipline team for your project.",
				"Get dedicated time or exclusive focus.",
				"Buy additional design materials and resources.",
				{
					html: 'Configure <span class="mono opacity-50">[D-02]</span> or <span class="mono opacity-50">[D-03]</span> to your needs.',
				},
				"Need something else...?",
			],
			ctaIcon: "D-04 /",
			ctaLabel: "Email",
			ctaHref: "mailto:dan@newman.is?subject=D-04%20%2F%20Vibing",
		},
	};

	function escapeHtml(str) {
		return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}

	function wrapParentheticals(str) {
		var escaped = escapeHtml(str);
		return escaped.replace(/\([^)]*\)/g, function (match) {
			return '<span class="opacity-50">' + match + "</span>";
		});
	}

	function wrapPlanIdsInNote(str) {
		if (!str) return "";
		var escaped = escapeHtml(str);
		return escaped.replace(/\b(D-0[1-4])\b/g, '<span class="mono">$1</span>');
	}

	function renderPricingPanel(planId, refs) {
		var plan = PRICING_PLANS[planId];
		if (!plan || !refs) return;
		var img = refs.img;
		var statusEl = refs.statusEl;
		var nameEl = refs.nameEl;
		var subtitleEl = refs.subtitleEl;
		var descEl = refs.descEl;
		var priceEl = refs.priceEl;
		var planNoteEl = refs.planNoteEl;
		var featuresEl = refs.featuresEl;
		var heroEl = refs.hero;

		// Clean up any existing pixelation canvas when switching plans
		if (heroEl) {
			var existing = heroEl.querySelector(".plan-panel-image-pixelation");
			if (existing) {
				if (existing._pixelationRafId != null) cancelAnimationFrame(existing._pixelationRafId);
				existing.remove();
			}
			img.style.visibility = "";
		}

		img.src = plan.image;
		img.alt = plan.name;
		statusEl.textContent = plan.status;
		nameEl.textContent = plan.name;
		subtitleEl.textContent = plan.nameSubtitle ? " " + plan.nameSubtitle : "";
		subtitleEl.style.display = plan.nameSubtitle ? "" : "none";
		descEl.textContent = plan.description;
		priceEl.innerHTML =
			'<span class="plan-panel-price-prefix opacity-50">' +
			plan.pricePrefix +
			' </span><span class="plan-panel-price-amount">' +
			plan.priceAmount +
			'</span><span class="plan-panel-price-suffix opacity-50"> ' +
			plan.priceSuffix +
			"</span>";
		planNoteEl.innerHTML = wrapPlanIdsInNote(plan.planNote || "");
		planNoteEl.style.display = plan.planNote ? "" : "none";
		featuresEl.innerHTML = "";
		plan.features.forEach(function (item) {
			var li = document.createElement("li");
			if (typeof item === "object" && item.html) {
				li.innerHTML = item.html;
			} else {
				li.innerHTML = wrapParentheticals(item);
			}
			featuresEl.appendChild(li);
		});
		var ctaWrap = refs.ctaWrap;
		if (plan.ctaHref) {
			ctaWrap.innerHTML =
				'<a class="plan-panel-cta" href="' +
				escapeHtml(plan.ctaHref) +
				'"><span class="accent opacity-50">' +
				escapeHtml(plan.ctaIcon) +
				" </span><span>" +
				escapeHtml(plan.ctaLabel) +
				'</span> <span class="accent opacity-50">→</span></a>';
		} else {
			ctaWrap.innerHTML =
				'<span class="plan-panel-cta plan-panel-cta--text">' +
				'<span class="accent opacity-50">' +
				escapeHtml(plan.ctaIcon) +
				" </span><span>" +
				escapeHtml(plan.ctaLabel) +
				"</span></span>";
		}

		refs.tabs.forEach(function (tab) {
			tab.classList.toggle("is-active", tab.getAttribute("data-plan") === planId);
		});

		// Run pixelation animation when image loads (panel open or tab switch)
		function startPixelation() {
			runPixelationAnimation(img, heroEl);
		}
		if (img.complete && img.naturalWidth) {
			startPixelation();
		} else {
			img.addEventListener("load", function onLoad() {
				img.removeEventListener("load", onLoad);
				startPixelation();
			});
		}
	}

	function runPixelationAnimation(img, heroEl) {
		if (!img.complete || !img.naturalWidth || !heroEl) return;
		var heroRect = heroEl.getBoundingClientRect();
		var cw = Math.floor(heroRect.width);
		var ch = Math.floor(heroRect.height);
		if (cw <= 0 || ch <= 0) return;

		var canvas = document.createElement("canvas");
		canvas.className = "plan-panel-image-pixelation";
		canvas.width = cw;
		canvas.height = ch;
		canvas.style.width = "100%";
		canvas.style.height = "100%";
		var gradientTop = heroEl.querySelector(".plan-panel-gradient--top");
		if (gradientTop) {
			heroEl.insertBefore(canvas, gradientTop);
		} else {
			heroEl.appendChild(canvas);
		}
		img.style.visibility = "hidden";

		var ctx = canvas.getContext("2d");
		var iw = img.naturalWidth;
		var ih = img.naturalHeight;

		function drawCover(ctx, destW, destH) {
			var scale = Math.max(destW / iw, destH / ih);
			var w = iw * scale;
			var h = ih * scale;
			var x = (destW - w) / 2;
			var y = (destH - h) / 2;
			ctx.drawImage(img, 0, 0, iw, ih, x, y, w, h);
		}

		// Initial pixelated frame (low-res then scale up)
		var pixelSize = 14;
		var pw = Math.max(2, Math.floor(cw / pixelSize));
		var ph = Math.max(2, Math.floor(ch / pixelSize));
		var tmp = document.createElement("canvas");
		tmp.width = pw;
		tmp.height = ph;
		var tctx = tmp.getContext("2d");
		tctx.imageSmoothingEnabled = false;
		drawCover(tctx, pw, ph);
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(tmp, 0, 0, pw, ph, 0, 0, cw, ch);

		// Grid of cells to reveal randomly
		var cols = 12;
		var rows = 12;
		var total = cols * rows;
		var indices = [];
		for (var i = 0; i < total; i++) indices.push(i);
		for (var i = total - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var t = indices[i];
			indices[i] = indices[j];
			indices[j] = t;
		}

		var revealed = 0;
		var cellsPerFrame = 2;

		function revealNext() {
			ctx.imageSmoothingEnabled = true;
			for (var n = 0; n < cellsPerFrame && revealed < total; n++) {
				var idx = indices[revealed];
				var col = idx % cols;
				var row = Math.floor(idx / cols);
				var cellW = cw / cols;
				var cellH = ch / rows;
				var x = col * cellW;
				var y = row * cellH;
				ctx.save();
				ctx.beginPath();
				ctx.rect(x, y, cellW + 1, cellH + 1);
				ctx.clip();
				drawCover(ctx, cw, ch);
				ctx.restore();
				revealed++;
			}
			if (revealed < total) {
				canvas._pixelationRafId = requestAnimationFrame(revealNext);
			} else {
				canvas._pixelationRafId = null;
				// Defer DOM changes to next frame so gradients don’t flash
				requestAnimationFrame(function () {
					canvas.remove();
					img.style.visibility = "";
				});
			}
		}

		canvas._pixelationRafId = requestAnimationFrame(revealNext);
	}

	function openPricingPanel(planId, refs) {
		var overlay = refs.overlay;
		refs._openedFromNav = overlay.classList.contains("is-panel-open");
		if (!refs._openedFromNav) {
			// Opened directly from the page: set overlay bg to page bg before
			// it becomes visible to prevent a flash of accent behind the panel.
			var isLight = document.documentElement.classList.contains("light-mode");
			overlay.style.background = isLight ? "#ffffff" : "#000000";
		}
		overlay.classList.add("is-open");
		overlay.classList.remove("is-panel-open");
		refs.planPanel.setAttribute("aria-hidden", "false");
		if (!refs._openedFromNav) {
			document.body.style.overflow = "hidden";
		}
		renderPricingPanel(planId, refs);
		if (refs.scrollEl) refs.scrollEl.offsetHeight;
		requestAnimationFrame(function () {
			overlay.classList.add("is-plan-open");
		});
		refs.closeBtn.focus();
	}

	var PANEL_TRANSITION_MS = 300;

	function closePricingPanel(refs) {
		var overlay = refs.overlay;
		if (!overlay.classList.contains("is-plan-open")) return;
		var heroEl = refs.hero;
		if (heroEl) {
			var canvas = heroEl.querySelector(".plan-panel-image-pixelation");
			if (canvas) {
				if (canvas._pixelationRafId != null) cancelAnimationFrame(canvas._pixelationRafId);
				canvas.remove();
			}
			if (refs.img) refs.img.style.visibility = "";
		}
		overlay.classList.remove("is-plan-open");
		overlay.style.background = "";
		if (!refs._openedFromNav) {
			overlay.classList.remove("is-open");
		} else {
			overlay.classList.add("is-panel-open");
		}
		var panel = refs.planPanel;
		function finishClose() {
			panel.setAttribute("aria-hidden", "true");
			if (!refs._openedFromNav) {
				document.body.style.overflow = "";
			}
			if (document.activeElement && document.activeElement.blur) {
				document.activeElement.blur();
			}
			if (panel) {
				panel.removeEventListener("transitionend", onTransitionEnd);
			}
			clearTimeout(timeoutId);
		}
		function onTransitionEnd(e) {
			if (e.target !== panel || e.propertyName !== "transform") return;
			finishClose();
		}
		var timeoutId = setTimeout(finishClose, PANEL_TRANSITION_MS);
		if (panel) panel.addEventListener("transitionend", onTransitionEnd);
	}

	function initPricingPanel() {
		var overlay = document.getElementById("nav-overlay");
		if (!overlay) return;
		var planPanel = overlay.querySelector(".plan-panel");
		if (!planPanel) return;
		var refs = {
			overlay: overlay,
			planPanel: planPanel,
			hero: overlay.querySelector(".plan-panel-hero"),
			img: overlay.querySelector(".plan-panel-image"),
			statusEl: overlay.querySelector(".plan-panel-status-value"),
			nameEl: overlay.querySelector(".plan-panel-name-text"),
			subtitleEl: overlay.querySelector(".plan-panel-name-subtitle"),
			descEl: overlay.querySelector(".plan-panel-description"),
			priceEl: overlay.querySelector(".plan-panel-price"),
			planNoteEl: overlay.querySelector(".plan-note"),
			featuresEl: overlay.querySelector(".plan-panel-features"),
			ctaWrap: overlay.querySelector(".plan-panel-cta-wrap"),
			tabs: overlay.querySelectorAll(".plan-panel-tab"),
			scrollEl: overlay.querySelector(".plan-panel-scroll"),
			closeBtn: overlay.querySelector(".plan-panel-close"),
		};
		document.querySelectorAll(".pricing-plan-link").forEach(function (link) {
			link.addEventListener("click", function (e) {
				e.preventDefault();
				var planId = link.getAttribute("data-plan");
				if (planId) openPricingPanel(planId, refs);
			});
		});
		refs.closeBtn.addEventListener("click", function () {
			closePricingPanel(refs);
		});
		overlay.addEventListener("click", function (e) {
			if (e.target === overlay) closePricingPanel(refs);
		});
		document.addEventListener("keydown", function (e) {
			if (e.key === "Escape" && overlay.classList.contains("is-plan-open")) closePricingPanel(refs);
		});
		refs.tabs.forEach(function (tab) {
			tab.addEventListener("click", function () {
				renderPricingPanel(tab.getAttribute("data-plan"), refs);
			});
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initPricingPanel);
	} else {
		initPricingPanel();
	}
})();
