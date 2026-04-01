// gallery.js
// Graphics / Clients + Experiments / Lab

document.addEventListener("DOMContentLoaded", function () {
	const ITEMS_PER_PAGE = 12;

	// Development controls: Temporarily disable JSON loading
	// Set to true to skip loading graphics.json and experiments.json
	const DISABLE_JSON_LOADING = false;

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

	// Append text to a parent element, wrapping any "(...)" segments in a span with opacity-50
	function appendBracketStyledText(text, parent) {
		if (!text) return;
		const parts = text.split(/(\([^)]*\))/); // keep brackets in the result

		parts.forEach(function (part) {
			if (!part) return;
			// Create a span so we don't disturb the parent's own classes
			const span = document.createElement("span");
			if (part.startsWith("(") && part.endsWith(")")) {
				span.className = "opacity-50";
			}
			span.textContent = part;
			parent.appendChild(span);
		});
	}

	// Get file size in KB
	async function getFileSize(url) {
		try {
			const response = await fetch(url, { method: "HEAD" });
			const contentLength = response.headers.get("Content-Length");
			if (contentLength) {
				const sizeInKB = Math.round(parseInt(contentLength, 10) / 1024);
				return sizeInKB;
			}
		} catch (error) {
			console.warn("Could not fetch file size for", url);
		}
		return null;
	}

	// Create an image element with theme-aware src (dark default, optional light variant)
	// basePath: e.g. "/images/work/", filename: e.g. "project.jpg"
	// Resolves to /images/work/dark/project.jpg or /images/work/light/project.jpg
	function createWorkImage(basePath, filename, altText) {
		const frame = document.createElement("div");
		frame.className = "work-image-frame";

		const img = document.createElement("img");
		img.className = "work-image";
		img.dataset.basePath = basePath;
		img.dataset.filename = filename;
		img.dataset.src = getThemedSrc(basePath, filename);
		img.alt = altText || "";
		img.loading = "lazy";

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

		// Set aspect ratio from dark image dimensions (canonical size)
		const tempImg = new Image();
		tempImg.onload = function () {
			const aspectRatio = this.naturalWidth / this.naturalHeight;
			img.style.aspectRatio = aspectRatio.toString();
		};
		tempImg.src = basePath + "dark/" + filename;

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

	// Optional work item URL: full href + protocol + remainder for caption display
	function normalizeWorkLink(link) {
		if (!link || typeof link !== "string") return null;
		const t = link.trim();
		if (!t) return null;
		let href = t;
		if (!/^https?:\/\//i.test(t)) {
			href = "https://" + t;
		}
		const m = href.match(/^(https?:\/\/)(.+)$/i);
		if (!m) return null;
		return {
			href: href,
			protocol: m[1].toLowerCase(),
			rest: m[2],
		};
	}

	// Caption line: muted protocol + url + arrow (clickable)
	function buildWorkLinkLine(link) {
		const parsed = normalizeWorkLink(link);
		if (!parsed) return null;

		const p = document.createElement("p");
		p.className = "work-link";

		const a = document.createElement("a");
		a.href = parsed.href;
		a.target = "_blank";
		a.rel = "noopener noreferrer";

		const proto = document.createElement("span");
		proto.className = "opacity-25";
		proto.textContent = parsed.protocol;

		a.appendChild(proto);
		a.appendChild(document.createTextNode(" "));
		a.appendChild(document.createTextNode(parsed.rest));

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

	// Full-width section title (graphics.json: type "title")
	function renderGraphicsTitleItem(item, container) {
		const wrap = document.createElement("div");
		wrap.className = "work-grid-title";

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
			dateSpan.className = "opacity-50";
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

		const linkEl = buildWorkLinkLine(item.link);
		if (linkEl) {
			wrap.appendChild(linkEl);
		}

		if (wrap.childNodes.length > 0) {
			container.appendChild(wrap);
		}
	}

	// Render Graphics/Clients item
	function renderGraphicsItem(item, container) {
		if (item.divider) {
			const hr = document.createElement("hr");
			hr.className = "divider work-grid-divider";
			hr.setAttribute("aria-hidden", "true");
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

		const graphicsLabel =
			item.number != null && item.number !== "" ? String(item.number) : "";

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
			const frame = createWorkImage("/images/work/", item.filename, altText);
			const parsedLink = normalizeWorkLink(item.link);
			if (parsedLink) {
				const imgA = document.createElement("a");
				imgA.href = parsedLink.href;
				imgA.target = "_blank";
				imgA.rel = "noopener noreferrer";
				imgA.appendChild(frame);
				workItem.appendChild(imgA);
			} else {
				workItem.appendChild(frame);
			}
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
				const linkEl = buildWorkLinkLine(item.link);
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

			const frame = createWorkImage("/images/lab/", item.filename, altText);
			const parsedLink = normalizeWorkLink(item.link);
			if (parsedLink) {
				const imgA = document.createElement("a");
				imgA.href = parsedLink.href;
				imgA.target = "_blank";
				imgA.rel = "noopener noreferrer";
				imgA.appendChild(frame);
				workItem.appendChild(imgA);
			} else {
				workItem.appendChild(frame);
			}
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
			const filenameEl = await buildWorkFilenameLine(displayPath, displayName, sizeUrl);
			caption.appendChild(filenameEl);
			const linkEl = buildWorkLinkLine(item.link);
			if (linkEl) caption.appendChild(linkEl);
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

		// Create grid container
		const grid = document.createElement("div");
		grid.className = "work-grid";
		workContent.appendChild(grid);

		// Create divider before load more button (hidden until we know there are extra items)
		const divider = document.createElement("hr");
		divider.className = "divider hidden";
		workContent.appendChild(divider);

		// Create load more button
		const loadMoreBtn = document.createElement("button");
		loadMoreBtn.className = "load-more-button";
		loadMoreBtn.innerHTML = 'Load More <span class="opacity-50">[+]</span>';
		workContent.appendChild(loadMoreBtn);

		let allItems = [];
		let displayedCount = 0;

		try {
			const response = await fetch(jsonPath);
			const data = await response.json();
			allItems = data.items || [];

			// Use JSON array order for both graphics and experiments

			// Calculate how many items fit within a given column budget (maxColumns).
			// Graphics dividers and title rows are included in the slice but do not consume column budget.
			// Used to cap initial display (2 rows) and each subsequent "Load More" (2 rows) on desktop
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
					while (n < remainingItems.length && isGraphicsBatchDeferrableTailItem(remainingItems[n - 1])) {
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

				// Each click:
				// - Desktop: ~2 additional rows (20 columns)
				// - Mobile: 4 more content items (+ dividers in the same slice)
				let rawBatchCount;
				if (isMobile) {
					rawBatchCount = countMobileBatchItems(remainingItems, 4);
				} else {
					rawBatchCount = calculateDisplayCount(remainingItems, 20);
				}
				const batchCount = adjustBatchCountForTrailingDividers(remainingItems, rawBatchCount);

				if (batchCount === 0) {
					loadMoreBtn.classList.add("hidden");
					divider.classList.add("hidden");
					return;
				}

				const batch = remainingItems.slice(0, batchCount);

				for (let i = 0; i < batch.length; i++) {
					await renderFunction(batch[i], grid);
				}
				displayedCount += batch.length;

				// Setup lazy loading for new images
				setupLazyLoading();

				if (displayedCount >= allItems.length) {
					loadMoreBtn.classList.add("hidden");
					divider.classList.add("hidden");
				}
			}

			loadMoreBtn.addEventListener("click", function () {
				displayNextBatch();
			});

			// Display first batch (limited for experiments/graphics)
			displayedCount = 0;
			const firstBatch = allItems.slice(0, initialDisplayCount);
			(async function () {
				for (let i = 0; i < firstBatch.length; i++) {
					await renderFunction(firstBatch[i], grid);
				}
				displayedCount = firstBatch.length;

				// Setup lazy loading for new images
				setupLazyLoading();

				if (displayedCount >= allItems.length) {
					loadMoreBtn.classList.add("hidden");
					divider.classList.add("hidden");
				} else {
					divider.classList.remove("hidden");
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
