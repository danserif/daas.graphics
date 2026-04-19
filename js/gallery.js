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

	function getThemedSrc(basePath, filename) {
		const isLight = document.documentElement.classList.contains("light-mode");
		if (isLight && !lightImageMissing.has(basePath + filename)) {
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
				var newSrc = getThemedSrc(basePath, filename);

				if (img.dataset.src) {
					img.dataset.src = newSrc;
				} else if (img.src) {
					img.src = newSrc;
				}
			});
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

	// Append text to a parent element, wrapping any "(...)" segments in a span with opacity-50,
	// and "<Name/>"-style tokens so only "<" and "/>" use opacity-50 (inner name stays full opacity).
	function appendBracketStyledText(text, parent) {
		if (!text) return;
		const tagParts = text.split(/(<[^/]+\/>)/);

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

			const parts = segment.split(/(\([^)]*\))/);
			parts.forEach(function (part) {
				if (!part) return;
				const span = document.createElement("span");
				if (part.startsWith("(") && part.endsWith(")")) {
					span.className = "opacity-50";
				}
				span.textContent = part;
				parent.appendChild(span);
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
	async function createWorkImage(basePath, filename, altText, dims) {
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
		img.dataset.src = getThemedSrc(basePath, filename);
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
			if (!bp || !fn) return;
			var darkSrc = bp + "dark/" + fn;
			if (this.src && !this.src.endsWith(darkSrc)) {
				lightImageMissing.add(bp + fn);
				this.src = darkSrc;
			}
		});

		frame.appendChild(img);
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

	// Build filename line <p class="work-filename"> with ⌙, path, filename, and optional size
	async function buildWorkFilenameLine(basePath, displayName, sizeUrl) {
		const filename = document.createElement("p");
		filename.className = "work-filename";

		let sizeText = "";
		if (sizeUrl) {
			const fileSize = await getFileSize(sizeUrl);
			if (fileSize) {
				sizeText = ` (${fileSize}kb)`;
			}
		}

		filename.innerHTML =
			'<span class="opacity-15">&#8985;</span> ' +
			'<span class="opacity-25">' +
			basePath +
			"</span>" +
			'<span class="opacity-25">' +
			displayName +
			"</span> " +
			'<span class="opacity-15">' +
			sizeText +
			"</span>";

		return filename;
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

	function appendWorkSlashDivider(paragraph) {
		const slash = document.createElement("span");
		slash.className = "opacity-25";
		slash.textContent = " //";
		paragraph.appendChild(slash);
	}

	function assignWorkProjects(items) {
		let proj = null;
		for (let i = 0; i < items.length; i++) {
			const it = items[i];
			if (it.type === "title" && it.name) {
				proj = it.name;
			}
			it.project = proj;
		}
	}

	function createGraphicsPortfolioMeta() {
		const wrap = document.createElement("span");
		wrap.className = "filter-bar-active-meta filter-bar-portfolio-meta";

		const prefix = document.createElement("span");
		prefix.className = "opacity-50";
		prefix.textContent = "Status: ";
		wrap.appendChild(prefix);

		const lead = document.createElement("span");
		lead.className = "opacity-75";
		lead.textContent = "Limited Availability ";
		wrap.appendChild(lead);

		const waitlist = document.createElement("span");
		waitlist.className = "opacity-50";
		waitlist.textContent = "(Waitlist)";
		wrap.appendChild(waitlist);

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

		let activeProject = null;

		function fireFilter() {
			onProjectChange(activeProject);
		}

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

		function addListLabel(ul, text) {
			const li = document.createElement("li");
			const span = document.createElement("span");
			span.className = "opacity-50";
			span.textContent = text;
			li.appendChild(span);
			ul.appendChild(li);
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
		addListLabel(projectsUl, "Examples:");
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
				appendWorkSlashDivider(line);
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
			const frame = await createWorkImage("/images/work/", item.filename, altText, item);
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

			const frame = await createWorkImage("/images/lab/", item.filename, altText, item);
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
			const displayName = pathFilename;
			const displayPath = "/images/lab/";
			const sizeUrl = "/images/lab/dark/" + item.filename;
			buildWorkFilenameLine(displayPath, displayName, sizeUrl).then(function (filenameEl) {
				caption.appendChild(filenameEl);
				const linkEl = buildWorkLinkLine(item.link, item.linkDisplay);
				if (linkEl) caption.appendChild(linkEl);
			});
		}

		workItem.appendChild(caption);
		container.appendChild(workItem);
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
					function gfxCheckFilterStuck() {
						gfxSyncFilterSnapTop();
						const rect = filterBar.getBoundingClientRect();
						const stickyTop = getFilterBarSnapTopForStickyPx();
						const line = stickyTop + 1;
						const stickHyst = 16;
						const wasStuck = filterBar.classList.contains("is-stuck");
						const stuck = wasStuck ? rect.top <= line + stickHyst : rect.top <= line;
						filterBar.classList.toggle("is-stuck", stuck);
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
					.querySelectorAll(".work-item, .work-grid-title, .work-grid-divider")
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
					const url = workImageBasePath + "dark/" + allItems[i].filename;
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
					if (sectionType === "graphics" && (item.divider || item.type === "title")) {
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
					if (sectionType === "graphics" && (item.divider || item.type === "title")) {
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
