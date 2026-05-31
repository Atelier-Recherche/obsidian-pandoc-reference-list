<div align="center">

<table>
<tr>
<td><img src="readme-media/logo_pandocite.png" alt="PandoCit" width="140" /></td>
<td align="left">
<h1 style="margin:0">PandoCit</h1>
<p style="margin:0.25em 0 0"><strong>Citations Pandoc dans Obsidian</strong><br/>panneau latéral · bibliographie WASM · intégration Zotero</p>
</td>
</tr>
</table>

<a href="https://atelier.atechnologie.fr/" title="l'Atelier – Association de fabrication de livres et d'outils de recherche"><img src="readme-media/logoasso.jpg" alt="l'Atelier" width="200" /></a>  
<sub>Développé par <a href="https://atelier.atechnologie.fr/">l'Atelier</a> — fabrication de livres et outils de recherche (EHESS)</sub>

<p>
🇫🇷 <a href="README.md"><b>Français</b></a> ·
🇬🇧 <a href="README.en.md">English</a> ·
🇩🇪 <a href="README.de.md">Deutsch</a> ·
🇪🇸 <a href="README.es.md">Español</a>
</p>

<p>
<a href="https://atelier.atechnologie.fr/"><img src="https://img.shields.io/badge/🌐_l'Atelier-atelier.atechnologie.fr-2d5016?style=for-the-badge" alt="Site l'Atelier" /></a>
<a href="https://github.com/Atelier-Recherche/pandocit"><img src="https://img.shields.io/badge/📦_Dépôt-GitHub-181717?style=for-the-badge&logo=github" alt="Dépôt GitHub" /></a>
<a href="https://obsidian.md/plugins?search=BRAT#"><img src="https://img.shields.io/badge/⬇️_Installer-BRAT-7c3aed?style=for-the-badge&logo=obsidian&logoColor=white" alt="Installer via BRAT" /></a>
</p>

</div>

---

## 📸 Aperçu

| Liste des références | Bibliothèque Zotero |
| :---: | :---: |
| <img src="readme-media/screen1.jpg" alt="Panneau des références formatées" width="400" /> | <img src="readme-media/screen2.jpg" alt="Panneau bibliothèque Zotero" width="400" /> |

---

## 📖 À propos

Affiche dans le panneau latéral une liste de références formatée pour chaque clé de citation Pandoc (`[@clef]`) présente dans la note active.

## ⬇️ Installation via BRAT (1 clic)

