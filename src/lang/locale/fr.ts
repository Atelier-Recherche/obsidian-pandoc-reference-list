// français — chaînes complètes pour l’interface du plugin

export default {
  'Plugin interface language': 'Langue de l’interface du plugin',
  'Display language for this plugin (settings, notices, side panel).':
    'Langue d’affichage de ce plugin (réglages, notifications, panneau latéral).',
  'Download Pandoc WASM': 'Télécharger Pandoc WASM',
  'Installs pandoc.wasm from Pandoc 3.9 next to main.js (official release ZIP). Reload Obsidian after install. Download works on desktop and mobile (including Android).':
    'Installe pandoc.wasm (Pandoc 3.9) à côté de main.js (archive officielle). Rechargez Obsidian après installation. Le téléchargement fonctionne sur bureau et mobile (dont Android).',
  'Download WASM': 'Télécharger WASM',
  'Downloading Pandoc WASM…': 'Téléchargement de Pandoc WASM…',
  'pandoc.wasm is already in the plugin folder.':
    'pandoc.wasm est déjà présent dans le dossier du plugin.',
  'Pandoc WASM installed. Reload Obsidian to apply.':
    'Pandoc WASM installé. Rechargez Obsidian pour l’utiliser.',
  'Pandoc WASM download failed.': 'Échec du téléchargement de Pandoc WASM.',
  Installed: 'Installé',

  'Path to bibliography file': 'Chemin du fichier de bibliographie',
  'The absolute path to your desired bibliography file. This can be overridden on a per-file basis by setting "bibliography" in the file\'s frontmatter.':
    'Chemin absolu vers votre fichier de bibliographie. Peut être surchargé par fichier avec « bibliography » dans les métadonnées.',
  'Select a bibliography file.': 'Choisir un fichier de bibliographie.',
  'Custom citation style': 'Style de citation personnalisé',
  'Citation style': 'Style de citation',
  'Citation style language': 'Langue du style de citation',
  'Search...': 'Rechercher…',
  'Path to a CSL file. This can be an absolute path or one relative to your vault. This will override the style selected above. This can be overridden on a per-file basis by setting "csl" or "citation-style" in the file\'s frontmatter. A URL can be supplied when setting the style via frontmatter.':
    'Chemin d’un fichier CSL (absolu ou relatif au coffre). Remplace le style ci-dessus ; surcharge possible par fichier avec « csl » ou « citation-style » dans les métadonnées. Une URL peut être indiquée via les métadonnées.',
  'Select a CSL file located on your computer':
    'Choisir un fichier CSL sur cet ordinateur',
  'File selection is only available on desktop. Please enter the path manually.':
    'Le sélecteur de fichier n’est disponible que sur bureau. Saisissez le chemin à la main.',
  'Hide links in references': 'Masquer les liens dans les références',
  'Replace links with link icons to save space.':
    'Remplace les liens par des icônes pour gagner de la place.',
  'Show citekey tooltips': 'Infobulles sur les clés de citation',
  'When enabled, hovering over citekeys will open a tooltip containing a formatted citation.':
    'Au survol d’une clé de citation, affiche une infobulle avec la référence formatée.',
  'Tooltip delay': 'Délai des infobulles',
  'Set the amount of time (in milliseconds) to wait before displaying tooltips.':
    'Temps d’attente (millisecondes) avant d’afficher une infobulle.',
  'Open PDF links in new tab': 'Ouvrir les PDF dans un nouvel onglet',
  'When enabled, vault PDFs opened from citekey tooltips or the Zotero library open in a new tab. When disabled, Obsidian may split the current pane instead.':
    'Si activé, les PDF du coffre ouverts depuis les infobulles ou le panneau Zotero s’ouvrent dans un nouvel onglet. Sinon, Obsidian peut utiliser une vue scindée.',
  'Validate Pandoc configuration': 'Valider la configuration Pandoc',
  Validate: 'Valider',
  'Validation successful': 'Validation réussie',
  'Show citekey suggestions': 'Suggestions de clés de citation',
  'When enabled, an autocomplete dialog will display when typing citation keys.':
    'Propose des complétions automatiques lors de la saisie des clés.',
  'Zotero port': 'Port Zotero',
  "Use 24119 for Juris-M or specify a custom port if you have changed Zotero's default.":
    'Utilisez 24119 pour Juris-M ou indiquez un port si vous avez modifié Zotero.',
  'Render live preview inline citations':
    'Citations en aperçu instantané',
  'Render reading mode inline citations':
    'Citations en mode lecture',
  'Convert [@pandoc] citations to formatted inline citations in live preview mode.':
    'Convertit les citations [@…] en citations formatées dans l’aperçu.',
  'Convert [@pandoc] citations to formatted inline citations in reading mode.':
    'Convertit les citations [@…] en citations formatées en mode lecture.',
  'Process citations in links': 'Traiter les citations dans les liens',
  'Include [[@pandoc]] citations in the reference list and format them as inline citations in live preview mode.':
    'Inclut les citations [[@…]] dans la liste et les formate dans l’aperçu.',

  'Click to copy': 'Cliquer pour copier',
  'Copy list': 'Copier la liste',
  'No citations found in the current document.':
    'Aucune citation dans le document actuel.',
  References: 'Références',
  'This can be overridden on a per-file basis by setting "lang" or "citation-language" in the file\'s frontmatter. A language code must be used when setting the language via frontmatter.':
    'Peut être surchargé par fichier avec « lang » ou « citation-language » dans les métadonnées (code langue obligatoire).',
  'See here for a list of available language codes':
    'Voir la liste des codes langue',
  'Cannot connect to Zotero': 'Impossible de joindre Zotero',
  'Start Zotero and try again.': 'Lancez Zotero et réessayez.',
  'Libraries to include in bibliography':
    'Bibliothèques à inclure dans la bibliographie',
  'Please provide the path to your pandoc compatible bibliography file in the PandoCit plugin settings.':
    'Indiquez le chemin du fichier de bibliographie compatible Pandoc dans les réglages du plugin.',
  'Refresh bibliography': 'Actualiser la bibliographie',
  'Pandoc reference list settings': 'Réglages PandoCit',
  'Unable to load pandoc.wasm; reference list is disabled on this platform.':
    'Impossible de charger pandoc.wasm ; la liste de références est désactivée sur cette plateforme.',

  'No citation found for ': 'Aucune citation pour ',

  'Show reference list': 'Afficher la liste de références',

  'Open literature note': 'Ouvrir la note littéraire',
  'Open in Zotero': 'Ouvrir dans Zotero',
  'Open PDF at cited page': 'Ouvrir le PDF à la page citée',
  'Open linked PDF': 'Ouvrir le PDF lié',
  'Local file': 'Fichier local',
  'Web link': 'Lien web',
  'Show citation info': 'Afficher la citation',
  'PDF not in vault or unavailable on mobile':
    'Le PDF n’est pas dans le coffre ou ne peut pas s’ouvrir sur mobile',
  'Local file open is only available on desktop':
    'L’ouverture du fichier local n’est disponible que sur bureau',
  'Edit item form hint':
    'Faites défiler le formulaire pour tout modifier, puis enregistrez. Utilisez le champ « clé de citation » pour Better BibTeX.',
  'Creators (JSON)': 'Créateurs (JSON)',
  'Creators JSON hint':
    'Tableau de créateurs Zotero, ex. [{ "creatorType": "author", "firstName": "A", "lastName": "B" }].',
  'Invalid creators JSON': 'JSON des créateurs invalide',
  Place: 'Lieu',
  ISBN: 'ISBN',
  'Number of pages': 'Nombre de pages',
  Edition: 'Édition',
  Series: 'Collection',
  'Series number': 'Numéro de collection',
  'Number of volumes': 'Nombre de volumes',
  Archive: 'Archive',
  'Archive location': 'Cote / emplacement',
  'Library catalog': 'Catalogue',
  'Call number': 'Cote',
  Language: 'Langue',
  Title: 'Titre',
  Remove: 'Retirer',
  'Short title': 'Titre court',
  Rights: 'Droits',
  'Access date': 'Date de consultation',
  'Journal abbreviation': 'Abréviation du journal',
  Volume: 'Volume',
  Issue: 'Numéro',
  Pages: 'Pages',
  ISSN: 'ISSN',
  University: 'Université',

  'Zotero sync failed': 'Échec de la synchro Zotero',
  'Zotero sync done': 'Synchro Zotero terminée',
  'conflicts skipped': 'conflits ignorés',
  'Zotero library': 'Bibliothèque Zotero',
  'Filter references…': 'Filtrer les références…',
  'Sync now': 'Synchroniser',
  'No matching references': 'Aucune référence correspondante',
  'Use server copy': 'Utiliser la copie serveur',
  'Insert citekey': 'Insérer la clé',
  'Open a markdown note to insert citations':
    'Ouvrez une note Markdown pour insérer des citations',
  Edit: 'Modifier',
  Creators: 'Créateurs',
  'Add creator': 'Ajouter un créateur',
  'First name': 'Prénom',
  'Last name': 'Nom',
  'Organization or full name': 'Organisme ou nom complet',
  'Language optional placeholder': '— (facultatif)',
  'Creator role author': 'Auteur',
  'Creator role editor': 'Éditeur',
  'Creator role translator': 'Traducteur',
  'Creator role contributor': 'Contributeur',
  'Creator role series editor': 'Directeur de collection',
  'Creator role book author': 'Auteur du livre',
  'Creator role composer': 'Compositeur',
  'Creator role reviewed author': 'Auteur recensé',
  'Edit reference': 'Modifier la référence',
  'Item type': 'Type de document',
  'Date': 'Date',
  'Publication / journal': 'Publication / revue',
  Publisher: 'Éditeur',
  'URL': 'URL',
  'Extra (e.g. Citation Key)': 'Extra (ex. clé de citation)',
  'Abstract': 'Résumé',
  'Save': 'Enregistrer',
  'Library changed on the server — use “Sync” or “Use server copy”':
    'La bibliothèque a changé sur le serveur — utilisez « Synchroniser » ou « Utiliser la copie serveur »',
  'Save failed': 'Échec de l’enregistrement',
  'Cancel': 'Annuler',
  'Updated from server': 'Mis à jour depuis le serveur',
  'Could not fetch item': 'Impossible de récupérer l’entrée',
  'Use Zotero Web API (sync)': 'Utiliser l’API web Zotero (sync)',
  'Pull and edit your library via api.zotero.org using an API key. Works on mobile. When enabled, the bibliography file path above is not used unless you override it in frontmatter.':
    'Synchronisez et modifiez votre bibliothèque via api.zotero.org avec une clé API. Fonctionne sur mobile. Si activé, le chemin de bibliographie ci-dessus est ignoré sauf surcharge dans les métadonnées.',
  'Zotero API key': 'Clé API Zotero',
  'Create a key at': 'Créez une clé sur',
  'Needs library access and write access to edit items.':
    'Accès à la bibliothèque et écriture nécessaires pour modifier les entrées.',
  'Could not validate API key': 'Impossible de valider la clé API',
  'API key OK': 'Clé API valide',
  Library: 'Bibliothèque',
  'User library or a group library.': 'Bibliothèque personnelle ou de groupe.',
  'My library': 'Ma bibliothèque',
  'Group library': 'Bibliothèque de groupe',
  'Group ID': 'ID du groupe',
  'Numeric group ID from the Zotero website URL.':
    'Identifiant numérique du groupe (URL du site Zotero).',
  'Linked user ID': 'ID utilisateur lié',
  'Filled automatically after verifying the API key.':
    'Rempli automatiquement après vérification de la clé.',
  'Verify API key': 'Vérifier la clé API',
  Verify: 'Vérifier',
  'Sync library now': 'Synchroniser la bibliothèque',
  'Download remote changes and upload local edits.':
    'Télécharge les changements distants et envoie les modifications locales.',
  'Sync Zotero library (Web API)': 'Synchroniser la bibliothèque Zotero (API)',
  'Open Zotero library panel': 'Ouvrir le panneau bibliothèque Zotero',
  'Zotero library has no items — run Sync':
    'La bibliothèque Zotero est vide — lancez une synchro',
  'Enable “Use Zotero Web API” in plugin settings first':
    'Activez d’abord « Utiliser l’API web Zotero » dans les réglages',

  'Export BibTeX (.bib)': 'Exporter BibTeX (.bib)',
  'The synced JSON stores every Zotero object (PDFs, notes, annotations, trash). The .bib export only includes top-level works — like Zotero’s own bibliography export.':
    'Le JSON synchronisé contient tous les objets Zotero (PDF, notes, annotations, corbeille). L’export .bib ne contient que les entrées de premier niveau — comme l’export bibliographie de Zotero.',
  'Export .bib now': 'Exporter le .bib',
  'Set a file path ending in .bib first':
    'Indiquez d’abord un chemin se terminant par .bib',
  'BibTeX export saved': 'Export BibTeX enregistré',
  entries: 'entrées',
  'Export failed': 'Échec de l’export',
  'Path must end with .bib': 'Le chemin doit se terminer par .bib',
  'Export Zotero API library to BibTeX':
    'Exporter la bibliothèque API Zotero vers BibTeX',
  'Set the BibTeX path in Zotero Web API settings':
    'Définissez le chemin BibTeX dans les réglages API Zotero',
  'Export .bib': 'Exporter .bib',

  Trash: 'Corbeille',
  Collection: 'Collection',
  Uncategorized: 'Sans collection',
  'Loose attachments / notes': 'Pièces jointes / notes isolées',
  'Filtered flat list — clear search for tree':
    'Liste plate filtrée — effacez la recherche pour l’arborescence',
  'Citation key (Better BibTeX)': 'Clé de citation (Better BibTeX)',
  Extra: 'Extra',
  Saved: 'Enregistré',
  Attachments: 'Pièces jointes',
  'Absolute path or vault-relative':
    'Chemin absolu, ou relatif à la racine du coffre',
  'Save link': 'Enregistrer le lien',
  'Delete attachment confirm':
    'Supprimer cette pièce jointe dans Zotero ?',
  'Attachment removed': 'Pièce jointe supprimée',
  'New web link': 'Nouveau lien web',
  'New linked file': 'Nouveau fichier lié',
  'Optional attachment title': 'Titre (facultatif)',
  'Attachment type read-only hint':
    'Seul le titre peut être modifié pour ce type de pièce jointe.',
  'File path required': 'Indiquez un chemin de fichier',
  'Select file on computer': 'Choisir un fichier sur cet ordinateur',
  Add: 'Ajouter',
  'created_but_not_in_snapshot':
    'Enregistré sur Zotero mais pas chargé ici — lancez une synchro.',
  Delete: 'Supprimer',
  'Delete item from Zotero confirm':
    'Retirer cet élément de Zotero ? Les éléments enfants peuvent être affectés.',
  'Item deleted': 'Élément supprimé',
  'Edit note': 'Modifier la note',
  'Note HTML hint':
    'Zotero enregistre les notes en HTML. Modifiez le code ci-dessous puis enregistrez.',
  'Load group libraries': 'Charger les bibliothèques de groupe',
  'Fetch groups your API key can access':
    'Liste les groupes renvoyés par l’API Zotero pour renseigner l’ID numérique.',
  'Load groups': 'Charger les groupes',
  'Groups loaded': 'Groupes chargés',
  'No group libraries found': 'Aucune bibliothèque de groupe trouvée',
  'Verify API key first to load groups':
    'Vérifiez d’abord la clé API pour que l’ID utilisateur soit connu.',
  'Merge group libraries (IDs)':
    'Fusionner des bibliothèques de groupe (IDs)',
  'Comma-separated group IDs to show alongside your library. Load groups to pick names; run Sync for each cache.':
    'IDs de groupes séparés par des virgules. Chargez les groupes pour les noms ; une synchro par cache.',
  'Toggle library subtree':
    'Afficher ou masquer les éléments imbriqués sous cette entrée',
  'Badge PDF or file': 'PDF / fichier',
  'Badge note': 'Note',
  'Badge annotation': 'Annotation',
  'Zotero type unknown': 'Élément',
  'Zotero type artwork': 'Œuvre',
  'Zotero type audioRecording': 'Enregistrement audio',
  'Zotero type bill': 'Projet de loi',
  'Zotero type blogPost': 'Article de blog',
  'Zotero type book': 'Livre',
  'Zotero type bookSection': 'Chapitre de livre',
  'Zotero type case': 'Décision de justice',
  'Zotero type computerProgram': 'Logiciel',
  'Zotero type conferencePaper': 'Communication',
  'Zotero type dictionaryEntry': 'Article de dictionnaire',
  'Zotero type document': 'Document',
  'Zotero type email': 'Courriel',
  'Zotero type encyclopediaArticle': 'Article d’encyclopédie',
  'Zotero type film': 'Film',
  'Zotero type forumPost': 'Message de forum',
  'Zotero type hearing': 'Audition',
  'Zotero type instantMessage': 'Message instantané',
  'Zotero type interview': 'Entretien',
  'Zotero type journalArticle': 'Article de revue',
  'Zotero type letter': 'Lettre',
  'Zotero type magazineArticle': 'Article de magazine',
  'Zotero type manuscript': 'Manuscrit',
  'Zotero type map': 'Carte',
  'Zotero type newspaperArticle': 'Article de presse',
  'Zotero type patent': 'Brevet',
  'Zotero type podcast': 'Podcast',
  'Zotero type presentation': 'Présentation',
  'Zotero type preprint': 'Preprint',
  'Zotero type radioBroadcast': 'Émission radio',
  'Zotero type report': 'Rapport',
  'Zotero type standard': 'Norme',
  'Zotero type statute': 'Texte législatif',
  'Zotero type thesis': 'Thèse',
  'Zotero type tvBroadcast': 'Émission TV',
  'Zotero type videoRecording': 'Vidéo',
  'Zotero type webpage': 'Page web',
  'Merge group display names (optional)':
    'Noms d’affichage des groupes fusionnés (optionnel)',
  'One line per merged group: numeric ID and display name (or ID=name). Shown in the library panel and collections; overrides names from Load groups when set.':
    'Une ligne par groupe : ID numérique puis libellé, ou ID=nom. Affiché dans le panneau et les collections ; remplace les noms issus de « Charger les groupes ».',
  'Could not open file': 'Impossible d’ouvrir le fichier',
};
