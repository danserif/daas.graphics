// ============================================
// LOADING SCREEN (runs immediately)
// ============================================
(function () {
	// Constants
	const isMobileViewport = window.matchMedia("(max-width: 1080px)").matches;
	const INITIAL_DELAY = 10;
	const ANIMATION_START_DELAY = 800;
	const BLOCK_DELAY = 200;
	const CODE_LINE_DELAY = 100;
	const LAST_BLOCK_DELAY = 400;
	// Give mobile extra pause time before the overlay swipes away so
	// header layout (including dividers) is fully ready and not seen loading.
	const PAUSE_TIME = isMobileViewport ? 1400 : 500;
	const CONTENT_FADE_MS = 1000;
	const SWIPE_DURATION_MS = 600;
	// Run preload (ASCII DOM, fonts, cache) while overlay is up for smoother reveal
	const PRELOAD_DELAY_MS = 1500;
	// ASCII disk: hidden, then lines load in one by one (scramble → original); code starts after disk completes
	const DISK_SHOW_DELAY = 200;
	const DISK_LINE_DELAY = 75; // ms between revealing each line of the disk
	const DISK_SCRAMBLE_SPACE_CHANCE = 0.6; // chance of space in unscrambled cells so it's not a solid block

	// Store original progress text and ASCII disk for reset
	let originalProgressText = null;
	let originalAsciiDisk = null;

	// Function to reset loading screen state
	function resetLoadingScreen() {
		const loadingOverlay = document.getElementById("loading-overlay");
		if (!loadingOverlay) return;

		// Remove all classes that affect visibility
		loadingOverlay.classList.remove("hidden", "fade-out", "swipe-up");

		const loadingProgress = loadingOverlay.querySelector(".loading-progress");
		const loadingLogo = loadingOverlay.querySelector(".loading-logo");
		if (loadingProgress) loadingProgress.classList.remove("fade-out");
		if (loadingLogo) loadingLogo.classList.remove("fade-out");

		// Reset progress text to original
		const loadingProgressText = loadingOverlay.querySelector(".loading-progress-text");
		if (loadingProgressText && originalProgressText) {
			loadingProgressText.textContent = originalProgressText;
		}

		// Remove all dynamically added progress blocks
		const loadingBlocks = loadingOverlay.querySelectorAll(".loading-block");
		const firstBlock = loadingOverlay.querySelector(".loading-progress .loading-block");
		loadingBlocks.forEach(function (block) {
			// Keep only the first one (the original in HTML)
			if (block !== firstBlock) {
				const prevSibling = block.previousSibling;
				if (prevSibling && prevSibling.nodeType === 3 && prevSibling.textContent.trim() === "") {
					prevSibling.remove();
				}
				block.remove();
			}
		});

		// Reset code lines visibility
		const loadingCodeLines = loadingOverlay.querySelectorAll(".loading-code p");
		loadingCodeLines.forEach(function (line) {
			line.classList.remove("code-line-visible");
		});

		// Reset progress lines visibility
		const loadingProgressLines = loadingOverlay.querySelectorAll(".loading-progress > p");
		loadingProgressLines.forEach(function (line) {
			line.classList.remove("progress-line-visible");
		});

		// Restore original ASCII disk and hide for next run
		const asciiDiskPre = loadingOverlay.querySelector(".ascii-disk");
		if (asciiDiskPre && originalAsciiDisk) {
			asciiDiskPre.textContent = originalAsciiDisk;
			asciiDiskPre.classList.add("ascii-disk-hidden");
		}

		// Add loading class to body
		document.body.classList.add("loading");
	}

	// Core animation function (can be called directly, bypasses skip check)
	function runLoadingAnimation() {
		// Cache DOM elements
		const loadingOverlay = document.getElementById("loading-overlay");
		const loadingProgressText = loadingOverlay?.querySelector(".loading-progress-text");
		const loadingBlock = loadingOverlay?.querySelector(".loading-block");
		const body = document.body;

		if (!loadingOverlay || !loadingProgressText) return;

		// Store original progress text on first load
		if (!originalProgressText) {
			originalProgressText = loadingProgressText.textContent;
		}

		body.classList.add("loading");

		// ASCII disk: hidden, then lines load in one by one; when done, start code + progress
		const asciiDiskPre = loadingOverlay.querySelector(".ascii-disk");
		var startCodeAndProgress = null; // set below after helpers exist

		// Preload header/ASCII/start during loading so reveal feels smooth.
		// Call immediately so header layout (including dividers) is finalized
		// well before the overlay finishes, avoiding any visible delay—
		// especially on mobile where the overall loading sequence is shorter.
		if (typeof window.__preloadDuringLoading === "function") {
			window.__preloadDuringLoading();
		}
		// Keep the delayed call as a fallback in case of slow font/layout initialization.
		setTimeout(function () {
			if (typeof window.__preloadDuringLoading === "function") {
				window.__preloadDuringLoading();
			}
		}, PRELOAD_DELAY_MS);

		// Cache elements for animations
		const loadingProgressLines = loadingOverlay.querySelectorAll(".loading-progress > p");
		const loadingCodeLines = loadingOverlay.querySelectorAll(".loading-code p");
		const loadingLogo = loadingOverlay.querySelector(".loading-logo");
		const loadingProgress = loadingOverlay.querySelector(".loading-progress");

		// Count underscores in the progress text
		const currentText = loadingProgressText.textContent;
		const underscoreCount = (currentText.match(/_/g) || []).length;
		const parentParagraph = loadingProgressText.parentElement;
		let insertAfterElement = loadingBlock;

		// Helper function to remove underscore from progress text
		function removeUnderscore(text) {
			const withSpace = text.replace(/_ /, "");
			return withSpace !== text ? withSpace : text.replace(/_/, "");
		}

		// Helper function to insert progress block
		function insertProgressBlock() {
			const blockSpan = document.createElement("span");
			blockSpan.className = "accent loading-block";
			blockSpan.textContent = "█";
			const textNode = document.createTextNode(" ");
			const nextSibling = insertAfterElement.nextSibling;

			if (nextSibling) {
				parentParagraph.insertBefore(textNode, nextSibling);
				parentParagraph.insertBefore(blockSpan, nextSibling);
			} else {
				parentParagraph.insertBefore(textNode, loadingProgressText);
				parentParagraph.insertBefore(blockSpan, loadingProgressText);
			}
			return blockSpan;
		}

		// Fade out content (bar, code, icon), then swipe overlay background up and off
		function fadeOutLoadingScreen() {
			if (loadingLogo) loadingLogo.classList.add("fade-out");
			if (loadingProgress) loadingProgress.classList.add("fade-out");

			setTimeout(function () {
				loadingOverlay.classList.add("swipe-up");
				setTimeout(function () {
					loadingOverlay.classList.add("hidden");
					body.classList.remove("loading");
					var meta = document.querySelector('meta[name="theme-color"]');
					if (meta) {
						var isLight = document.documentElement.classList.contains("light-mode");
						meta.setAttribute("content", isLight ? "#ffffff" : "#000000");
					}
					window.dispatchEvent(new CustomEvent("loadingComplete"));
				}, SWIPE_DURATION_MS);
			}, CONTENT_FADE_MS);
		}

		// Start code lines + progress (called when disk finishes, or after delay if no disk)
		startCodeAndProgress = function () {
			loadingCodeLines.forEach(function (line, index) {
				setTimeout(function () {
					line.classList.add("code-line-visible");
				}, index * CODE_LINE_DELAY);
			});
			for (let i = 0; i < underscoreCount; i++) {
				setTimeout(function () {
					loadingProgressText.textContent = removeUnderscore(loadingProgressText.textContent);
					insertAfterElement = insertProgressBlock();
					if (i === underscoreCount - 1) {
						setTimeout(function () {
							setTimeout(fadeOutLoadingScreen, PAUSE_TIME);
						}, LAST_BLOCK_DELAY);
					}
				}, i * BLOCK_DELAY);
			}
		};

		// Disk: line-by-line reveal, then start code
		if (asciiDiskPre) {
			if (!originalAsciiDisk) originalAsciiDisk = asciiDiskPre.textContent;
			const diskChars = "!@#$%^&*()_+-=[]{}|;':\",.<>?/~`0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
			function randomDiskChar() {
				if (Math.random() < DISK_SCRAMBLE_SPACE_CHANCE) return " ";
				return diskChars[Math.floor(Math.random() * diskChars.length)];
			}
			var lines = originalAsciiDisk.split("\n");
			var lineRanges = [];
			var pos = 0;
			for (var l = 0; l < lines.length; l++) {
				var start = pos;
				pos += lines[l].length;
				var end = pos;
				lineRanges.push({ start: start, end: end });
				pos += 1; // newline
			}
			asciiDiskPre.classList.add("ascii-disk-hidden");
			asciiDiskPre.textContent = originalAsciiDisk
				.split("")
				.map(function (c) {
					return c === "\n" ? "\n" : randomDiskChar();
				})
				.join("");
			setTimeout(function () {
				asciiDiskPre.classList.remove("ascii-disk-hidden");
				var len = originalAsciiDisk.length;
				var revealed = new Set();
				function buildFrame() {
					var out = [];
					for (var i = 0; i < len; i++) {
						out.push(
							revealed.has(i)
								? originalAsciiDisk[i]
								: originalAsciiDisk[i] === "\n"
									? "\n"
									: randomDiskChar(),
						);
					}
					asciiDiskPre.textContent = out.join("");
				}
				var lineIndex = 0;
				var diskInterval = setInterval(function () {
					var r = lineRanges[lineIndex];
					for (var i = r.start; i < r.end; i++) revealed.add(i);
					if (lineIndex < lineRanges.length - 1) revealed.add(r.end); // newline
					buildFrame();
					lineIndex++;
					if (lineIndex >= lineRanges.length) {
						clearInterval(diskInterval);
						asciiDiskPre.textContent = originalAsciiDisk;
						startCodeAndProgress();
					}
				}, DISK_LINE_DELAY);
			}, DISK_SHOW_DELAY);
		} else {
			setTimeout(startCodeAndProgress, ANIMATION_START_DELAY);
		}

		// Animate loading progress (show title + bar; code starts when disk completes)
		function animateLoading() {
			setTimeout(function () {
				loadingProgressLines.forEach(function (line) {
					line.classList.add("progress-line-visible");
				});
			}, INITIAL_DELAY);
		}

		animateLoading();
	}

	// Wrapper function that checks for skip flag (for initial load)
	function initLoadingScreen() {
		// Development controls: Skip loading screen
		const urlParams = new URLSearchParams(window.location.search);
		const shouldSkip =
			urlParams.get("skipLoading") === "true" ||
			localStorage.getItem("skipLoadingScreen") === "true";

		if (shouldSkip) {
			const loadingOverlay = document.getElementById("loading-overlay");
			const body = document.body;
			if (loadingOverlay) {
				loadingOverlay.classList.add("hidden");
			}
			body.classList.remove("loading");
			if (typeof window.__preloadDuringLoading === "function") {
				window.__preloadDuringLoading();
			}
			// Defer until full main.js has run so initAfterLoading() can attach the listener.
			setTimeout(function () {
				window.dispatchEvent(new CustomEvent("loadingComplete"));
			}, 0);
			return;
		}

		runLoadingAnimation();
	}

	// Make triggerLoadingScreen available globally for mode toggle
	window.triggerLoadingScreen = function () {
		resetLoadingScreen();
		// Small delay to ensure color mode is applied
		setTimeout(function () {
			runLoadingAnimation();
		}, 10);
	};

	// Start loading screen when DOM is ready
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initLoadingScreen);
	} else {
		initLoadingScreen();
	}
})();

