<div align="center">

<table>
  <tr>
    <td><img src="readme-media/logo_pandocite.jpg" alt="PandoCit" width="140" /></td>
    <td align="left">
      <h1>PandoCit</h1>
      <strong>Citas Pandoc en Obsidian</strong><br />
      <sub>Panel lateral · bibliografía WASM · Zotero</sub>
    </td>
  </tr>
</table>

<a href="https://atelier.atechnologie.fr/" title="l'Atelier – EHESS"><img src="readme-media/logoasso.jpg" alt="l'Atelier" width="200" /></a>

<p>
  <a href="https://atelier.atechnologie.fr/"><img src="https://img.shields.io/badge/l'Atelier-🌐_Web-6d28d9?style=for-the-badge" alt="Web l'Atelier" /></a>
  <a href="https://github.com/Atelier-Recherche/pandocit"><img src="https://img.shields.io/badge/Repositorio-📦_GitHub-181717?style=for-the-badge" alt="GitHub" /></a>
  <a href="#-instalación-vía-brat"><img src="https://img.shields.io/badge/Instalar-⚡_BRAT-7c3aed?style=for-the-badge" alt="BRAT" /></a>
</p>

<p>
  🇫🇷 <a href="README.md">FR</a> · 🇬🇧 <a href="README.en.md">EN</a> · 🇩🇪 <a href="README.de.md">DE</a> · 🇪🇸 <a href="README.es.md"><b>ES</b></a>
</p>

</div>

---

## 👁️ Vista previa

| 📑 Referencias | 📚 Zotero |
| :---: | :---: |
| <img src="readme-media/screen1.jpg" alt="Panel de referencias" width="400" /> | <img src="readme-media/screen2.jpg" alt="Biblioteca Zotero" width="400" /> |

---

## 📖 Acerca de

Muestra en el panel lateral referencias formateadas para cada clave Pandoc (`[@clave]`) en la nota activa.

## ⚡ Instalación vía BRAT

1. 🔌 Instalar [**BRAT**](https://obsidian.md/plugins?search=BRAT#) en Obsidian
2. ➕ *Add Beta plugin* → `https://github.com/Atelier-Recherche/pandocit`

> ⏳ Pendiente de validación en el catálogo Obsidian — pruébalo ya con BRAT · [l'Atelier](https://atelier.atechnologie.fr/)

## 🔧 Funcionamiento

- 🦀 **Pandoc 3.9 WASM** (`pandoc.wasm`): BibTeX, etc. → CSL JSON — **sin Pandoc en el sistema**
- 💻🖥️ **Escritorio** (Win / macOS / Linux) y **móvil** (Android, iOS)

## ⚙️ Configuración

| | |
| --- | --- |
| 📁 **Bibliografía** | `.bib`, CSL `.json`… Escritorio: selector o ruta · Móvil: solo ruta **relativa al vault** (`refs/bib.bib`) |
| 🎨 **Estilo CSL** *(opc.)* | Lista integrada o `.csl`; frontmatter (`bibliography`, `csl`, `lang`…) |
| 📋 **Panel** | Paleta de comandos → **« PandoCit : Show reference list »** |
| 🌐 **Idioma UI** *(opc.)* | Ajustes del plugin (etiquetas, editor, panel) |

## 📚 Zotero *(opcional)*

### 🔗 Better BibTeX / local

Red local — sobre todo **escritorio**. Móvil → archivo bib en el vault.

### ☁️ API web

- 🔑 Clave API · biblioteca **personal** o de **grupo** (ID)
- 🔀 Fusionar grupos · **Cargar grupos** o nombres personalizados
- 🔄 Sincronización bidireccional · **BibTeX** opcional → `.bib` (Pandoc, LaTeX, Typst)
- 💾 JSON en la carpeta del plugin — **sin Node Zotero**; offline tras sincronizar

### 🌳 Panel biblioteca

**« Open Zotero library panel »** — árbol (colecciones, sin clasificar, adjuntos, papelera), filtro, edición, **PDF** en fila, cheurones para subárboles, insignias de tipo según idioma del plugin · **« Sync Zotero library (Web API) »** para actualizar.

## 🛠️ Desarrollo

📦 [Node.js](https://nodejs.org/) · [Yarn](https://yarnpkg.com/)

```bash
yarn install && yarn build
```

Copiar en `.obsidian/plugins/<plugin>/`: `main.js`, `manifest.json`, `styles.css`, `pandoc.wasm`

## ⚠️ WASM

Entorno aislado: sin red ni shell desde Pandoc — solo bibliografía → CSL JSON.

## 🔗 Recursos

<a href="https://atelier.atechnologie.fr/"><img src="https://img.shields.io/badge/l'Atelier-atelier.atechnologie.fr-6d28d9?style=flat-square&logo=google-chrome&logoColor=white" /></a>
<a href="https://github.com/Atelier-Recherche/pandocit"><img src="https://img.shields.io/badge/GitHub-Atelier--Recherche%2Fpandocit-181717?style=flat-square&logo=github" /></a>
<a href="https://pandoc.org/"><img src="https://img.shields.io/badge/Pandoc-pandoc.org-1a56db?style=flat-square" /></a>
<a href="https://github.com/jgm/pandoc/releases"><img src="https://img.shields.io/badge/pandoc.wasm-3.9-1a56db?style=flat-square" /></a>
<a href="https://citationstyles.org/"><img src="https://img.shields.io/badge/CSL-citationstyles.org-059669?style=flat-square" /></a>

<p align="center"><sub><a href="README.md">🇫🇷 FR</a> · <a href="README.en.md">🇬🇧 EN</a> · <a href="README.de.md">🇩🇪 DE</a> · 🇪🇸 ES</sub></p>