> **ID du plugin (catalogue Obsidian)** : `pandocit` — le dossier dans `.obsidian/plugins/` doit s’appeler **`pandocit`** (sans le mot `obsidian` dans l’ID, conformément aux [règles du manifest](https://docs.obsidian.md/Reference/Manifest)). Si vous migrez depuis `obsidian-pandoc-reference-list`, renommez le dossier ou réinstallez, puis copiez `data.json` et `pandoc.wasm`.

1. 🔌 Installer **BRAT** : [Obsidian — BRAT](https://obsidian.md/plugins?search=BRAT#)
2. ➕ Ajouter ce dépôt avec l’option *« Add Beta plugin »* :  
   `https://github.com/Atelier-Recherche/pandocit`

> 💡 Nos plugins peuvent être en attente de validation sur le catalogue Obsidian ; BRAT permet de les tester dès maintenant. Voir aussi 🌐 [l’Atelier](https://atelier.atechnologie.fr/).

## ⚙️ Fonctionnement

- 🦀 Le plugin utilise **Pandoc 3.9 en WebAssembly** (`pandoc.wasm`) pour convertir les fichiers de bibliographie (BibTeX, etc.) en CSL JSON. **Aucune installation de Pandoc sur le système n’est nécessaire.**
- 📱 Compatible **Obsidian bureau** (Windows, macOS, Linux) **et mobile** (Android, iOS) : le même plugin fonctionne sur ordinateur, téléphone et tablette.

## 🔧 Configuration

1. **📚 Bibliographie**  
   Indiquez le chemin vers votre fichier de bibliographie (compatible Pandoc : `.bib`, `.json` CSL, etc.).  
   - 🖥️ Sur **bureau** : bouton de sélection ou chemin absolu / relatif au coffre.  
   - 📱 Sur **mobile** : chemin **relatif au coffre** (ex. `refs/bibliographie.bib`). La boîte « ouvrir un fichier » n’est disponible que sur bureau.

2. **🎨 Style de citation (CSL)** *(optionnel)*  
   Liste intégrée ou fichier `.csl` (chemin ou URL), éventuellement surchargé par le frontmatter (`bibliography`, `csl`, `lang`, etc.).

3. **📋 Panneau des références**  
   Palette de commandes : **« PandoCit : Show reference list »** (libellé selon la langue Obsidian).

4. **🌐 Langue du plugin** *(optionnel)*  
   Dans les réglages du plugin : langue des libellés (paramètres, notices, panneau latéral).

## 📚 Zotero (optionnel)

### 🔗 Better BibTeX / flux local

L’intégration **Better BibTeX** et le réseau local convient surtout à **Obsidian bureau**. Sur mobile, préférez une bibliographie fichier dans le coffre.

### ☁️ Zotero Web API

Une fois activée dans les réglages :

- 🔑 **Clé API** et bibliothèque **personnelle** ou **de groupe** (ID numérique).
- 👥 **Fusion de bibliothèques de groupe** : IDs de groupes + **Charger les groupes** ou **noms d’affichage personnalisés** (une ligne par ID + libellé).
- 🔄 **Synchronisation** bidirectionnelle (modèle Zotero API).
- 📤 **Export BibTeX** optionnel vers un `.bib` dans le coffre (Pandoc, LaTeX, Typst).

Les données sont stockées en JSON dans le dossier du plugin ; **aucun Node local Zotero** n’est requis — usage hors ligne possible après synchro.

### 🌳 Panneau « Bibliothèque Zotero »

Commande : **« Open Zotero library panel »** / **« Ouvrir le panneau bibliothèque Zotero »**.

Vue **arborescente** (collections, éléments sans classe, pièces isolées, corbeille). Filtre, édition des notices (notes HTML Zotero), pièces jointes **PDF / fichiers** sur la ligne.

- **▸ Sous-arbre replié par défaut** : icône chevron dans la bande des pièces jointes pour afficher / masquer les enfants.
- **🏷️ Badges de type** (livre, article…) selon la **langue d’interface du plugin**.

Commande **« Sync Zotero library (Web API) »** pour actualiser après la première synchro.

### 📥 Import d’un dossier PDF vers Zotero

Commande **« Importer un dossier PDF vers Zotero »** (panneau bibliothèque ou palette) : scan récursif d’un dossier du coffre, détection des doublons, clés de citation suggérées (auteur + année + initiales du titre), collections « longs » / « courts » PDF, pièce jointe liée au coffre ou téléversée. Réglages : dossier par défaut, motifs d’exclusion, regex sur les noms de fichiers.

## 📄 Lecteur PDF intégré

- Ouverture via le coffre (Obsidian natif ou lecteur PandoCit, selon réglages).
- **Surlignage** dans le PDF et/ou **Zotero** (API Web), avec styles mémorisés et menu contextuel.
- **Panneau annotations** : liste unifiée (PDF, Zotero), copie de référence Pandoc (`> texte`, lien Obsidian, `[@citekey]`).
- Synchronisation des surlignages avec les pièces jointes Zotero liées au fichier du coffre.

## 📗 Lecteur EPUB intégré

- Lecteur **foliate-js** dans Obsidian (navigation, surlignage local).
- Fichier **sidecar** d’annotations à côté de l’EPUB.
- Début de liaison **Zotero** (lecture / envoi d’annotations si pièce jointe EPUB reconnue) — voir roadmap ci-dessous.

## 📝 Hypothesis (optionnel)

Token API et groupe dans les réglages. **Import** des annotations Hypothesis vers le panneau document (EPUB) ; **export** des annotations locales vers Hypothesis. Interface masquée si non configuré.

## 🗺️ Roadmap (synthèse)

État actuel : **citations Pandoc + Zotero API + PDF** sont les plus matures ; **EPUB** et **Hypothesis** ont une base fonctionnelle à affiner.

| Priorité | EPUB | Hypothesis | Autres pistes |
| :---: | --- | --- | --- |
| **Court terme** | Panneau annotations aligné sur le PDF ; notes Zotero (HTML) depuis la bibliothèque ; stabilité surlignage ↔ Zotero (CFI) | Jeux de tests (URI coffre, groupe public/privé, aller-retour import/export) ; messages d’erreur plus explicites | Import dossier PDF : affiner filtres et retours utilisateur |
| **Moyen terme** | Recherche dans le livre ; préférences typographie ; conversion cible PDF ↔ Zotero comme pour le PDF | Sélecteurs riches (pas seulement citation textuelle) ; lien avec pages PDF si même ouvrage | Copier référence depuis annotations EPUB comme pour le PDF |
| **Long terme** | Parité fonctionnelle PDF/EPUB (overlay, mobile) | Workflow de revue de littérature (sync planifiée, conflits) | Plugin catalogue Obsidian ; tests CI étendus ; assets PDF locaux sans CDN |

**EPUB — détail**

- [x] Lecteur foliate, sidecar, toolbar de base
- [x] Lecture annotations Zotero existantes ; envoi highlight vers Zotero (API)
- [ ] Édition / affichage des **notes Zotero** liées à l’EPUB
- [ ] Surlignage fluide avec synchro bidirectionnelle fiable
- [ ] Intégration complète au panneau « Annotations du document »
- [ ] Tests sur gros fichiers et mobile

**Hypothesis — détail**

- [x] Token + groupe ; import API search ; export POST
- [ ] Tests systématiques (PDF annoté dans le navigateur, EPUB, URIs multiples)
- [ ] Robustesse réseau et quotas API
- [ ] Harmonisation avec le flux Zotero (éviter doublons, choix de source)

**Autres idées**

- Recherche globale dans les annotations (tous documents ouverts récemment).
- Export groupé des références d’une session de lecture.
- Rappel de synchronisation Zotero avant export `.bib`.
- Support **Typst** / modèles de notes de lecture depuis les annotations.

> Les cases cochées reflètent l’état du dépôt à la date de la doc ; la roadmap peut évoluer sur [GitHub Issues](https://github.com/Atelier-Recherche/pandocit/issues).

## 💻 Développement et build

Prérequis : [Node.js](https://nodejs.org/) et [Yarn](https://yarnpkg.com/).

```bash
yarn install
yarn build
```

En CI / release, `yarn install` utilise `--ignore-scripts` et un cache Yarn local au runner (évite les corruptions du cache global `~/.cache/yarn`).

Le build produit notamment :

- `main.js` (bundle ; non versionné — fourni par les [releases GitHub](https://github.com/Atelier-Recherche/pandocit/releases))
- `manifest.json`, `styles.css`
- `pdf.worker.min.mjs`, dossier `pdfjs/` (lecteur PDF)
- `pdf-assets/`, `foliate/` (assets copiés depuis les dépendances)

**Déploiement local** (Windows) :

```powershell
.\Deploy-LocalPlugin.ps1
```

Copie `main.js`, `manifest.json`, `styles.css`, `pdf.worker.min.mjs` et `pdfjs/` vers le dossier plugin Obsidian (préserve `data.json` et `pandoc.wasm`).

**Release** : `.\Release-Plugin.ps1` incrémente la version, build, commit, tag et push ; la [workflow release](.github/workflows/release.yml) publie **uniquement** `main.js`, `manifest.json` et `styles.css` (exigence du [catalogue Obsidian](https://docs.obsidian.md/Reference/Releasing+your+plugin)). Le worker PDF est **inclus dans `main.js`** ; un téléchargement optionnel de `pdf.worker.min.mjs` est proposé dans les **réglages du plugin** (comme pour `pandoc.wasm`). Pour `pdfjs/` et déploiement complet : BRAT ou `.\Deploy-LocalPlugin.ps1`.

Dans le coffre, installez aussi **`pandoc.wasm`** via les réglages du plugin (obligatoire pour les bibliographies non-JSON).

## ⚠️ Limitations connues (WASM)

Pandoc WASM tourne dans un bac à sable : pas d’accès réseau arbitraire ni d’exécution de commandes système. Ce plugin n’utilise que la conversion bibliographie → CSL JSON.

## 🔗 Ressources

| | |
| --- | --- |
| 🌐 **l'Atelier** | [atelier.atechnologie.fr](https://atelier.atechnologie.fr/) |
| 📦 **Dépôt** | [github.com/Atelier-Recherche/pandocit](https://github.com/Atelier-Recherche/pandocit) |
| 📄 **Pandoc** | [pandoc.org](https://pandoc.org/) — [Releases / pandoc.wasm 3.9](https://github.com/jgm/pandoc/releases) |
| 🎓 **CSL** | [citationstyles.org](https://citationstyles.org/) |

---

<div align="center">

<sub>🇫🇷 Français · <a href="README.en.md">🇬🇧 English</a> · <a href="README.de.md">🇩🇪 Deutsch</a> · <a href="README.es.md">🇪🇸 Español</a></sub>

</div>
