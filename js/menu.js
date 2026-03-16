// Global navigation overlay / panel (mobile + desktop)
(function () {
	"use strict";

	function initNavOverlay() {
		var overlay = document.querySelector("[data-nav-overlay]");
		var panel = overlay ? overlay.querySelector(".nav-panel") : null;
		var closeBtn = overlay ? overlay.querySelector(".nav-panel-close") : null;
		var linksContainer = overlay ? overlay.querySelector("[data-nav-panel-links]") : null;
		var toggles = document.querySelectorAll(".nav-toggle");
		var headerNav = document.querySelector(".header-nav");

		if (!overlay || !panel || !closeBtn || !linksContainer || !headerNav || !toggles.length) {
			return;
		}

		var originalList = headerNav.querySelector(".anchor-links");
		if (!originalList) return;

		var lastTrigger = null;

		function cloneLinks() {
			// Clear any existing items
			while (linksContainer.firstChild) {
				linksContainer.removeChild(linksContainer.firstChild);
			}

			originalList.querySelectorAll("li").forEach(function (item) {
				var cloneLi = item.cloneNode(true);
				linksContainer.appendChild(cloneLi);
			});
		}

		function isPricingLink(el) {
			return el && el.classList && el.classList.contains("pricing-plan-link");
		}

		function handleNavLinkClick(event) {
			var target = event.target;
			if (!target) return;

			var link = target.closest("a");
			if (!link) return;

			if (isPricingLink(link)) {
				// Let pricing.js logic handle the plan opening after we close the nav
				event.preventDefault();
				var planId = link.getAttribute("data-plan");
				closeOverlay();

				// Find a matching pricing link in the main document and simulate click
				if (planId) {
					var mainLink = document.querySelector('.pricing-plan-link[data-plan="' + planId + '"]');
					if (mainLink) {
						mainLink.click();
					}
				}
			} else {
				// Close overlay for regular anchor navigation and allow default behavior
				closeOverlay();
			}
		}

		function openOverlay(trigger) {
			if (!overlay || !panel) return;
			lastTrigger = trigger || null;

			cloneLinks();

			overlay.classList.add("is-open");
			if (trigger) {
				trigger.setAttribute("aria-expanded", "true");
			}

			// Allow CSS transition to apply (same pattern as pricing panel)
			requestAnimationFrame(function () {
				overlay.classList.add("is-panel-open");
			});

			// Focus close button for accessibility
			closeBtn.focus();
		}

		function closeOverlay() {
			if (!overlay) return;

			overlay.classList.remove("is-panel-open");
			overlay.classList.remove("is-open");

			if (lastTrigger) {
				lastTrigger.setAttribute("aria-expanded", "false");
				lastTrigger.focus();
			}
		}

		toggles.forEach(function (btn) {
			btn.addEventListener("click", function () {
				openOverlay(btn);
			});
		});

		closeBtn.addEventListener("click", function () {
			closeOverlay();
		});

		overlay.addEventListener("click", function (event) {
			// Click outside panel closes overlay
			if (!panel.contains(event.target)) {
				closeOverlay();
			}
		});

		document.addEventListener("keydown", function (event) {
			if (event.key === "Escape" || event.key === "Esc") {
				if (overlay.classList.contains("is-open")) {
					event.preventDefault();
					closeOverlay();
				}
			}
		});

		linksContainer.addEventListener("click", handleNavLinkClick);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initNavOverlay);
	} else {
		initNavOverlay();
	}
})();

