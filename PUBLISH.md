# Publishing ClinicalBuddy to the Chrome Web Store

## Does it need approval?

**Yes.** Every extension is reviewed by Chrome before it goes live. Review usually takes a few days. You get an email when it’s approved, rejected, or if more info is needed.

---

## How to deploy

### 1. Register a developer account (one-time)

- Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
- Sign in with the Google account you want as the developer.
- Pay the **one-time registration fee** (currently $5).
- Complete the developer agreement.

### 2. Create the upload package

Only include files the extension needs at runtime. Exclude dev/build artifacts.

**Option A – Use the script (recommended):**

```bash
cd extension
./pack-for-store.sh
```

This creates `clinicalbuddy-extension.zip` in the `extension` folder.

**Option B – Manual zip:**

From the `extension` folder, zip:

- `manifest.json`
- `background.js`
- `content.js`, `content.css`
- `sidepanel.html`, `sidepanel.js`, `sidepanel.css`
- `images/` (e.g. `logo.png`)

Do **not** include: `node_modules/`, `src/`, `package.json`, `tailwind.config.js`, `.git/`, `*.md`, or any dev-only files.

The zip must be **under 2GB**. Your `manifest.json` must be at the **root** of the zip.

### 3. Upload and fill the dashboard

1. In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), click **“New item”**.
2. **Choose file** → select `clinicalbuddy-extension.zip` → **Upload**.
3. Complete every tab in the left menu:

| Tab | What to do |
|-----|------------|
| **Store listing** | Short description, **screenshots** (at least 1), category (e.g. Productivity), language. |

### Icons and images you need

**1. Extension icons (in the zip – already done)**  
The package includes `images/icon16.png`, `icon32.png`, `icon48.png`, and `icon128.png` (generated from your logo). The store **requires** a **128×128** icon in the zip; the others are used in the toolbar and extension management page. No extra step needed unless you want to replace these with custom-designed icons.

**2. Small promotional image (upload in dashboard – required)**  
- **Size:** 440×280 pixels  
- **Where:** Store listing → Promotional images → Small  
- **Tip:** Use your logo/brand, avoid long text, works on light gray. This is mandatory; listings without it are shown after others.

**3. Screenshots (upload in dashboard – at least 1 required)**  
- **Size:** 1280×800 or 640×400 pixels (1280×800 preferred)  
- **Where:** Store listing → Screenshots  
- **Tip:** Show the side panel open next to a guideline page (e.g. NICE CKS) and/or a highlighted section so users see the real experience. Up to 5 screenshots allowed.
| **Privacy** | Single purpose, permission justifications, remote code = No, data usage, privacy policy URL. |
| **Distribution** | Free, regions, “Public” or “Unlisted” as you prefer. |
| **Test instructions** | Only if reviewers need a test account or special steps. |

### 4. Submit for review

- Click **“Submit for review”**.
- You can choose to **publish automatically** when approved, or **defer** and publish manually later (within 30 days).

---

## How to avoid rejection

### Single purpose (Privacy tab)

Use one clear sentence in plain language, for example:

**Single purpose:**  
“Helps UK GPs quickly summarise clinical guideline and article pages (e.g. NICE CKS, PubMed) in a side panel. Surfaces red flags, management options, and prescribing points; highlights matching text on the page; and lets you click any item in the summary to scroll to that section.”

### Permissions justification (Privacy tab)

For each permission, explain why you need it in one short sentence:

| Permission | Justification |
|------------|----------------|
| **sidePanel** | Opens the reading assistant in the side panel when the user clicks the extension icon. |
| **tabs** | Detects the active tab and its URL so the correct page is summarised and to relay messages to the content script. |
| **scripting** | Injects the content script when the tab doesn’t have it yet, so summarisation and highlights work after opening the panel. |
| **host_permissions &lt;all_urls&gt;** | Reads visible text on the current tab (e.g. NICE CKS, PubMed) to send to our API for summarisation and to highlight matching text on the page. |

### Remote code (Privacy tab)

- Select **“No, I am not using remote code.”**
- The extension only loads JS/CSS from the package; it does **not** load or execute scripts from your API. API calls are `fetch()` to your backend; that’s data, not executable code.

### Data usage (Privacy tab)

- If you **only** send page content (title, URL, extracted text) to your API for summarisation and **don’t** store it long-term or use it for ads/profiling, you can disclose something like:
  - “This extension sends the current page’s title, URL, and extracted text to our server to generate a summary. Data is not stored permanently and is not used for advertising or cross-site tracking.”
- Check only the data types you actually use (e.g. “Website content”) and certify that use is limited and consistent with your description.

### Privacy policy

- You **must** provide a **privacy policy URL** (required for the Web Store).
- It should state what data the extension collects (e.g. page URL and text), how it’s used (e.g. summarisation), that it’s not sold, and where it’s processed (e.g. your backend). It can be the same policy as your main ClinicalBuddy site if it covers the extension.

### Store listing

- **Description** must match what the extension does: side panel, summarisation, what not to miss / what to do / prescribing, highlights, click to jump. No misleading or exaggerated claims.
- **Screenshots**: 1–2 showing the side panel and a highlighted page help reviewers and users.

### Quality

- Test on a few real pages (e.g. a NICE CKS topic) before submitting.
- Ensure the production API URL is used when installed from the store (your code already switches based on `update_url`).

---

## After submission

- You’ll get email about **approval**, **rejection**, or **more information needed**.
- If **rejected**, the email explains the reason; fix the issue (manifest, permissions, privacy text, or listing) and upload a new zip, then submit again.
- If **approved**, the extension goes live (or stays staged if you chose “defer publish”); you can then update it later via the same dashboard by uploading a new zip and submitting an update.

---

## Quick checklist before submit

- [ ] Zip contains only runtime files (no `node_modules`, dev config, or `.git`).
- [ ] Store listing description matches extension behaviour.
- [ ] Single purpose is clear and in plain language.
- [ ] Every permission has a short justification.
- [ ] Remote code = “No”.
- [ ] Data usage and privacy policy are filled and accurate.
- [ ] Privacy policy URL is valid and describes extension data handling.
