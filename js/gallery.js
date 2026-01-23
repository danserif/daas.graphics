// gallery.js
// Graphics / Clients + Experiments / Lab 

document.addEventListener("DOMContentLoaded", function () {
	const ITEMS_PER_PAGE = 12;

	// Development controls: Temporarily disable JSON loading
	// Set to true to skip loading graphics.json and experiments.json
	const DISABLE_JSON_LOADING = true; // Change to false to re-enable

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
			}
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

	// Create an image element with shared behavior (dataset src, alt, lazy loading, aspect ratio)
	function createWorkImage(src, altText) {
		const img = document.createElement("img");
		img.className = "work-image";
		img.dataset.src = src;
		img.alt = altText || "";
		img.loading = "lazy";

		// Set aspect ratio from image dimensions
		const tempImg = new Image();
		tempImg.onload = function () {
			const aspectRatio = this.naturalWidth / this.naturalHeight;
			img.style.aspectRatio = aspectRatio.toString();
		};
		tempImg.src = src;

		return img;
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

	// Render Graphics/Clients item
	function renderGraphicsItem(item, container) {
		const workItem = document.createElement("div");
		workItem.className = "work-item";
		// Allow 1, 2, 3, or 4 columns, default to 1
		const columns = item.columns && [1, 2, 3, 4].includes(item.columns) ? item.columns : 1;
		workItem.setAttribute("data-columns", columns);

		// Determine if we have image, logo, or both
		const hasImage = item.filename;
		const hasLogo = item.logo;

		if (hasImage) {
			// Alt text: client - description (fallbacks to client, then description, then filename)
			let altText = "";
			if (item.client && item.description) {
				altText = item.client + " - " + item.description;
			} else if (item.client) {
				altText = item.client;
			} else if (item.description) {
				altText = item.description;
			} else if (item.filename) {
				altText = item.filename;
			}
			// Graphics images now live in /images/work
			const img = createWorkImage("/images/work/" + item.filename, altText);
			workItem.appendChild(img);
		} else if (hasLogo) {
			const logoImg = document.createElement("img");
			logoImg.className = "work-item-logo";
			logoImg.src = "/images/logos/" + item.logo;
			logoImg.alt = item.client || item.logo;
			// Mark logo-only items so we can style them differently on mobile
			workItem.classList.add("work-logo-item");
			workItem.appendChild(logoImg);
		}

		// Caption
		const caption = document.createElement("div");
		caption.className = "work-caption";

		// Graphics: name // description
		const metaLine = buildWorkTextLine(item.client, item.description, "work-client");
		if (metaLine && metaLine.childNodes.length > 0) {
			caption.appendChild(metaLine);
		}

		if (item.filename || item.logo) {
			const fileToShow = item.filename || item.logo;
			// Images live in /images/work, logos in /images/logos
			const path = item.filename ? "/images/work/" : "/images/logos/";

			// Get file size for images (not logos)
			const sizeUrl = item.filename ? path + fileToShow : null;
			buildWorkFilenameLine(path, fileToShow, sizeUrl).then(function (filenameEl) {
				caption.appendChild(filenameEl);
			});
		}

		workItem.appendChild(caption);
		container.appendChild(workItem);
	}

	// Render Experiments/Lab item
	async function renderExperimentItem(item, container) {
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
			// Alt text: Number - description (fallbacks to number, then description, then filename)
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

			const img = createWorkImage("/images/lab/" + item.filename, altText);
			workItem.appendChild(img);
		}

		// Caption
		const caption = document.createElement("div");
		caption.className = "work-caption";

		// Experiments: Number // Description
		const metaLine = buildWorkTextLine(
			itemNumber ? itemNumber.toUpperCase() : "",
			item.description,
			"work-number"
		);
		if (metaLine && metaLine.childNodes.length > 0) {
			caption.appendChild(metaLine);
		}

		if (item.filename) {
			const displayName = pathFilename;
			const basePath = "/images/lab/";
			const sizeUrl = basePath + item.filename;
			const filenameEl = await buildWorkFilenameLine(basePath, displayName, sizeUrl);
			caption.appendChild(filenameEl);
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
				if (sectionType === "graphics" && iconText === "G") {
					section = sections[i];
					break;
				} else if (sectionType === "experiments" && iconText === "¶") {
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

		// Create divider before load more button
		const divider = document.createElement("hr");
		divider.className = "divider";
		workContent.appendChild(divider);

		// Create load more button
		const loadMoreBtn = document.createElement("button");
		loadMoreBtn.className = "load-more-button";
		loadMoreBtn.innerHTML = 'Load More <span class="accent">></span>';
		workContent.appendChild(loadMoreBtn);

		let allItems = [];
		let displayedCount = 0;

		try {
			const response = await fetch(jsonPath);
			const data = await response.json();
			allItems = data.items || [];

			// Use JSON array order for both graphics and experiments

			// Calculate how many items fit within a given column budget (maxColumns)
			// Used to cap initial display (2 rows) and each subsequent "Load More" row (1 row) on desktop
			function calculateDisplayCount(items, maxColumns) {
				let totalColumns = 0;
				let count = 0;

				for (let i = 0; i < items.length; i++) {
					const item = items[i];
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

			// Detect mobile layout (single-column work grid)
			const isMobile = window.matchMedia("(max-width: 980px)").matches;

			// Initial display:
			// - Desktop: max 2 rows (20 columns at largest breakpoint)
			// - Mobile: max 4 items
			const initialDisplayCount = isMobile
				? Math.min(4, allItems.length)
				: calculateDisplayCount(allItems, 20);

			async function displayNextBatch() {
				const remainingItems = allItems.slice(displayedCount);

				// Each click:
				// - Desktop: loads approximately one additional row (10 columns)
				// - Mobile: loads 2 more items
				let batchCount;
				if (isMobile) {
					batchCount = Math.min(2, remainingItems.length);
				} else {
					batchCount = calculateDisplayCount(remainingItems, 10); // 1 row × 10 columns
				}

				if (batchCount === 0) {
					// Nothing more to show
					loadMoreBtn.classList.add("hidden");
					return;
				}

				const batch = remainingItems.slice(0, batchCount);

				for (let i = 0; i < batch.length; i++) {
					await renderFunction(batch[i], grid);
				}
				displayedCount += batch.length;

				// Setup lazy loading for new images
				setupLazyLoading();

				// Hide button if all items are displayed
				if (displayedCount >= allItems.length) {
					loadMoreBtn.classList.add("hidden");
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

				// Hide button if all items are displayed
				if (displayedCount >= allItems.length) {
					loadMoreBtn.classList.add("hidden");
				}
			})().catch(function (error) {
				console.error("Error displaying batch:", error);
			});
		} catch (error) {
			console.error("Error loading work gallery:", error);
			workContent.innerHTML = "<p class='opacity-50'>Error loading gallery.</p>";
		}
	}

	// Initialize both galleries (only if not disabled)
	if (!DISABLE_JSON_LOADING) {
		initWorkGallery("graphics", "/data/graphics.json", renderGraphicsItem);
		initWorkGallery("experiments", "/data/experiments.json", renderExperimentItem);
	}
});

