// Global navigation overlay / panel (mobile + desktop)
(function () {
	"use strict";

	function initNavOverlay() {
		var overlay = document.querySelector("[data-nav-overlay]");
		var root = document.documentElement;
		var themeMeta = document.querySelector('meta[name="theme-color"]');
		var panel = overlay ? overlay.querySelector(".nav-panel") : null;
		var panelScroll = overlay ? overlay.querySelector(".nav-panel-scroll") : null;
		var closeBtn = overlay ? overlay.querySelector(".nav-panel-close") : null;
		var linksContainer = overlay ? overlay.querySelector("[data-nav-panel-links]") : null;
		var toggles = document.querySelectorAll(".nav-toggle");
		var headerNav = document.querySelector(".header-nav");

		if (!overlay || !panel || !panelScroll || !closeBtn || !linksContainer || !headerNav || !toggles.length) {
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

		function isSamePageHashLink(link) {
			if (!link) return false;
			var href = link.getAttribute("href") || "";
			if (!href) return false;
			if (href[0] === "#") return true;
			try {
				var url = new URL(href, window.location.href);
				return (
					url.origin === window.location.origin &&
					url.pathname === window.location.pathname &&
					!!url.hash
				);
			} catch (e) {
				return false;
			}
		}

		function getHashFromLink(link) {
			var href = link.getAttribute("href") || "";
			if (!href) return "";
			if (href[0] === "#") return href;
			try {
				var url = new URL(href, window.location.href);
				return url.hash || "";
			} catch (e) {
				return "";
			}
		}

		function scrollToHash(hash) {
			if (!hash || hash === "#") return;
			var id = hash.slice(1);
			try {
				id = decodeURIComponent(id);
			} catch (e) {}
			var el = document.getElementById(id);
			if (!el) {
				// Fallback for legacy named anchors
				var esc = (window.CSS && typeof window.CSS.escape === "function"
					? window.CSS.escape
					: function (s) {
							return String(s).replace(/[^a-zA-Z0-9_\u00A0-\uFFFF-]/g, "\\$&");
						});
				el = document.querySelector('[name="' + esc(id) + '"]');
			}
			if (!el) return;

			// Ensure URL reflects the target without triggering native scroll twice
			try {
				history.pushState(null, "", hash);
			} catch (e) {
				// If pushState fails, fall back to assigning hash
				window.location.hash = hash;
			}

			// Allow layout to settle after unlocking body scroll / panel close transition
			requestAnimationFrame(function () {
				requestAnimationFrame(function () {
					el.scrollIntoView({ behavior: "smooth", block: "start" });
				});
			});
		}

		function handleNavLinkClick(event) {
			var target = event.target;
			if (!target) return;

			var link = target.closest("a");
			if (!link) return;

			if (isPricingLink(link)) {
				// Open plan panel inside nav overlay (no overlay switch, no flash)
				event.preventDefault();
				var planId = link.getAttribute("data-plan");
				if (planId) {
					var mainLink = document.querySelector('.pricing-plan-link[data-plan="' + planId + '"]');
					if (mainLink) {
						mainLink.click();
					}
				}
			} else if (isSamePageHashLink(link)) {
				// For same-page anchors: close menu first (unlocks body), then perform the scroll.
				event.preventDefault();
				var hash = getHashFromLink(link);
				closeOverlay(false, function () {
					scrollToHash(hash);
				});
			} else {
				// Close overlay for regular anchor navigation and allow default behavior
				closeOverlay();
			}
		}

		function getMenuThemeColor() {
			if (!root) return "#000000";
			return root.classList.contains("light-mode") ? "#0044FF" : "#aaff00";
		}

		function getPageBgColor() {
			if (!root) return "#000000";
			return root.classList.contains("light-mode") ? "#ffffff" : "#000000";
		}

		// Safari on iOS often ignores setAttribute on an existing theme-color meta.
		// Removing and re-inserting the element forces Safari to re-evaluate it.
		function forceThemeColor(color) {
			var existing = document.querySelector('meta[name="theme-color"]');
			if (existing) existing.parentNode.removeChild(existing);
			var m = document.createElement("meta");
			m.name = "theme-color";
			m.content = color;
			document.head.appendChild(m);
			themeMeta = m;
		}

		function setThemeColorForMenu(isOpen) {
			var color = isOpen ? getMenuThemeColor() : getPageBgColor();
			forceThemeColor(color);
			if (isMobileViewport()) {
				document.documentElement.style.backgroundColor = color;
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

		var bodyScrollLocked = false;
		var MOBILE_MAX_WIDTH = 1080;
		var overlayTouchMoveHandler = null;
		var panelScrollTouchMoveHandler = null;
		var stickyBand = document.querySelector(".header-sticky-band");

		function isMobileViewport() {
			return typeof window !== "undefined" && window.innerWidth <= MOBILE_MAX_WIDTH;
		}

		function lockBodyScroll() {
			if (!document.body || bodyScrollLocked) return;
			document.body.style.overflow = "hidden";
			bodyScrollLocked = true;
		}

		function unlockBodyScroll() {
			if (!document.body || !bodyScrollLocked) return;
			document.body.style.overflow = "";
			bodyScrollLocked = false;
		}

		function openOverlay(trigger) {
			if (!overlay || !panel) return;
			lastTrigger = trigger || null;

			cloneLinks();

			if (stickyBand && isMobileViewport()) {
				stickyBand.style.display = "none";
			}

			// Update theme colour before the overlay becomes visible to avoid any iOS flash.
			setThemeColorForMenu(true);
			overlay.classList.add("is-open");
			syncOverlayBackground();
			if (trigger) {
				trigger.setAttribute("aria-expanded", "true");
			}

			// On mobile, lock body scroll so the page doesn’t scroll under the menu when scrolling the panel (iOS).
			if (isMobileViewport()) {
				lockBodyScroll();

				// iOS can draw a right-edge “fade” scroll indicator above web content.
				// Prevent touchmove on the overlay itself, but still allow scrolling inside the panel scroller.
				if (!overlayTouchMoveHandler) {
					overlayTouchMoveHandler = function (e) {
						// Only prevent touchmove on the overlay backdrop itself.
						// If the user is touching inside the panel (menu or plan),
						// allow that native scrolling to work.
						if (e.target === overlay) {
							e.preventDefault();
						}
					};
					overlay.addEventListener("touchmove", overlayTouchMoveHandler, { passive: false });
				}
				if (!panelScrollTouchMoveHandler) {
					panelScrollTouchMoveHandler = function (e) {
						// Allow native scrolling in the panel scroll area, but don't let it bubble to the overlay.
						e.stopPropagation();
					};
					panelScroll.addEventListener("touchmove", panelScrollTouchMoveHandler, { passive: true });
				}
			}

			// Show overlay first, then slide panel in after overlay has appeared
			setTimeout(function () {
				overlay.classList.add("is-panel-open");
			}, OVERLAY_FADE_MS);

			// Focus close button for accessibility
			closeBtn.focus();
		}

		// Expose a global helper so Safari can always open the menu via inline handlers if needed.
		if (!window.__daasOpenNavPanel) {
			window.__daasOpenNavPanel = function (trigger) {
				openOverlay(trigger || null);
				return false;
			};
		}

		function restoreTriggerFocus() {
			if (!lastTrigger || typeof lastTrigger.focus !== "function") return;
			// Try to restore focus without causing a scroll jump (Chrome/Safari support).
			try {
				lastTrigger.focus({ preventScroll: true });
			} catch (e) {
				// If the browser doesn’t support the option, skip focusing to avoid snapping.
			}
		}

		function restoreStickyBand() {
			if (stickyBand) stickyBand.style.display = "";
			document.documentElement.style.backgroundColor = "";
		}

		function closeOverlay(immediate, onClosed) {
			if (!overlay) return;

			overlay.classList.remove("is-panel-open");
			if (immediate) {
				overlay.classList.remove("is-open");
				overlay.style.backgroundColor = "";
				setThemeColorForMenu(false);
				restoreStickyBand();
				if (overlayTouchMoveHandler) {
					overlay.removeEventListener("touchmove", overlayTouchMoveHandler);
					overlayTouchMoveHandler = null;
				}
				if (panelScrollTouchMoveHandler) {
					panelScroll.removeEventListener("touchmove", panelScrollTouchMoveHandler);
					panelScrollTouchMoveHandler = null;
				}
				if (bodyScrollLocked) {
					unlockBodyScroll();
				}
				if (lastTrigger) {
					lastTrigger.setAttribute("aria-expanded", "false");
					restoreTriggerFocus();
				}
				if (typeof onClosed === "function") onClosed();
				return;
			}
			// Remove overlay and restore theme only after panel has fully slid off (no fade, just delay).
			setTimeout(function () {
				overlay.classList.remove("is-open");
				overlay.style.backgroundColor = "";
				setThemeColorForMenu(false);
				restoreStickyBand();
				if (overlayTouchMoveHandler) {
					overlay.removeEventListener("touchmove", overlayTouchMoveHandler);
					overlayTouchMoveHandler = null;
				}
				if (panelScrollTouchMoveHandler) {
					panelScroll.removeEventListener("touchmove", panelScrollTouchMoveHandler);
					panelScrollTouchMoveHandler = null;
				}
				if (bodyScrollLocked) {
					unlockBodyScroll();
				}
				if (lastTrigger) {
					lastTrigger.setAttribute("aria-expanded", "false");
					restoreTriggerFocus();
				}
				if (typeof onClosed === "function") onClosed();
			}, OVERLAY_CLOSE_DELAY_MS);
		}

		function handleToggleClick(e) {
			e.preventDefault();
			openOverlay(this);
		}

		// Bind the same handler to all nav toggles (mobile + desktop)
		toggles.forEach(function (btn) {
			btn.addEventListener("click", handleToggleClick);
		});

		closeBtn.addEventListener("click", function () {
			closeOverlay();
		});

		overlay.addEventListener("click", function (event) {
			// Click outside panel closes overlay
			// If the pricing plan panel is open, allow interaction inside it without closing the nav.
			var planPanel = overlay.querySelector(".plan-panel");
			var planIsOpen = overlay.classList.contains("is-plan-open");
			var clickedInsidePlan = planPanel && planPanel.contains(event.target);
			var clickedOverlayBackdrop = event.target === overlay;

			// When the pricing panel is open and the user clicks the backdrop,
			// let the pricing panel logic handle closing without also closing the nav overlay.
			if (planIsOpen && clickedOverlayBackdrop) {
				return;
			}

			if (!panel.contains(event.target) && !clickedInsidePlan) {
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

		window.updateNavOverlayBackground = function () {
			if (!overlay) return;
			if (overlay.classList.contains("is-open")) {
				syncOverlayBackground();
				if (isMobileViewport()) {
					setThemeColorForMenu(true);
				}
			}
		};
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initNavOverlay);
	} else {
		initNavOverlay();
	}
})();

