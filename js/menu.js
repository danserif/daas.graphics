// Global navigation overlay / panel (mobile + desktop)
(function () {
	"use strict";

	function initNavOverlay() {
		var overlay = document.querySelector("[data-nav-overlay]");
		var root = document.documentElement;
		var themeMeta = document.querySelector('meta[name="theme-color"]');
		var originalThemeColor = themeMeta ? themeMeta.getAttribute("content") : null;
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

		function getMenuThemeColor() {
			// Match the accent background used for the mobile nav panel
			if (!root) return originalThemeColor || "#000000";
			var isLightMode = root.classList.contains("light-mode");
			return isLightMode ? "#0044FF" : "#aaff00";
		}

		function setThemeColorForMenu(isOpen) {
			if (!themeMeta) return;
			if (isOpen) {
				themeMeta.setAttribute("content", getMenuThemeColor());
			} else if (originalThemeColor) {
				themeMeta.setAttribute("content", originalThemeColor);
			}
		}

		function syncOverlayBackground() {
			if (!overlay) return;
			// Let CSS control overlay colour (light/dark); clear any inline overrides.
			overlay.style.backgroundColor = "";
		}

		var OVERLAY_FADE_MS = 280;
		var PANEL_SLIDE_MS = 300;
		// Extra delay before removing overlay so it stays until panel is fully off; can reduce theme flash on close.
		var OVERLAY_CLOSE_DELAY_MS = 380;

		function openOverlay(trigger) {
			if (!overlay || !panel) return;
			lastTrigger = trigger || null;

			cloneLinks();

			// Update theme colour before the overlay becomes visible to avoid any iOS flash.
			setThemeColorForMenu(true);
			overlay.classList.add("is-open");
			syncOverlayBackground();
			if (trigger) {
				trigger.setAttribute("aria-expanded", "true");
			}

			// Show overlay first, then slide panel in after overlay has appeared
			setTimeout(function () {
				overlay.classList.add("is-panel-open");
			}, OVERLAY_FADE_MS);

			// Focus close button for accessibility
			closeBtn.focus();
		}

		function closeOverlay() {
			if (!overlay) return;

			overlay.classList.remove("is-panel-open");
			// Remove overlay and restore theme only after panel has fully slid off (no fade, just delay).
			setTimeout(function () {
				overlay.classList.remove("is-open");
				overlay.style.backgroundColor = "";
				setThemeColorForMenu(false);
				if (lastTrigger) {
					lastTrigger.setAttribute("aria-expanded", "false");
					lastTrigger.focus();
				}
			}, OVERLAY_CLOSE_DELAY_MS);
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

		// Expose hook so theme toggle can resync overlay color while menu is open
		window.updateNavOverlayBackground = function () {
			if (!overlay) return;
			if (overlay.classList.contains("is-open")) {
				syncOverlayBackground();
			}
		};
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initNavOverlay);
	} else {
		initNavOverlay();
	}
})();

