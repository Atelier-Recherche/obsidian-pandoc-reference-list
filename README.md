<div align="center">

<table>
  <tr>
    <td><img src="readme-media/logo_pandocite.jpg" alt="PandoCit" width="140" /></td>
    <td align="left">
      <h1>PandoCit</h1>
      <strong>Citations Pandoc dans Obsidian</strong><br />
      <sub>Panneau latéral · bibliographie WASM · Zotero</sub>
    </td>
  </tr>
</table>

<a href="https://atelier.atechnologie.fr/" title="l'Atelier – EHESS"><img src="readme-media/logoasso.jpg" alt="l'Atelier" width="200" /></a>

<p>
  <a href="https://atelier.atechnologie.fr/"><img src="https://img.shields.io/badge/l'Atelier-🌐_Site-6d28d9?style=for-the-badge" alt="Site l'Atelier" /></a>
  <a href="https://github.com/Atelier-Recherche/pandocit"><img src="https://img.shields.io/badge/Dépôt-📦_GitHub-181717?style=for-the-badge" alt="GitHub" /></a>
  <a href="#-installation-via-brat"><img src="https://img.shields.io/badge/Installer-⚡_BRAT-7c3aed?style=for-the-badge" alt="BRAT" /></a>
</p>

<p>
  🇫🇷 <a href="README.md"><b>FR</b></a> · 🇬🇧 <a href="README.en.md">EN</a> · 🇩🇪 <a href="README.de.md">DE</a> · 🇪🇸 <a href="README.es.md">ES</a>
</p>

</div>

---

## 👁️ Aperçu

| 📑 Références | 📚 Zotero |
| :---: | :---: |
| <img src="readme-media/screen1.jpg" alt="Panneau des références" width="400" /> | <img src="readme-media/screen2.jpg" alt="Bibliothèque Zotero" width="400" /> |

---

## 📖 À propos

Affiche dans le panneau latéral une liste de références formatée pour chaque clé Pandoc (`[@clef]`) de la note active.

## ⚡ Installation via BRAT

1. 🔌 Installer [**BRAT**](https://obsidian.md/plugins?search=BRAT#) dans Obsidian
2. ➕ *Add Beta plugin* → `https://github.com/Atelier-Recherche/pandocit`

> ⏳ En attente de validation catalogue Obsidian — BRAT permet de tester dès maintenant · [l'Atelier](https://atelier.atechnologie.fr/)

## 🔧 Fonctionnement

- 🦀 **Pandoc 3.9 WASM** (`pandoc.wasm`) : BibTeX, etc. → CSL JSON — **sans Pandoc système**
- 💻🖥️ **Bureau** (Win / macOS / Linux) et **mobile** (Android, iOS)

## ⚙️ Configuration

| | |
| --- | --- |
| 📁 **Bibliographie** | `.bib`, CSL `.json`… Bureau : sélecteur ou chemin absolu/relatif · Mobile : chemin **relatif au coffre** (`refs/bib.bib`) |
| 🎨 **Style CSL** *(opt.)* | Liste intégrée ou `.csl` ; surcharge frontmatter (`bibliography`, `csl`, `lang`…) |
| 📋 **Panneau** | Palette → **« PandoCit : Show reference list »** |
| 🌐 **Langue UI** *(opt.)* | Réglages du plugin (libellés, notices, panneau) |

## 📚 Zotero *(optionnel)*

### 🔗 Better BibTeX / local

Réseau local — surtout **bureau**. Mobile → fichier bib dans le coffre.

### ☁️ Web API

- 🔑 Clé API · bibliothèque **personnelle** ou **groupe** (ID)
- 🔀 Fusion groupes · **Charger les groupes** ou noms personnalisés
- 🔄 Sync bidirectionnelle · export **BibTeX** → `.bib` (Pandoc, LaTeX, Typst)
- 💾 JSON dans le dossier plugin — **pas de Node Zotero** ; hors ligne après synchro

### 🌳 Panneau bibliothèque

**« Ouvrir le panneau bibliothèque Zotero »** — arbre (collections, sans classe, PJ, corbeille), filtre, édition, **PDF** sur la ligne, chevrons pour sous-arbres, badges de type selon la langue du plugin · **« Sync Zotero library (Web API) »** pour actualiser.

## 🛠️ Développement

📦 [Node.js](https://nodejs.org/) · [Yarn](https://yarnpkg.com/)

```bash
yarn install && yarn build
```

Copier dans `.obsidian/plugins/<plugin>/` : `main.js`, `manifest.json`, `styles.css`, `pandoc.wasm`

## ⚠️ WASM

Bac à sable : pas de réseau ni shell depuis Pandoc — uniquement bib → CSL JSON.

## 🔗 Ressources

<a href="https://atelier.atechnologie.fr/"><img src="https://img.shields.io/badge/l'Atelier-atelier.atechnologie.fr-6d28d9?style=flat-square&logo=google-chrome&logoColor=white" /></a>
<a href="https://github.com/Atelier-Recherche/pandocit"><img src="https://img.shields.io/badge/GitHub-Atelier--Recherche%2Fpandocit-181717?style=flat-square&logo=github" /></a>
<a href="https://pandoc.org/"><img src="https://img.shields.io/badge/Pandoc-pandoc.org-1a56db?style=flat-square" /></a>
<a href="https://github.com/jgm/pandoc/releases"><img src="https://img.shields.io/badge/pandoc.wasm-3.9-1a56db?style=flat-square" /></a>
<a href="https://citationstyles.org/"><img src="https://img.shields.io/badge/CSL-citationstyles.org-059669?style=flat-square" /></a>

<p align="center"><sub>🇫🇷 FR · <a href="README.en.md">🇬🇧 EN</a> · <a href="README.de.md">🇩🇪 DE</a> · <a href="README.es.md">🇪🇸 ES</a></sub></p>
