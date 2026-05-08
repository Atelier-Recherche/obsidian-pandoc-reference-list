# PandoCit (Obsidian)

Affiche dans le panneau latéral une liste de références formatée pour chaque clé de citation Pandoc (`[@clef]`) présente dans la note active.

## Installation via BRAT (1 clic)

1. Installer BRAT : [lien obsidian](https://obsidian.md/plugins?search=BRAT#)
2. Installer ce plugin avec BRAT avec l'url du depot  : https://github.com/Atelier-Recherche/pandocit
## Fonctionnement

- Le plugin utilise **Pandoc 3.9 en WebAssembly** (`pandoc.wasm`) pour convertir les fichiers de bibliographie (BibTeX, etc.) en CSL JSON. **Aucune installation de Pandoc sur le système n’est nécessaire.**
- Compatible **Obsidian bureau (Windows, macOS, Linux) et mobile (Android, iOS)** : le même plugin peut être installé sur desktop et sur téléphone ou tablette.

## Configuration

1. **Bibliographie**  
   Indiquez le chemin vers votre fichier de bibliographie (compatible Pandoc : `.bib`, `.json` CSL, etc.).  
   - Sur **bureau**, vous pouvez utiliser le bouton de sélection de fichier ou saisir un chemin absolu ou relatif au coffre.  
   - Sur **mobile**, saisissez un **chemin relatif au coffre** (par ex. `refs/bibliographie.bib`). La boîte de dialogue « ouvrir un fichier » n’est disponible que sur bureau.

2. **Style de citation (CSL)** *(optionnel)*  
   Choisissez un style dans la liste ou indiquez un fichier `.csl` (chemin ou URL), éventuellement surchargé par le frontmatter de la note (`bibliography`, `csl`, `lang`, etc.).

3. **Afficher le panneau des références**  
   Palette de commandes : **« PandoCit : Show reference list »** (selon la langue de l’interface Obsidian) pour ouvrir l’onglet des références dans la barre latérale.

4. **Langue du plugin** *(optionnel)*  
   Dans les réglages du plugin, vous pouvez choisir la langue des libellés (paramètres, notices, panneau latéral dédié).

## Zotero (optionnel)

### Better BibTeX / flux local

L’intégration via **Better BibTeX** et le réseau local (pull depuis Zotero) repose sur les API locales : elle convient surtout à **Obsidian bureau**. Sur mobile, préférez une bibliographie fichier dans le coffre.

### Zotero Web API

Une fois activée dans les réglages du plugin, vous pouvez synchroniser votre bibliothèque **via l’API officielle** (`api.zotero.org`) :

- **Clé API** et bibliothèque **personnelle** ou **de groupe** (ID numérique).
- **Fusion de bibliothèques de groupe** avec votre bibliothèque personnelle : listez les IDs de groupes à afficher en plus ; utilisez **Charger les groupes** pour récupérer les noms, ou définissez des **noms d’affichage personnalisés** (une ligne par ID + libellé) si vous préférez un titre lisible sans dépendre du cache.
- **Synchronisation** bidirectionnelle (téléchargement et envoi des modifications selon le modèle Zotero API).
- **Export BibTeX** optionnel vers un fichier `.bib` dans le coffre (chemin configurable), pour Pandoc, LaTeX ou Typst.

Les données synchronisées sont stockées dans des fichiers JSON dédiés dans le dossier du plugin ; **aucune installation Node locale de Zotero n’est requise**, ce qui reste compatible avec une utilisation hors ligne du coffre après synchro.

### Panneau « Bibliothèque Zotero »

Depuis la palette de commandes : **« Open Zotero library panel »** / **« Ouvrir le panneau bibliothèque Zotero »**.

Ce panneau affiche une **vue arborescente** (collections, éléments sans classe, pièces isolées, corbeille selon les données). Vous pouvez **filtrer** les références, ouvrir ou éditer des notices (dont les notes au format HTML Zotero), et accéder aux pièces jointes **PDF / fichiers** directement sur la ligne.

- **Sous-arbre replié par défaut** : lorsqu’une entrée a des éléments enfants dans l’arbre (sous-notes, références sous un ouvrage, etc.), une **icône chevron** placée dans la bande des pièces jointes (à gauche des lignes PDF) permet d’**afficher ou masquer** ce bloc — pratique pour alléger la liste.
- Les **badges de type** (livre, article de revue, note…) suivent la **langue d’interface du plugin** lorsque celle-ci est prise en charge.

Après la première synchro, utilisez **« Sync Zotero library (Web API) »** pour actualiser ; les citations dans vos notes peuvent s’appuyer sur les données chargées via la bibliographie globale du plugin.

## Développement et build

Prérequis : [Node.js](https://nodejs.org/) et [Yarn](https://yarnpkg.com/).

```bash
yarn install
yarn build
```

Le script produit `main.js` à la racine du projet. Pour tester le plugin dans un coffre Obsidian, copiez au minimum dans le dossier du plugin (souvent `.obsidian/plugins/<nom-du-plugin>/`) :

- `main.js`
- `manifest.json`
- `styles.css` (s’il est présent)
- `pandoc.wasm` (obligatoire pour la conversion des bibliographies non-JSON)

## Limitations connues (WASM)

La version WebAssembly de Pandoc fonctionne dans un bac à sable : pas d’accès réseau arbitraire ni d’exécution de commandes système depuis Pandoc. Pour ce plugin, seule la conversion bibliographie → CSL JSON est utilisée, ce qui convient à l’usage prévu.

## Ressources

- [Pandoc](https://pandoc.org/) — [Releases (dont pandoc.wasm / 3.9)](https://github.com/jgm/pandoc/releases)
- [Citation Style Language (CSL)](https://citationstyles.org/)

![Capture d’écran de la liste de références](https://raw.githubusercontent.com/mgmeyers/obsidian-pandoc-reference-list/main/Screen%20Shot.png)
