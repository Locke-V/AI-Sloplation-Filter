"use strict";

const enabled = document.querySelector("#enabled");
const blockedInput = document.querySelector("#blockedInput");
const allowedInput = document.querySelector("#allowedInput");
const sortCleanFirst = document.querySelector("#sortCleanFirst");
const saveButton = document.querySelector("#saveButton");
const resetButton = document.querySelector("#resetButton");
const exportButton = document.querySelector("#exportButton");
const importInput = document.querySelector("#importInput");
const status = document.querySelector("#status");

let currentSettings = null;

function getSelectedMode() {
  return document.querySelector("input[name='mode']:checked").value;
}

function setSelectedMode(mode) {
  const input = document.querySelector(`input[name='mode'][value='${mode}']`);
  if (input) {
    input.checked = true;
  }
}

function render(settings) {
  currentSettings = settings;
  enabled.checked = settings.enabled;
  sortCleanFirst.checked = settings.sortCleanFirst;
  setSelectedMode(settings.mode);
  blockedInput.value = settings.blockedGroups.join("\n");
  allowedInput.value = settings.allowedGroups.join("\n");
}

function collect() {
  return mgaifMergeSettings({
    ...currentSettings,
    enabled: enabled.checked,
    showToast: false,
    mode: getSelectedMode(),
    sortCleanFirst: sortCleanFirst.checked,
    blockedGroups: mgaifCleanList(blockedInput.value),
    allowedGroups: mgaifCleanList(allowedInput.value)
  });
}

function setStatus(message) {
  status.textContent = message;
}

async function save() {
  currentSettings = collect();
  await mgaifSaveSettings(currentSettings);
  setStatus("Saved.");
}

async function reset() {
  render(mgaifMergeSettings(MGAIF_DEFAULT_SETTINGS));
  await save();
  setStatus("Reset to the starter list.");
}

function exportSettings() {
  const blob = new Blob([JSON.stringify(collect(), null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ai-sloplation-filter-settings.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importSettings(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const settings = mgaifMergeSettings(parsed);
    render(settings);
    await mgaifSaveSettings(settings);
    setStatus("Imported.");
  } catch (_error) {
    setStatus("That file was not valid filter settings.");
  } finally {
    importInput.value = "";
  }
}

saveButton.addEventListener("click", save);
resetButton.addEventListener("click", reset);
exportButton.addEventListener("click", exportSettings);
importInput.addEventListener("change", importSettings);

mgaifLoadSettings().then((settings) => {
  render(settings);
  setStatus("Ready.");
});