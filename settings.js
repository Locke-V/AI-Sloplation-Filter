"use strict";

const MGAIF_STORAGE_KEY = "mgaifSettings";

const MGAIF_DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  mode: "hide",
  showToast: true,
  blockedGroups: ["Desire Scans", "Myth Toons", "Kaizen", "Spring", "Springtoons", "Desire"],
  allowedGroups: ["OccultScans"]
});

function mgaifCleanList(value) {
  const lines = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/\r?\n|,/);

  return Array.from(
    new Set(lines.map((line) => String(line || "").trim()).filter(Boolean))
  );
}

function mgaifMergeSettings(value) {
  const source = value && typeof value === "object" ? value : {};

  return {
    ...MGAIF_DEFAULT_SETTINGS,
    ...source,
    blockedGroups: mgaifCleanList(source.blockedGroups || MGAIF_DEFAULT_SETTINGS.blockedGroups),
    allowedGroups: mgaifCleanList(source.allowedGroups || MGAIF_DEFAULT_SETTINGS.allowedGroups)
  };
}

async function mgaifLoadSettings() {
  const stored = await chrome.storage.local.get(MGAIF_STORAGE_KEY);
  return mgaifMergeSettings(stored[MGAIF_STORAGE_KEY]);
}

async function mgaifSaveSettings(settings) {
  await chrome.storage.local.set({
    [MGAIF_STORAGE_KEY]: mgaifMergeSettings(settings)
  });
}

