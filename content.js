(() => {
  const extensionApi = globalThis.browser || globalThis.chrome;
  "use strict";

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    mode: "hide",
    showToast: false,
    sortCleanFirst: true,
    blockedGroups: ["Desire Scans", "Myth Toons", "Kaizen", "Spring", "Springtoons", "Desire"],
    allowedGroups: []
  });

  const STORAGE_KEY = "mgaifSettings";
  const FILTERED_ATTR = "data-mgaif-filtered";
  const FILTERED_CHAPTER_ATTR = "data-mgaif-filtered-chapter";
  const CHAPTER_LIST_ATTR = "data-mgaif-chapter-list";
  const ORIGINAL_ORDER_ATTR = "data-mgaif-original-order";
  const MODE_ATTR = "data-mgaif-mode";
  const BADGE_CLASS = "mgaif-badge";
  const COUNT_BADGE_CLASS = "mgaif-count-badge";

  let settings = { ...DEFAULT_SETTINGS };
  let observer = null;
  let observerStarted = false;
  let originalOrderCounter = 0;
  let lastFilteredCount = 0;

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function cleanList(list) {
    return Array.from(
      new Set(
        (Array.isArray(list) ? list : [])
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      )
    );
  }

  function removeOldDefaultAllowList(list) {
    const cleaned = cleanList(list);
    if (cleaned.length === 1 && normalize(cleaned[0]) === "occultscans") {
      return [];
    }

    return cleaned;
  }

  function mergeSettings(saved) {
    const source = saved && typeof saved === "object" ? saved : {};
    const hasAllowedGroups = Object.prototype.hasOwnProperty.call(source, "allowedGroups");
    const blockedGroups = cleanList(source.blockedGroups);

    return {
      ...DEFAULT_SETTINGS,
      ...source,
      showToast: false,
      sortCleanFirst: source.sortCleanFirst !== false,
      blockedGroups: blockedGroups.length ? blockedGroups : DEFAULT_SETTINGS.blockedGroups,
      allowedGroups: removeOldDefaultAllowList(hasAllowedGroups ? source.allowedGroups : DEFAULT_SETTINGS.allowedGroups)
    };
  }

  function getText(element) {
    return element ? element.textContent || "" : "";
  }

  function isChapterEntryText(text) {
    const trimmed = String(text || "").trim();
    return /(^|\s)(ch\.|chapter)\s*\d+/i.test(trimmed) ||
      /(^|\s)(promo|notice)\./i.test(trimmed);
  }

  function isUploaderHref(href) {
    return /\/home\/people\/\d+\/upload\/?/i.test(String(href || ""));
  }

  function isChapterHref(href) {
    return /\/read-manga\/[^/]+\/.*(?:br_chapter-|iur_chapter-|chapter-).*\/pg-\d+\/?/i.test(String(href || ""));
  }

  function matchesAny(text, list) {
    const normalizedText = normalize(text);
    return list.find((name) => {
      const normalizedName = normalize(name);
      return normalizedName && normalizedText.includes(normalizedName);
    });
  }

  function findBlockedGroup(text) {
    if (!text || matchesAny(text, settings.allowedGroups)) {
      return "";
    }

    return matchesAny(text, settings.blockedGroups) || "";
  }

  function closestUsefulContainer(link) {
    const tableRow = link.closest("tr");
    if (tableRow) {
      return tableRow;
    }

    const listRow = link.closest("li");
    if (listRow) {
      return listRow;
    }

    let current = link.parentElement;
    let fallback = link;

    while (current && current !== document.body && current !== document.documentElement) {
      const chapterLinks = Array.from(current.querySelectorAll("a[href]")).filter((item) => {
        return isChapterHref(item.getAttribute("href"));
      });
      const uploaderLinks = Array.from(current.querySelectorAll("a[href]")).filter((item) => {
        return isUploaderHref(item.getAttribute("href"));
      });

      if (chapterLinks.length <= 1 && uploaderLinks.length <= 1) {
        fallback = current;
        current = current.parentElement;
        continue;
      }

      break;
    }

    return fallback;
  }

  function uniqueElements(elements) {
    return Array.from(new Set(elements.filter(Boolean)));
  }

  function buildChapterItems() {
    const anchors = Array.from(document.querySelectorAll("a[href]"));
    const items = [];
    let currentItem = null;

    for (const anchor of anchors) {
      const href = anchor.getAttribute("href");

      if (isChapterHref(href)) {
        const chapterContainer = closestUsefulContainer(anchor);
        const labelText = `${getText(anchor)} ${getText(chapterContainer)}`;
        if (!isChapterEntryText(labelText)) {
          currentItem = null;
          continue;
        }

        currentItem = {
          chapterLink: anchor,
          chapterContainer,
          uploaderLink: null,
          uploaderContainer: null
        };
        items.push(currentItem);
        continue;
      }

      if (isUploaderHref(href) && currentItem && !currentItem.uploaderLink) {
        currentItem.uploaderLink = anchor;
        currentItem.uploaderContainer = closestUsefulContainer(anchor);
      }
    }

    return items;
  }

  function getItemElements(item) {
    return uniqueElements([item.chapterContainer, item.uploaderContainer]);
  }

  function getItemUploaderText(item) {
    if (item.uploaderLink) {
      return getText(item.uploaderLink).trim();
    }

    return getItemElements(item).map(getText).join(" ");
  }

  function findChapterCountNode() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (/Chapters\s*\(\s*\d+\s*\)/i.test(node.nodeValue || "")) {
          return NodeFilter.FILTER_ACCEPT;
        }

        return NodeFilter.FILTER_SKIP;
      }
    });

    return walker.nextNode();
  }

  function getTotalChapterCountFromNode(node) {
    const match = String(node ? node.nodeValue : "").match(/Chapters\s*\(\s*(\d+)\s*\)/i);
    return match ? Number.parseInt(match[1], 10) : 0;
  }
  function isVisibleTableRow(row) {
    return window.getComputedStyle(row).display !== "none";
  }

  function getVisibleChapterTableRowCount() {
    const rows = Array.from(document.querySelectorAll("#chapter_table tr"));
    if (!rows.length) {
      return 0;
    }

    return rows.filter(isVisibleTableRow).length;
  }

  function markChapterTableWrapper() {
    const table = document.querySelector("#chapter_table");
    if (table && table.parentElement) {
      table.parentElement.setAttribute(CHAPTER_LIST_ATTR, "true");
    }
  }

  function updatePageMode() {
    if (!settings.enabled) {
      document.documentElement.removeAttribute(MODE_ATTR);
      return;
    }

    document.documentElement.setAttribute(MODE_ATTR, settings.mode === "dim" ? "dim" : "hide");
  }

  function clearFilteredState() {
    for (const element of document.querySelectorAll(`[${FILTERED_ATTR}], [${FILTERED_CHAPTER_ATTR}], .mgaif-hidden, .mgaif-dimmed`)) {
      element.removeAttribute(FILTERED_ATTR);
      element.removeAttribute(FILTERED_CHAPTER_ATTR);
      element.classList.remove("mgaif-hidden", "mgaif-dimmed");
      element.removeAttribute("title");
    }

    for (const badge of document.querySelectorAll(`.${BADGE_CLASS}`)) {
      badge.remove();
    }
  }

  function addBadge(item, group) {
    if (settings.mode !== "dim") {
      return;
    }

    const target = item.chapterLink || item.chapterContainer;
    if (!target || target.parentElement.querySelector(`.${BADGE_CLASS}`)) {
      return;
    }

    const badge = document.createElement("span");
    badge.className = BADGE_CLASS;
    badge.textContent = `Filtered: ${group}`;
    target.insertAdjacentElement("afterend", badge);
  }

  function tagFilteredItem(item, group) {
    if (item.chapterContainer) {
      item.chapterContainer.setAttribute(FILTERED_CHAPTER_ATTR, group);
    }

    for (const element of getItemElements(item)) {
      element.setAttribute(FILTERED_ATTR, group);
      element.title = `AI Sloplation Filter matched ${group}`;
    }

    addBadge(item, group);
  }

  function updateChapterCountSummary(filteredCount = null) {
    for (const badge of document.querySelectorAll(`.${COUNT_BADGE_CLASS}`)) {
      badge.remove();
    }

    const countNode = findChapterCountNode();
    if (!countNode || !countNode.parentElement) {
      return;
    }

    const total = getTotalChapterCountFromNode(countNode);
    if (!Number.isFinite(total) || total <= 0) {
      return;
    }

    const visibleTableRows = settings.enabled && settings.mode === "hide" ? getVisibleChapterTableRowCount() : 0;
    const taggedFilteredCount = document.querySelectorAll(`[${FILTERED_CHAPTER_ATTR}]`).length;
    const effectiveFilteredCount = taggedFilteredCount || (Number.isFinite(filteredCount) ? filteredCount : 0);
    const visibleCount = visibleTableRows > 0 && visibleTableRows < total
      ? visibleTableRows
      : Math.max(0, total - Math.min(total, effectiveFilteredCount));
    const badge = document.createElement("span");
    badge.className = COUNT_BADGE_CLASS;
    badge.textContent = ` (${visibleCount} unfiltered)`;
    badge.title = `${visibleCount} of ${total} chapter entries are not filtered by AI Sloplation Filter.`;
    countNode.parentElement.insertBefore(badge, countNode.nextSibling);
  }

  function rememberOriginalOrder(items) {
    for (const item of items) {
      const row = item.chapterContainer;
      if (row && !row.hasAttribute(ORIGINAL_ORDER_ATTR)) {
        row.setAttribute(ORIGINAL_ORDER_ATTR, String(originalOrderCounter));
        originalOrderCounter += 1;
      }
    }
  }

  function getOriginalOrder(item) {
    return Number.parseInt(item.chapterContainer.getAttribute(ORIGINAL_ORDER_ATTR) || "0", 10) || 0;
  }

  function sortChapterItems(items) {
    if (!(settings.mode === "dim" && settings.sortCleanFirst) || items.length < 2) {
      return;
    }

    rememberOriginalOrder(items);

    const sortable = items.filter((item) => {
      return item.chapterContainer && item.chapterContainer.parentElement;
    });
    const parents = Array.from(new Set(sortable.map((item) => item.chapterContainer.parentElement)));

    for (const parent of parents) {
      const siblings = sortable.filter((item) => item.chapterContainer.parentElement === parent);
      if (siblings.length < 2) {
        continue;
      }

      const sorted = siblings.slice().sort((a, b) => {
        const aFiltered = getItemElements(a).some((element) => element.hasAttribute(FILTERED_ATTR));
        const bFiltered = getItemElements(b).some((element) => element.hasAttribute(FILTERED_ATTR));

        if (aFiltered !== bFiltered) {
          return aFiltered ? 1 : -1;
        }

        return getOriginalOrder(a) - getOriginalOrder(b);
      });

      for (const item of sorted) {
        parent.appendChild(item.chapterContainer);
      }
    }
  }

  function updateCount(count) {
    lastFilteredCount = count;
    try {
      const pending = extensionApi.runtime.sendMessage({ type: "mgaif-count", count });
      if (pending && typeof pending.catch === "function") {
        pending.catch(() => {});
      }
    } catch (_error) {
      // Popup may not be open.
    }
  }

  function filterPage() {
    if (observer) {
      observer.disconnect();
    }

    updatePageMode();
    markChapterTableWrapper();
    clearFilteredState();

    const items = buildChapterItems();
    rememberOriginalOrder(items);

    if (!settings.enabled) {
      updateCount(0);
      sortChapterItems(items);
      updateChapterCountSummary(0);
      restartObserver();
      return;
    }

    const matches = items
      .map((item) => ({ item, group: findBlockedGroup(getItemUploaderText(item)) }))
      .filter((match) => Boolean(match.group));

    for (const { item, group } of matches) {
      tagFilteredItem(item, group);
    }

    sortChapterItems(items);
    updateCount(matches.length);
    updateChapterCountSummary(matches.length);
    window.setTimeout(() => updateChapterCountSummary(matches.length), 50);
    window.setTimeout(() => updateChapterCountSummary(matches.length), 250);
    restartObserver();
  }

  function scheduleFilter(delay = 120) {
    window.clearTimeout(scheduleFilter.timer);
    scheduleFilter.timer = window.setTimeout(filterPage, delay);
  }

  function scheduleStartupPasses() {
    scheduleFilter(200);
    window.setTimeout(scheduleFilter, 900);
    window.setTimeout(scheduleFilter, 2200);
    window.setTimeout(scheduleFilter, 4200);
  }

  function startObserver() {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver(scheduleFilter);
    observerStarted = true;
    restartObserver();
  }

  function restartObserver() {
    if (!observer || !observerStarted) {
      return;
    }

    observer.observe(document.documentElement, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  async function loadSettings() {
    const stored = await extensionApi.storage.local.get(STORAGE_KEY);
    settings = mergeSettings(stored[STORAGE_KEY]);
  }

  extensionApi.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) {
      return;
    }

    settings = mergeSettings(changes[STORAGE_KEY].newValue);
    filterPage();
  });

  extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "mgaif-get-count") {
      return false;
    }

    sendResponse({ count: lastFilteredCount });
    return true;
  });

  loadSettings()
    .then(() => {
      filterPage();
      startObserver();
      scheduleStartupPasses();
    })
    .catch(() => {
      settings = { ...DEFAULT_SETTINGS };
      filterPage();
      startObserver();
      scheduleStartupPasses();
    });
})();
