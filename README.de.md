<div align="center">

<table>
  <tr>
    <td><img src="readme-media/logo_pandocite.jpg" alt="PandoCit" width="140" /></td>
    <td align="left">
      <h1>PandoCit</h1>
      <strong>Pandoc-Zitate in Obsidian</strong><br />
      <sub>Seitenleiste · WASM-Bibliographie · Zotero</sub>
    </td>
  </tr>
</table>

<a href="https://atelier.atechnologie.fr/" title="l'Atelier – EHESS"><img src="readme-media/logoasso.jpg" alt="l'Atelier" width="200" /></a>

<p>
  <a href="https://atelier.atechnologie.fr/"><img src="https://img.shields.io/badge/l'Atelier-🌐_Website-6d28d9?style=for-the-badge" alt="Website l'Atelier" /></a>
  <a href="https://github.com/Atelier-Recherche/pandocit"><img src="https://img.shields.io/badge/Repository-📦_GitHub-181717?style=for-the-badge" alt="GitHub" /></a>
  <a href="#-installation-über-brat"><img src="https://img.shields.io/badge/Installieren-⚡_BRAT-7c3aed?style=for-the-badge" alt="BRAT" /></a>
</p>

<p>
  🇫🇷 <a href="README.md">FR</a> · 🇬🇧 <a href="README.en.md">EN</a> · 🇩🇪 <a href="README.de.md"><b>DE</b></a> · 🇪🇸 <a href="README.es.md">ES</a>
</p>

</div>

---

## 👁️ Vorschau

| 📑 Referenzen | 📚 Zotero |
| :---: | :---: |
| <img src="readme-media/screen1.jpg" alt="Referenz-Seitenleiste" width="400" /> | <img src="readme-media/screen2.jpg" alt="Zotero-Bibliothek" width="400" /> |

---

## 📖 Überblick

Zeigt in der Seitenleiste formatierte Literaturangaben für jeden Pandoc-Schlüssel (`[@key]`) in der aktiven Notiz.

## ⚡ Installation über BRAT

1. 🔌 [**BRAT**](https://obsidian.md/plugins?search=BRAT#) in Obsidian installieren
2. ➕ *Add Beta plugin* → `https://github.com/Atelier-Recherche/pandocit`

> ⏳ Wartet auf Obsidian-Katalogfreigabe — mit BRAT sofort testen · [l'Atelier](https://atelier.atechnologie.fr/)

## 🔧 Funktionsweise

- 🦀 **Pandoc 3.9 WASM** (`pandoc.wasm`): BibTeX usw. → CSL JSON — **ohne System-Pandoc**
- 💻🖥️ **Desktop** (Win / macOS / Linux) und **Mobil** (Android, iOS)

## ⚙️ Konfiguration

| | |
| --- | --- |
| 📁 **Bibliographie** | `.bib`, CSL `.json`… Desktop: Auswahl oder Pfad · Mobil: nur **vault-relativ** (`refs/bib.bib`) |
| 🎨 **CSL-Stil** *(opt.)* | Integrierte Liste oder `.csl`; Frontmatter (`bibliography`, `csl`, `lang`…) |
| 📋 **Panel** | Befehlspalette → **„PandoCit : Show reference list“** |
| 🌐 **UI-Sprache** *(opt.)* | Plugin-Einstellungen (Beschriftungen, Editor, Seitenleiste) |

## 📚 Zotero *(optional)*

### 🔗 Better BibTeX / lokal

Lokales Netzwerk — vor allem **Desktop**. Mobil → Bib-Datei im Vault.

### ☁️ Web-API

- 🔑 API-Schlüssel · **persönliche** oder **Gruppen**-Bibliothek (ID)
- 🔀 Gruppen zusammenführen · **Gruppen laden** oder eigene Namen
- 🔄 Bidirektionale Sync · optional **BibTeX** → `.bib` (Pandoc, LaTeX, Typst)
- 💾 JSON im Plugin-Ordner — **kein Zotero-Node**; offline nach Sync

### 🌳 Bibliotheks-Panel

**„Open Zotero library panel“** — Baum (Sammlungen, ohne Sammlung, Anhänge, Papierkorb), Filter, Bearbeitung, Zeilen-**PDFs**, Chevrons für Unterbäume, Typ-Badges in Plugin-Sprache · **„Sync Zotero library (Web API)“** zum Aktualisieren.

## 🛠️ Entwicklung

📦 [Node.js](https://nodejs.org/) · [Yarn](https://yarnpkg.com/)

```bash
yarn install && yarn build
```

Nach `.obsidian/plugins/<plugin>/` kopieren: `main.js`, `manifest.json`, `styles.css`, `pandoc.wasm`

## ⚠️ WASM

Sandbox: kein Netzwerk/Shell von Pandoc — nur Bibliographie → CSL JSON.

## 🔗 Ressourcen

<a href="https://atelier.atechnologie.fr/"><img src="https://img.shields.io/badge/l'Atelier-atelier.atechnologie.fr-6d28d9?style=flat-square&logo=google-chrome&logoColor=white" /></a>
<a href="https://github.com/Atelier-Recherche/pandocit"><img src="https://img.shields.io/badge/GitHub-Atelier--Recherche%2Fpandocit-181717?style=flat-square&logo=github" /></a>
<a href="https://pandoc.org/"><img src="https://img.shields.io/badge/Pandoc-pandoc.org-1a56db?style=flat-square" /></a>
<a href="https://github.com/jgm/pandoc/releases"><img src="https://img.shields.io/badge/pandoc.wasm-3.9-1a56db?style=flat-square" /></a>
<a href="https://citationstyles.org/"><img src="https://img.shields.io/badge/CSL-citationstyles.org-059669?style=flat-square" /></a>

<p align="center"><sub><a href="README.md">🇫🇷 FR</a> · <a href="README.en.md">🇬🇧 EN</a> · 🇩🇪 DE · <a href="README.es.md">🇪🇸 ES</a></sub></p>