// ============================================
// IMMEDIATE INITIALIZATION (runs before DOM ready)
// ============================================

// Light/Dark Mode - Apply immediately to prevent flash
(function () {
	const root = document.documentElement;
	const savedMode = localStorage.getItem("colorMode") || "dark";
	if (savedMode === "light") {
		root.classList.add("light-mode");
	}
})();

// Update accent color value display based on current mode
window.updateAccentColorValue = function () {
	const accentColorValue = document.getElementById("accent-color-value");
	if (!accentColorValue) return;

	const root = document.documentElement;
	const isLightMode = root.classList.contains("light-mode");
	accentColorValue.textContent = isLightMode ? "#0044FF" : "#aaff00";
};

// Update accent color value on initial load (after DOM is ready)
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", window.updateAccentColorValue);
} else {
	window.updateAccentColorValue();
}

// Typewriter - Store original HTML immediately to prevent flash
(function () {
	const headerLabels = document.querySelectorAll(".header-label");
	headerLabels.forEach(function (label) {
		label.setAttribute("data-original", label.innerHTML);
	});
})();

// Clock - Initialize immediately
function updateClocks() {
	const now = new Date();
	const nzTimeZone = "Pacific/Auckland";
	const nzTime = now.toLocaleString("en-NZ", {
		timeZone: nzTimeZone,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: true,
	});
	// Check DST using the same date object
	const nzTimeString = now.toLocaleTimeString("en-NZ", {
		timeZone: nzTimeZone,
		timeZoneName: "short",
	});
	const nzTimeZoneName = nzTimeString.includes("DT") ? "NZDT" : "NZST";
	// Calculate timezone offset more efficiently
	const nzDate = new Date(now.toLocaleString("en-US", { timeZone: nzTimeZone }));
	const timezoneOffset = -nzDate.getTimezoneOffset() / 60;
	const gmtOffsetFooter = `<span class="opacity-50">(GMT${timezoneOffset >= 0 ? "+" : ""}${timezoneOffset})</span>`;
	const gmtOffsetHeader = `<span class="opacity-75">(GMT${timezoneOffset >= 0 ? "+" : ""}${timezoneOffset})</span>`;

	const footerClockElement = document.getElementById("footer-clock");
	if (footerClockElement) {
		footerClockElement.innerHTML = `<span>${nzTime}</span> <span class="opacity-25">${nzTimeZoneName}</span> ${gmtOffsetFooter}`;
	}

	const headerClockElement = document.getElementById("header-clock");
	const headerClockGmtElement = document.getElementById("header-clock-gmt");
	if (headerClockElement) {
		const clockHTML = `<span class="opacity-50">${nzTimeZoneName}</span> <span>${nzTime}</span>`;
		const headerLabel = headerClockElement.closest(".header-label");
		if (!headerLabel || !headerLabel.classList.contains("typewriter-active")) {
			headerClockElement.innerHTML = clockHTML;
		}

		if (headerClockGmtElement) {
			headerClockGmtElement.innerHTML = gmtOffsetHeader;
		}

		if (headerLabel && !headerLabel.hasAttribute("data-original")) {
			headerLabel.setAttribute("data-original", headerLabel.innerHTML);
		}
	}
}
// Initialize clock immediately (before typewriter runs)
updateClocks();
// Start interval for updates after a short delay
setTimeout(function () {
	setInterval(updateClocks, 1000);
}, 100);

