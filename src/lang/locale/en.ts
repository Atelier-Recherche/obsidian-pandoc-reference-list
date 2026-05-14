// English

export default {
  'Plugin interface language': 'Plugin interface language',
  'Display language for this plugin (settings, notices, side panel).':
    'Display language for this plugin (settings, notices, side panel).',
  'Download Pandoc WASM': 'Download Pandoc WASM',
  'Installs pandoc.wasm from Pandoc 3.9 next to main.js (official release ZIP). Reload Obsidian after install. Download works on desktop and mobile (including Android).':
    'Installs pandoc.wasm from Pandoc 3.9 next to main.js (official release ZIP). Reload Obsidian after install. Download works on desktop and mobile (including Android).',
  'Download WASM': 'Download WASM',
  'Downloading Pandoc WASM…': 'Downloading Pandoc WASM…',
  'pandoc.wasm is already in the plugin folder.':
    'pandoc.wasm is already in the plugin folder.',
  'Pandoc WASM installed. Reload Obsidian to apply.':
    'Pandoc WASM installed. Reload Obsidian to apply.',
  'Pandoc WASM download failed.': 'Pandoc WASM download failed.',
  Installed: 'Installed',

  // src/settings.ts
  'Path to bibliography file': 'Path to bibliography file',
  'The absolute path to your desired bibliography file. This can be overridden on a per-file basis by setting "bibliography" in the file\'s frontmatter.':
    'The absolute path to your desired bibliography file. This can be overridden on a per-file basis by setting "bibliography" in the file\'s frontmatter.',
  'Select a bibliography file.': 'Select a bibliography file.',
  'Custom citation style': 'Custom citation style',
  'Citation style': 'Citation style',
  'Citation style language': 'Citation style language',
  'Search...': 'Search...',
  'Path to a CSL file. This can be an absolute path or one relative to your vault. This will override the style selected above. This can be overridden on a per-file basis by setting "csl" or "citation-style" in the file\'s frontmatter. A URL can be supplied when setting the style via frontmatter.':
    'Path to a CSL file. This can be an absolute path or one relative to your vault. This will override the style selected above. This can be overridden on a per-file basis by setting "csl" or "citation-style" in the file\'s frontmatter. A URL can be supplied when setting the style via frontmatter.',
  'Select a CSL file located on your computer':
    'Select a CSL file located on your computer',
  'File selection is only available on desktop. Please enter the path manually.':
    'File selection is only available on desktop. Please enter the path manually.',
  'Hide links in references': 'Hide links in references',
  'Replace links with link icons to save space.':
    'Replace links with link icons to save space.',
  'Show citekey tooltips': 'Show citekey tooltips',
  'When enabled, hovering over citekeys will open a tooltip containing a formatted citation.':
    'When enabled, hovering over citekeys will open a tooltip containing a formatted citation.',
  'Tooltip delay': 'Tooltip delay',
  'Set the amount of time (in milliseconds) to wait before displaying tooltips.':
    'Set the amount of time (in milliseconds) to wait before displaying tooltips.',
  'Open PDF links in new tab': 'Open PDF links in new tab',
  'When enabled, vault PDFs opened from citekey tooltips or the Zotero library open in a new tab. When disabled, Obsidian may split the current pane instead.':
    'When enabled, vault PDFs opened from citekey tooltips or the Zotero library open in a new tab. When disabled, Obsidian may split the current pane instead.',
  'Validate Pandoc configuration': 'Validate Pandoc configuration',
  Validate: 'Validate',
  'Validation successful': 'Validation successful',
  'Show citekey suggestions': 'Show citekey suggestions',
  'When enabled, an autocomplete dialog will display when typing citation keys.':
    'When enabled, an autocomplete dialog will display when typing citation keys.',
  'Zotero port': 'Zotero port',
  "Use 24119 for Juris-M or specify a custom port if you have changed Zotero's default.":
    "Use 24119 for Juris-M or specify a custom port if you have changed Zotero's default.",
  'Render live preview inline citations':
    'Render live preview inline citations',
  'Render reading mode inline citations':
    'Render reading mode inline citations',
  'Convert [@pandoc] citations to formatted inline citations in live preview mode.':
    'Convert [@pandoc] citations to formatted inline citations in live preview mode.',
  'Convert [@pandoc] citations to formatted inline citations in reading mode.':
    'Convert [@pandoc] citations to formatted inline citations in reading mode.',
  'Process citations in links': 'Process citations in links',
  'Include [[@pandoc]] citations in the reference list and format them as inline citations in live preview mode.':
    'Include [[@pandoc]] citations in the reference list and format them as inline citations in live preview mode.',
  // src/view.ts
  'Click to copy': 'Click to copy',
  'Copy list': 'Copy list',
  'No citations found in the current document.':
    'No citations found in the current document.',
  References: 'References',
  'This can be overridden on a per-file basis by setting "lang" or "citation-language" in the file\'s frontmatter. A language code must be used when setting the language via frontmatter.':
    'This can be overridden on a per-file basis by setting "lang" or "citation-language" in the file\'s frontmatter. A language code must be used when setting the language via frontmatter.',
  'See here for a list of available language codes':
    'See here for a list of available language codes',
  'Cannot connect to Zotero': 'Cannot connect to Zotero',
  'Start Zotero and try again.': 'Start Zotero and try again.',
  'Libraries to include in bibliography':
    'Libraries to include in bibliography',
  'Please provide the path to your pandoc compatible bibliography file in the PandoCit plugin settings.':
    'Please provide the path to your pandoc compatible bibliography file in the PandoCit plugin settings.',
  'Refresh bibliography': 'Refresh bibliography',
  'Pandoc reference list settings': 'PandoCit settings',
  'Unable to load pandoc.wasm; reference list is disabled on this platform.':
    'Unable to load pandoc.wasm; reference list is disabled on this platform.',
  // src/tooltip.ts
  'No citation found for ': 'No citation found for ',

  // src/main.ts
  'Show reference list': 'Show reference list',

  // src/view.ts
  'Open literature note': 'Open literature note',
  'Open in Zotero': 'Open in Zotero',
  'Open PDF at cited page': 'Open PDF at cited page',
  'Open linked PDF': 'Open linked PDF',
  'Local file': 'Local file',
  'Web link': 'Web link',
  'Local file open is only available on desktop':
    'Local file open is only available on desktop',
  'Edit item form hint':
    'Scroll the form to edit all fields, then save. Use the citation key field for Better BibTeX.',
  'Creators (JSON)': 'Creators (JSON)',
  'Creators JSON hint':
    'Zotero creator array, e.g. [{ "creatorType": "author", "firstName": "A", "lastName": "B" }].',
  'Invalid creators JSON': 'Invalid creators JSON',
  Place: 'Place',
  ISBN: 'ISBN',
  'Number of pages': 'Number of pages',
  Edition: 'Edition',
  Series: 'Series',
  'Series number': 'Series number',
  'Number of volumes': 'Number of volumes',
  Archive: 'Archive',
  'Archive location': 'Archive location',
  'Library catalog': 'Library catalog',
  'Call number': 'Call number',
  Language: 'Language',
  Title: 'Title',
  Remove: 'Remove',
  'Short title': 'Short title',
  Rights: 'Rights',
  'Access date': 'Access date',
  'Journal abbreviation': 'Journal abbreviation',
  Volume: 'Volume',
  Issue: 'Issue',
  Pages: 'Pages',
  ISSN: 'ISSN',
  University: 'University',

  // Zotero Web API
  'Zotero sync failed': 'Zotero sync failed',
  'Zotero sync done': 'Zotero sync done',
  'conflicts skipped': 'conflicts skipped',
  'Zotero library': 'Zotero library',
  'Filter references…': 'Filter references…',
  'Sync now': 'Sync now',
  'No matching references': 'No matching references',
  'Use server copy': 'Use server copy',
  'Insert citekey': 'Insert citekey',
  'Open a markdown note to insert citations':
    'Open a markdown note to insert citations',
  Edit: 'Edit',
  Creators: 'Creators',
  'Add creator': 'Add creator',
  'First name': 'First name',
  'Last name': 'Last name',
  'Organization or full name': 'Organization or full name',
  'Language optional placeholder': '— (optional)',
  'Creator role author': 'Author',
  'Creator role editor': 'Editor',
  'Creator role translator': 'Translator',
  'Creator role contributor': 'Contributor',
  'Creator role series editor': 'Series editor',
  'Creator role book author': 'Book author',
  'Creator role composer': 'Composer',
  'Creator role reviewed author': 'Reviewed author',
  'Edit reference': 'Edit reference',
  'Item type': 'Item type',
  'Date': 'Date',
  'Publication / journal': 'Publication / journal',
  Publisher: 'Publisher',
  'URL': 'URL',
  'Extra (e.g. Citation Key)': 'Extra (e.g. Citation Key)',
  'Abstract': 'Abstract',
  'Save': 'Save',
  'Library changed on the server — use “Sync” or “Use server copy”':
    'Library changed on the server — use “Sync” or “Use server copy”',
  'Save failed': 'Save failed',
  'Cancel': 'Cancel',
  'Updated from server': 'Updated from server',
  'Could not fetch item': 'Could not fetch item',
  'Use Zotero Web API (sync)': 'Use Zotero Web API (sync)',
  'Pull and edit your library via api.zotero.org using an API key. Works on mobile. When enabled, the bibliography file path above is not used unless you override it in frontmatter.':
    'Pull and edit your library via api.zotero.org using an API key. Works on mobile. When enabled, the bibliography file path above is not used unless you override it in frontmatter.',
  'Zotero API key': 'Zotero API key',
  'Create a key at': 'Create a key at',
  'Needs library access and write access to edit items.':
    'Needs library access and write access to edit items.',
  'Could not validate API key': 'Could not validate API key',
  'API key OK': 'API key OK',
  Library: 'Library',
  'User library or a group library.': 'User library or a group library.',
  'My library': 'My library',
  'Group library': 'Group library',
  'Group ID': 'Group ID',
  'Numeric group ID from the Zotero website URL.':
    'Numeric group ID from the Zotero website URL.',
  'Linked user ID': 'Linked user ID',
  'Filled automatically after verifying the API key.':
    'Filled automatically after verifying the API key.',
  'Verify API key': 'Verify API key',
  Verify: 'Verify',
  'Sync library now': 'Sync library now',
  'Download remote changes and upload local edits.':
    'Download remote changes and upload local edits.',
  'Sync Zotero library (Web API)': 'Sync Zotero library (Web API)',
  'Open Zotero library panel': 'Open Zotero library panel',
  'Zotero library has no items — run Sync':
    'Zotero library has no items — run Sync',
  'Enable “Use Zotero Web API” in plugin settings first':
    'Enable “Use Zotero Web API” in plugin settings first',

  'Export BibTeX (.bib)': 'Export BibTeX (.bib)',
  'The synced JSON stores every Zotero object (PDFs, notes, annotations, trash). The .bib export only includes top-level works — like Zotero’s own bibliography export.':
    'The synced JSON stores every Zotero object (PDFs, notes, annotations, trash). The .bib export only includes top-level works — like Zotero’s own bibliography export.',
  'Export .bib now': 'Export .bib now',
  'Set a file path ending in .bib first':
    'Set a file path ending in .bib first',
  'BibTeX export saved': 'BibTeX export saved',
  entries: 'entries',
  'Export failed': 'Export failed',
  'Path must end with .bib': 'Path must end with .bib',
  'Export Zotero API library to BibTeX':
    'Export Zotero API library to BibTeX',
  'Set the BibTeX path in Zotero Web API settings':
    'Set the BibTeX path in Zotero Web API settings',
  'Export .bib': 'Export .bib',

  Trash: 'Trash',
  Collection: 'Collection',
  Uncategorized: 'Uncategorized',
  'Loose attachments / notes': 'Loose attachments / notes',
  'Filtered flat list — clear search for tree':
    'Filtered flat list — clear search for tree',
  'Citation key (Better BibTeX)': 'Citation key (Better BibTeX)',
  Extra: 'Extra',
  Saved: 'Saved',
  Attachments: 'Attachments',
  'Absolute path or vault-relative':
    'Absolute path, or relative to vault root',
  'Save link': 'Save link',
  'Delete attachment confirm':
    'Delete this attachment from Zotero?',
  'Attachment removed': 'Attachment removed',
  'New web link': 'New web link',
  'New linked file': 'New linked file',
  'Optional attachment title': 'Title (optional)',
  'Attachment type read-only hint':
    'Only the title can be edited for this attachment type.',
  'File path required': 'Enter a file path',
  'Select file on computer': 'Select a file on this computer',
  Add: 'Add',
  'created_but_not_in_snapshot':
    'Saved on Zotero but not loaded here — run Sync.',
  Delete: 'Delete',
  'Delete item from Zotero confirm':
    'Remove this item from Zotero? Linked child items may be affected.',
  'Item deleted': 'Item deleted',
  'Edit note': 'Edit note',
  'Note HTML hint':
    'Zotero stores notes as HTML. Edit the markup below, then save.',
  'Load group libraries': 'Load group libraries',
  'Fetch groups your API key can access':
    'Lists groups returned by the Zotero API so you can paste the numeric ID.',
  'Load groups': 'Load groups',
  'Groups loaded': 'Groups loaded',
  'No group libraries found': 'No group libraries found',
  'Verify API key first to load groups':
    'Verify the API key first so your user ID is known.',
  'Merge group libraries (IDs)': 'Merge group libraries (IDs)',
  'Comma-separated group IDs to show alongside your library. Load groups to pick names; run Sync for each cache.':
    'Comma-separated group IDs to show alongside your library. Load groups to pick names; run Sync for each cache.',
  'Toggle library subtree':
    'Show or hide nested items (notes, etc.) under this entry',
  'Badge PDF or file': 'PDF / file',
  'Badge note': 'Note',
  'Badge annotation': 'Annotation',
  'Zotero type unknown': 'Item',
  'Zotero type artwork': 'Artwork',
  'Zotero type audioRecording': 'Audio recording',
  'Zotero type bill': 'Bill',
  'Zotero type blogPost': 'Blog post',
  'Zotero type book': 'Book',
  'Zotero type bookSection': 'Book section',
  'Zotero type case': 'Case',
  'Zotero type computerProgram': 'Computer program',
  'Zotero type conferencePaper': 'Conference paper',
  'Zotero type dictionaryEntry': 'Dictionary entry',
  'Zotero type document': 'Document',
  'Zotero type email': 'E-mail',
  'Zotero type encyclopediaArticle': 'Encyclopedia article',
  'Zotero type film': 'Film',
  'Zotero type forumPost': 'Forum post',
  'Zotero type hearing': 'Hearing',
  'Zotero type instantMessage': 'Instant message',
  'Zotero type interview': 'Interview',
  'Zotero type journalArticle': 'Journal article',
  'Zotero type letter': 'Letter',
  'Zotero type magazineArticle': 'Magazine article',
  'Zotero type manuscript': 'Manuscript',
  'Zotero type map': 'Map',
  'Zotero type newspaperArticle': 'Newspaper article',
  'Zotero type patent': 'Patent',
  'Zotero type podcast': 'Podcast',
  'Zotero type presentation': 'Presentation',
  'Zotero type preprint': 'Preprint',
  'Zotero type radioBroadcast': 'Radio broadcast',
  'Zotero type report': 'Report',
  'Zotero type standard': 'Standard',
  'Zotero type statute': 'Statute',
  'Zotero type thesis': 'Thesis',
  'Zotero type tvBroadcast': 'TV broadcast',
  'Zotero type videoRecording': 'Video recording',
  'Zotero type webpage': 'Web page',
  'Merge group display names (optional)': 'Merge group display names (optional)',
  'One line per merged group: numeric ID and display name (or ID=name). Shown in the library panel and collections; overrides names from Load groups when set.':
    'One line per merged group: numeric ID and display name (or ID=name). Shown in the library panel and collections; overrides names from Load groups when set.',
  'Could not open file': 'Could not open file',
};
