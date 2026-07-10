"use strict";

const MGAIF_STORAGE_KEY = "mgaifSettings";
const MGAIF_API = globalThis.browser || globalThis.chrome;

const MGAIF_DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  mode: "hide",
  showToast: false,
  sortCleanFirst: true,
  blockedGroups: ["Desire Scans", "Myth Toons", "Kaizen", "Spring", "Springtoons", "Desire"],
  allowedGroups: []
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
  const allowedGroups = mgaifCleanList(source.allowedGroups || MGAIF_DEFAULT_SETTINGS.allowedGroups);

  return {
    ...MGAIF_DEFAULT_SETTINGS,
    ...source,
    blockedGroups: mgaifCleanList(source.blockedGroups).length ? mgaifCleanList(source.blockedGroups) : MGAIF_DEFAULT_SETTINGS.blockedGroups,
    showToast: false,
    sortCleanFirst: source.sortCleanFirst !== false,
    allowedGroups: allowedGroups.filter((item, _index, list) => {
      return !(list.length === 1 && item.toLowerCase() === "occultscans");
    })
  };
}

async function mgaifLoadSettings() {
  const stored = await MGAIF_API.storage.local.get(MGAIF_STORAGE_KEY);
  return mgaifMergeSettings(stored[MGAIF_STORAGE_KEY]);
}

async function mgaifSaveSettings(settings) {
  await MGAIF_API.storage.local.set({
    [MGAIF_STORAGE_KEY]: mgaifMergeSettings(settings)
  });
}