// ============================================
// DOM READY INITIALIZATION
// ============================================
// Shared character set for glitch (ASCII) animations
const glitchChars =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/~`";
let asciiDomPrepared = false;
let cachedHeaderLabels = null;
let cachedStartSection = null;
let headerSharedMinHeight = 0;
let animationIntervals = [];
let animationTimeouts = [];

function getHeaderLabelLayoutParent(label) {
	const band = label.closest(".header-sticky-band");
	if (band) return band;
	const col = label.closest(".header-column");
	if (!col || window.getComputedStyle(col).display === "none") {
		return null;
	}
	return col;
}

function markHeaderLinesReady() {
	const header = document.querySelector(".header");
	if (header) {
		header.classList.add("header-lines-ready");
	}
	// Nudge fixed mobile band height + repaint so the sticky hr shows with other header dividers (Safari).
	syncMobileHeaderStickyBandHeight();
	if (typeof requestAnimationFrame === "function") {
		requestAnimationFrame(function () {
			syncMobileHeaderStickyBandHeight();
		});
	}
}

function syncMobileHeaderStickyBandHeight() {
	const mq = window.matchMedia("(max-width: 1080px)");
	const bandEl = document.querySelector(".header-sticky-band");
	const root = document.documentElement;
	if (!bandEl || !mq.matches) {
		root.style.removeProperty("--header-sticky-band-height");
		return;
	}
	root.style.setProperty("--header-sticky-band-height", bandEl.offsetHeight + "px");
}

function prepareAsciiDOM() {
	const asciiTextElements = document.querySelectorAll(".ascii-text");
	asciiTextElements.forEach(function (element) {
		const originalText = element.textContent;
		const textArray = originalText.split("");
		const newContent = [];
		const animatePercentage = 0.15;
		const charsToAnimate = Math.floor(textArray.length * animatePercentage);
		const animateIndices = new Set();
		while (animateIndices.size < charsToAnimate) {
			const randomIndex = Math.floor(Math.random() * textArray.length);
			if (textArray[randomIndex] !== " " && textArray[randomIndex] !== "\n") {
				animateIndices.add(randomIndex);
			}
		}
		textArray.forEach(function (char, index) {
			if (animateIndices.has(index) && char !== " " && char !== "\n") {
				newContent.push(
					'<span class="ascii-char-animate" data-final="' +
						char.replace(/"/g, "&quot;") +
						'">' +
						char +
						"</span>",
				);
			} else {
				newContent.push(char === "\n" ? "\n" : char === " " ? " " : char);
			}
		});
		element.innerHTML = newContent.join("");
	});
}

function startAsciiCharAnimations() {
	const chars = glitchChars;
	function animateChar(char, shouldLoop) {
		const finalChar = char.getAttribute("data-final");
		const duration = 1000 + Math.random() * 2000;
		const steps = 10 + Math.floor(Math.random() * 20);
		const stepDuration = duration / steps;
		let currentStep = 0;
		const animate = setInterval(function () {
			if (currentStep < steps) {
				const randomChar = chars[Math.floor(Math.random() * chars.length)];
				char.textContent = randomChar;
				currentStep++;
			} else {
				char.textContent = finalChar;
				animationIntervals = animationIntervals.filter(function (interval) {
					return interval !== animate;
				});
				clearInterval(animate);
				if (shouldLoop) {
					const delay = 2000 + Math.random() * 5000;
					const timeout = setTimeout(function () {
						animationTimeouts = animationTimeouts.filter(function (t) {
							return t !== timeout;
						});
						animateChar(char, true);
					}, delay);
					animationTimeouts.push(timeout);
				}
			}
		}, stepDuration);
		animationIntervals.push(animate);
	}
	const animatedChars = document.querySelectorAll(".ascii-char-animate");
	animatedChars.forEach(function (char) {
		const initialDelay = Math.random() * 3000;
		const timeout = setTimeout(function () {
			animationTimeouts = animationTimeouts.filter(function (t) {
				return t !== timeout;
			});
			animateChar(char, true);
		}, initialDelay);
		animationTimeouts.push(timeout);
	});
}

function initAsciiAnimation() {
	prepareAsciiDOM();
	startAsciiCharAnimations();
}

// Called by loading screen during overlay to preload for smoother reveal
window.__preloadDuringLoading = function () {
	prepareAsciiDOM();
	asciiDomPrepared = true;
	cachedHeaderLabels = document.querySelectorAll(".header-label");
	cachedStartSection = document.querySelector(".start");
	// Compute and apply shared min-height for header labels while the loading
	// overlay is still covering the page so header row heights (and dividers)
	// are stable before they are visible, especially on mobile.
	if (cachedHeaderLabels && cachedHeaderLabels.length && !headerSharedMinHeight) {
		let localSharedMinHeight = 0;
		cachedHeaderLabels.forEach(function (label) {
			const layoutParent = getHeaderLabelLayoutParent(label);
			if (!layoutParent) return;
			const previousVisibility = label.style.visibility;
			label.style.visibility = "visible";
			const h = label.offsetHeight;
			if (h > localSharedMinHeight) localSharedMinHeight = h;
			label.style.visibility = previousVisibility;
		});
		if (localSharedMinHeight > 0) {
			headerSharedMinHeight = localSharedMinHeight;
			cachedHeaderLabels.forEach(function (label) {
				const layoutParent = getHeaderLabelLayoutParent(label);
				if (!layoutParent) return;
				label.style.minHeight = headerSharedMinHeight + "px";
			});
			// Header row heights (and dividers) are now stable; allow them to fade in.
			markHeaderLinesReady();
		}
	}
	syncMobileHeaderStickyBandHeight();
};

// Wait for loading screen to complete before starting animations
function initAfterLoading() {
	// This function will be called after loading completes
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", function () {
			window.addEventListener("loadingComplete", startAnimations, { once: true });
		});
	} else {
		window.addEventListener("loadingComplete", startAnimations, { once: true });
	}
}

function startAnimations() {
	const root = document.documentElement;

	// Fade in start section (use cached element if preloaded)
	const startSection = cachedStartSection || document.querySelector(".start");
	if (startSection) {
		setTimeout(function () {
			startSection.classList.add("fade-in");
		}, 200);
	}

	// Legacy: keep theme-color meta in sync for Safari < 26 and other browsers.
	function syncThemeColorMeta() {
		var meta = document.querySelector('meta[name="theme-color"]');
		if (!meta) return;
		var isLight = root.classList.contains("light-mode");
		meta.setAttribute("content", isLight ? "#ffffff" : "#000000");
	}

	// Safari 26: all fixed elements have backdrop-filter on mobile, which
	// disqualifies them from toolbar tinting. Safari falls back to body bg.
	function pushSafariTint() {
		if (window.innerWidth > 1080) return;
		var isLight = root.classList.contains("light-mode");
		document.body.style.backgroundColor = isLight ? "#ffffff" : "#000000";
	}

	// Light/Dark Mode Toggle - Event delegation
	document.addEventListener("click", function (e) {
		if (e.target.classList.contains("dark-mode-toggle")) {
			e.preventDefault();
			root.classList.remove("light-mode");
			localStorage.setItem("colorMode", "dark");
			updateAccentColorValue();
			syncThemeColorMeta();
			pushSafariTint();
			if (typeof window.updateNavOverlayBackground === "function") {
				window.updateNavOverlayBackground();
			}
			if (typeof window.triggerLoadingScreen === "function") {
				window.triggerLoadingScreen();
			}
		} else if (e.target.classList.contains("light-mode-toggle")) {
			e.preventDefault();
			root.classList.add("light-mode");
			localStorage.setItem("colorMode", "light");
			updateAccentColorValue();
			syncThemeColorMeta();
			pushSafariTint();
			if (typeof window.updateNavOverlayBackground === "function") {
				window.updateNavOverlayBackground();
			}
			if (typeof window.triggerLoadingScreen === "function") {
				window.triggerLoadingScreen();
			}
		}
	});

	// Typewriter effect for header labels (use cached list if preloaded)
	const headerLabels = cachedHeaderLabels || document.querySelectorAll(".header-label");

	// Compute shared min-height from tallest visible label so all labels use the same height.
	// If we've already computed/applied it during the loading overlay, reuse that value
	// to avoid any visible layout shift when animations start.
	let sharedMinHeight = headerSharedMinHeight || 0;
	if (!sharedMinHeight) {
		headerLabels.forEach(function (label) {
			const layoutParent = getHeaderLabelLayoutParent(label);
			if (!layoutParent) return;
			const previousVisibility = label.style.visibility;
			label.style.visibility = "visible";
			const h = label.offsetHeight;
			if (h > sharedMinHeight) sharedMinHeight = h;
			label.style.visibility = previousVisibility;
		});
		if (sharedMinHeight > 0) {
			headerSharedMinHeight = sharedMinHeight;
			headerLabels.forEach(function (label) {
				const layoutParent = getHeaderLabelLayoutParent(label);
				if (!layoutParent) return;
				label.style.minHeight = sharedMinHeight + "px";
			});
			// In cases where the loading overlay didn't run (or preload was skipped),
			// mark header lines as ready once we know their final height.
			markHeaderLinesReady();
		}
	} else {
		// Preload already applied min-heights; ensure class is present if anything prevented markHeaderLinesReady.
		const headerEl = document.querySelector(".header");
		if (headerEl && !headerEl.classList.contains("header-lines-ready")) {
			markHeaderLinesReady();
		}
	}

	function typeWriter(element, speed, onComplete) {
		const originalHTML = element.getAttribute("data-original") || element.innerHTML;

		let htmlIndex = 0;
		let nextAdvanceAt = 0;
		let rafId = null;
		// Clear content and make visible when starting to type
		element.innerHTML = "";
		element.classList.add("typewriter-active");

		// Pre-compile entity lookup for faster checking
		const validEntities = {
			"&amp;": true,
			"&lt;": true,
			"&gt;": true,
			"&quot;": true,
			"&apos;": true,
			"&#39;": true,
			"&#34;": true,
		};

		// Advance one logical character (tag, entity, or single char). Returns delay in ms until next advance.
		function advanceOne(now) {
			if (htmlIndex >= originalHTML.length) return 0;
			const char = originalHTML[htmlIndex];
			let delay = speed;

			if (char === "<") {
				const tagEnd = originalHTML.indexOf(">", htmlIndex);
				if (tagEnd !== -1) {
					element.innerHTML = originalHTML.substring(0, tagEnd + 1);
					htmlIndex = tagEnd + 1;
					const nextIsTag = htmlIndex < originalHTML.length && originalHTML[htmlIndex] === "<";
					delay = Math.max(1, speed * (nextIsTag ? 0.05 : 0.15));
				} else {
					htmlIndex++;
					element.innerHTML = originalHTML.substring(0, htmlIndex);
				}
			} else if (char === "&") {
				const entityEnd = originalHTML.indexOf(";", htmlIndex);
				if (entityEnd !== -1) {
					const entity = originalHTML.substring(htmlIndex, entityEnd + 1);
					if (validEntities[entity]) {
						htmlIndex = entityEnd + 1;
						element.innerHTML = originalHTML.substring(0, htmlIndex);
						delay = Math.max(1, speed * 0.3);
					} else {
						htmlIndex++;
						element.innerHTML = originalHTML.substring(0, htmlIndex);
					}
				} else {
					htmlIndex++;
					element.innerHTML = originalHTML.substring(0, htmlIndex);
				}
			} else {
				htmlIndex++;
				element.innerHTML = originalHTML.substring(0, htmlIndex);
				if ((char === "[" || char === "]") && htmlIndex < originalHTML.length) {
					const nextChar = originalHTML[htmlIndex];
					if (nextChar === "<" || (htmlIndex > 1 && originalHTML[htmlIndex - 2] === ">")) {
						delay = speed * 0.5;
					}
				}
			}
			nextAdvanceAt = now + delay;
			return delay;
		}

		function tick(now) {
			if (htmlIndex >= originalHTML.length) {
				element.style.visibility = "visible";
				element.classList.remove("typewriter-active");
				if (typeof onComplete === "function") {
					onComplete();
				}
				return;
			}
			// Only advance at most one character per frame; prevents timer batching "jump"
			if (now >= nextAdvanceAt) {
				advanceOne(now);
			}
			rafId = requestAnimationFrame(tick);
		}

		// Start on next frame with first character due immediately
		nextAdvanceAt = 0;
		rafId = requestAnimationFrame(tick);
	}

	// Constants for typewriter timing
	const IS_MOBILE_VIEWPORT = window.matchMedia("(max-width: 1080px)").matches;
	// Unified speed for both viewports (ms per logical "step").
	const TYPEWRITER_SPEED = 20;
	// When staggering/batching (mobile), this controls per-label delay.
	const TYPEWRITER_DELAY = 220;
	// Small settle delay before typing starts (helps avoid post-load jank).
	const TYPEWRITER_START_DELAY = IS_MOBILE_VIEWPORT ? 120 : 80;
	// On desktop, start all header labels at the same time.
	// Hidden (display:none) labels should not add delay to visible ones.
	const TYPEWRITER_CONCURRENCY = IS_MOBILE_VIEWPORT ? 1 : Number.POSITIVE_INFINITY;

	function isLabelVisible(label) {
		if (label.closest(".header-sticky-band")) {
			return true;
		}
		const headerColumn = label.closest(".header-column");
		return !!(headerColumn && window.getComputedStyle(headerColumn).display !== "none");
	}

	function getTypewriterHTMLForViewport(label) {
		// The header nav label contains both mobile-only and desktop-only segments.
		// If we type the full HTML, we spend real time animating hidden text.
		// Instead, build a viewport-appropriate snapshot so visible text appears immediately.
		const clone = label.cloneNode(true);
		clone.classList.remove("typewriter-active");
		if (IS_MOBILE_VIEWPORT) {
			clone.querySelectorAll(".desktop-only").forEach(function (el) {
				el.remove();
			});
		} else {
			clone.querySelectorAll(".mobile-only").forEach(function (el) {
				el.remove();
			});
		}
		return clone.innerHTML;
	}

	function scheduleTypewriter(label, startDelay) {
		const clockElement = label.querySelector("#header-clock");
		const isNavLabel = label.classList.contains("header-label--nav");

		function onNavLabelComplete() {
			if (!isNavLabel) return;
			const headerColumn = label.closest(".header-column");
			if (!headerColumn) return;
			const trigger = headerColumn.querySelector(".header-nav-trigger");
			if (trigger) {
				trigger.classList.add("is-visible");
			}
		}

		if (clockElement) {
			// Clock is already populated by earlier script; no extra wait
			const fullLabelHTML = label.innerHTML;
			if (fullLabelHTML && clockElement.innerHTML) {
				label.setAttribute("data-original", getTypewriterHTMLForViewport(label));
				setTimeout(function () {
					typeWriter(label, TYPEWRITER_SPEED, onNavLabelComplete);
				}, startDelay);
			}
		} else {
			setTimeout(function () {
				label.setAttribute("data-original", getTypewriterHTMLForViewport(label));
				typeWriter(label, TYPEWRITER_SPEED, onNavLabelComplete);
			}, startDelay);
		}
	}

	// 1) Animate visible labels first (desktop: concurrently in small batches).
	const visibleLabels = Array.from(headerLabels)
		.filter(isLabelVisible)
		.sort(function (a, b) {
			// Prioritize nav/mode label so Mode + Navigation appears immediately.
			function priority(label) {
				if (label.classList.contains("header-label--nav")) return 0;
				// Next: anything containing the mode toggles (extra safety if class changes)
				if (label.querySelector(".dark-mode-toggle, .light-mode-toggle")) return 1;
				return 2;
			}
			return priority(a) - priority(b);
		});

	visibleLabels.forEach(function (label, visibleIndex) {
		// Desktop: all start together. Mobile: keep sequential.
		const startDelay = IS_MOBILE_VIEWPORT
			? TYPEWRITER_START_DELAY + visibleIndex * TYPEWRITER_DELAY
			: 0;
		scheduleTypewriter(label, startDelay);
	});

	// 2) For labels currently hidden (mobile/desktop variants), animate them when they become visible.
	// This avoids invisible labels slowing down the initial desktop header.
	const hiddenLabels = Array.from(headerLabels).filter(function (label) {
		return !isLabelVisible(label);
	});
	hiddenLabels.forEach(function (label) {
		const observeRoot = label.closest(".header-sticky-band") || label.closest(".header-column");
		if (!observeRoot) return;
		const observer = new IntersectionObserver(
			function (entries) {
				entries.forEach(function (entry) {
					if (!entry.isIntersecting) return;
					if (label.classList.contains("typewriter-active")) return;
					label.setAttribute("data-original", getTypewriterHTMLForViewport(label));
					scheduleTypewriter(label, 0);
					observer.disconnect();
				});
			},
			{ threshold: 0.1 },
		);
		observer.observe(observeRoot);
	});

	// ASCII: use preloaded DOM if loading screen ran, else prepare now; then start char animations after short defer
	if (!asciiDomPrepared) {
		prepareAsciiDOM();
		asciiDomPrepared = true;
	}
	setTimeout(startAsciiCharAnimations, 450);

	let resizeTimeout;
	window.addEventListener("resize", function () {
		clearTimeout(resizeTimeout);
		resizeTimeout = setTimeout(function () {
			animationIntervals.forEach(function (interval) {
				clearInterval(interval);
			});
			animationIntervals = [];
			animationTimeouts.forEach(function (timeout) {
				clearTimeout(timeout);
			});
			animationTimeouts = [];
			initAsciiAnimation();
		}, 250);
	});

	// Mobile: fixed title bar from first paint; keep placeholder height in sync (ResizeObserver + viewport changes).
	(function initMobileHeaderStickyBand() {
		const mq = window.matchMedia("(max-width: 1080px)");
		const band = document.querySelector(".header-sticky-band");
		if (!band) return;

		function sync() {
			syncMobileHeaderStickyBandHeight();
		}

		mq.addEventListener("change", sync);
		if (typeof ResizeObserver !== "undefined") {
			const ro = new ResizeObserver(sync);
			ro.observe(band);
		}
		if (document.fonts && document.fonts.ready) {
			document.fonts.ready.then(sync);
		}
		sync();
	})();

	// Staggered fade-in animation for ASCII hero + hero icons; viewport-triggered fade-in for footer DaaS graphics + icons
	const asciiTexts = document.querySelectorAll(".ascii-text");
	const heroIcons = document.querySelectorAll(".hero-icons .daas-icon");
	const graphicsSection = document.querySelector(".daas-graphics");
	const graphics = document.querySelectorAll(".daas-graphic");
	const icons = document.querySelectorAll(".daas-icon");

	// Check if mobile to add delay for loading overlay
	const isMobile = window.matchMedia("(max-width: 1080px)").matches;
	const asciiDelay = isMobile ? 1800 : 0; // Delay on mobile to account for overlay swipe

	requestAnimationFrame(function () {
		requestAnimationFrame(function () {
			setTimeout(function () {
				asciiTexts.forEach(function (asciiText) {
					asciiText.classList.add("fade-in");
				});
				// Hero icons fade in with ASCII (same placement over header, do not scroll)
				heroIcons.forEach(function (icon, index) {
					setTimeout(function () {
						icon.classList.add("fade-in");
					}, index * 80);
				});
			}, asciiDelay);
		});
	});

	function initDaasGraphicsFade() {
		if (!graphics.length) return;

		const imagePromises = Array.from(graphics).map(function (graphic) {
			return new Promise(function (resolve) {
				// For <img> elements, use `complete`; for SVGs or others, resolve immediately
				if ("complete" in graphic) {
					if (graphic.complete) {
						resolve();
					} else {
						graphic.addEventListener("load", resolve, { once: true });
						graphic.addEventListener("error", resolve, { once: true });
					}
				} else {
					resolve();
				}
			});
		});

		Promise.all(imagePromises).then(function () {
			setTimeout(function () {
				graphics.forEach(function (graphic, index) {
					setTimeout(function () {
						graphic.classList.add("fade-in");
					}, index * 200);
				});

				// Only fade footer icons (hero icons fade with ASCII above)
				const footerIcons = graphicsSection.querySelectorAll(".daas-icon");
				const iconsStartDelay = 1500; // Start icons after graphics fade-in (1.5s CSS)
				footerIcons.forEach(function (icon, index) {
					setTimeout(
						function () {
							icon.classList.add("fade-in");
						},
						iconsStartDelay + index * 150,
					);
				});
			}, 50);
		});
	}

	// Trigger DaaS graphics fade when the footer illustration section enters the viewport
	if (graphicsSection) {
		const observer = new IntersectionObserver(
			function (entries) {
				entries.forEach(function (entry) {
					if (entry.isIntersecting) {
						initDaasGraphicsFade();
						observer.disconnect();
					}
				});
			},
			{
				root: null,
				threshold: 0.3,
			},
		);

		observer.observe(graphicsSection);
	} else {
		// Fallback: run immediately if section is not found
		initDaasGraphicsFade();
	}

	// Confetti Easter Egg - Click icons to animate them across screen
	function createConfetti(icon) {
		const rect = icon.getBoundingClientRect();
		// getBoundingClientRect() includes transforms (rotation), which can inflate/skew the
		// measured box and make SVGs look stretched when we force that size on the clone.
		// Use layout size instead for width/height.
		const layoutWidth = icon.offsetWidth || rect.width;
		const layoutHeight = icon.offsetHeight || rect.height;
		const computed = window.getComputedStyle(icon);
		const aspectRatio = computed && computed.aspectRatio ? computed.aspectRatio : "auto";
		const iconClone = icon.cloneNode(true);

		// Style the clone for animation
		iconClone.style.position = "fixed";
		iconClone.style.left = rect.left + "px";
		iconClone.style.top = rect.top + "px";
		iconClone.style.width = layoutWidth + "px";
		// Prefer preserving the element's aspect ratio to avoid stretching (notably on icon 2).
		if (aspectRatio && aspectRatio !== "auto") {
			iconClone.style.aspectRatio = aspectRatio;
			iconClone.style.height = "auto";
		} else {
			iconClone.style.height = layoutHeight + "px";
		}
		iconClone.style.zIndex = "10000";
		iconClone.style.pointerEvents = "none";
		iconClone.style.willChange = "transform, opacity";

		// For hero icons, append to body so animation can extend beyond the hero container
		// while still allowing section-specific color styling via an extra class.
		let parentForClone;
		if (icon.closest(".hero-icons")) {
			parentForClone = document.body;
			iconClone.classList.add("hero-confetti");
		} else {
			// For footer / other sections, keep within the same DOM context
			// so existing section-specific color styling continues to apply.
			parentForClone = icon.parentNode || document.body;
		}
		parentForClone.appendChild(iconClone);

		// Random trajectory
		const angle = Math.random() * Math.PI * 2;
		const velocity = 200 + Math.random() * 300; // pixels per second
		const rotationSpeed = (Math.random() - 0.5) * 1080; // degrees per second
		const scaleEnd = 0.2 + Math.random() * 0.4;
		const duration = 2000 + Math.random() * 1500; // 2-3.5 seconds

		const startX = rect.left + rect.width / 2;
		const startY = rect.top + rect.height / 2;
		const vx = Math.cos(angle) * velocity;
		const vy = Math.sin(angle) * velocity;

		const startTime = Date.now();

		function animate() {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);

			if (progress < 1) {
				// Ease out with gravity
				const easeProgress = 1 - Math.pow(1 - progress, 2);

				const timeSeconds = elapsed / 1000;
				const x = startX + vx * timeSeconds;
				const y = startY + vy * timeSeconds + 0.5 * 500 * timeSeconds * timeSeconds; // gravity effect
				const rotation = rotationSpeed * timeSeconds;
				const scale = 1 - (1 - scaleEnd) * easeProgress;
				const opacity = 1 - progress;

				iconClone.style.transform = `translate(${x - startX}px, ${y - startY}px) rotate(${rotation}deg) scale(${scale})`;
				iconClone.style.opacity = opacity;

				requestAnimationFrame(animate);
			} else {
				// Animation complete, remove clone
				if (iconClone.parentNode) {
					iconClone.parentNode.removeChild(iconClone);
				}
			}
		}

		// Start animation on next frame
		requestAnimationFrame(animate);
	}

	// Add click handlers to all icons
	icons.forEach(function (icon) {
		icon.addEventListener("click", function (e) {
			e.preventDefault();
			e.stopPropagation();
			// Track with Fathom if available
			if (typeof fathom !== "undefined" && fathom.trackEvent) fathom.trackEvent("Icon", 0);
			// Create multiple confetti pieces for more effect
			for (let i = 0; i < 5; i++) {
				setTimeout(function () {
					createConfetti(icon);
				}, i * 50);
			}
		});
		// Remove inline onclick to avoid conflicts
		icon.removeAttribute("onclick");
	});

	// Icon Flicker Effect - Same as ASCII text glitch, triggered when element enters viewport
	const cardIcons = document.querySelectorAll(".card-icon");
	const workIcons = document.querySelectorAll(".work-icon");
	const quotesIcons = document.querySelectorAll(".quotes-icon");
	const awardsIcons = document.querySelectorAll(".awards-icon");
	const footerIcons = document.querySelectorAll(".footer-icon");
	const marqueeIcons = document.querySelectorAll(".marquee-icon");
	const allIcons = Array.from(cardIcons)
		.concat(Array.from(workIcons))
		.concat(Array.from(quotesIcons))
		.concat(Array.from(awardsIcons))
		.concat(Array.from(footerIcons))
		.concat(Array.from(marqueeIcons));
	const animatedIcons = new Set();

	allIcons.forEach(function (icon) {
		// Get the original HTML entity or text - check both innerHTML and textContent
		const originalHTML = icon.innerHTML.trim();
		const originalText = icon.textContent.trim();

		// Try to extract the HTML entity code (e.g., "&#68;" -> 68)
		let entityMatch = originalHTML.match(/&#(\d+);/);
		let originalCharCode = null;
		let isPlainText = false;
		let isMultiCharIcon = false; // e.g. .card-icon with "TL;DR" in .tldr section

		if (entityMatch) {
			originalCharCode = parseInt(entityMatch[1]);
		} else if (originalText.length > 0) {
			isPlainText = true;
			if (icon.classList.contains("card-icon") && originalText.length > 1) {
				isMultiCharIcon = true;
				// Replace content with one span per character so each can animate
				const chars = originalText.split("");
				const spans = chars.map(function (c) {
					const escaped = c
						.replace(/&/g, "&amp;")
						.replace(/"/g, "&quot;")
						.replace(/</g, "&lt;")
						.replace(/>/g, "&gt;");
					return '<span class="card-icon-char" data-final="' + escaped + '">' + c + "</span>";
				});
				icon.innerHTML = spans.join("");
			} else {
				originalCharCode = originalText.charCodeAt(0);
			}
		} else {
			return;
		}

		const originalHTMLToRestore =
			isPlainText && !isMultiCharIcon
				? originalText
				: isPlainText
					? originalText
					: "&#" + originalCharCode + ";";

		function animateIcon() {
			if (animatedIcons.has(icon)) return; // Already animated
			animatedIcons.add(icon);

			icon.style.visibility = "visible";

			if (isMultiCharIcon) {
				// Animate each character span (all 5 for "TL;DR")
				const charSpans = icon.querySelectorAll(".card-icon-char");
				charSpans.forEach(function (span, index) {
					const finalChar = span
						.getAttribute("data-final")
						.replace(/&quot;/g, '"')
						.replace(/&amp;/g, "&")
						.replace(/&lt;/g, "<")
						.replace(/&gt;/g, ">");
					const duration = 1000 + Math.random() * 2000;
					const steps = 10 + Math.floor(Math.random() * 20);
					const stepDuration = Math.max(16, duration / steps);
					let currentStep = 0;
					// Stagger start so chars don't all flip in lockstep
					const stagger = index * (stepDuration * 0.3);
					const startTimeout = setTimeout(function () {
						span.textContent = glitchChars[Math.floor(Math.random() * glitchChars.length)];
						const animateInterval = setInterval(function () {
							if (currentStep < steps) {
								span.textContent = glitchChars[Math.floor(Math.random() * glitchChars.length)];
								currentStep++;
							} else {
								span.textContent = finalChar;
								clearInterval(animateInterval);
							}
						}, stepDuration);
					}, stagger);
				});
				return;
			}

			// Single-character icon (entity or one plain char)
			const firstRandomChar = glitchChars[Math.floor(Math.random() * glitchChars.length)];
			if (isPlainText) {
				icon.textContent = firstRandomChar;
			} else {
				icon.innerHTML = "&#" + firstRandomChar.charCodeAt(0) + ";";
			}

			const duration = 1000 + Math.random() * 2000; // 1-3 seconds
			const steps = 10 + Math.floor(Math.random() * 20); // 10-30 steps
			const stepDuration = Math.max(16, duration / steps); // Minimum 16ms for Safari compatibility
			let currentStep = 0;
			let animateInterval = null;

			animateInterval = setInterval(function () {
				if (currentStep < steps) {
					// Show random character (first character shown is random)
					const randomChar = glitchChars[Math.floor(Math.random() * glitchChars.length)];
					if (isPlainText) {
						icon.textContent = randomChar;
					} else {
						icon.innerHTML = "&#" + randomChar.charCodeAt(0) + ";";
					}
					currentStep++;
				} else {
					// Finish on the character from the HTML for this section
					if (isPlainText) {
						icon.textContent = originalHTMLToRestore;
					} else {
						icon.innerHTML = originalHTMLToRestore;
					}
					if (animateInterval) {
						clearInterval(animateInterval);
						animateInterval = null;
					}
				}
			}, stepDuration);
		}

		// Use Intersection Observer to trigger when parent element enters viewport
		let parentElement = icon.closest(".card");
		if (!parentElement) {
			parentElement = icon.closest(".work-samples");
		}
		if (!parentElement) {
			parentElement = icon.closest(".quotes");
		}
		if (!parentElement) {
			parentElement = icon.closest(".awards");
		}
		if (!parentElement) {
			parentElement = icon.closest(".footer-column");
		}
		// Support marquee footer icon, which lives in its own column
		if (!parentElement) {
			parentElement = icon.closest(".marquee-column");
		}

		if (parentElement) {
			const observerOptions = {
				root: null,
				rootMargin: "0px",
				threshold: 0.3, // Trigger when 30% of element is visible
			};

			const observer = new IntersectionObserver(function (entries) {
				entries.forEach(function (entry) {
					if (entry.isIntersecting && !animatedIcons.has(icon)) {
						// Small delay before starting animation
						setTimeout(function () {
							animateIcon();
						}, 200);
						observer.unobserve(parentElement);
					}
				});
			}, observerOptions);

			observer.observe(parentElement);
		}
	});

	// Slash patterns - repeating slashes with hover effect
	function initSlashPatterns() {
		const patterns = document.querySelectorAll(".pattern-graphic");
		if (!patterns.length) return;

		const char = "/";
		const defaultLinesPerViewport = {
			default: 24,
			1640: 8,
			1040: 6,
			1080: 8,
		};

		function getLinesCountFor(patternEl) {
			const width = window.innerWidth;

			// Per-element overrides via data attributes:
			// data-lines-default / data-lines-1640 / data-lines-1040 / data-lines-1080
			// Use getAttribute for robustness (dataset mapping with numeric segments can be inconsistent).
			function getVal(key) {
				const attrName = key === "default" ? "data-lines-default" : `data-lines-${key}`;
				const raw = patternEl.getAttribute(attrName);
				const parsed = raw == null ? NaN : parseInt(raw, 10);
				return Number.isFinite(parsed) ? parsed : defaultLinesPerViewport[key];
			}

			if (width <= 1040) return getVal("1040");
			if (width <= 1080) return getVal("1080");
			if (width <= 1640) return getVal("1640");
			return getVal("default");
		}

		function generatePattern(patternEl) {
			patternEl.innerHTML = "";

			// Use the inner content width (excluding padding) so the pattern
			// respects the same left/right padding as surrounding sections.
			const containerRect = patternEl.getBoundingClientRect();
			const containerWidth = containerRect.width;
			const computedStyle = window.getComputedStyle(patternEl);
			const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
			const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
			const innerWidth = containerWidth - paddingLeft - paddingRight;

			if (innerWidth <= 0) return; // Safety check

			// Create a test container that matches the actual styling
			const testContainer = document.createElement("div");
			testContainer.style.position = "absolute";
			testContainer.style.visibility = "hidden";
			testContainer.style.fontFamily = "Departure Mono, monospace";
			testContainer.style.fontSize = "22px"; // Match CSS font-size
			testContainer.style.lineHeight = "1.5";
			document.body.appendChild(testContainer);

			// Measure character width without padding
			const testCharEl = document.createElement("span");
			testCharEl.className = "pattern-char";
			testCharEl.style.paddingRight = "0"; // Override padding for measurement
			testCharEl.textContent = char;
			testContainer.appendChild(testCharEl);
			const charWidth = testCharEl.offsetWidth;
			testContainer.removeChild(testCharEl);

			// Measure character width with padding (using actual class)
			const testCharWithPaddingEl = document.createElement("span");
			testCharWithPaddingEl.className = "pattern-char";
			testCharWithPaddingEl.textContent = char;
			testContainer.appendChild(testCharWithPaddingEl);
			const charWithPaddingWidth = testCharWithPaddingEl.offsetWidth;
			testContainer.removeChild(testCharWithPaddingEl);

			document.body.removeChild(testContainer);

			// Calculate padding width
			const paddingWidth = charWithPaddingWidth - charWidth;

			// More accurate calculation: account for subpixel rendering.
			// Formula: (innerWidth - charWidth) / charWithPaddingWidth + 1
			// The last character has padding removed, so this keeps the
			// right edge inside the available inner width.
			const availableWidth = innerWidth - charWidth;
			let charsPerLine = Math.max(1, Math.floor(availableWidth / charWithPaddingWidth) + 1);
			const linesCount = getLinesCountFor(patternEl);

			// Create a test line to verify the calculation
			const testLine = document.createElement("div");
			testLine.className = "pattern-line";
			testLine.style.position = "absolute";
			testLine.style.visibility = "hidden";
			testLine.style.width = innerWidth + "px";
			document.body.appendChild(testLine);

			// Build test line with calculated number of characters
			for (let j = 0; j < charsPerLine; j++) {
				const testCharSpan = document.createElement("span");
				testCharSpan.className = "pattern-char";
				testCharSpan.textContent = char;
				if (j === charsPerLine - 1) {
					testCharSpan.style.paddingRight = "0";
				}
				testLine.appendChild(testCharSpan);
			}

			// Measure actual width and adjust if needed
			const actualLineWidth = testLine.offsetWidth;
			if (actualLineWidth > containerWidth && charsPerLine > 1) {
				// Reduce by one if it overflows
				charsPerLine--;
			}
			document.body.removeChild(testLine);

			const totalChars = linesCount * charsPerLine;

			// Generate the actual pattern lines
			for (let i = 0; i < linesCount; i++) {
				const line = document.createElement("div");
				line.className = "pattern-line";

				for (let j = 0; j < charsPerLine; j++) {
					const charSpan = document.createElement("span");
					charSpan.className = "pattern-char";
					charSpan.textContent = char;
					charSpan.setAttribute("data-index", i * charsPerLine + j);
					charSpan.style.transition = "opacity 0.6s ease-out, color 0.3s ease";
					// Remove padding from last character to prevent overflow
					if (j === charsPerLine - 1) {
						charSpan.style.paddingRight = "0";
					}
					line.appendChild(charSpan);
				}

				patternEl.appendChild(line);
			}

			const infoList =
				patternEl.nextElementSibling &&
				patternEl.nextElementSibling.classList.contains("pattern-list")
					? patternEl.nextElementSibling
					: null;
			const countEl = infoList ? infoList.querySelector(".pattern-char-count") : null;
			if (countEl) countEl.textContent = totalChars.toLocaleString();
		}

		// Get accent color and base color from CSS variables
		function getCSSVariableColor(variable) {
			const temp = document.createElement("div");
			temp.style.color = `var(${variable})`;
			temp.style.position = "absolute";
			temp.style.visibility = "hidden";
			document.body.appendChild(temp);
			const computedColor = window.getComputedStyle(temp).color;
			document.body.removeChild(temp);
			return computedColor;
		}

		// Convert rgb/rgba to hex for blending
		function colorToHex(color) {
			const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
			if (match) {
				const r = parseInt(match[1]).toString(16).padStart(2, "0");
				const g = parseInt(match[2]).toString(16).padStart(2, "0");
				const b = parseInt(match[3]).toString(16).padStart(2, "0");
				return `#${r}${g}${b}`;
			}
			// If already hex, return as is
			if (color.startsWith("#")) {
				return color;
			}
			// Fallback: get accent color from CSS variable and convert
			const fallbackColor = getCSSVariableColor("--color-accent");
			const fallbackMatch = fallbackColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
			if (fallbackMatch) {
				const r = parseInt(fallbackMatch[1]).toString(16).padStart(2, "0");
				const g = parseInt(fallbackMatch[2]).toString(16).padStart(2, "0");
				const b = parseInt(fallbackMatch[3]).toString(16).padStart(2, "0");
				return `#${r}${g}${b}`;
			}
			return fallbackColor.startsWith("#") ? fallbackColor : "#aaff00";
		}

		// Helper to always use the *current* accent color (updates with light/dark toggle)
		function getAccentHex() {
			const accentColor = getCSSVariableColor("--color-accent");
			return colorToHex(accentColor);
		}

		// Generate pattern on load
		patterns.forEach(function (patternEl) {
			const hoveredChars = new Map(); // Track hovered characters with timestamps
			let fadeOutInterval = null;
			const infoList =
				patternEl.nextElementSibling &&
				patternEl.nextElementSibling.classList.contains("pattern-list")
					? patternEl.nextElementSibling
					: null;
			const cursorXEl = infoList ? infoList.querySelector(".pattern-cursor-x") : null;
			const cursorYEl = infoList ? infoList.querySelector(".pattern-cursor-y") : null;

			function fadeOutTrail() {
				const now = Date.now();
				const fadeDuration = 1200;

				hoveredChars.forEach(function (timestamp, charEl) {
					const elapsed = now - timestamp;
					if (elapsed >= fadeDuration) {
						charEl.style.color = "";
						charEl.style.opacity = "1";
						hoveredChars.delete(charEl);
					} else {
						const fadeProgress = elapsed / fadeDuration;
						charEl.style.opacity = (1 - fadeProgress * 0.25).toString();
					}
				});

				if (hoveredChars.size === 0 && fadeOutInterval) {
					clearInterval(fadeOutInterval);
					fadeOutInterval = null;
				}
			}

			patternEl.addEventListener("mousemove", function (e) {
				const rect = patternEl.getBoundingClientRect();
				const x = e.clientX - rect.left;
				const y = e.clientY - rect.top;

				if (cursorXEl) cursorXEl.textContent = Math.round(e.clientX);
				if (cursorYEl) cursorYEl.textContent = Math.round(e.clientY);

				const chars = patternEl.querySelectorAll(".pattern-char");
				let closestChar = null;
				let minDistance = Infinity;

				chars.forEach(function (charEl) {
					const charRect = charEl.getBoundingClientRect();
					const charX = charRect.left + charRect.width / 2 - rect.left;
					const charY = charRect.top + charRect.height / 2 - rect.top;

					const distance = Math.sqrt(Math.pow(x - charX, 2) + Math.pow(y - charY, 2));
					if (distance < minDistance) {
						minDistance = distance;
						closestChar = charEl;
					}
				});

				if (closestChar && !hoveredChars.has(closestChar)) {
					closestChar.style.color = getAccentHex();
					closestChar.style.opacity = "1";
					hoveredChars.set(closestChar, Date.now());

					if (!fadeOutInterval) {
						fadeOutInterval = setInterval(fadeOutTrail, 16);
					}
				}
			});

			patternEl.addEventListener("mouseleave", function () {
				hoveredChars.forEach(function (timestamp, charEl) {
					charEl.style.color = "";
					charEl.style.opacity = "1";
				});
				hoveredChars.clear();

				if (fadeOutInterval) {
					clearInterval(fadeOutInterval);
					fadeOutInterval = null;
				}
			});

			generatePattern(patternEl);
		});

		let resizeTimeout;
		window.addEventListener("resize", function () {
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(function () {
				patterns.forEach(function (patternEl) {
					generatePattern(patternEl);
				});
			}, 250);
		});
	}

	initSlashPatterns();

	// Cursor position is handled per-pattern inside `initSlashPatterns()`

	// End Section Progress Bar Animation
	function initEndProgressAnimation() {
		const endSection = document.querySelector(".end");
		if (!endSection) return;

		const progressSpan = endSection.querySelector(".end-progress");
		if (!progressSpan) return;

		const parentParagraph = progressSpan.parentElement;
		// Find the first accent block to insert after it
		const firstAccentBlock = parentParagraph.querySelector(".accent");
		let insertAfterElement = firstAccentBlock;
		const originalText = progressSpan.textContent;
		// Count underscores (they're separated by spaces)
		const underscoreCount = (originalText.match(/_/g) || []).length;
		let animated = false;

		const observerOptions = {
			root: null,
			rootMargin: "0px",
			threshold: 1.0, // Trigger when 10% of element is visible
		};

		const observer = new IntersectionObserver(function (entries) {
			entries.forEach(function (entry) {
				if (entry.isIntersecting && !animated) {
					animated = true;

					// Delay the animation start until after the section has entered the viewport
					setTimeout(function () {
						// Animate each block with a delay (slower animation)
						for (let i = 0; i < underscoreCount; i++) {
							setTimeout(function () {
								// Remove first underscore from the opacity-25 span
								const currentText = progressSpan.textContent;
								let newText = currentText.replace(/_ /, "");
								// If no replacement happened (last underscore without space), replace just "_"
								if (newText === currentText) {
									newText = currentText.replace(/_/, "");
								}
								progressSpan.textContent = newText;

								// Insert the block as a sibling after the previous block (outside the opacity-25 span)
								const blockSpan = document.createElement("span");
								blockSpan.className = "accent";
								blockSpan.textContent = "█";
								// Insert space and block after the insertAfterElement
								const textNode = document.createTextNode(" ");
								// Insert after insertAfterElement, before its next sibling (or before progressSpan)
								const nextSibling = insertAfterElement.nextSibling;
								if (nextSibling) {
									parentParagraph.insertBefore(textNode, nextSibling);
									parentParagraph.insertBefore(blockSpan, nextSibling);
								} else {
									// If no next sibling, insert before progressSpan
									parentParagraph.insertBefore(textNode, progressSpan);
									parentParagraph.insertBefore(blockSpan, progressSpan);
								}
								// Update reference for next insertion (point to the new block)
								insertAfterElement = blockSpan;
							}, i * 200); // 200ms delay between each block (slower animation)
						}
					}, 500); // 500ms delay after entering viewport before animation starts

					observer.unobserve(endSection);
				}
			});
		}, observerOptions);

		observer.observe(endSection);
	}

	initEndProgressAnimation();

	// Stop blinking animation on start block after a few seconds
	setTimeout(function () {
		const startBlinkBlock = document.querySelector(".start .blink");
		const startBlinkUnderscore = document.querySelector(".start .blink-underscore");
		if (startBlinkBlock) {
			startBlinkBlock.style.animation = "none";
			startBlinkBlock.style.opacity = "1"; // Keep it visible
		}
		if (startBlinkUnderscore) {
			startBlinkUnderscore.style.animation = "none";
			startBlinkUnderscore.style.opacity = "0"; // Hide the underscore
		}
	}, 10000); // Stop after 10 seconds
}

// Initialize after loading screen
initAfterLoading();

// Desktop fixed header bar — show when original header row scrolls out of view
(function initDesktopFixedBar() {
	var bar = document.querySelector(".header-fixed-bar");
	var target = document.querySelector(".header-row--nav");
	if (!bar || !target) return;
	var observer = new IntersectionObserver(
		function (entries) {
			entries.forEach(function (entry) {
				var scrolled = !entry.isIntersecting;
				bar.classList.toggle("is-visible", scrolled);
				document.body.classList.toggle("header-scrolled", scrolled);
			});
		},
		{ threshold: 0 },
	);
	observer.observe(target);
})();

// "D" overlay — any D trigger opens a full-viewport accent letter; click or Escape dismisses
function toggleDOverlay() {
	var o = document.querySelector(".d-overlay");
	if (!o) return;
	var show = !o.classList.contains("is-visible");
	o.classList.toggle("is-visible", show);
	o.setAttribute("aria-hidden", show ? "false" : "true");
}
document.addEventListener("click", function (e) {
	if (e.target.closest(".d-overlay.is-visible")) toggleDOverlay();
});
document.addEventListener("keydown", function (e) {
	if (e.key === "Escape" && document.querySelector(".d-overlay.is-visible")) toggleDOverlay();
});
