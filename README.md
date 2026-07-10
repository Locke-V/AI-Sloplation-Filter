# AI Sloplation Filter

A Firefox and Brave/Chromium extension that hides or dims Mangago items from uploader groups you block.

## What It Does

- Filters visible chapter, update, and notice items on Mangago.
- Adds an unfiltered chapter count beside `Chapters(...)`.
- Uses a local blocklist and allowlist.
- Lets you hide matches or dim them with a label.
- Can move unfiltered chapters above dimmed filtered rows.
- Imports and exports settings as JSON.
- Stores everything in your browser.

## Starter Lists

Blocked: Desire Scans, Myth Toons, Kaizen, Spring, Springtoons, Desire

Allowed: blank by default

## Install Locally

1. Open `brave://extensions` or `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this repo folder.

## Install Temporarily in Firefox

1. Extract the Firefox ZIP.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on**.
4. Select `manifest.json` inside the extracted folder.

Temporary add-ons are removed when Firefox closes. A permanent Firefox install must be signed through Mozilla Add-ons.

## Store Assets

Chrome Web Store assets are in `assets/`:

- `screenshot-hidden-1280x800.png`
- `screenshot-dimmed-1280x800.png`
- `promo-small-440x280.png`
- `promo-marquee-1400x560.png`
- `icon-128.png`

## Privacy

No accounts. No analytics. No remote code. No page content is sent anywhere.

This is a local page filter, so it cannot change Mangago's server-side notification system.


