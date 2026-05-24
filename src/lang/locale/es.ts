// español — cadenas completas del plugin

export default {
  'Plugin interface language': 'Idioma de la interfaz del plugin',
  'Display language for this plugin (settings, notices, side panel).':
    'Idioma de este plugin (ajustes, avisos, panel lateral).',
  'Download Pandoc WASM': 'Descargar Pandoc WASM',
  'Installs pandoc.wasm from Pandoc 3.9 next to main.js (official release ZIP). Reload Obsidian after install. Download works on desktop and mobile (including Android).':
    'Instala pandoc.wasm (Pandoc 3.9) junto a main.js (ZIP oficial). Recargue Obsidian después. La descarga funciona en escritorio y móvil (incluido Android).',
  'Download WASM': 'Descargar WASM',
  'Downloading Pandoc WASM…': 'Descargando Pandoc WASM…',
  'pandoc.wasm is already in the plugin folder.':
    'pandoc.wasm ya está en la carpeta del plugin.',
  'Pandoc WASM installed. Reload Obsidian to apply.':
    'Pandoc WASM instalado. Recargue Obsidian para usarlo.',
  'Pandoc WASM download failed.': 'Error al descargar Pandoc WASM.',
  Installed: 'Instalado',

  'Path to bibliography file': 'Ruta del archivo de bibliografía',
  'The absolute path to your desired bibliography file. This can be overridden on a per-file basis by setting "bibliography" in the file\'s frontmatter.':
    'Ruta absoluta al archivo de bibliografía. Se puede sobrescribir por nota con «bibliography» en metadatos.',
  'Select a bibliography file.': 'Elegir archivo de bibliografía.',
  'Custom citation style': 'Estilo de cita personalizado',
  'Citation style': 'Estilo de cita',
  'Citation style language': 'Idioma del estilo de cita',
  'Search...': 'Buscar…',
  'Path to a CSL file. This can be an absolute path or one relative to your vault. This will override the style selected above. This can be overridden on a per-file basis by setting "csl" or "citation-style" in the file\'s frontmatter. A URL can be supplied when setting the style via frontmatter.':
    'Ruta a un archivo CSL (absoluta o relativa al vault). Sustituye el estilo anterior; por nota con «csl» o «citation-style». URL posible en metadatos.',
  'Select a CSL file located on your computer':
    'Elegir archivo CSL en este equipo',
  'File selection is only available on desktop. Please enter the path manually.':
    'El selector solo está en escritorio. Introduzca la ruta manualmente.',
  'Hide links in references': 'Ocultar enlaces en referencias',
  'Replace links with link icons to save space.':
    'Sustituye enlaces por iconos para ahorrar espacio.',
  'Show citekey tooltips': 'Tooltips en claves de cita',
  'When enabled, hovering over citekeys will open a tooltip containing a formatted citation.':
    'Al pasar el cursor muestra un tooltip con la referencia formateada.',
  'Tooltip delay': 'Retraso del tooltip',
  'Set the amount of time (in milliseconds) to wait before displaying tooltips.':
    'Tiempo de espera en milisegundos antes del tooltip.',
  'Open PDF links in new tab': 'Abrir PDF en una pestaña nueva',
  'When enabled, vault PDFs opened from citekey tooltips or the Zotero library open in a new tab. When disabled, Obsidian may split the current pane instead.':
    'Si está activado, los PDF del cofre abiertos desde tooltips o el panel Zotero se abren en una pestaña nueva. Si no, Obsidian puede dividir el panel.',
  'Validate Pandoc configuration': 'Validar configuración de Pandoc',
  Validate: 'Validar',
  'Validation successful': 'Validación correcta',
  'Show citekey suggestions': 'Sugerencias de claves de cita',
  'When enabled, an autocomplete dialog will display when typing citation keys.':
    'Muestra autocompletado al escribir claves.',
  'Zotero port': 'Puerto de Zotero',
  "Use 24119 for Juris-M or specify a custom port if you have changed Zotero's default.":
    'Use 24119 para Juris-M o un puerto personalizado si cambió Zotero.',
  'Render live preview inline citations':
    'Citas en vista previa en vivo',
  'Render reading mode inline citations':
    'Citas en modo lectura',
  'Convert [@pandoc] citations to formatted inline citations in live preview mode.':
    'Convierte citas [@…] en citas formateadas en vista previa.',
  'Convert [@pandoc] citations to formatted inline citations in reading mode.':
    'Convierte citas [@…] en citas formateadas en modo lectura.',
  'Process citations in links': 'Procesar citas en enlaces',
  'Include [[@pandoc]] citations in the reference list and format them as inline citations in live preview mode.':
    'Incluye citas [[@…]] en la lista y las formatea en vista previa.',

  'Click to copy': 'Clic para copiar',
  'Copy list': 'Copiar lista',
  'No citations found in the current document.':
    'No hay citas en el documento actual.',
  References: 'Referencias',
  'This can be overridden on a per-file basis by setting "lang" or "citation-language" in the file\'s frontmatter. A language code must be used when setting the language via frontmatter.':
    'Se puede sobrescribir por nota con «lang» o «citation-language» en metadatos (código de idioma obligatorio).',
  'See here for a list of available language codes':
    'Lista de códigos de idioma',
  'Cannot connect to Zotero': 'No se puede conectar a Zotero',
  'Start Zotero and try again.': 'Abra Zotero e inténtelo de nuevo.',
  'Libraries to include in bibliography':
    'Bibliotecas en la bibliografía',
  'Please provide the path to your pandoc compatible bibliography file in the PandoCit plugin settings.':
    'Indique la ruta del archivo de bibliografía compatible con Pandoc en los ajustes del plugin.',
  'Refresh bibliography': 'Actualizar bibliografía',
  'Pandoc reference list settings': 'Ajustes de PandoCit',
  'Unable to load pandoc.wasm; reference list is disabled on this platform.':
    'No se puede cargar pandoc.wasm; la lista de referencias está desactivada en esta plataforma.',

  'No citation found for ': 'No hay cita para ',

  'Show reference list': 'Mostrar lista de referencias',

  'Open literature note': 'Abrir nota de lectura',
  'Open in Zotero': 'Abrir en Zotero',
  'Open PDF at cited page': 'Abrir PDF en la página citada',
  'Open linked PDF': 'Abrir PDF vinculado',
  'Local file': 'Archivo local',
  'Web link': 'Enlace web',
  'Show citation info': 'Mostrar cita',
  'PDF not in vault or unavailable on mobile':
    'El PDF no está en el cofre o no se puede abrir en móvil',
  'PDF open path label': 'Ruta Zotero',
  'PDF open strategy label': 'Resolución',
  'PDF open tried label': 'Probado',
  'PDF open log hint':
    'Detalles en la consola de desarrollo: filtre por [PandoCit PDF]',
  'PDF open failed see console':
    'No se pudo abrir el PDF — consola ([PandoCit PDF])',
  'Local file open is only available on desktop':
    'Abrir archivo local solo en escritorio',
  'Edit item form hint':
    'Desplace el formulario, edite los campos y guarde. Use el campo de clave de cita para Better BibTeX.',
  'Creators (JSON)': 'Autores (JSON)',
  'Creators JSON hint':
    'Array de autores Zotero, ej. [{ "creatorType": "author", "firstName": "A", "lastName": "B" }].',
  'Invalid creators JSON': 'JSON de autores no válido',
  Place: 'Lugar',
  ISBN: 'ISBN',
  'Number of pages': 'Número de páginas',
  Edition: 'Edición',
  Series: 'Serie',
  'Series number': 'Número de serie',
  'Number of volumes': 'Número de volúmenes',
  Archive: 'Archivo',
  'Archive location': 'Ubicación en archivo',
  'Library catalog': 'Catálogo',
  'Call number': 'Signatura',
  Language: 'Idioma',
  Title: 'Título',
  Remove: 'Quitar',
  'Short title': 'Título corto',
  Rights: 'Derechos',
  'Access date': 'Fecha de consulta',
  'Journal abbreviation': 'Abreviatura de la revista',
  Volume: 'Volumen',
  Issue: 'Número',
  Pages: 'Páginas',
  ISSN: 'ISSN',
  University: 'Universidad',

  'Zotero sync failed': 'Error de sincronización Zotero',
  'Zotero sync done': 'Sincronización Zotero terminada',
  'conflicts skipped': 'conflictos omitidos',
  'Zotero library': 'Biblioteca Zotero',
  'Filter references…': 'Filtrar referencias…',
  'Sync now': 'Sincronizar',
  'No matching references': 'Ninguna referencia coincide',
  'Use server copy': 'Usar copia del servidor',
  'Insert citekey': 'Insertar clave',
  'Open a markdown note to insert citations':
    'Abra una nota Markdown para insertar citas',
  Edit: 'Editar',
  Creators: 'Autores',
  'Add creator': 'Añadir autor',
  'First name': 'Nombre',
  'Last name': 'Apellido',
  'Organization or full name': 'Organización o nombre completo',
  'Language optional placeholder': '— (opcional)',
  'Creator role author': 'Autor',
  'Creator role editor': 'Editor',
  'Creator role translator': 'Traductor',
  'Creator role contributor': 'Colaborador',
  'Creator role series editor': 'Director de colección',
  'Creator role book author': 'Autor del libro',
  'Creator role composer': 'Compositor',
  'Creator role reviewed author': 'Autor reseñado',
  'Edit reference': 'Editar referencia',
  'Item type': 'Tipo de documento',
  'Date': 'Fecha',
  'Publication / journal': 'Publicación / revista',
  Publisher: 'Editorial',
  'URL': 'URL',
  'Extra (e.g. Citation Key)': 'Extra (p. ej. clave de cita)',
  'Abstract': 'Resumen',
  'Save': 'Guardar',
  'Library changed on the server — use “Sync” or “Use server copy”':
    'La biblioteca cambió en el servidor — use «Sincronizar» o «Usar copia del servidor»',
  'Save failed': 'Error al guardar',
  'Cancel': 'Cancelar',
  'Updated from server': 'Actualizado desde el servidor',
  'Could not fetch item': 'No se pudo obtener el elemento',
  'Use Zotero Web API (sync)': 'Usar API web de Zotero (sync)',
  'Pull and edit your library via api.zotero.org using an API key. Works on mobile. When enabled, the bibliography file path above is not used unless you override it in frontmatter.':
    'Sincronice y edite su biblioteca con api.zotero.org y una clave API. Funciona en móvil. Si está activo, la ruta de bibliografía superior no se usa salvo metadatos.',
  'Zotero API key': 'Clave API de Zotero',
  'Create a key at': 'Cree una clave en',
  'Needs library access and write access to edit items.':
    'Requiere acceso a la biblioteca y permiso de escritura.',
  'Could not validate API key': 'No se pudo validar la clave API',
  'API key OK': 'Clave API correcta',
  Library: 'Biblioteca',
  'User library or a group library.': 'Biblioteca personal o de grupo.',
  'My library': 'Mi biblioteca',
  'Group library': 'Biblioteca de grupo',
  'Group ID': 'ID de grupo',
  'Numeric group ID from the Zotero website URL.':
    'ID numérico del grupo en la URL del sitio Zotero.',
  'Linked user ID': 'ID de usuario vinculado',
  'Filled automatically after verifying the API key.':
    'Se rellena automáticamente al verificar la clave.',
  'Verify API key': 'Verificar clave API',
  Verify: 'Verificar',
  'Sync library now': 'Sincronizar biblioteca',
  'Download remote changes and upload local edits.':
    'Descarga cambios remotos y sube ediciones locales.',
  'Sync Zotero library (Web API)': 'Sincronizar biblioteca Zotero (API)',
  'Open Zotero library panel': 'Abrir panel biblioteca Zotero',
  'Zotero library has no items — run Sync':
    'La biblioteca Zotero está vacía — ejecute sincronización',
  'Enable “Use Zotero Web API” in plugin settings first':
    'Active primero «Usar API web de Zotero» en los ajustes',

  'Export BibTeX (.bib)': 'Exportar BibTeX (.bib)',
  'The synced JSON stores every Zotero object (PDFs, notes, annotations, trash). The .bib export only includes top-level works — like Zotero’s own bibliography export.':
    'El JSON sincronizado guarda todos los objetos Zotero (PDFs, notas, anotaciones, papelera). El export .bib solo incluye obras de nivel superior — como el export de Zotero.',
  'Export .bib now': 'Exportar .bib ahora',
  'Set a file path ending in .bib first':
    'Indique primero una ruta que termine en .bib',
  'BibTeX export saved': 'Export BibTeX guardado',
  entries: 'entradas',
  'Export failed': 'Error en exportación',
  'Path must end with .bib': 'La ruta debe terminar en .bib',
  'Export Zotero API library to BibTeX':
    'Exportar biblioteca API Zotero a BibTeX',
  'Set the BibTeX path in Zotero Web API settings':
    'Configure la ruta BibTeX en los ajustes API Zotero',
  'Export .bib': 'Exportar .bib',

  Trash: 'Papelera',
  Collection: 'Colección',
  Uncategorized: 'Sin colección',
  'Loose attachments / notes': 'Adjuntos / notas sueltos',
  'Filtered flat list — clear search for tree':
    'Lista filtrada — borre la búsqueda para el árbol',
  'Citation key (Better BibTeX)': 'Clave de cita (Better BibTeX)',
  Extra: 'Extra',
  Saved: 'Guardado',
  Attachments: 'Adjuntos',
  'Absolute path or vault-relative':
    'Ruta absoluta o relativa a la raíz del almacén',
  'Save link': 'Guardar enlace',
  'Delete attachment confirm':
    '¿Eliminar este adjunto en Zotero?',
  'Attachment removed': 'Adjunto eliminado',
  'New web link': 'Nuevo enlace web',
  'New linked file': 'Nuevo archivo vinculado',
  'Optional attachment title': 'Título (opcional)',
  'Attachment type read-only hint':
    'Solo se puede editar el título para este tipo de adjunto.',
  'File path required': 'Indique una ruta de archivo',
  'Select file on computer': 'Elegir un archivo en este equipo',
  Add: 'Añadir',
  'created_but_not_in_snapshot':
    'Guardado en Zotero pero no cargado aquí — ejecute sincronización.',
  Delete: 'Eliminar',
  'Delete item from Zotero confirm':
    '¿Quitar este elemento de Zotero? Los elementos hijos pueden verse afectados.',
  'Item deleted': 'Elemento eliminado',
  'Edit note': 'Editar nota',
  'Note HTML hint':
    'Zotero guarda las notas como HTML. Edite el marcado abajo y guarde.',
  'Load group libraries': 'Cargar bibliotecas de grupo',
  'Fetch groups your API key can access':
    'Lista los grupos de la API de Zotero para indicar el ID numérico.',
  'Load groups': 'Cargar grupos',
  'Groups loaded': 'Grupos cargados',
  'No group libraries found': 'No hay bibliotecas de grupo',
  'Verify API key first to load groups':
    'Verifique primero la clave API para conocer el ID de usuario.',
  'Merge group libraries (IDs)':
    'Fusionar bibliotecas de grupo (IDs)',
  'Comma-separated group IDs to show alongside your library. Load groups to pick names; run Sync for each cache.':
    'IDs de grupo separados por comas. Cargue grupos para los nombres; sincronice cada caché.',
  'Toggle library subtree':
    'Mostrar u ocultar elementos anidados bajo esta entrada',
  'Badge PDF or file': 'PDF / archivo',
  'Badge note': 'Nota',
  'Badge annotation': 'Anotación',
  'Zotero type unknown': 'Elemento',
  'Zotero type artwork': 'Obra de arte',
  'Zotero type audioRecording': 'Grabación de audio',
  'Zotero type bill': 'Proyecto de ley',
  'Zotero type blogPost': 'Entrada de blog',
  'Zotero type book': 'Libro',
  'Zotero type bookSection': 'Capítulo de libro',
  'Zotero type case': 'Sentencia',
  'Zotero type computerProgram': 'Programa informático',
  'Zotero type conferencePaper': 'Comunicación',
  'Zotero type dictionaryEntry': 'Entrada de diccionario',
  'Zotero type document': 'Documento',
  'Zotero type email': 'Correo electrónico',
  'Zotero type encyclopediaArticle': 'Artículo de enciclopedia',
  'Zotero type film': 'Película',
  'Zotero type forumPost': 'Mensaje de foro',
  'Zotero type hearing': 'Audiencia',
  'Zotero type instantMessage': 'Mensaje instantáneo',
  'Zotero type interview': 'Entrevista',
  'Zotero type journalArticle': 'Artículo de revista',
  'Zotero type letter': 'Carta',
  'Zotero type magazineArticle': 'Artículo de revista ilustrada',
  'Zotero type manuscript': 'Manuscrito',
  'Zotero type map': 'Mapa',
  'Zotero type newspaperArticle': 'Artículo de periódico',
  'Zotero type patent': 'Patente',
  'Zotero type podcast': 'Pódcast',
  'Zotero type presentation': 'Presentación',
  'Zotero type preprint': 'Prepublicación',
  'Zotero type radioBroadcast': 'Programa de radio',
  'Zotero type report': 'Informe',
  'Zotero type standard': 'Norma',
  'Zotero type statute': 'Texto legal',
  'Zotero type thesis': 'Tesis',
  'Zotero type tvBroadcast': 'Programa de TV',
  'Zotero type videoRecording': 'Grabación de vídeo',
  'Zotero type webpage': 'Página web',
  'Merge group display names (optional)':
    'Nombres para grupos fusionados (opcional)',
  'One line per merged group: numeric ID and display name (or ID=name). Shown in the library panel and collections; overrides names from Load groups when set.':
    'Una línea por grupo: ID numérico y nombre, o ID=nombre. En el panel y colecciones; sustituye los nombres de « Cargar grupos ».',
  'Could not open file': 'No se pudo abrir el archivo',
};
