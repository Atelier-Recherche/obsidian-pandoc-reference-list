<div align="center">

<table>
  <tr>
    <td><img src="readme-media/logo_pandocite.jpg" alt="PandoCit" width="140" /></td>
    <td align="left">
      <h1>PandoCit</h1>
      <strong>Pandoc citations in Obsidian</strong><br />
      <sub>Sidebar · WASM bibliography · Zotero</sub>
    </td>
  </tr>
</table>

<a href="https://atelier.atechnologie.fr/" title="l'Atelier – EHESS"><img src="readme-media/logoasso.jpg" alt="l'Atelier" width="200" /></a>

<p>
  <a href="https://atelier.atechnologie.fr/"><img src="https://img.shields.io/badge/l'Atelier-🌐_Website-6d28d9?style=for-the-badge" alt="l'Atelier website" /></a>
  <a href="https://github.com/Atelier-Recherche/pandocit"><img src="https://img.shields.io/badge/Repository-📦_GitHub-181717?style=for-the-badge" alt="GitHub" /></a>
  <a href="#-install-via-brat"><img src="https://img.shields.io/badge/Install-⚡_BRAT-7c3aed?style=for-the-badge" alt="BRAT" /></a>
</p>

<p>
  🇫🇷 <a href="README.md">FR</a> · 🇬🇧 <a href="README.en.md"><b>EN</b></a> · 🇩🇪 <a href="README.de.md">DE</a> · 🇪🇸 <a href="README.es.md">ES</a>
</p>

</div>

---

## 👁️ Preview

| 📑 References | 📚 Zotero |
| :---: | :---: |
| <img src="readme-media/screen1.jpg" alt="Reference sidebar" width="400" /> | <img src="readme-media/screen2.jpg" alt="Zotero library" width="400" /> |

---

## 📖 About

Shows a formatted reference list in the sidebar for each Pandoc key (`[@key]`) in the active note.

## ⚡ Install via BRAT

1. 🔌 Install [**BRAT**](https://obsidian.md/plugins?search=BRAT#) in Obsidian
2. ➕ *Add Beta plugin* → `https://github.com/Atelier-Recherche/pandocit`

> ⏳ Pending Obsidian community review — use BRAT to try now · [l'Atelier](https://atelier.atechnologie.fr/)

## 🔧 How it works

- 🦀 **Pandoc 3.9 WASM** (`pandoc.wasm`): BibTeX, etc. → CSL JSON — **no system Pandoc**
- 💻🖥️ **Desktop** (Win / macOS / Linux) and **mobile** (Android, iOS)

## ⚙️ Configuration

| | |
| --- | --- |
| 📁 **Bibliography** | `.bib`, CSL `.json`… Desktop: picker or path · Mobile: **vault-relative** only (`refs/lib.bib`) |
| 🎨 **CSL style** *(opt.)* | Built-in list or `.csl`; frontmatter override (`bibliography`, `csl`, `lang`…) |
| 📋 **Panel** | Command palette → **“PandoCit : Show reference list”** |
| 🌐 **UI language** *(opt.)* | Plugin settings (labels, editor, sidebar) |

## 📚 Zotero *(optional)*

### 🔗 Better BibTeX / local

Local network — best on **desktop**. Mobile → bib file in vault.

### ☁️ Web API

- 🔑 API key · **personal** or **group** library (ID)
- 🔀 Merge groups · **Load groups** or custom names
- 🔄 Bidirectional sync · optional **BibTeX** → `.bib` (Pandoc, LaTeX, Typst)
- 💾 JSON in plugin folder — **no Zotero Node**; offline after sync

### 🌳 Library panel

**“Open Zotero library panel”** — tree (collections, unfiled, attachments, trash), filter, edit, row **PDFs**, chevrons for subtrees, type badges per plugin language · **“Sync Zotero library (Web API)”** to refresh.

## 🛠️ Development

📦 [Node.js](https://nodejs.org/) · [Yarn](https://yarnpkg.com/)

```bash
yarn install && yarn build
```

Copy to `.obsidian/plugins/<plugin>/`: `main.js`, `manifest.json`, `styles.css`, `pandoc.wasm`

## ⚠️ WASM

Sandbox: no network or shell from Pandoc — bibliography → CSL JSON only.

## 🔗 Resources

<a href="https://atelier.atechnologie.fr/"><img src="https://img.shields.io/badge/l'Atelier-atelier.atechnologie.fr-6d28d9?style=flat-square&logo=google-chrome&logoColor=white" /></a>
<a href="https://github.com/Atelier-Recherche/pandocit"><img src="https://img.shields.io/badge/GitHub-Atelier--Recherche%2Fpandocit-181717?style=flat-square&logo=github" /></a>
<a href="https://pandoc.org/"><img src="https://img.shields.io/badge/Pandoc-pandoc.org-1a56db?style=flat-square" /></a>
<a href="https://github.com/jgm/pandoc/releases"><img src="https://img.shields.io/badge/pandoc.wasm-3.9-1a56db?style=flat-square" /></a>
<a href="https://citationstyles.org/"><img src="https://img.shields.io/badge/CSL-citationstyles.org-059669?style=flat-square" /></a>

<p align="center"><sub><a href="README.md">🇫🇷 FR</a> · 🇬🇧 EN · <a href="README.de.md">🇩🇪 DE</a> · <a href="README.es.md">🇪🇸 ES</a></sub></p>
