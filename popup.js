"use strict";

const enabled = document.querySelector("#enabled");
const blockedInput = document.querySelector("#blockedInput");
const allowedInput = document.querySelector("#allowedInput");
const saveButton = document.querySelector("#saveButton");
const optionsButton = document.querySelector("#optionsButton");
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
  setSelectedMode(settings.mode);
  blockedInput.value = settings.blockedGroups.join("\n");
  allowedInput.value = settings.allowedGroups.join("\n");
}

function collect() {
  return mgaifMergeSettings({
    ...currentSettings,
    enabled: enabled.checked,
    mode: getSelectedMode(),
    blockedGroups: mgaifCleanList(blockedInput.value),
    allowedGroups: mgaifCleanList(allowedInput.value)
  });
}

function setStatus(message) {
  status.textContent = message;
  window.setTimeout(() => {
    status.textContent = currentSettings && currentSettings.enabled
      ? "Local filtering is on."
      : "Local filtering is off.";
  }, 1800);
}

async function save() {
  currentSettings = collect();
  await mgaifSaveSettings(currentSettings);
  setStatus("Saved.");
}

saveButton.addEventListener("click", save);
enabled.addEventListener("change", save);

for (const input of document.querySelectorAll("input[name='mode']")) {
  input.addEventListener("change", save);
}

optionsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

mgaifLoadSettings().then((settings) => {
  render(settings);
  status.textContent = settings.enabled ? "Local filtering is on." : "Local filtering is off.";
});
