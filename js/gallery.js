// gallery.js
// Graphics / Clients + Experiments / Lab

document.addEventListener("DOMContentLoaded", function () {
	const ITEMS_PER_PAGE = 12;

	// Development controls: Temporarily disable JSON loading
	// Set to true to skip loading graphics.json and experiments.json
	const DISABLE_JSON_LOADING = false;

	/* Keep in sync with filter bar CSS (mobile vs desktop filter layout). */
	const FILTER_BAR_MOBILE_MQL = "(max-width: 1080px)";

	// Theme-aware images: tracks light variants that 404'd so we don't retry them
	const lightImageMissing = new Set();
	var galleryLightboxApi = null;

	/** Ambient lightbox colours keyed by src. */
	var lightboxColorCache = Object.create(null);

	function clampByte(n) {
		return Math.max(0, Math.min(255, Math.round(n)));
	}

	function rgbToHex(r, g, b) {
		return (
			"#" +
			((1 << 24) + (clampByte(r) << 16) + (clampByte(g) << 8) + clampByte(b))
				.toString(16)
				.slice(1)
		);
	}

	/** Multiply RGB toward black (0.1 = 10% darker). Preset bgColor skips this. */
	function darkenCssColor(value, amount) {
		var rgb = parseCssColor(value);
		if (!rgb) return value;
		var f = 1 - amount;
		return rgbToHex(rgb.r * f, rgb.g * f, rgb.b * f);
	}

	function parseCssColor(value) {
		if (!value || typeof value !== "string") return null;
		var s = value.trim();
		var hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
		if (hex) {
			var h = hex[1];
			if (h.length === 3) {
				return {
					r: parseInt(h.charAt(0) + h.charAt(0), 16),
					g: parseInt(h.charAt(1) + h.charAt(1), 16),
					b: parseInt(h.charAt(2) + h.charAt(2), 16),
				};
			}
			return {
				r: parseInt(h.slice(0, 2), 16),
				g: parseInt(h.slice(2, 4), 16),
				b: parseInt(h.slice(4, 6), 16),
			};
		}
		var rgb = /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i.exec(s);
		if (rgb) {
			return {
				r: clampByte(Number(rgb[1])),
				g: clampByte(Number(rgb[2])),
				b: clampByte(Number(rgb[3])),
			};
		}
		return null;
	}

	function relativeLuminance(r, g, b) {
		function channel(c) {
			var s = c / 255;
			return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
		}
		return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
	}

	function extractAverageColor(imageEl) {
		if (!imageEl || !imageEl.naturalWidth) return null;
		// Modal colour of a thin border ring. Full-frame mode picks large centre
		// artwork; a border mean picks artwork cropped to one edge. Edge + mode
		// keeps the solid surround when it still owns most of the perimeter.
		var size = 48;
		var inset = 3;
		var step = 16;
		var canvas = document.createElement("canvas");
		canvas.width = size;
		canvas.height = size;
		var ctx = canvas.getContext("2d", { willReadFrequently: true });
		if (!ctx) return null;
		try {
			ctx.drawImage(imageEl, 0, 0, size, size);
			var data = ctx.getImageData(0, 0, size, size).data;
			var buckets = Object.create(null);
			var bestKey = null;
			var bestCount = 0;

			function addPixel(x, y, weight) {
				var i = (y * size + x) * 4;
				if (data[i + 3] < 128) return;
				var rq = Math.min(255, Math.floor(data[i] / step) * step);
				var gq = Math.min(255, Math.floor(data[i + 1] / step) * step);
				var bq = Math.min(255, Math.floor(data[i + 2] / step) * step);
				var key = rq + "," + gq + "," + bq;
				var bucket = buckets[key];
				if (!bucket) {
					bucket = buckets[key] = { r: 0, g: 0, b: 0, n: 0 };
				}
				var w = weight || 1;
				bucket.r += data[i] * w;
				bucket.g += data[i + 1] * w;
				bucket.b += data[i + 2] * w;
				bucket.n += w;
				if (bucket.n > bestCount) {
					bestCount = bucket.n;
					bestKey = key;
				}
			}

			for (var y = 0; y < size; y++) {
				for (var x = 0; x < size; x++) {
					var onEdge = x < inset || y < inset || x >= size - inset || y >= size - inset;
					if (!onEdge) continue;
					// Corners are almost always the solid field — weight them up
					// so one cropped edge of artwork can't outvote the surround.
					var inCorner =
						(x < inset || x >= size - inset) && (y < inset || y >= size - inset);
					addPixel(x, y, inCorner ? 3 : 1);
				}
			}

			if (!bestKey || !bestCount) return null;
			var winner = buckets[bestKey];
			return rgbToHex(winner.r / winner.n, winner.g / winner.n, winner.b / winner.n);
		} catch (err) {
			return null;
		}
	}

	function cacheAmbientColor(adjusted, keys) {
		if (!adjusted || !keys) return;
		for (var i = 0; i < keys.length; i++) {
			if (keys[i]) lightboxColorCache[keys[i]] = adjusted;
		}
	}

	function warmLightboxColorCache(img) {
		if (!img || !img.complete || !img.naturalWidth) return;
		var color = extractAverageColor(img);
		if (!color) return;
		var adjusted = darkenCssColor(color, 0.1);
		var keys = [img.currentSrc || img.src];
		if (img.dataset.basePath && img.dataset.filename) {
			var shared = img.dataset.shared === "true";
			keys.push(getThemedSrc(img.dataset.basePath, img.dataset.filename, shared));
			keys.push(img.dataset.basePath + "dark/" + img.dataset.filename);
			keys.push(img.dataset.basePath + img.dataset.filename);
		}
		cacheAmbientColor(adjusted, keys);
	}

	function findGridPreviewImage(filename) {
		if (!filename) return null;
		var nodes = document.querySelectorAll("img.work-image[data-filename]");
		for (var i = 0; i < nodes.length; i++) {
			var candidate = nodes[i];
			if (candidate.dataset.filename !== filename) continue;
			if (candidate.complete && candidate.naturalWidth) return candidate;
		}
		return null;
	}

	function getThemedSrc(basePath, filename, shared) {
		const isLight = document.documentElement.classList.contains("light-mode");
		if (isLight && !shared && !lightImageMissing.has(basePath + filename)) {
			return basePath + "light/" + filename;
		}
		return basePath + "dark/" + filename;
	}

	// Swap all gallery images to match the current theme
	window.updateGalleryTheme = function () {
		document
			.querySelectorAll("img.work-image[data-base-path][data-filename]")
			.forEach(function (img) {
				var basePath = img.dataset.basePath;
				var filename = img.dataset.filename;
				var shared = img.dataset.shared === "true";
				var newSrc = getThemedSrc(basePath, filename, shared);

				if (img.dataset.src) {
					img.dataset.src = newSrc;
				} else if (img.src) {
					img.src = newSrc;
				}
			});
		if (galleryLightboxApi && typeof galleryLightboxApi.refreshTheme === "function") {
			galleryLightboxApi.refreshTheme();
		}
	};

	// Lazy loading with Intersection Observer
	function setupLazyLoading() {
		const imageObserver = new IntersectionObserver(
			function (entries, observer) {
				entries.forEach(function (entry) {
					if (entry.isIntersecting) {
						const img = entry.target;
						if (img.dataset.src) {
							img.src = img.dataset.src;
							img.removeAttribute("data-src");
							observer.unobserve(img);
							if (img.complete && img.naturalWidth) {
								warmLightboxColorCache(img);
							} else {
								img.addEventListener(
									"load",
									function () {
										warmLightboxColorCache(img);
									},
									{ once: true },
								);
							}
						}
					}
				});
			},
			{
				rootMargin: "50px",
			},
		);

		document.querySelectorAll("img[data-src]").forEach(function (img) {
			imageObserver.observe(img);
		});
	}

	// Append text to a parent element, wrapping any "(...)" segments in a span (class from optional third arg; default opacity-50),
	// optional fourth arg sets class on non-parenthetical segments (avoids nesting opacity-* on the parent).
	// and "<Name/>"-style tokens so only "<" and "/>" use opacity-50 (inner name stays full opacity).
	function appendBracketStyledText(text, parent, parenClass, defaultClass) {
		if (!text) return;
		const parenOpacityClass = parenClass || "opacity-50";
		const tagParts = text.split(/(<[^/]+\/>)/);

		function appendParentheticalText(segmentText, target) {
			const parts = segmentText.split(/(\([^)]*\))/);
			parts.forEach(function (part) {
				if (!part) return;
				const span = document.createElement("span");
				if (part.startsWith("(") && part.endsWith(")")) {
					span.className = parenOpacityClass;
				} else if (defaultClass) {
					span.className = defaultClass;
				}
				span.textContent = part;
				target.appendChild(span);
			});
		}

		tagParts.forEach(function (segment) {
			if (!segment) return;
			const tagMatch = segment.match(/^<([^/]+)\/>$/);
			if (tagMatch) {
				const open = document.createElement("span");
				open.className = "opacity-50";
				open.textContent = "<";
				parent.appendChild(open);
				const mid = document.createElement("span");
				mid.textContent = tagMatch[1];
				parent.appendChild(mid);
				const close = document.createElement("span");
				close.className = "opacity-50";
				close.textContent = "/>";
				parent.appendChild(close);
				return;
			}

			const strikeParts = segment.split(/(~~.+?~~)/);
			strikeParts.forEach(function (strikePart) {
				if (!strikePart) return;
				const strikeMatch = strikePart.match(/^~~(.+?)~~$/);
				if (strikeMatch) {
					const deleted = document.createElement("s");
					appendParentheticalText(strikeMatch[1], deleted);
					parent.appendChild(deleted);
					return;
				}
				appendParentheticalText(strikePart, parent);
			});
		});
	}

	// Raw Content-Length in bytes (HEAD), or null
	async function getFileSizeBytes(url) {
		try {
			const response = await fetch(url, { method: "HEAD" });
			const contentLength = response.headers.get("Content-Length");
			if (contentLength) {
				return parseInt(contentLength, 10);
			}
		} catch (error) {
			console.warn("Could not fetch file size for", url);
		}
		return null;
	}

	// Get file size in KB
	async function getFileSize(url) {
		const bytes = await getFileSizeBytes(url);
		if (bytes == null) return null;
		return Math.round(bytes / 1024);
	}

	// e.g. 3mb, 2.4mb, 512kb — lowercase suffix per site copy
	function formatCompactDataSize(bytes) {
		if (bytes == null || bytes <= 0) {
			return null;
		}
		const MB = 1024 * 1024;
		if (bytes >= MB) {
			const x = bytes / MB;
			if (x >= 10) {
				return Math.round(x) + "mb";
			}
			const rounded = Math.round(x * 10) / 10;
			const s = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
			return s.replace(/\.0$/, "") + "mb";
		}
		return Math.max(1, Math.round(bytes / 1024)) + "kb";
	}

	// Optional width/height from JSON (canonical dark/ pixels); avoids per-tile probe when present.
	function aspectRatioFromJsonDimensions(dims) {
		if (!dims || typeof dims.width !== "number" || typeof dims.height !== "number") {
			return null;
		}
		if (dims.width <= 0 || dims.height <= 0) {
			return null;
		}
		return dims.width / dims.height;
	}

	// Canonical dimensions from dark/ (same pixel size as light/ per site convention)
	function probeWorkImageAspectRatio(basePath, filename) {
		return new Promise(function (resolve) {
			const probe = new Image();
			probe.onload = function () {
				if (this.naturalWidth > 0 && this.naturalHeight > 0) {
					resolve(this.naturalWidth / this.naturalHeight);
				} else {
					resolve(null);
				}
			};
			probe.onerror = function () {
				resolve(null);
			};
			probe.src = basePath + "dark/" + filename;
		});
	}

	// Create an image element with theme-aware src (dark default, optional light variant)
	// basePath: e.g. "/images/work/", filename: e.g. "project.jpg"
	// dims: optional { width, height } from JSON; otherwise awaits dark/ probe before paint.
	async function createWorkImage(basePath, filename, altText, dims, shared) {
		let aspectRatio = aspectRatioFromJsonDimensions(dims);
		if (aspectRatio == null) {
			aspectRatio = await probeWorkImageAspectRatio(basePath, filename);
		}

		const frame = document.createElement("div");
		frame.className = "work-image-frame";

		const img = document.createElement("img");
		img.className = "work-image";
		img.dataset.basePath = basePath;
		img.dataset.filename = filename;
		img.dataset.shared = shared ? "true" : "false";
		img.dataset.src = getThemedSrc(basePath, filename, shared);
		img.alt = altText || "";
		img.loading = "lazy";

		if (aspectRatio != null) {
			img.style.aspectRatio = String(aspectRatio);
		}

		img.addEventListener("load", function () {
			this.classList.add("is-loaded");
		});

		img.addEventListener("error", function () {
			var bp = this.dataset.basePath;
			var fn = this.dataset.filename;
			var shared = this.dataset.shared === "true";
			if (!bp || !fn) return;
			var darkSrc = bp + "dark/" + fn;
			if (!shared && this.src && !this.src.endsWith(darkSrc)) {
				lightImageMissing.add(bp + fn);
				this.src = darkSrc;
			}
		});

		frame.appendChild(img);
		return frame;
	}
	// Experiments/Lab script widgets (type: "script" in experiments.json)
	const LAB_SCRIPT_BASE_PATH = "/js/lab/";
	const labScriptsLoaded = {};

	function isExperimentScriptItem(item) {
		return item && item.type === "script" && item.filename;
	}

	function getLabScriptName(filename) {
		return filename.replace(/\.js$/i, "");
	}

	function loadLabScript(filename) {
		const src = LAB_SCRIPT_BASE_PATH + filename;
		if (labScriptsLoaded[src]) {
			return labScriptsLoaded[src];
		}
		labScriptsLoaded[src] = new Promise(function (resolve, reject) {
			const script = document.createElement("script");
			script.src = src;
			script.onload = function () {
				resolve();
			};
			script.onerror = function () {
				reject(new Error("Failed to load " + src));
			};
			document.head.appendChild(script);
		});
		return labScriptsLoaded[src];
	}

	function loadAndInitLabScript(filename, mountEl) {
		if (mountEl.dataset.labInitialized === "true") {
			return Promise.resolve();
		}
		const name = getLabScriptName(filename);
		return loadLabScript(filename).then(function () {
			const widgets = window.LabWidgets;
			if (!widgets || typeof widgets[name] !== "function") {
				throw new Error("LabWidgets." + name + " not found");
			}
			widgets[name](mountEl);
			mountEl.dataset.labInitialized = "true";
		});
	}

	function createWorkWidget(item) {
		const aspectRatio = aspectRatioFromJsonDimensions(item);

		const frame = document.createElement("div");
		frame.className = "work-image-frame work-script-frame";
		frame.dataset.filename = item.filename;

		const widget = document.createElement("div");
		widget.className = "work-widget";
		widget.dataset.labScript = getLabScriptName(item.filename);

		if (aspectRatio != null) {
			frame.style.aspectRatio = String(aspectRatio);
		}

		frame.appendChild(widget);

		const widgetObserver = new IntersectionObserver(
			function (entries, observer) {
				entries.forEach(function (entry) {
					if (entry.isIntersecting) {
						loadAndInitLabScript(item.filename, widget)
							.then(function () {
								frame.classList.add("is-loaded");
							})
							.catch(function (err) {
								console.warn(err);
							});
						observer.unobserve(entry.target);
					}
				});
			},
			{
				rootMargin: "50px",
			},
		);

		widgetObserver.observe(widget);
		return frame;
	}

	// Build the "meta" caption line as a <p class="work-text"> with spans inside
	// leftTextClass is e.g. "work-client" or "work-number"
	function buildWorkTextLine(leftText, descriptionText, leftTextClass) {
		if (!leftText && !descriptionText) return null;

		const metaLine = document.createElement("p");
		metaLine.className = "work-text";

		if (leftText) {
			const leftSpan = document.createElement("span");
			leftSpan.className = leftTextClass;
			appendBracketStyledText(leftText, leftSpan);
			metaLine.appendChild(leftSpan);
		}

		if (descriptionText) {
			if (leftText) {
				const divider = document.createElement("span");
				divider.className = "opacity-25";
				divider.textContent = " //";
				metaLine.appendChild(divider);
			}
			const description = document.createElement("span");
			description.className = "work-description";
			// Leading space before description
			appendBracketStyledText(" " + descriptionText, description);
			metaLine.appendChild(description);
		}

		return metaLine;
	}

	/** Sync filename caption line; size span can be filled later to avoid layout flash. */
	function buildFilenameLineElement(displayPath, displayName, className) {
		const filename = document.createElement("p");
		filename.className = className || "work-filename";

		const corner = document.createElement("span");
		corner.className = "opacity-15";
		corner.innerHTML = "&#8985;";

		const pathSpan = document.createElement("span");
		pathSpan.className = "opacity-25";
		pathSpan.textContent = displayPath;

		const nameSpan = document.createElement("span");
		nameSpan.className = "opacity-25";
		nameSpan.textContent = displayName;

		const sizeSpan = document.createElement("span");
		sizeSpan.className = "opacity-15";

		filename.appendChild(corner);
		filename.appendChild(document.createTextNode(" "));
		filename.appendChild(pathSpan);
		filename.appendChild(nameSpan);
		filename.appendChild(document.createTextNode(" "));
		filename.appendChild(sizeSpan);

		return { el: filename, sizeSpan: sizeSpan };
	}

	// Build filename line <p class="work-filename"> with ⌙, path, filename, and optional size
	async function buildWorkFilenameLine(basePath, displayName, sizeUrl) {
		const built = buildFilenameLineElement(basePath, displayName, "work-filename");
		if (sizeUrl) {
			const fileSize = await getFileSize(sizeUrl);
			if (fileSize) {
				built.sizeSpan.textContent = " (" + fileSize + "kb)";
			}
		}
		return built.el;
	}

	// Optional work item URL: normalized href + host/path for caption after [URL]
	function normalizeWorkLink(link) {
		if (!link || typeof link !== "string") return null;
		const t = link.trim();
		if (!t) return null;
		let href = t;
		if (!/^https?:\/\//i.test(t)) {
			href = "https://" + t;
		}
		const m = href.match(/^https?:\/\/(.+)$/i);
		if (!m) return null;
		return { href, rest: m[1] };
	}

	function appendLinkCaptionParts(anchor, rest) {
		const label = document.createElement("span");
		label.className = "opacity-25";
		label.textContent = "[URL]";
		anchor.appendChild(label);
		anchor.appendChild(document.createTextNode(" "));
		anchor.appendChild(document.createTextNode(rest));
	}

	// Caption line: dim [URL] + path; linkDisplay shortens visible path, href still from link
	function buildWorkLinkLine(link, linkDisplay) {
		const parsed = normalizeWorkLink(link);
		if (!parsed) return null;

		const p = document.createElement("p");
		p.className = "work-link";

		const a = document.createElement("a");
		a.href = parsed.href;
		a.target = "_blank";
		a.rel = "noopener noreferrer";

		const displayRaw =
			linkDisplay && typeof linkDisplay === "string" && linkDisplay.trim()
				? linkDisplay.trim()
				: null;

		if (displayRaw) {
			const displayParsed = normalizeWorkLink(displayRaw);
			if (displayParsed) {
				appendLinkCaptionParts(a, displayParsed.rest);
			} else {
				a.appendChild(document.createTextNode(displayRaw));
			}
		} else {
			appendLinkCaptionParts(a, parsed.rest);
		}

		const arrow = document.createElement("span");
		arrow.className = "opacity-50";
		arrow.textContent = " →";
		a.appendChild(arrow);

		p.appendChild(a);
		return p;
	}

	/* Matches sticky header: space + .meta-separator padding + // + padding + space (see index.html around Mode / //) */
	function appendWorkSlashDivider(paragraph, opts) {
		const trailingSpace = !opts || opts.trailingSpace !== false;
		const leadingSpace = !opts || opts.leadingSpace !== false;
		const useMetaSeparator = !opts || opts.metaSeparator !== false;
		if (leadingSpace) {
			paragraph.appendChild(document.createTextNode(" "));
		}
		const slash = document.createElement("span");
		slash.className = useMetaSeparator ? "opacity-50 meta-separator" : "opacity-50";
		slash.textContent = "//";
		paragraph.appendChild(slash);
		if (trailingSpace) {
			paragraph.appendChild(document.createTextNode(" "));
		}
	}

	function assignWorkProjects(items) {
		let proj = null;
		let projDate = null;
		for (let i = 0; i < items.length; i++) {
			const it = items[i];
			if (it.type === "title" && it.name) {
				proj = it.name;
				projDate = it.date || null;
			}
			it.project = proj;
			it.projectDate = projDate;
		}
	}

	function getWorkFullColor() {
		const work = document.getElementById("work");
		return !!(work && work.classList.contains("work-images-full-color"));
	}

	function setWorkFullColor(enabled) {
		const work = document.getElementById("work");
		if (work) {
			work.classList.toggle("work-images-full-color", enabled);
		}
		document.querySelectorAll("[data-work-color-toggle]").forEach(function (el) {
			const isOn = el.getAttribute("data-work-color-toggle") === "on";
			const selected = isOn === enabled;
			el.setAttribute("aria-current", selected ? "true" : "false");
		});
	}

	function syncWorkColorControlsFromSection() {
		setWorkFullColor(getWorkFullColor());
	}

	function createGraphicsPortfolioMeta() {
		const wrap = document.createElement("span");
		wrap.className = "filter-bar-active-meta filter-bar-portfolio-meta";

		const colorLabel = document.createElement("span");
		colorLabel.className = "opacity-50";
		colorLabel.textContent = "T: ";
		wrap.appendChild(colorLabel);

		const bracketOpen = document.createElement("span");
		bracketOpen.className = "opacity-50";
		bracketOpen.textContent = "[";
		wrap.appendChild(bracketOpen);

		const onLink = document.createElement("a");
		onLink.href = "#";
		onLink.className = "graphics-color-toggle graphics-color-toggle--on";
		onLink.setAttribute("data-work-color-toggle", "on");
		onLink.textContent = "Color";
		onLink.addEventListener("click", function (e) {
			e.preventDefault();
			setWorkFullColor(true);
		});
		wrap.appendChild(onLink);

		wrap.appendChild(document.createTextNode(" "));
		const colorSlash = document.createElement("span");
		colorSlash.className = "opacity-50";
		colorSlash.setAttribute("aria-hidden", "true");
		colorSlash.textContent = "/";
		wrap.appendChild(colorSlash);
		wrap.appendChild(document.createTextNode(" "));

		const offLink = document.createElement("a");
		offLink.href = "#";
		offLink.className = "graphics-color-toggle graphics-color-toggle--off";
		offLink.setAttribute("data-work-color-toggle", "off");
		offLink.textContent = "Grayscale";
		offLink.addEventListener("click", function (e) {
			e.preventDefault();
			setWorkFullColor(false);
		});
		wrap.appendChild(offLink);

		const bracketClose = document.createElement("span");
		bracketClose.className = "opacity-50";
		bracketClose.textContent = "]";
		wrap.appendChild(bracketClose);

		appendWorkSlashDivider(wrap);

		const prefix = document.createElement("span");
		prefix.className = "opacity-50";
		prefix.textContent = "S: ";
		wrap.appendChild(prefix);

		const lead = document.createElement("span");
		lead.className = "opacity-75";
		lead.textContent = "Limited Avalibilty";
		wrap.appendChild(lead);

		syncWorkColorControlsFromSection();

		return wrap;
	}

	function graphicsProjectListLabel(canonicalName) {
		if (!canonicalName) return "";
		return canonicalName.replace(/,\s*Inc\.\s*$/i, "").trim();
	}

	function buildGraphicsProjectFilterBar(projectNames, projectImageCounts, onProjectChange) {
		if (!projectNames || projectNames.length <= 1) return null;

		const bar = document.createElement("div");
		bar.className = "filter-bar";

		const backdrop = document.createElement("div");
		backdrop.className = "filter-bar-backdrop";
		backdrop.setAttribute("aria-hidden", "true");
		bar.appendChild(backdrop);

		let activeProject = null;

		function fireFilter() {
			onProjectChange(activeProject);
		}

		function selectProject(projectName) {
			activeProject = projectName || null;
			updateActiveStates();
			bar.querySelectorAll(".filter-dropdown").forEach(function (d) {
				if (typeof d.updateTriggerLabel === "function") {
					d.updateTriggerLabel();
				}
			});
			fireFilter();
		}

		bar._selectProject = selectProject;

		function updateActiveStates() {
			bar.querySelectorAll("[data-filter-project]").forEach(function (btn) {
				const val = btn.getAttribute("data-filter-project");
				btn.classList.toggle("is-active", val === (activeProject || "all"));
			});
		}

		function appendParenStyledTextPlain(text, parent, parenClass) {
			const parts = text.split(/(\([^)]*\))/);
			for (let i = 0; i < parts.length; i++) {
				if (!parts[i]) continue;
				const span = document.createElement("span");
				if (parts[i].startsWith("(") && parts[i].endsWith(")")) {
					span.className = parenClass;
				}
				span.textContent = parts[i];
				parent.appendChild(span);
			}
		}

		function addSlashLi(ul) {
			const li = document.createElement("li");
			li.className = "filter-bar-slash";
			li.setAttribute("aria-hidden", "true");
			li.textContent = "/";
			ul.appendChild(li);
		}

		function appendProjectFilterLabel(parent, displayLabel, imageCount) {
			appendParenStyledTextPlain(displayLabel, parent, "opacity-25");
			if (typeof imageCount === "number") {
				const supEl = document.createElement("sup");
				supEl.className = "opacity-50";
				supEl.textContent = "(" + imageCount + ")";
				parent.appendChild(supEl);
			}
		}

		function addProjectBtn(ul, label, value, imageCount) {
			const li = document.createElement("li");
			const btn = document.createElement("button");
			btn.type = "button";
			btn.setAttribute("data-filter-project", value);
			if (value === "all") {
				appendParenStyledTextPlain(label, btn, "opacity-25");
			} else {
				appendProjectFilterLabel(btn, label, imageCount);
			}
			btn.addEventListener("click", function () {
				activeProject = value === "all" ? null : value;
				updateActiveStates();
				fireFilter();
			});
			li.appendChild(btn);
			ul.appendChild(li);
		}

		function buildDropdown(label, options, getActive, setActive) {
			const wrapper = document.createElement("div");
			wrapper.className = "filter-dropdown";

			const trigger = document.createElement("button");
			trigger.type = "button";
			trigger.className = "filter-dropdown-trigger";

			const triggerLabel = document.createElement("span");
			triggerLabel.textContent = label;
			trigger.appendChild(triggerLabel);

			const chevron = document.createElement("span");
			chevron.className = "opacity-25";
			chevron.textContent = " ▾";
			trigger.appendChild(chevron);

			const list = document.createElement("div");
			list.className = "filter-dropdown-list";

			function updateTriggerLabel() {
				const active = getActive();
				const defaultVal = options.length > 0 ? options[0].value : null;
				triggerLabel.replaceChildren();
				if (active && active !== defaultVal) {
					let match = null;
					for (let mi = 0; mi < options.length; mi++) {
						if (options[mi].value === active) {
							match = options[mi];
							break;
						}
					}
					if (match) {
						const tl = match.shortLabel || match.label;
						if (typeof match.imageCount === "number") {
							appendProjectFilterLabel(triggerLabel, tl, match.imageCount);
						} else {
							appendParenStyledTextPlain(tl, triggerLabel, "opacity-25");
						}
					} else {
						triggerLabel.textContent = active;
					}
					wrapper.classList.add("has-selection");
				} else {
					triggerLabel.textContent = label;
					wrapper.classList.remove("has-selection");
				}
			}

			function buildList() {
				list.innerHTML = "";
				const active = getActive();
				for (let i = 0; i < options.length; i++) {
					const opt = document.createElement("button");
					opt.type = "button";
					opt.className = "filter-dropdown-option";
					opt.setAttribute("data-value", options[i].value);
					if (typeof options[i].imageCount === "number" && options[i].styledLabel) {
						appendProjectFilterLabel(opt, options[i].styledLabel, options[i].imageCount);
					} else if (options[i].styledLabel) {
						appendParenStyledTextPlain(options[i].styledLabel, opt, "opacity-25");
					} else {
						opt.textContent = options[i].label;
					}
					if (options[i].value === active) opt.classList.add("is-active");
					(function (val) {
						opt.addEventListener("click", function (e) {
							e.stopPropagation();
							setActive(val);
							updateActiveStates();
							fireFilter();
							updateTriggerLabel();
							wrapper.classList.remove("is-open");
						});
					})(options[i].value);
					list.appendChild(opt);
				}
			}

			trigger.addEventListener("click", function (e) {
				e.stopPropagation();
				const wasOpen = wrapper.classList.contains("is-open");
				bar.querySelectorAll(".filter-dropdown.is-open").forEach(function (d) {
					d.classList.remove("is-open");
				});
				if (!wasOpen) {
					buildList();
					wrapper.classList.add("is-open");
				}
			});

			wrapper.appendChild(trigger);
			wrapper.appendChild(list);
			updateTriggerLabel();
			return wrapper;
		}

		const desktopWrap = document.createElement("nav");
		desktopWrap.className = "filter-bar-desktop";
		desktopWrap.setAttribute("aria-label", "Example filters");

		const projectsUl = document.createElement("ul");
		projectsUl.className = "filter-bar-list";
		addProjectBtn(projectsUl, "All", "all");
		for (let i = 0; i < projectNames.length; i++) {
			addSlashLi(projectsUl);
			addProjectBtn(
				projectsUl,
				graphicsProjectListLabel(projectNames[i]),
				projectNames[i],
				projectImageCounts[projectNames[i]],
			);
		}
		desktopWrap.appendChild(projectsUl);
		desktopWrap.appendChild(createGraphicsPortfolioMeta());
		bar.appendChild(desktopWrap);

		const mobileBar = document.createElement("div");
		mobileBar.className = "filter-bar-mobile";

		const mobileLabel = document.createElement("span");
		mobileLabel.className = "filter-bar-mobile-label opacity-50";
		mobileLabel.textContent = "Examples:";
		mobileBar.appendChild(mobileLabel);

		const projOptions = [{ label: "All", value: "all" }];
		for (let ci = 0; ci < projectNames.length; ci++) {
			const display = graphicsProjectListLabel(projectNames[ci]);
			projOptions.push({
				label: display,
				styledLabel: display,
				shortLabel: display.replace(/\s*\([^)]*\)/, ""),
				value: projectNames[ci],
				imageCount: projectImageCounts[projectNames[ci]],
			});
		}

		mobileBar.appendChild(
			buildDropdown(
				"All",
				projOptions,
				function () {
					return activeProject || "all";
				},
				function (val) {
					activeProject = val === "all" ? null : val;
				},
			),
		);
		mobileBar.appendChild(createGraphicsPortfolioMeta());

		document.addEventListener("click", function () {
			bar.querySelectorAll(".filter-dropdown.is-open").forEach(function (d) {
				d.classList.remove("is-open");
			});
		});

		bar.appendChild(mobileBar);

		updateActiveStates();

		bar._fireInitialFilter = function () {
			fireFilter();
		};
		return bar;
	}

	function getGraphicsFilterSnapTopPx() {
		if (window.matchMedia(FILTER_BAR_MOBILE_MQL).matches) {
			const v = getComputedStyle(document.documentElement)
				.getPropertyValue("--header-sticky-band-height")
				.trim();
			if (v) {
				const n = parseFloat(v);
				if (!Number.isNaN(n)) return n;
			}
			const band = document.querySelector(".header-sticky-band");
			return band ? band.offsetHeight : 0;
		}
		const fixed = document.querySelector(".header-fixed-bar");
		if (fixed && fixed.classList.contains("is-visible")) {
			return fixed.offsetHeight;
		}
		return 0;
	}

	/** Raw band height can sit a hair below visual header edge; sticky top uses this so JS scroll math matches CSS */
	function getFilterBarSnapTopForStickyPx() {
		const raw = getGraphicsFilterSnapTopPx();
		if (!window.matchMedia(FILTER_BAR_MOBILE_MQL).matches) return raw;
		return Math.max(0, raw - 3);
	}

	const WORK_CREDITS_FIELD_ORDER = [
		["client", "Client"],
		["creativeDirection", "Creative Direction"],
		["design", "Design"],
		["development", "Development"],
		["research", "Research"],
		["content", "Content"],
		["collaborators", "Collaborators"],
	];

	const WORK_DETAILS_FIELD_ORDER = [
		["formats", "Formats"],
		["fonts", "Fonts"],
	];

	function formatWorkCreditsValue(val) {
		if (val == null || val === "") return "";
		if (Array.isArray(val)) {
			return val
				.map(function (x) {
					return x == null ? "" : String(x);
				})
				.filter(Boolean)
				.join(", ");
		}
		return String(val);
	}

	function appendWorkCreditsRow(container, label, rawVal) {
		const text = formatWorkCreditsValue(rawVal);
		if (!text) return;

		const p = document.createElement("p");
		p.className = "work-info-line";

		const lab = document.createElement("span");
		lab.className = "opacity-25";
		lab.textContent = label + ": ";

		const valSpan = document.createElement("span");
		appendBracketStyledText(text, valSpan, "opacity-25", "opacity-50");

		p.appendChild(lab);
		p.appendChild(valSpan);
		container.appendChild(p);
	}

	// Project credits + optional details (graphics: type "info") — typography matches .work-filename lines
	function renderGraphicsCreditsItem(item, container) {
		const creditsObj = item.credits && typeof item.credits === "object" ? item.credits : {};
		const detailsObj = item.details && typeof item.details === "object" ? item.details : {};

		let anyCredits = false;
		for (let i = 0; i < WORK_CREDITS_FIELD_ORDER.length; i++) {
			const key = WORK_CREDITS_FIELD_ORDER[i][0];
			if (formatWorkCreditsValue(creditsObj[key])) {
				anyCredits = true;
				break;
			}
		}
		let anyDetails = false;
		for (let j = 0; j < WORK_DETAILS_FIELD_ORDER.length; j++) {
			const dkey = WORK_DETAILS_FIELD_ORDER[j][0];
			if (formatWorkCreditsValue(detailsObj[dkey])) {
				anyDetails = true;
				break;
			}
		}

		if (!anyCredits && !anyDetails) return;

		const wrap = document.createElement("div");
		wrap.className = "work-info-block";
		if (item.project) {
			wrap.setAttribute("data-project", item.project);
		}

		const creditsBlock = document.createElement("div");
		creditsBlock.className = "work-info-credits";
		for (let c = 0; c < WORK_CREDITS_FIELD_ORDER.length; c++) {
			const pair = WORK_CREDITS_FIELD_ORDER[c];
			appendWorkCreditsRow(creditsBlock, pair[1], creditsObj[pair[0]]);
		}
		if (creditsBlock.childNodes.length > 0) {
			wrap.appendChild(creditsBlock);
		}

		if (anyDetails) {
			const detailsBlock = document.createElement("div");
			detailsBlock.className = "work-info-details";
			for (let d = 0; d < WORK_DETAILS_FIELD_ORDER.length; d++) {
				const dpair = WORK_DETAILS_FIELD_ORDER[d];
				appendWorkCreditsRow(detailsBlock, dpair[1], detailsObj[dpair[0]]);
			}
			if (detailsBlock.childNodes.length > 0) {
				wrap.appendChild(detailsBlock);
			}
		}

		if (wrap.childNodes.length > 0) {
			container.appendChild(wrap);
		}
	}

	// Full-width section title (graphics.json: type "title")
	function renderGraphicsTitleItem(item, container) {
		const wrap = document.createElement("div");
		wrap.className = "work-grid-title";
		if (item.project) {
			wrap.setAttribute("data-project", item.project);
		}

		const line = document.createElement("p");
		line.className = "work-text work-title-line";

		if (item.name) {
			const nameSpan = document.createElement("span");
			nameSpan.className = "work-title-name";
			appendBracketStyledText(item.name, nameSpan);
			line.appendChild(nameSpan);
		}

		if (item.date) {
			if (line.childNodes.length > 0) {
				line.appendChild(document.createTextNode(" "));
			}
			const dateSpan = document.createElement("span");
			dateSpan.className = "opacity-75";
			appendBracketStyledText(item.date, dateSpan);
			line.appendChild(dateSpan);
		}

		if (item.description) {
			if (line.childNodes.length > 0) {
				appendWorkSlashDivider(line, { trailingSpace: false, metaSeparator: false });
			}
			const descSpan = document.createElement("span");
			descSpan.className = "work-description";
			appendBracketStyledText(" " + item.description, descSpan);
			line.appendChild(descSpan);
		}

		if (line.childNodes.length > 0) {
			wrap.appendChild(line);
		}

		const linkEl = buildWorkLinkLine(item.link, item.linkDisplay);
		if (linkEl) {
			wrap.appendChild(linkEl);
		}

		if (wrap.childNodes.length > 0) {
			container.appendChild(wrap);
		}
	}

	// Render Graphics/Clients item
	async function renderGraphicsItem(item, container) {
		if (item.divider) {
			const hr = document.createElement("hr");
			hr.className = "divider work-grid-divider";
			hr.setAttribute("aria-hidden", "true");
			if (item.project) {
				hr.setAttribute("data-project", item.project);
			}
			container.appendChild(hr);
			return;
		}

		if (item.type === "title") {
			renderGraphicsTitleItem(item, container);
			return;
		}

		if (item.type === "info") {
			renderGraphicsCreditsItem(item, container);
			return;
		}

		const workItem = document.createElement("div");
		workItem.className = "work-item";
		// Allow 1, 2, 3, or 4 columns, default to 1
		const columns = item.columns && [1, 2, 3, 4].includes(item.columns) ? item.columns : 1;
		workItem.setAttribute("data-columns", columns);
		if (item.project) {
			workItem.setAttribute("data-project", item.project);
		}

		const graphicsLabel = item.number != null && item.number !== "" ? String(item.number) : "";

		if (item.filename) {
			let altText = "";
			if (graphicsLabel && item.description) {
				altText = graphicsLabel + " - " + item.description;
			} else if (graphicsLabel) {
				altText = graphicsLabel;
			} else if (item.description) {
				altText = item.description;
			} else {
				altText = item.filename;
			}
			const frame = await createWorkImage(
				"/images/work/",
				item.filename,
				altText,
				item,
				item.shared === true,
			);
			workItem.appendChild(frame);
		}

		// Caption
		const caption = document.createElement("div");
		caption.className = "work-caption";

		// Graphics: number // description
		const metaLine = buildWorkTextLine(graphicsLabel, item.description, "work-number");
		if (metaLine && metaLine.childNodes.length > 0) {
			caption.appendChild(metaLine);
		}

		if (item.filename) {
			const fileToShow = item.filename;
			const sizeUrl = "/images/work/dark/" + fileToShow;
			buildWorkFilenameLine("/images/work/", fileToShow, sizeUrl).then(function (filenameEl) {
				caption.appendChild(filenameEl);
				const linkEl = buildWorkLinkLine(item.link, item.linkDisplay);
				if (linkEl) caption.appendChild(linkEl);
			});
		}

		workItem.appendChild(caption);
		container.appendChild(workItem);
	}

	// Render Experiments/Lab item
	async function renderExperimentItem(item, container) {
		if (item.divider || item.type === "title") {
			return;
		}

		const workItem = document.createElement("div");
		workItem.className = "work-item";
		// Allow 1, 2, 3, or 4 columns, default to 2
		const columns = item.columns && [1, 2, 3, 4].includes(item.columns) ? item.columns : 2;
		workItem.setAttribute("data-columns", columns);

		// Extract number from filename if not provided (e.g., "G-002.png" -> "G-002")
		let itemNumber = item.number;
		if (!itemNumber && item.filename) {
			const match = item.filename.match(/^([A-Za-z]+-\d+)\./);
			if (match) {
				itemNumber = match[1];
			}
		}

		// Extract just the number part for path display (e.g., "G-001.png" -> "001.png")
		let pathFilename = item.filename;
		if (item.filename) {
			const pathMatch = item.filename.match(/[A-Za-z]+-(\d+\.[^.]+)$/);
			if (pathMatch) {
				pathFilename = pathMatch[1];
			}
		}

		if (item.filename) {
			let altText = "";
			const displayNumber = itemNumber ? itemNumber.toUpperCase() : "";
			if (displayNumber && item.description) {
				altText = displayNumber + " - " + item.description;
			} else if (displayNumber) {
				altText = displayNumber;
			} else if (item.description) {
				altText = item.description;
			} else if (item.filename) {
				altText = item.filename;
			}

			const frame = isExperimentScriptItem(item)
				? createWorkWidget(item)
				: await createWorkImage(
						"/images/lab/",
						item.filename,
						altText,
						item,
						item.shared === true,
					);
			workItem.appendChild(frame);
		}

		// Caption
		const caption = document.createElement("div");
		caption.className = "work-caption";

		// Experiments: Number // Description
		const metaLine = buildWorkTextLine(
			itemNumber ? itemNumber.toUpperCase() : "",
			item.description,
			"work-number",
		);
		if (metaLine && metaLine.childNodes.length > 0) {
			caption.appendChild(metaLine);
		}

		if (item.filename) {
			if (isExperimentScriptItem(item)) {
				const displayName = item.filename;
				const displayPath = LAB_SCRIPT_BASE_PATH;
				const sizeUrl = LAB_SCRIPT_BASE_PATH + item.filename;
				buildWorkFilenameLine(displayPath, displayName, sizeUrl).then(function (filenameEl) {
					caption.appendChild(filenameEl);
					const linkEl = buildWorkLinkLine(item.link, item.linkDisplay);
					if (linkEl) caption.appendChild(linkEl);
				});
			} else {
				const displayName = pathFilename;
				const displayPath = "/images/lab/";
				const sizeUrl = "/images/lab/dark/" + item.filename;
				buildWorkFilenameLine(displayPath, displayName, sizeUrl).then(function (filenameEl) {
					caption.appendChild(filenameEl);
					const linkEl = buildWorkLinkLine(item.link, item.linkDisplay);
					if (linkEl) caption.appendChild(linkEl);
				});
			}
		}

		workItem.appendChild(caption);
		container.appendChild(workItem);
	}

	// =========================================================================
	// FULLSCREEN LIGHTBOX (work + lab)
	// =========================================================================

	function experimentPathFilename(filename) {
		if (!filename) return "";
		const pathMatch = filename.match(/[A-Za-z]+-(\d+\.[^.]+)$/);
		return pathMatch ? pathMatch[1] : filename;
	}

	function experimentDisplayNumber(entry) {
		if (!entry) return "";
		if (entry.number != null && entry.number !== "") {
			return String(entry.number).toUpperCase();
		}
		if (entry.filename) {
			const match = entry.filename.match(/^([A-Za-z]+-\d+)\./);
			if (match) return match[1].toUpperCase();
		}
		return "";
	}

	function ensureGalleryLightbox() {
		if (galleryLightboxApi) return galleryLightboxApi;

		var root = document.createElement("div");
		root.className = "gallery-lightbox";
		root.id = "gallery-lightbox";
		root.setAttribute("hidden", "");
		root.setAttribute("aria-hidden", "true");
		root.setAttribute("role", "dialog");
		root.setAttribute("aria-modal", "true");
		root.setAttribute("aria-label", "Image");

		var projectEl = document.createElement("p");
		projectEl.className = "gallery-lightbox-project font-departure";

		var closeBtn = document.createElement("button");
		closeBtn.type = "button";
		closeBtn.className = "gallery-lightbox-close font-departure";
		closeBtn.setAttribute("aria-label", "Close");
		closeBtn.innerHTML =
			'Close <span class="opacity-50">[</span>×<span class="opacity-50">]</span>';

		var stage = document.createElement("div");
		stage.className = "gallery-lightbox-stage";

		var figure = document.createElement("div");
		figure.className = "gallery-lightbox-figure";

		var img = document.createElement("img");
		img.className = "gallery-lightbox-image";
		img.alt = "";

		var widgetMount = document.createElement("div");
		widgetMount.className = "gallery-lightbox-widget";
		widgetMount.hidden = true;

		var hitPrev = document.createElement("button");
		hitPrev.type = "button";
		hitPrev.className = "gallery-lightbox-hit gallery-lightbox-hit--prev";
		hitPrev.setAttribute("aria-label", "Previous");

		var hitNext = document.createElement("button");
		hitNext.type = "button";
		hitNext.className = "gallery-lightbox-hit gallery-lightbox-hit--next";
		hitNext.setAttribute("aria-label", "Next");

		figure.appendChild(img);
		figure.appendChild(widgetMount);
		figure.appendChild(hitPrev);
		figure.appendChild(hitNext);
		stage.appendChild(figure);

		var meta = document.createElement("div");
		meta.className = "gallery-lightbox-meta";

		var countEl = document.createElement("p");
		countEl.className = "gallery-lightbox-count font-departure";

		root.appendChild(projectEl);
		root.appendChild(closeBtn);
		root.appendChild(stage);
		root.appendChild(meta);
		root.appendChild(countEl);
		document.body.appendChild(root);

		var state = {
			open: false,
			entries: [],
			index: 0,
			sectionType: "graphics",
			imageBasePath: "/images/work/",
			isThemed: true,
			matchImageBackground: false,
			ambientToken: 0,
			widgetCleanup: null,
		};

		var ambientColorKeys = [
			"--color-bg",
			"--color-text",
			"--color-border",
			"--opacity-15",
			"--opacity-25",
			"--opacity-50",
			"--opacity-75",
			"--opacity-90",
		];

		function clearAmbientBackground() {
			root.classList.remove(
				"is-ambient",
				"gallery-lightbox--tone-dark",
				"gallery-lightbox--tone-light",
			);
			for (var i = 0; i < ambientColorKeys.length; i++) {
				root.style.removeProperty(ambientColorKeys[i]);
			}
		}

		function applyAmbientBackground(colorValue) {
			var rgb = parseCssColor(colorValue);
			if (!rgb) {
				clearAmbientBackground();
				return;
			}
			var hex = rgbToHex(rgb.r, rgb.g, rgb.b);
			var isDark = relativeLuminance(rgb.r, rgb.g, rgb.b) < 0.45;
			var textRgb = isDark ? "255, 255, 255" : "0, 0, 0";

			root.style.setProperty("--color-bg", hex);
			root.style.setProperty("--color-text", isDark ? "#ffffff" : "#000000");
			// Soft frame: ambient bg mixed toward text so the border is a tint, not grey
			var borderMix = isDark ? 0.14 : 0.12;
			var borderRgb = {
				r: rgb.r + (isDark ? 255 - rgb.r : 0 - rgb.r) * borderMix,
				g: rgb.g + (isDark ? 255 - rgb.g : 0 - rgb.g) * borderMix,
				b: rgb.b + (isDark ? 255 - rgb.b : 0 - rgb.b) * borderMix,
			};
			root.style.setProperty("--color-border", rgbToHex(borderRgb.r, borderRgb.g, borderRgb.b));
			root.style.setProperty("--opacity-15", "rgba(" + textRgb + ", 0.15)");
			root.style.setProperty("--opacity-25", "rgba(" + textRgb + ", 0.25)");
			root.style.setProperty("--opacity-50", "rgba(" + textRgb + ", 0.5)");
			root.style.setProperty("--opacity-75", "rgba(" + textRgb + ", 0.75)");
			root.style.setProperty("--opacity-90", "rgba(" + textRgb + ", 0.9)");

			root.classList.add("is-ambient");
			root.classList.toggle("gallery-lightbox--tone-dark", isDark);
			root.classList.toggle("gallery-lightbox--tone-light", !isDark);
		}

		function syncAmbientBackground(entry) {
			state.ambientToken += 1;
			var token = state.ambientToken;

			if (!state.matchImageBackground || !entry || isExperimentScriptItem(entry)) {
				clearAmbientBackground();
				return;
			}

			var preset = entry.bgColor || entry.lightboxBg || null;
			if (preset) {
				applyAmbientBackground(preset);
				return;
			}

			var cacheKey = entrySrc(entry);
			if (cacheKey && lightboxColorCache[cacheKey]) {
				applyAmbientBackground(lightboxColorCache[cacheKey]);
				return;
			}

			function applySampled(color, extraKeys) {
				if (!color) return false;
				var adjusted = darkenCssColor(color, 0.1);
				cacheAmbientColor(adjusted, [cacheKey, img.currentSrc || img.src].concat(extraKeys || []));
				applyAmbientBackground(adjusted);
				return true;
			}

			// Prefer the already-decoded grid thumb so open/nav doesn't wait on lightbox decode.
			var preview = findGridPreviewImage(entry.filename);
			if (preview && applySampled(extractAverageColor(preview), [preview.currentSrc || preview.src])) {
				return;
			}

			function sampleFromImage() {
				if (!state.open || token !== state.ambientToken) return;
				applySampled(extractAverageColor(img));
			}

			if (typeof img.decode === "function") {
				img.decode().then(sampleFromImage).catch(function () {
					if (img.complete && img.naturalWidth) sampleFromImage();
				});
			} else if (img.complete && img.naturalWidth) {
				sampleFromImage();
			} else {
				img.addEventListener("load", sampleFromImage, { once: true });
			}
		}

		function clearWidget() {
			if (typeof state.widgetCleanup === "function") {
				state.widgetCleanup();
			}
			state.widgetCleanup = null;
			widgetMount.replaceChildren();
			widgetMount.removeAttribute("data-lab-initialized");
			widgetMount.removeAttribute("data-clock-running");
			widgetMount.removeAttribute("data-lab-script");
			delete widgetMount._clockCleanup;
			widgetMount.hidden = true;
			widgetMount.classList.remove("is-ready");
		}

		function entrySrc(entry) {
			if (!entry || !entry.filename) return "";
			if (state.isThemed) {
				return getThemedSrc(state.imageBasePath, entry.filename, entry.shared === true);
			}
			return state.imageBasePath + entry.filename;
		}

		function renderMeta(entry) {
			meta.replaceChildren();
			if (!entry) return;

			var caption = document.createElement("div");
			caption.className = "work-caption";

			var label =
				state.sectionType === "experiments"
					? experimentDisplayNumber(entry)
					: entry.number != null && entry.number !== ""
						? String(entry.number)
						: "";
			var metaLine = buildWorkTextLine(label, entry.description, "work-number");
			if (metaLine && metaLine.childNodes.length > 0) {
				caption.appendChild(metaLine);
			}

			if (entry.filename) {
				var displayPath;
				var displayName;
				var sizeUrl;
				if (isExperimentScriptItem(entry)) {
					displayPath = LAB_SCRIPT_BASE_PATH;
					displayName = entry.filename;
					sizeUrl = LAB_SCRIPT_BASE_PATH + entry.filename;
				} else if (state.sectionType === "experiments") {
					displayPath = "/images/lab/";
					displayName = experimentPathFilename(entry.filename);
					sizeUrl = state.imageBasePath + "dark/" + entry.filename;
				} else {
					displayPath = "/images/work/";
					displayName = entry.filename;
					sizeUrl = state.isThemed
						? state.imageBasePath + "dark/" + entry.filename
						: state.imageBasePath + entry.filename;
				}
				var built = buildFilenameLineElement(displayPath, displayName, "work-filename");
				caption.appendChild(built.el);

				var metaToken = entry.filename;
				built.sizeSpan.dataset.metaToken = metaToken;
				getFileSize(sizeUrl).then(function (fileSize) {
					if (!state.open) return;
					if (built.sizeSpan.dataset.metaToken !== metaToken) return;
					if (fileSize) {
						built.sizeSpan.textContent = " (" + fileSize + "kb)";
					}
				});
			}

			meta.appendChild(caption);
		}

		function showIndex(i) {
			if (!state.entries.length) return;
			var n = state.entries.length;
			state.index = ((i % n) + n) % n;
			var entry = state.entries[state.index];

			var title = "";
			var titleIsStatic = false;
			if (state.sectionType === "experiments") {
				title = "DAAS (GRAPHICS) COMPUTER LAB";
				titleIsStatic = true;
			} else {
				title = entry.project || "";
			}
			projectEl.replaceChildren();
			if (!title) {
				projectEl.classList.add("is-empty");
			} else {
				projectEl.classList.remove("is-empty");

				if (titleIsStatic) {
					var labLink = document.createElement("a");
					labLink.href = "#lab";
					labLink.className = "gallery-lightbox-project-link";

					var labName = document.createElement("span");
					labName.className = "gallery-lightbox-project-name";
					appendBracketStyledText(title, labName);
					labLink.appendChild(labName);

					labLink.addEventListener("click", function (e) {
						e.preventDefault();
						e.stopPropagation();
						close();
						window.location.hash = "lab";
						var labSection = document.getElementById("lab");
						if (labSection) {
							labSection.scrollIntoView();
						}
					});

					projectEl.appendChild(labLink);
				} else {
					var link = document.createElement("a");
					link.href = "#";
					link.className = "gallery-lightbox-project-link";

					var nameSpan = document.createElement("span");
					nameSpan.className = "gallery-lightbox-project-name";
					nameSpan.textContent = title;
					link.appendChild(nameSpan);

					if (entry.projectDate) {
						link.appendChild(document.createTextNode(" "));
						var dateSpan = document.createElement("span");
						dateSpan.className = "opacity-75";
						appendBracketStyledText(entry.projectDate, dateSpan);
						link.appendChild(dateSpan);
					}

					link.addEventListener("click", function (e) {
						e.preventDefault();
						e.stopPropagation();
						var navigate = state.onTitleNavigate;
						close();
						if (typeof navigate === "function") {
							navigate(title);
						}
					});

					projectEl.appendChild(link);
				}
			}

			clearWidget();
			img.removeAttribute("data-base-path");
			img.removeAttribute("data-filename");
			img.removeAttribute("data-shared");
			img.onerror = null;

			if (isExperimentScriptItem(entry)) {
				img.hidden = true;
				img.removeAttribute("src");
				img.alt = "";
				widgetMount.hidden = false;
				syncAmbientBackground(entry);
				loadAndInitLabScript(entry.filename, widgetMount)
					.then(function () {
						if (!state.open) return;
						if (state.entries[state.index] !== entry) return;
						widgetMount.classList.add("is-ready");
						state.widgetCleanup = function () {
							if (typeof widgetMount._clockCleanup === "function") {
								widgetMount._clockCleanup();
							}
						};
					})
					.catch(function (err) {
						console.warn(err);
					});
			} else {
				img.hidden = false;
				if (state.isThemed) {
					img.dataset.basePath = state.imageBasePath;
					img.dataset.filename = entry.filename;
					img.dataset.shared = entry.shared === true ? "true" : "false";
				}
				img.src = entrySrc(entry);
				img.alt = entry.description || entry.filename || "";

				img.onerror = function () {
					if (!state.isThemed || !entry.filename) return;
					var darkSrc = state.imageBasePath + "dark/" + entry.filename;
					if (!this.src.endsWith(darkSrc)) {
						lightImageMissing.add(state.imageBasePath + entry.filename);
						this.src = darkSrc;
					}
				};
				syncAmbientBackground(entry);
			}

			renderMeta(entry);

			countEl.replaceChildren();
			countEl.className = "gallery-lightbox-count font-departure";

			var navLine = document.createElement("span");
			navLine.className = "gallery-lightbox-count-nav";

			var prevLink = document.createElement("a");
			prevLink.href = "#";
			prevLink.className = "gallery-lightbox-count-arrow";
			prevLink.setAttribute("aria-label", "Previous");
			prevLink.textContent = "Previous";
			prevLink.addEventListener("click", function (e) {
				e.preventDefault();
				e.stopPropagation();
				step(-1);
			});

			var slash = document.createElement("span");
			slash.className = "opacity-25";
			slash.textContent = " / ";

			var nextLink = document.createElement("a");
			nextLink.href = "#";
			nextLink.className = "gallery-lightbox-count-arrow";
			nextLink.setAttribute("aria-label", "Next");
			nextLink.textContent = "Next";
			nextLink.addEventListener("click", function (e) {
				e.preventDefault();
				e.stopPropagation();
				step(1);
			});

			navLine.appendChild(prevLink);
			navLine.appendChild(slash);
			navLine.appendChild(nextLink);
			countEl.appendChild(navLine);

			var singular = state.statusLabel || "Image";
			var plural = singular + "s";
			var label = n === 1 ? singular : plural;
			var countLine = document.createElement("span");
			countLine.className = "opacity-25";
			countLine.textContent = state.index + 1 + " of " + n + " " + label;
			countEl.appendChild(countLine);

			var sizeSpan = document.createElement("span");
			sizeSpan.className = "opacity-15";
			countLine.appendChild(sizeSpan);

			var sizeToken =
				String(n) +
				":" +
				(state.entries[0] && state.entries[0].filename) +
				":" +
				(state.entries[n - 1] && state.entries[n - 1].filename);
			countEl.dataset.sizeToken = sizeToken;

			function applyTotalSize(sizeStr) {
				if (!state.open || countEl.dataset.sizeToken !== sizeToken) return;
				if (sizeStr) sizeSpan.textContent = " (" + sizeStr + ")";
			}

			if (state.cachedTotalSizeStr != null && state.cachedTotalSizeKey === sizeToken) {
				applyTotalSize(state.cachedTotalSizeStr);
			} else if (typeof state.getTotalSizeStr === "function") {
				Promise.resolve(state.getTotalSizeStr(state.entries)).then(function (sizeStr) {
					state.cachedTotalSizeKey = sizeToken;
					state.cachedTotalSizeStr = sizeStr || null;
					applyTotalSize(state.cachedTotalSizeStr);
				});
			} else {
				Promise.all(
					state.entries.map(function (ent) {
						if (isExperimentScriptItem(ent)) {
							return getFileSizeBytes(LAB_SCRIPT_BASE_PATH + ent.filename);
						}
						var url = state.isThemed
							? state.imageBasePath + "dark/" + ent.filename
							: state.imageBasePath + ent.filename;
						return getFileSizeBytes(url);
					}),
				).then(function (sizes) {
					var sum = 0;
					var any = false;
					for (var si = 0; si < sizes.length; si++) {
						if (sizes[si] != null) {
							sum += sizes[si];
							any = true;
						}
					}
					state.cachedTotalSizeKey = sizeToken;
					state.cachedTotalSizeStr = any ? formatCompactDataSize(sum) : null;
					applyTotalSize(state.cachedTotalSizeStr);
				});
			}
		}

		function open(entries, startIndex, opts) {
			if (!entries || !entries.length) return;
			state.entries = entries;
			state.sectionType = opts.sectionType || "graphics";
			state.imageBasePath = opts.imageBasePath || "/images/work/";
			state.isThemed = opts.isThemed !== false;
			state.matchImageBackground = opts.matchImageBackground !== false;
			state.statusLabel = opts.statusLabel || "Image";
			state.onTitleNavigate =
				typeof opts.onTitleNavigate === "function" ? opts.onTitleNavigate : null;
			state.getTotalSizeStr =
				typeof opts.getTotalSizeStr === "function" ? opts.getTotalSizeStr : null;
			state.cachedTotalSizeStr = null;
			state.cachedTotalSizeKey = null;
			state.open = true;

			root.removeAttribute("hidden");
			root.classList.add("is-open");
			root.setAttribute("aria-hidden", "false");
			document.documentElement.classList.add("gallery-lightbox-open");

			showIndex(startIndex || 0);
			closeBtn.focus();
		}

		function close() {
			if (!state.open) return;
			state.open = false;
			state.ambientToken += 1;
			clearAmbientBackground();
			clearWidget();
			root.classList.remove("is-open");
			root.setAttribute("aria-hidden", "true");
			root.setAttribute("hidden", "");
			document.documentElement.classList.remove("gallery-lightbox-open");
			img.removeAttribute("src");
			meta.replaceChildren();
		}

		function refreshTheme() {
			if (!state.open || !state.isThemed) return;
			var entry = state.entries[state.index];
			if (!entry || isExperimentScriptItem(entry)) return;
			img.src = entrySrc(entry);
			syncAmbientBackground(entry);
		}

		function step(delta) {
			if (!state.open) return;
			showIndex(state.index + delta);
		}

		closeBtn.addEventListener("click", function (e) {
			e.stopPropagation();
			close();
		});
		hitPrev.addEventListener("click", function (e) {
			e.stopPropagation();
			step(-1);
		});
		hitNext.addEventListener("click", function (e) {
			e.stopPropagation();
			step(1);
		});
		root.addEventListener("click", function () {
			close();
		});
		figure.addEventListener("click", function (e) {
			e.stopPropagation();
		});

		document.addEventListener("keydown", function (e) {
			if (!state.open) return;
			if (e.key === "Escape") {
				e.preventDefault();
				close();
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				step(-1);
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				step(1);
			}
		});

		galleryLightboxApi = {
			open: open,
			close: close,
			refreshTheme: refreshTheme,
			isOpen: function () {
				return state.open;
			},
		};
		return galleryLightboxApi;
	}

	// Load and render work gallery
	async function initWorkGallery(sectionType, jsonPath, renderFunction) {
		// Find section by icon content
		const sections = document.querySelectorAll(".work-samples");
		let section = null;

		for (let i = 0; i < sections.length; i++) {
			const icon = sections[i].querySelector(".work-icon");
			if (icon) {
				const iconText = icon.textContent.trim();
				if (sectionType === "graphics" && iconText === "⌘") {
					section = sections[i];
					break;
				} else if (sectionType === "experiments" && iconText === "∑") {
					section = sections[i];
					break;
				}
			}
		}

		if (!section) return;

		const workContent = section.querySelector(".work-content");
		if (!workContent) return;

		// Preserve any existing disclaimer block in the work-content
		// (used for both graphics and experiments work sections)
		const disclaimer = workContent.querySelector(".disclaimer");

		// Remove placeholder content
		workContent.innerHTML = "";

		// Re-insert disclaimer (if present) at the top of work-content
		if (disclaimer) {
			workContent.appendChild(disclaimer);
		}

		const grid = document.createElement("div");
		grid.className = "work-grid";

		const divider = document.createElement("hr");
		divider.className = "divider hidden";

		const loadMoreRow = document.createElement("div");
		loadMoreRow.className = "load-more-row";

		const loadMoreBtn = document.createElement("button");
		loadMoreBtn.className = "load-more-button";
		loadMoreBtn.innerHTML = 'Load More <span class="opacity-50">[+]</span>';

		const loadMoreSep = document.createElement("span");
		loadMoreSep.className = "load-more-separator opacity-15";
		loadMoreSep.setAttribute("aria-hidden", "true");
		loadMoreSep.textContent = "/";

		const loadMoreStatus = document.createElement("span");
		loadMoreStatus.className = "load-more-status opacity-25";
		loadMoreStatus.setAttribute("aria-live", "polite");

		loadMoreRow.appendChild(loadMoreBtn);
		loadMoreRow.appendChild(loadMoreSep);
		loadMoreRow.appendChild(loadMoreStatus);
		loadMoreSep.classList.add("hidden");

		let allItems = [];
		let displayedCount = 0;

		try {
			let activeGraphicsProject = null;
			let filterChangeScrollEnabled = false;
			let expandGraphicsFilterToVisible = async function () {};

			function scrollGridIntoViewAfterFilterTap() {
				if (!filterChangeScrollEnabled) return;

				function measureAndScrollByFilterGeometry() {
					const mobileScroll = window.matchMedia(FILTER_BAR_MOBILE_MQL).matches;
					const gapPx = mobileScroll ? 12 : 16;
					const titleBelowFilterPad = mobileScroll ? 10 : 14;
					const minWantAnchorTopPx = mobileScroll ? 56 : 72;
					const filterEl =
						section.querySelector(".filter-bar") || workContent.querySelector(".filter-bar");
					if (!filterEl) return;

					/* After dropdown selection the trigger label height can change (wrap, sup hidden); flush layout before rects */
					void filterEl.offsetHeight;

					let anchor = null;
					if (sectionType === "graphics") {
						if (activeGraphicsProject) {
							const ttl = grid.querySelectorAll(".work-grid-title");
							for (let ti = 0; ti < ttl.length; ti++) {
								if (ttl[ti].getAttribute("data-project") === activeGraphicsProject) {
									anchor = ttl[ti];
									break;
								}
							}
						} else {
							anchor = grid.querySelector(".work-grid-title");
						}
					}
					if (!anchor) {
						anchor = section.querySelector(".disclaimer") || grid;
					}

					let wantAnchorTop;
					if (anchor.classList && anchor.classList.contains("work-grid-title") && filterEl) {
						const fr = filterEl.getBoundingClientRect();
						wantAnchorTop = fr.bottom + gapPx + titleBelowFilterPad;
						if (wantAnchorTop < gapPx + 48) {
							const snap =
								parseFloat(getComputedStyle(section).getPropertyValue("--filter-bar-snap-top")) ||
								0;
							wantAnchorTop =
								snap +
								Math.max(fr.height, filterEl.offsetHeight || 52) +
								gapPx +
								titleBelowFilterPad;
						}
					} else {
						wantAnchorTop = getFilterBarSnapTopForStickyPx() + gapPx + 48;
					}
					wantAnchorTop = Math.max(wantAnchorTop, minWantAnchorTopPx);

					const anchorTop = anchor.getBoundingClientRect().top;
					const delta = anchorTop - wantAnchorTop;
					if (Math.abs(delta) < 4) return;
					window.scrollBy({ top: delta, behavior: "smooth" });
				}

				/* Mobile: extra frame so sticky bar + dropdown label finish reflow before measuring */
				if (window.matchMedia(FILTER_BAR_MOBILE_MQL).matches) {
					requestAnimationFrame(function () {
						requestAnimationFrame(function () {
							requestAnimationFrame(measureAndScrollByFilterGeometry);
						});
					});
				} else {
					requestAnimationFrame(function () {
						requestAnimationFrame(measureAndScrollByFilterGeometry);
					});
				}
			}

			const response = await fetch(jsonPath);
			const data = await response.json();
			allItems = data.items || [];

			let filterBar = null;
			let graphicsNoResultsMsg = null;
			let applyGraphicsProjectFilter = function () {};

			if (sectionType === "graphics") {
				assignWorkProjects(allItems);

				const projectImageCounts = {};
				for (let ii = 0; ii < allItems.length; ii++) {
					const row = allItems[ii];
					if (!row.filename || !row.project) continue;
					const pnKey = row.project;
					projectImageCounts[pnKey] = (projectImageCounts[pnKey] || 0) + 1;
				}
				const projectNames = [];
				const projectSeen = new Set();
				for (let pi = 0; pi < allItems.length; pi++) {
					const pn = allItems[pi].project;
					if (pn && !projectSeen.has(pn)) {
						projectSeen.add(pn);
						projectNames.push(pn);
					}
				}

				filterBar = buildGraphicsProjectFilterBar(
					projectNames,
					projectImageCounts,
					function (proj) {
						activeGraphicsProject = proj;
						applyGraphicsProjectFilter();
						updateLoadMoreStatus();
						void expandGraphicsFilterToVisible().then(function () {
							applyGraphicsProjectFilter();
							updateLoadMoreStatus();
							scrollGridIntoViewAfterFilterTap();
						});
					},
				);

				if (filterBar) {
					workContent.appendChild(filterBar);

					graphicsNoResultsMsg = document.createElement("p");
					graphicsNoResultsMsg.className = "no-results opacity-50";
					graphicsNoResultsMsg.textContent = "No work matches the selected project.";
					graphicsNoResultsMsg.style.display = "none";

					function gfxSyncFilterSnapTop() {
						section.style.setProperty(
							"--filter-bar-snap-top",
							getFilterBarSnapTopForStickyPx() + "px",
						);
					}
					let gfxFilterStuckInitialized = false;
					let gfxStickFadeToken = 0;
					function gfxCheckFilterStuck() {
						gfxSyncFilterSnapTop();
						const rect = filterBar.getBoundingClientRect();
						const stickyTop = getFilterBarSnapTopForStickyPx();
						const line = stickyTop + 1;
						const stickHyst = 16;
						const wasStuck = filterBar.classList.contains("is-stuck");
						const stuck = wasStuck ? rect.top <= line + stickHyst : rect.top <= line;
						if (stuck === wasStuck) {
							gfxFilterStuckInitialized = true;
							return;
						}

						/*
						 * Desktop width breakout/collapse is masked both ways:
						 * opacity 0 → toggle is-stuck (layout jumps while invisible) → fade to 1.
						 * Skip on mobile (no breakout), reduced motion, and first paint.
						 */
						const canFadeMask =
							gfxFilterStuckInitialized &&
							!window.matchMedia(FILTER_BAR_MOBILE_MQL).matches &&
							!window.matchMedia("(prefers-reduced-motion: reduce)").matches;

						if (canFadeMask) {
							const token = ++gfxStickFadeToken;
							filterBar.classList.add("is-stick-fade");
							filterBar.classList.toggle("is-stuck", stuck);
							requestAnimationFrame(function () {
								requestAnimationFrame(function () {
									if (token !== gfxStickFadeToken) return;
									filterBar.classList.remove("is-stick-fade");
								});
							});
						} else {
							filterBar.classList.remove("is-stick-fade");
							filterBar.classList.toggle("is-stuck", stuck);
						}
						gfxFilterStuckInitialized = true;
					}
					let gfxFilterStuckRaf = null;
					function gfxScheduleFilterStuckCheck() {
						if (gfxFilterStuckRaf != null) return;
						gfxFilterStuckRaf = requestAnimationFrame(function () {
							gfxFilterStuckRaf = null;
							gfxCheckFilterStuck();
						});
					}
					window.addEventListener("scroll", gfxScheduleFilterStuckCheck, { passive: true });
					function gfxOnResizeLayout() {
						gfxSyncFilterSnapTop();
						gfxScheduleFilterStuckCheck();
					}
					window.addEventListener("resize", gfxOnResizeLayout);
					gfxCheckFilterStuck();
				}
			}

			workContent.appendChild(grid);
			if (graphicsNoResultsMsg) {
				workContent.appendChild(graphicsNoResultsMsg);
			}
			workContent.appendChild(divider);
			workContent.appendChild(loadMoreRow);

			const workImageBasePath = sectionType === "graphics" ? "/images/work/" : "/images/lab/";
			let workImageBytesByIndex = null;

			function countWorkImages(items) {
				let n = 0;
				for (let i = 0; i < items.length; i++) {
					if (items[i].filename) {
						n++;
					}
				}
				return n;
			}

			function countWorkImagesShown(items, displayedItemCount) {
				let n = 0;
				const end = Math.min(displayedItemCount, items.length);
				for (let i = 0; i < end; i++) {
					if (items[i].filename) {
						n++;
					}
				}
				return n;
			}

			function itemMatchesGraphicsProject(item, proj) {
				return !proj || item.project === proj;
			}

			function isGraphicsProjectFilterActive() {
				return Boolean(activeGraphicsProject);
			}

			function countGraphicsImagesMatchingInRange(items, proj, displayedItemCount) {
				let n = 0;
				const end = Math.min(displayedItemCount, items.length);
				for (let i = 0; i < end; i++) {
					if (!items[i].filename) continue;
					if (!itemMatchesGraphicsProject(items[i], proj)) continue;
					n++;
				}
				return n;
			}

			function countGraphicsImagesMatchingTotal(items, proj) {
				return countGraphicsImagesMatchingInRange(items, proj, items.length);
			}

			function remainingMatchingFilenameItemsExist() {
				for (let i = displayedCount; i < allItems.length; i++) {
					const item = allItems[i];
					if (!item.filename) continue;
					if (sectionType === "graphics" && isGraphicsProjectFilterActive()) {
						if (!itemMatchesGraphicsProject(item, activeGraphicsProject)) continue;
					}
					return true;
				}
				return false;
			}

			const lightbox = ensureGalleryLightbox();

			function getLightboxBrowseEntries() {
				const out = [];
				for (let i = 0; i < allItems.length; i++) {
					const item = allItems[i];
					if (!item.filename) continue;
					if (sectionType === "graphics" && isGraphicsProjectFilterActive()) {
						if (!itemMatchesGraphicsProject(item, activeGraphicsProject)) continue;
					}
					out.push(item);
				}
				return out;
			}

			function openLightboxForFilename(filename) {
				if (!filename) return;
				const entries = getLightboxBrowseEntries();
				let start = -1;
				for (let i = 0; i < entries.length; i++) {
					if (entries[i].filename === filename) {
						start = i;
						break;
					}
				}

				function navigateToTitle(title) {
					if (!title || !filterBar) return;
					if (sectionType === "graphics" && typeof filterBar._selectProject === "function") {
						filterBar._selectProject(title);
					}
				}

				var openOpts = {
					sectionType: sectionType,
					imageBasePath: workImageBasePath,
					isThemed: true,
					statusLabel: "Image",
					onTitleNavigate: navigateToTitle,
					getTotalSizeStr: function (entries) {
						function sumFromCache() {
							if (!workImageBytesByIndex) return null;
							var byName = {};
							for (var i = 0; i < allItems.length; i++) {
								if (!allItems[i].filename) continue;
								if (workImageBytesByIndex[i] != null) {
									byName[allItems[i].filename] = workImageBytesByIndex[i];
								}
							}
							var sum = 0;
							var any = false;
							for (var j = 0; j < entries.length; j++) {
								var b = byName[entries[j].filename];
								if (b != null) {
									sum += b;
									any = true;
								}
							}
							return any ? formatCompactDataSize(sum) : null;
						}

						var cached = sumFromCache();
						if (cached) return Promise.resolve(cached);

						return Promise.all(
							entries.map(function (ent) {
								if (isExperimentScriptItem(ent)) {
									return getFileSizeBytes(LAB_SCRIPT_BASE_PATH + ent.filename);
								}
								return getFileSizeBytes(workImageBasePath + "dark/" + ent.filename);
							}),
						).then(function (sizes) {
							var sum = 0;
							var any = false;
							for (var si = 0; si < sizes.length; si++) {
								if (sizes[si] != null) {
									sum += sizes[si];
									any = true;
								}
							}
							return any ? formatCompactDataSize(sum) : null;
						});
					},
				};

				if (start < 0) {
					const all = [];
					for (let j = 0; j < allItems.length; j++) {
						if (allItems[j].filename) all.push(allItems[j]);
					}
					for (let k = 0; k < all.length; k++) {
						if (all[k].filename === filename) {
							start = k;
							break;
						}
					}
					if (start < 0) return;
					lightbox.open(all, start, openOpts);
					return;
				}
				lightbox.open(entries, start, openOpts);
			}

			grid.addEventListener("click", function (e) {
				const frame = e.target.closest(".work-image-frame");
				if (!frame || !grid.contains(frame)) return;
				const thumb = frame.querySelector("img.work-image");
				const filename =
					(thumb && thumb.dataset.filename) || frame.dataset.filename || "";
				if (!filename) return;
				e.preventDefault();
				openLightboxForFilename(filename);
			});

			function syncLoadMoreButtonVisibility() {
				const fullyLoaded = displayedCount >= allItems.length;
				const noMoreMatchingImages = !remainingMatchingFilenameItemsExist();
				loadMoreBtn.classList.toggle("hidden", fullyLoaded || noMoreMatchingImages);
			}

			function sumBytesForDisplayedImages() {
				if (!workImageBytesByIndex) {
					return null;
				}
				let sum = 0;
				let any = false;
				const end = Math.min(displayedCount, allItems.length);
				for (let i = 0; i < end; i++) {
					if (!allItems[i].filename) continue;
					if (sectionType === "graphics" && isGraphicsProjectFilterActive()) {
						if (!itemMatchesGraphicsProject(allItems[i], activeGraphicsProject)) continue;
					}
					const b = workImageBytesByIndex[i];
					if (b != null) {
						sum += b;
						any = true;
					}
				}
				return any ? sum : null;
			}

			function updateLoadMoreStatus() {
				const singularLabel = "Image";
				const pluralLabel = "Images";
				let total;
				let shown;
				let label;
				if (sectionType === "graphics" && isGraphicsProjectFilterActive()) {
					shown = countGraphicsImagesMatchingInRange(
						allItems,
						activeGraphicsProject,
						displayedCount,
					);
					total = countGraphicsImagesMatchingTotal(allItems, activeGraphicsProject);
					label = total === 1 ? "filtered " + singularLabel : "filtered " + pluralLabel;
				} else {
					total = countWorkImages(allItems);
					shown = countWorkImagesShown(allItems, displayedCount);
					label = total === 1 ? singularLabel : pluralLabel;
				}
				const sizeStr = formatCompactDataSize(sumBytesForDisplayedImages());
				loadMoreStatus.replaceChildren();
				loadMoreStatus.appendChild(document.createTextNode(shown + " of " + total + " " + label));
				if (sizeStr) {
					const sizeWrap = document.createElement("span");
					sizeWrap.className = "opacity-75";
					sizeWrap.textContent = " (" + sizeStr + ")";
					loadMoreStatus.appendChild(sizeWrap);
				}
				syncLoadMoreButtonVisibility();
				loadMoreSep.classList.toggle("hidden", loadMoreBtn.classList.contains("hidden"));
			}

			applyGraphicsProjectFilter = function () {
				if (sectionType !== "graphics") return;
				const proj = activeGraphicsProject;
				grid
					.querySelectorAll(".work-item, .work-grid-title, .work-info-block, .work-grid-divider")
					.forEach(function (el) {
						const dp = el.getAttribute("data-project");
						const visible = !proj || dp === proj;
						el.style.display = visible ? "" : "none";
					});
				if (proj) {
					const ch = grid.children;
					for (let ti = ch.length - 1; ti >= 0; ti--) {
						const node = ch[ti];
						if (node.style.display === "none") continue;
						if (!node.classList.contains("work-grid-divider")) break;
						node.style.display = "none";
					}
				}
				if (graphicsNoResultsMsg) {
					const noneInDataset = proj && countGraphicsImagesMatchingTotal(allItems, proj) === 0;
					graphicsNoResultsMsg.style.display = noneInDataset ? "block" : "none";
				}
			};

			void (async function fetchWorkImageByteSizesByIndex() {
				workImageBytesByIndex = new Array(allItems.length);
				const tasks = [];
				for (let i = 0; i < allItems.length; i++) {
					workImageBytesByIndex[i] = null;
					if (!allItems[i].filename) {
						continue;
					}
					const idx = i;
					let url = workImageBasePath + "dark/" + allItems[i].filename;
					if (sectionType === "experiments" && allItems[i].type === "script") {
						url = LAB_SCRIPT_BASE_PATH + allItems[i].filename;
					}
					tasks.push(
						getFileSizeBytes(url).then(function (bytes) {
							workImageBytesByIndex[idx] = bytes;
						}),
					);
				}
				if (tasks.length === 0) {
					return;
				}
				await Promise.all(tasks);
				updateLoadMoreStatus();
			})();

			// Use JSON array order for both graphics and experiments

			// Calculate how many items fit within a given column budget (maxColumns).
			// Graphics dividers and title rows are included in the slice but do not consume column budget.
			// Used to cap initial display (2 rows) and "Load more" batches on desktop (separate larger budget per click below)
			function calculateDisplayCount(items, maxColumns) {
				let totalColumns = 0;
				let count = 0;

				for (let i = 0; i < items.length; i++) {
					const item = items[i];
					if (sectionType === "graphics" && (item.divider || item.type === "title" || item.type === "info")) {
						count++;
						continue;
					}

					const itemColumns = item.columns || (sectionType === "experiments" ? 2 : 1);

					if (totalColumns + itemColumns <= maxColumns) {
						totalColumns += itemColumns;
						count++;
					} else {
						break;
					}
				}

				return count;
			}

			// Mobile: cap by image "content" slots; dividers / title rows in between are included but not counted toward the cap
			function countMobileBatchItems(items, maxContentItems) {
				let contentIncluded = 0;
				let count = 0;

				for (let i = 0; i < items.length; i++) {
					const item = items[i];
					if (sectionType === "graphics" && (item.divider || item.type === "title" || item.type === "info")) {
						count++;
						continue;
					}
					if (contentIncluded >= maxContentItems) {
						break;
					}
					contentIncluded++;
					count++;
				}

				return count;
			}

			function isGraphicsBatchDeferrableTailItem(item) {
				return item && (item.divider === true || item.type === "title");
			}

			// Graphics: do not end a batch with a divider or title row when more items exist after (defer until next batch).
			// Final batch (reaches end of list) keeps trailing divider/title. If the raw batch is only deferrable rows but more follow, extend until it ends with image/content.
			function adjustBatchCountForTrailingDividers(remainingItems, rawBatchCount) {
				if (sectionType !== "graphics" || rawBatchCount === 0) {
					return rawBatchCount;
				}
				if (rawBatchCount >= remainingItems.length) {
					return rawBatchCount;
				}
				let n = rawBatchCount;
				while (n > 0 && isGraphicsBatchDeferrableTailItem(remainingItems[n - 1])) {
					n--;
				}
				if (n === 0) {
					n = rawBatchCount;
					while (
						n < remainingItems.length &&
						isGraphicsBatchDeferrableTailItem(remainingItems[n - 1])
					) {
						n++;
					}
				}
				return n;
			}

			// Detect mobile layout (single-column work grid; matches CSS max-width: 1080px)
			const isMobile = window.matchMedia("(max-width: 1080px)").matches;

			// Initial display:
			// - Desktop: max 2 rows (20 columns at largest breakpoint)
			// - Mobile: max 4 content items (+ graphics dividers in the same slice)
			const rawInitialCount = isMobile
				? countMobileBatchItems(allItems, 4)
				: calculateDisplayCount(allItems, 20);
			const initialDisplayCount = adjustBatchCountForTrailingDividers(allItems, rawInitialCount);

			async function displayNextBatch() {
				const remainingItems = allItems.slice(displayedCount);

				// Each click: larger batch than initial paint (desktop ~4 rows, mobile 8 tiles)
				let rawBatchCount;
				if (isMobile) {
					rawBatchCount = countMobileBatchItems(remainingItems, 8);
				} else {
					rawBatchCount = calculateDisplayCount(remainingItems, 40);
				}
				const batchCount = adjustBatchCountForTrailingDividers(remainingItems, rawBatchCount);

				if (batchCount === 0) {
					updateLoadMoreStatus();
					return;
				}

				const batch = remainingItems.slice(0, batchCount);

				for (let i = 0; i < batch.length; i++) {
					await renderFunction(batch[i], grid);
				}
				displayedCount += batch.length;

				setupLazyLoading();

				if (displayedCount >= allItems.length) {
					loadMoreBtn.classList.add("hidden");
				}
				updateLoadMoreStatus();
				if (sectionType === "graphics") {
					applyGraphicsProjectFilter();
				}

				if (displayedCount < allItems.length && !remainingMatchingFilenameItemsExist()) {
					await displayNextBatch();
				}
			}

			expandGraphicsFilterToVisible = async function () {
				if (sectionType !== "graphics" || !activeGraphicsProject) return;
				const proj = activeGraphicsProject;
				if (countGraphicsImagesMatchingTotal(allItems, proj) === 0) return;

				while (displayedCount < allItems.length) {
					let visibleMatching = 0;
					grid.querySelectorAll(".work-item").forEach(function (el) {
						if (el.getAttribute("data-project") !== proj) return;
						if (el.style.display === "none") return;
						visibleMatching++;
					});
					if (visibleMatching > 0) break;
					const before = displayedCount;
					await displayNextBatch();
					if (displayedCount === before) break;
				}
			};

			loadMoreBtn.addEventListener("click", function () {
				displayNextBatch();
			});

			displayedCount = 0;
			const firstBatch = allItems.slice(0, initialDisplayCount);
			(async function () {
				for (let i = 0; i < firstBatch.length; i++) {
					await renderFunction(firstBatch[i], grid);
				}
				displayedCount = firstBatch.length;

				setupLazyLoading();

				if (displayedCount >= allItems.length) {
					loadMoreBtn.classList.add("hidden");
				}
				divider.classList.remove("hidden");
				updateLoadMoreStatus();
				if (filterBar && filterBar._fireInitialFilter) {
					filterBar._fireInitialFilter();
				}
				filterChangeScrollEnabled = true;

				while (displayedCount < allItems.length && !remainingMatchingFilenameItemsExist()) {
					await displayNextBatch();
				}
			})().catch(function (error) {
				console.error("Error displaying batch:", error);
			});
		} catch (error) {
			console.error("Error loading work gallery:", error);
			workContent.innerHTML = "<p class='opacity-50'>Error loading gallery.</p>";
		}
	}

	// Initialize galleries (only if not disabled)
	if (!DISABLE_JSON_LOADING) {
		initWorkGallery("graphics", "/data/graphics.json", renderGraphicsItem);
		initWorkGallery("experiments", "/data/experiments.json", renderExperimentItem);
	}
});
