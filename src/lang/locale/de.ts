// Deutsch — vollständige Plugin-Oberfläche

export default {
  'Plugin interface language': 'Sprache der Plugin-Oberfläche',
  'Display language for this plugin (settings, notices, side panel).':
    'Anzeigesprache für dieses Plugin (Einstellungen, Hinweise, Seitenleiste).',
  'Download Pandoc WASM': 'Pandoc WASM herunterladen',
  'Installs pandoc.wasm from Pandoc 3.9 next to main.js (official release ZIP). Reload Obsidian after install. Download works on desktop and mobile (including Android).':
    'Installiert pandoc.wasm (Pandoc 3.9) neben main.js (offizielles ZIP). Obsidian danach neu laden. Download funktioniert auf Desktop und Mobilgeräten (einschließlich Android).',
  'Download WASM': 'WASM laden',
  'Downloading Pandoc WASM…': 'Pandoc WASM wird heruntergeladen…',
  'pandoc.wasm is already in the plugin folder.':
    'pandoc.wasm liegt bereits im Plugin-Ordner.',
  'Pandoc WASM installed. Reload Obsidian to apply.':
    'Pandoc WASM installiert. Obsidian neu laden, um es zu nutzen.',
  'Pandoc WASM download failed.': 'Download von Pandoc WASM fehlgeschlagen.',
  Installed: 'Installiert',

  'Path to bibliography file': 'Pfad zur Bibliografiedatei',
  'The absolute path to your desired bibliography file. This can be overridden on a per-file basis by setting "bibliography" in the file\'s frontmatter.':
    'Absoluter Pfad zur Bibliografiedatei. Pro Datei überschreibbar mit „bibliography“ im Frontmatter.',
  'Select a bibliography file.': 'Bibliografiedatei auswählen.',
  'Custom citation style': 'Benutzerdefinierter Zitationsstil',
  'Citation style': 'Zitationsstil',
  'Citation style language': 'Sprache des Zitationsstils',
  'Search...': 'Suchen…',
  'Path to a CSL file. This can be an absolute path or one relative to your vault. This will override the style selected above. This can be overridden on a per-file basis by setting "csl" or "citation-style" in the file\'s frontmatter. A URL can be supplied when setting the style via frontmatter.':
    'Pfad zu einer CSL-Datei (absolut oder relativ zur Vault). Überschreibt den obigen Stil; pro Datei mit „csl“ oder „citation-style“ im Frontmatter überschreibbar. URL über Frontmatter möglich.',
  'Select a CSL file located on your computer':
    'CSL-Datei auf diesem Computer auswählen',
  'File selection is only available on desktop. Please enter the path manually.':
    'Dateiauswahl nur auf dem Desktop. Bitte Pfad manuell eingeben.',
  'Hide links in references': 'Links in Referenzen ausblenden',
  'Replace links with link icons to save space.':
    'Ersetzt Links durch Symbole, um Platz zu sparen.',
  'Show citekey tooltips': 'Tooltips für Zitationsschlüssel',
  'When enabled, hovering over citekeys will open a tooltip containing a formatted citation.':
    'Zeigt beim Überfahren eines Schlüssels einen Tooltip mit formatierter Quelle.',
  'Tooltip delay': 'Tooltip-Verzögerung',
  'Set the amount of time (in milliseconds) to wait before displaying tooltips.':
    'Wartezeit in Millisekunden vor dem Tooltip.',
  'Open PDF links in new tab': 'PDF in neuem Tab öffnen',
  'When enabled, vault PDFs opened from citekey tooltips or the Zotero library open in a new tab. When disabled, Obsidian may split the current pane instead.':
    'Wenn aktiv, öffnen sich Tresor-PDFs aus Tooltips oder der Zotero-Leiste in einem neuen Tab. Wenn aus, kann Obsidian den Bereich teilen.',
  'Validate Pandoc configuration': 'Pandoc-Konfiguration prüfen',
  Validate: 'Prüfen',
  'Validation successful': 'Validierung erfolgreich',
  'Show citekey suggestions': 'Vorschläge für Zitationsschlüssel',
  'When enabled, an autocomplete dialog will display when typing citation keys.':
    'Zeigt beim Tippen eine Autovervollständigung für Schlüssel.',
  'Zotero port': 'Zotero-Port',
  "Use 24119 for Juris-M or specify a custom port if you have changed Zotero's default.":
    '24119 für Juris-M oder eigenen Port, falls Zotero geändert wurde.',
  'Render live preview inline citations':
    'Inline-Zitate in Live-Vorschau',
  'Render reading mode inline citations':
    'Inline-Zitate im Lesemodus',
  'Convert [@pandoc] citations to formatted inline citations in live preview mode.':
    'Wandelt [@…]-Zitate in der Live-Vorschau in formatierte Inline-Zitate.',
  'Convert [@pandoc] citations to formatted inline citations in reading mode.':
    'Wandelt [@…]-Zitate im Lesemodus in formatierte Inline-Zitate.',
  'Process citations in links': 'Zitate in Links verarbeiten',
  'Include [[@pandoc]] citations in the reference list and format them as inline citations in live preview mode.':
    '[[@…]]-Zitate in die Liste aufnehmen und in der Live-Vorschau formatieren.',

  'Click to copy': 'Klicken zum Kopieren',
  'Copy list': 'Liste kopieren',
  'No citations found in the current document.':
    'Keine Zitate im aktuellen Dokument.',
  References: 'Literatur',
  'This can be overridden on a per-file basis by setting "lang" or "citation-language" in the file\'s frontmatter. A language code must be used when setting the language via frontmatter.':
    'Pro Datei überschreibbar mit „lang“ oder „citation-language“ im Frontmatter (Sprachcode erforderlich).',
  'See here for a list of available language codes':
    'Liste der Sprachcodes',
  'Cannot connect to Zotero': 'Keine Verbindung zu Zotero',
  'Start Zotero and try again.': 'Zotero starten und erneut versuchen.',
  'Libraries to include in bibliography':
    'Bibliotheken für die Bibliografie',
  'Please provide the path to your pandoc compatible bibliography file in the PandoCit plugin settings.':
    'Bitte den Pfad zur Pandoc-kompatiblen Bibliografiedatei in den Plugin-Einstellungen angeben.',
  'Refresh bibliography': 'Bibliografie aktualisieren',
  'Pandoc reference list settings': 'PandoCit — Einstellungen',
  'Unable to load pandoc.wasm; reference list is disabled on this platform.':
    'pandoc.wasm kann nicht geladen werden; Literaturliste auf dieser Plattform deaktiviert.',

  'No citation found for ': 'Kein Zitat gefunden für ',

  'Show reference list': 'Literaturansicht öffnen',

  'Open literature note': 'Literatur-Notiz öffnen',
  'Open in Zotero': 'In Zotero öffnen',
  'Open PDF at cited page': 'PDF auf zitierter Seite öffnen',
  'Open linked PDF': 'Verknüpftes PDF öffnen',
  'Local file': 'Lokale Datei',
  'Web link': 'Web-Link',
  'Show citation info': 'Zitation anzeigen',
  'PDF not in vault or unavailable on mobile':
    'PDF liegt nicht im Tresor oder ist auf Mobilgeräten nicht öffenbar',
  'Local file open is only available on desktop':
    'Lokale Datei nur auf dem Desktop öffenbar',
  'Edit item form hint':
    'Formular nach unten scrollen, alle Felder bearbeiten, dann speichern. Zitationsschlüssel über das Better-BibTeX-Feld.',
  'Creators (JSON)': 'Autoren (JSON)',
  'Creators JSON hint':
    'Zotero-Autorenarray, z. B. [{ "creatorType": "author", "firstName": "A", "lastName": "B" }].',
  'Invalid creators JSON': 'Ungültiges Autoren-JSON',
  Place: 'Ort',
  ISBN: 'ISBN',
  'Number of pages': 'Seitenzahl',
  Edition: 'Auflage',
  Series: 'Reihe',
  'Series number': 'Reihennummer',
  'Number of volumes': 'Bandanzahl',
  Archive: 'Archiv',
  'Archive location': 'Archivsignatur',
  'Library catalog': 'Katalog',
  'Call number': 'Signatur',
  Language: 'Sprache',
  Title: 'Titel',
  Remove: 'Entfernen',
  'Short title': 'Kurztitel',
  Rights: 'Rechte',
  'Access date': 'Zugriffsdatum',
  'Journal abbreviation': 'Zeitschriftenkürzel',
  Volume: 'Band',
  Issue: 'Heft',
  Pages: 'Seiten',
  ISSN: 'ISSN',
  University: 'Universität',

  'Zotero sync failed': 'Zotero-Sync fehlgeschlagen',
  'Zotero sync done': 'Zotero-Sync abgeschlossen',
  'conflicts skipped': 'Konflikte übersprungen',
  'Zotero library': 'Zotero-Bibliothek',
  'Filter references…': 'Referenzen filtern…',
  'Sync now': 'Jetzt synchronisieren',
  'No matching references': 'Keine passenden Referenzen',
  'Use server copy': 'Serverkopie verwenden',
  'Insert citekey': 'Zitationsschlüssel einfügen',
  'Open a markdown note to insert citations':
    'Markdown-Notiz öffnen, um Zitate einzufügen',
  Edit: 'Bearbeiten',
  Creators: 'Autoren',
  'Add creator': 'Autor hinzufügen',
  'First name': 'Vorname',
  'Last name': 'Nachname',
  'Organization or full name': 'Organisation oder voller Name',
  'Language optional placeholder': '— (optional)',
  'Creator role author': 'Autor',
  'Creator role editor': 'Herausgeber',
  'Creator role translator': 'Übersetzer',
  'Creator role contributor': 'Mitwirkender',
  'Creator role series editor': 'Reihenherausgeber',
  'Creator role book author': 'Buchautor',
  'Creator role composer': 'Komponist',
  'Creator role reviewed author': 'Rezensierter Autor',
  'Edit reference': 'Referenz bearbeiten',
  'Item type': 'Dokumenttyp',
  'Date': 'Datum',
  'Publication / journal': 'Veröffentlichung / Zeitschrift',
  Publisher: 'Verlag',
  'URL': 'URL',
  'Extra (e.g. Citation Key)': 'Extra (z. B. Zitationsschlüssel)',
  'Abstract': 'Abstract',
  'Save': 'Speichern',
  'Library changed on the server — use “Sync” or “Use server copy”':
    'Bibliothek auf dem Server geändert — „Synchronisieren“ oder „Serverkopie verwenden“',
  'Save failed': 'Speichern fehlgeschlagen',
  'Cancel': 'Abbrechen',
  'Updated from server': 'Vom Server aktualisiert',
  'Could not fetch item': 'Eintrag konnte nicht geladen werden',
  'Use Zotero Web API (sync)': 'Zotero-Web-API (Sync) verwenden',
  'Pull and edit your library via api.zotero.org using an API key. Works on mobile. When enabled, the bibliography file path above is not used unless you override it in frontmatter.':
    'Bibliothek über api.zotero.org mit API-Schlüssel laden und bearbeiten. Funktioniert mobil. Wenn aktiv, wird der Bibliografiepfad oben ignoriert, außer Frontmatter überschreibt.',
  'Zotero API key': 'Zotero-API-Schlüssel',
  'Create a key at': 'Schlüssel erstellen unter',
  'Needs library access and write access to edit items.':
    'Bibliothekszugriff und Schreibrechte zum Bearbeiten nötig.',
  'Could not validate API key': 'API-Schlüssel konnte nicht geprüft werden',
  'API key OK': 'API-Schlüssel OK',
  Library: 'Bibliothek',
  'User library or a group library.': 'Persönliche oder Gruppenbibliothek.',
  'My library': 'Meine Bibliothek',
  'Group library': 'Gruppenbibliothek',
  'Group ID': 'Gruppen-ID',
  'Numeric group ID from the Zotero website URL.':
    'Numerische Gruppen-ID aus der Zotero-Website-URL.',
  'Linked user ID': 'Verknüpfte Benutzer-ID',
  'Filled automatically after verifying the API key.':
    'Wird nach Schlüsselprüfung automatisch ausgefüllt.',
  'Verify API key': 'API-Schlüssel prüfen',
  Verify: 'Prüfen',
  'Sync library now': 'Bibliothek jetzt synchronisieren',
  'Download remote changes and upload local edits.':
    'Remote-Änderungen laden und lokale Bearbeitungen hochladen.',
  'Sync Zotero library (Web API)': 'Zotero-Bibliothek synchronisieren (API)',
  'Open Zotero library panel': 'Zotero-Bibliothek öffnen',
  'Zotero library has no items — run Sync':
    'Zotero-Bibliothek ist leer — Sync ausführen',
  'Enable “Use Zotero Web API” in plugin settings first':
    'Zuerst „Zotero-Web-API“ in den Plugin-Einstellungen aktivieren',

  'Export BibTeX (.bib)': 'BibTeX (.bib) exportieren',
  'The synced JSON stores every Zotero object (PDFs, notes, annotations, trash). The .bib export only includes top-level works — like Zotero’s own bibliography export.':
    'Das synchronisierte JSON enthält alle Zotero-Objekte (PDFs, Notizen, Anmerkungen, Papierkorb). Der .bib-Export enthält nur Einträge der obersten Ebene — wie der Zotero-Literaturexport.',
  'Export .bib now': '.bib jetzt exportieren',
  'Set a file path ending in .bib first':
    'Zuerst einen Pfad mit Endung .bib angeben',
  'BibTeX export saved': 'BibTeX-Export gespeichert',
  entries: 'Einträge',
  'Export failed': 'Export fehlgeschlagen',
  'Path must end with .bib': 'Pfad muss mit .bib enden',
  'Export Zotero API library to BibTeX':
    'Zotero-API-Bibliothek nach BibTeX exportieren',
  'Set the BibTeX path in Zotero Web API settings':
    'BibTeX-Pfad in den Zotero-API-Einstellungen setzen',
  'Export .bib': '.bib exportieren',

  Trash: 'Papierkorb',
  Collection: 'Sammlung',
  Uncategorized: 'Ohne Sammlung',
  'Loose attachments / notes': 'Lose Anhänge / Notizen',
  'Filtered flat list — clear search for tree':
    'Gefilterte Liste — Suche leeren für Baumansicht',
  'Citation key (Better BibTeX)': 'Zitationsschlüssel (Better BibTeX)',
  Extra: 'Extra',
  Saved: 'Gespeichert',
  Attachments: 'Anhänge',
  'Absolute path or vault-relative':
    'Absoluter Pfad oder relativ zum Vault-Stammordner',
  'Save link': 'Link speichern',
  'Delete attachment confirm':
    'Diesen Anhang in Zotero löschen?',
  'Attachment removed': 'Anhang entfernt',
  'New web link': 'Neuer Weblink',
  'New linked file': 'Neue verknüpfte Datei',
  'Optional attachment title': 'Titel (optional)',
  'Attachment type read-only hint':
    'Nur der Titel kann für diesen Anhangstyp bearbeitet werden.',
  'File path required': 'Bitte einen Dateipfad angeben',
  'Select file on computer': 'Datei auf diesem Rechner auswählen',
  Add: 'Hinzufügen',
  'created_but_not_in_snapshot':
    'Auf Zotero gespeichert, hier aber nicht geladen — Sync ausführen.',
  Delete: 'Löschen',
  'Delete item from Zotero confirm':
    'Dieses Element aus Zotero entfernen? Untergeordnete Elemente können betroffen sein.',
  'Item deleted': 'Element gelöscht',
  'Edit note': 'Notiz bearbeiten',
  'Note HTML hint':
    'Zotero speichert Notizen als HTML. Markup unten bearbeiten und speichern.',
  'Load group libraries': 'Gruppenbibliotheken laden',
  'Fetch groups your API key can access':
    'Listet Gruppen der Zotero-API auf, um die numerische ID einzutragen.',
  'Load groups': 'Gruppen laden',
  'Groups loaded': 'Gruppen geladen',
  'No group libraries found': 'Keine Gruppenbibliotheken gefunden',
  'Verify API key first to load groups':
    'Bitte zuerst den API-Schlüssel prüfen (Benutzer-ID).',
  'Merge group libraries (IDs)':
    'Gruppenbibliotheken zusammenführen (IDs)',
  'Comma-separated group IDs to show alongside your library. Load groups to pick names; run Sync for each cache.':
    'Kommagetrennte Gruppen-IDs. „Gruppen laden“ für Namen; je Cache synchronisieren.',
  'Toggle library subtree':
    'Untergeordnete Einträge unter diesem Element ein- oder ausblenden',
  'Badge PDF or file': 'PDF / Datei',
  'Badge note': 'Notiz',
  'Badge annotation': 'Annotation',
  'Zotero type unknown': 'Eintrag',
  'Zotero type artwork': 'Kunstwerk',
  'Zotero type audioRecording': 'Tonaufnahme',
  'Zotero type bill': 'Gesetzentwurf',
  'Zotero type blogPost': 'Blogbeitrag',
  'Zotero type book': 'Buch',
  'Zotero type bookSection': 'Buchabschnitt',
  'Zotero type case': 'Gerichtsentscheidung',
  'Zotero type computerProgram': 'Computerprogramm',
  'Zotero type conferencePaper': 'Konferenzbeitrag',
  'Zotero type dictionaryEntry': 'Wörterbucheintrag',
  'Zotero type document': 'Dokument',
  'Zotero type email': 'E-Mail',
  'Zotero type encyclopediaArticle': 'Enzyklopädieartikel',
  'Zotero type film': 'Film',
  'Zotero type forumPost': 'Forumsbeitrag',
  'Zotero type hearing': 'Anhörung',
  'Zotero type instantMessage': 'Instant Message',
  'Zotero type interview': 'Interview',
  'Zotero type journalArticle': 'Zeitschriftenartikel',
  'Zotero type letter': 'Brief',
  'Zotero type magazineArticle': 'Magazinartikel',
  'Zotero type manuscript': 'Manuskript',
  'Zotero type map': 'Karte',
  'Zotero type newspaperArticle': 'Zeitungsartikel',
  'Zotero type patent': 'Patent',
  'Zotero type podcast': 'Podcast',
  'Zotero type presentation': 'Präsentation',
  'Zotero type preprint': 'Preprint',
  'Zotero type radioBroadcast': 'Radiosendung',
  'Zotero type report': 'Bericht',
  'Zotero type standard': 'Norm',
  'Zotero type statute': 'Gesetzestext',
  'Zotero type thesis': 'Dissertation',
  'Zotero type tvBroadcast': 'TV-Sendung',
  'Zotero type videoRecording': 'Videoaufnahme',
  'Zotero type webpage': 'Webseite',
  'Merge group display names (optional)':
    'Anzeigenamen zusammengeführter Gruppen (optional)',
  'One line per merged group: numeric ID and display name (or ID=name). Shown in the library panel and collections; overrides names from Load groups when set.':
    'Eine Zeile pro Gruppe: numerische ID und Anzeigename oder ID=Name. Im Bibliotheksbereich und bei Sammlungen; überschreibt Namen aus „Gruppen laden“.',
  'Could not open file': 'Datei konnte nicht geöffnet werden',
};
