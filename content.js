(() => {
  "use strict";

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    mode: "hide",
    showToast: true,
    blockedGroups: ["Desire Scans", "Myth Toons", "Kaizen", "Spring", "Springtoons", "Desire"],
    allowedGroups: ["OccultScans"]
  });

  const STORAGE_KEY = "mgaifSettings";
  const FILTERED_ATTR = "data-mgaif-filtered";
  const BADGE_CLASS = "mgaif-badge";
  const COUNT_BADGE_CLASS = "mgaif-count-badge";
  const HIDDEN_CLASS = "mgaif-hidden";
  const DIMMED_CLASS = "mgaif-dimmed";

  const ITEM_SELECTORS = [
    "tr",
    "li",
    ".chapter",
    ".chapter-list",
    ".chapter-list-item",
    ".episode",
    ".update",
    ".update-item",
    ".notification",
    ".notification-item",
    ".notice",
    ".notice-item",
    ".feed-item",
    ".list-item",
    ".row",
    ".item",
    "[class*='chapter']",
    "[class*='update']",
    "[class*='notice']",
    "[class*='notification']"
  ].join(",");

  const TEXT_SELECTORS = [
    "a",
    "td",
    "span",
    "p",
    "div",
    "em",
    "strong",
    "b",
    "i"
  ].join(",");

  let settings = { ...DEFAULT_SETTINGS };
  let observer = null;
  let toastTimer = null;
  let lastHiddenCount = 0;
  let observerStarted = false;

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function mergeSettings(saved) {
    const source = saved && typeof saved === "object" ? saved : {};
    return {
      ...DEFAULT_SETTINGS,
      ...source,
      blockedGroups: cleanList(source.blockedGroups || DEFAULT_SETTINGS.blockedGroups),
      allowedGroups: cleanList(source.allowedGroups || DEFAULT_SETTINGS.allowedGroups)
    };
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

  function getText(element) {
    return element ? element.textContent || "" : "";
  }

  function isChapterEntryText(text) {
    const trimmed = String(text || "").trim();
    return /(^|\s)(ch\.|chapter)\s*\d+/i.test(trimmed) ||
      /(^|\s)(promo|notice)\./i.test(trimmed);
  }

  function matchesAny(text, list) {
    const normalizedText = normalize(text);
    return list.find((name) => {
      const normalizedName = normalize(name);
      return normalizedName && normalizedText.includes(normalizedName);
    });
  }

  function isAllowed(text) {
    return Boolean(matchesAny(text, settings.allowedGroups));
  }

  function findBlockedGroup(text) {
    if (isAllowed(text)) {
      return "";
    }

    return matchesAny(text, settings.blockedGroups) || "";
  }

  function hasPageSignals(element) {
    const text = normalize(getText(element));
    const link = element.matches("a") ? element : element.querySelector("a[href]");
    const href = link ? String(link.getAttribute("href") || "") : "";

    return (
      text.includes("chapter") ||
      text.includes("chap") ||
      text.includes("update") ||
      text.includes("upload") ||
      text.includes("scan") ||
      text.includes("toon") ||
      text.includes("notification") ||
      /read-manga|chapter|manga|notice|notification/i.test(href)
    );
  }

  function findBestContainer(node) {
    const base = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!base || !document.body.contains(base)) {
      return null;
    }

    const row = base.closest(ITEM_SELECTORS);
    if (row && row !== document.body && row !== document.documentElement && hasPageSignals(row)) {
      return row;
    }

    return null;
  }

  function getCandidateElements() {
    const direct = Array.from(document.querySelectorAll(ITEM_SELECTORS));
    const textMatches = [];

    for (const element of document.querySelectorAll(TEXT_SELECTORS)) {
      const text = getText(element);
      if (findBlockedGroup(text)) {
        const container = findBestContainer(element);
        if (container) {
          textMatches.push(container);
        }
      }
    }

    const candidates = Array.from(new Set([...direct, ...textMatches])).filter((element) => {
      if (!element || element === document.body || element === document.documentElement) {
        return false;
      }

      const text = getText(element);
      return text && findBlockedGroup(text) && hasPageSignals(element);
    });

    return candidates.filter((element) => {
      return !candidates.some((other) => other !== element && element.contains(other));
    });
  }

  function getChapterEntries() {
    const candidates = Array.from(document.querySelectorAll(ITEM_SELECTORS)).filter((element) => {
      if (!element || element === document.body || element === document.documentElement) {
        return false;
      }

      return isChapterEntryText(getText(element));
    });

    return candidates.filter((element) => {
      return !candidates.some((other) => other !== element && element.contains(other));
    });
  }

  function findChapterCountTarget() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();

    while (node) {
      if (/Chapters\s*\(\s*\d+\s*\)/i.test(node.nodeValue || "")) {
        return node.parentElement;
      }

      node = walker.nextNode();
    }

    return null;
  }

  function getTotalChapterCount(target) {
    const match = getText(target).match(/Chapters\s*\(\s*(\d+)\s*\)/i);
    return match ? Number.parseInt(match[1], 10) : 0;
  }

  function updateChapterCountSummary() {
    for (const badge of document.querySelectorAll(`.${COUNT_BADGE_CLASS}`)) {
      badge.remove();
    }

    const target = findChapterCountTarget();
    if (!target) {
      return;
    }

    const total = getTotalChapterCount(target);
    if (!Number.isFinite(total) || total <= 0) {
      return;
    }

    const entries = getChapterEntries();
    const filteredEntries = entries.filter((element) => element.hasAttribute(FILTERED_ATTR)).length;
    const visibleCount = Math.max(0, total - filteredEntries);

    const badge = document.createElement("span");
    badge.className = COUNT_BADGE_CLASS;
    badge.textContent = `${visibleCount} unfiltered`;
    badge.title = `${visibleCount} of ${total} chapter entries are not hidden by AI Sloplation Filter.`;
    target.appendChild(badge);
  }

  function clearMarks() {
    for (const element of document.querySelectorAll(`[${FILTERED_ATTR}]`)) {
      element.classList.remove(HIDDEN_CLASS, DIMMED_CLASS);
      element.removeAttribute(FILTERED_ATTR);
      element.removeAttribute("title");
    }

    for (const badge of document.querySelectorAll(`.${BADGE_CLASS}`)) {
      badge.remove();
    }
  }

  function addBadge(element, group) {
    if (settings.mode !== "dim" || element.querySelector(`.${BADGE_CLASS}`)) {
      return;
    }

    const badge = document.createElement("span");
    badge.className = BADGE_CLASS;
    badge.textContent = `Filtered: ${group}`;

    const anchor = element.querySelector("a") || element.firstElementChild || element;
    anchor.appendChild(badge);
  }

  function applyMark(element, group) {
    element.setAttribute(FILTERED_ATTR, group);
    element.classList.toggle(HIDDEN_CLASS, settings.mode === "hide");
    element.classList.toggle(DIMMED_CLASS, settings.mode === "dim");
    element.title = `Mangago AI Upload Filter matched ${group}`;
    addBadge(element, group);
  }

  function filterPage() {
    if (observer) {
      observer.disconnect();
    }

    if (!settings.enabled) {
      clearMarks();
      updateChapterCountSummary();
      updateCount(0);
      restartObserver();
      return;
    }

    clearMarks();

    let hiddenCount = 0;
    for (const element of getCandidateElements()) {
      const group = findBlockedGroup(getText(element));
      if (group) {
        applyMark(element, group);
        hiddenCount += 1;
      }
    }

    updateCount(hiddenCount);
    updateChapterCountSummary();
    restartObserver();
  }

  function updateCount(count) {
    lastHiddenCount = count;
    try {
      chrome.runtime.sendMessage({ type: "mgaif-count", count }, () => {
        void chrome.runtime.lastError;
      });
    } catch (_error) {
      // Popup may not be open.
    }

    if (!settings.showToast || count === 0) {
      removeToast();
      return;
    }

    showToast(`${count} Mangago item${count === 1 ? "" : "s"} filtered.`);
  }

  function showToast(message) {
    let toast = document.querySelector(".mgaif-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "mgaif-toast";
      document.documentElement.appendChild(toast);
    }

    toast.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(removeToast, 2800);
  }

  function removeToast() {
    const toast = document.querySelector(".mgaif-toast");
    if (toast) {
      toast.remove();
    }
  }

  function scheduleFilter() {
    window.clearTimeout(scheduleFilter.timer);
    scheduleFilter.timer = window.setTimeout(filterPage, 120);
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
      subtree: true
    });
  }

  async function loadSettings() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    settings = mergeSettings(stored[STORAGE_KEY]);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) {
      return;
    }

    settings = mergeSettings(changes[STORAGE_KEY].newValue);
    scheduleFilter();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "mgaif-get-count") {
      return false;
    }

    sendResponse({ count: lastHiddenCount });
    return true;
  });

  loadSettings()
    .then(() => {
      filterPage();
      startObserver();
    })
    .catch(() => {
      settings = { ...DEFAULT_SETTINGS };
      filterPage();
      startObserver();
    });
})();

