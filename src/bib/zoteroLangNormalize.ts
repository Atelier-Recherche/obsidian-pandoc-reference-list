/**
 * Zotero stocke souvent des codes ISO 639-2 (ex. « ger ») ou des noms de langue ;
 * la liste CSL utilise des locales BCP 47 (ex. de-DE). On fait la correspondance
 * pour pré-sélectionner le menu déroulant et afficher un libellé lisible.
 */

const ISO639_2_TO_CSL: Record<string, string> = {
  ger: 'de-DE',
  deu: 'de-DE',
  eng: 'en-US',
  fre: 'fr-FR',
  fra: 'fr-FR',
  spa: 'es-ES',
  ita: 'it-IT',
  por: 'pt-PT',
  dut: 'nl-NL',
  nld: 'nl-NL',
  rus: 'ru-RU',
  pol: 'pl-PL',
  swe: 'sv-SE',
  nor: 'nb-NO',
  dan: 'da-DK',
  fin: 'fi-FI',
  hun: 'hu-HU',
  cze: 'cs-CZ',
  ces: 'cs-CZ',
  slo: 'sk-SK',
  slk: 'sk-SK',
  rum: 'ro-RO',
  ron: 'ro-RO',
  gre: 'el-GR',
  ell: 'el-GR',
  tur: 'tr-TR',
  chi: 'zh-CN',
  zho: 'zh-CN',
  jpn: 'ja-JP',
  ara: 'ar',
  per: 'fa-IR',
  fas: 'fa-IR',
  heb: 'he-IL',
  ukr: 'uk-UA',
};

const NAME_OR_ALIAS_TO_CSL: Record<string, string> = {
  german: 'de-DE',
  deutsch: 'de-DE',
  allemand: 'de-DE',
  english: 'en-US',
  anglais: 'en-US',
  french: 'fr-FR',
  français: 'fr-FR',
  fran: 'fr-FR',
  spanish: 'es-ES',
  espagnol: 'es-ES',
  italian: 'it-IT',
  portuguese: 'pt-PT',
  dutch: 'nl-NL',
  holland: 'nl-NL',
  russian: 'ru-RU',
  polish: 'pl-PL',
  swedish: 'sv-SE',
  norwegian: 'nb-NO',
  danish: 'da-DK',
  finnish: 'fi-FI',
  hungarian: 'hu-HU',
  czech: 'cs-CZ',
  slovak: 'sk-SK',
  romanian: 'ro-RO',
  greek: 'el-GR',
  turkish: 'tr-TR',
  chinese: 'zh-CN',
  japanese: 'ja-JP',
  arabic: 'ar',
  hebrew: 'he-IL',
  ukrainian: 'uk-UA',
};

const ISO639_1_TO_CSL: Record<string, string> = {
  de: 'de-DE',
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  pt: 'pt-PT',
  nl: 'nl-NL',
  ru: 'ru-RU',
  pl: 'pl-PL',
  sv: 'sv-SE',
  no: 'nb-NO',
  nb: 'nb-NO',
  nn: 'nn-NO',
  da: 'da-DK',
  fi: 'fi-FI',
  hu: 'hu-HU',
  cs: 'cs-CZ',
  sk: 'sk-SK',
  ro: 'ro-RO',
  el: 'el-GR',
  tr: 'tr-TR',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ar: 'ar',
  fa: 'fa-IR',
  he: 'he-IL',
  uk: 'uk-UA',
};

export type LangOption = { value: string; label: string };

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/_/g, '-');
}

function valueExists(value: string, list: LangOption[]): boolean {
  return list.some((l) => l.value === value);
}

/**
 * Retourne une valeur présente dans `langListRaw` (ou '' si inconnu).
 */
export function matchStoredLanguageToCslLocale(
  raw: string | undefined | null,
  langList: LangOption[]
): string {
  if (typeof raw !== 'string' || !raw.trim()) return '';
  const t = raw.trim();
  const n = norm(t);

  if (valueExists(t, langList)) return t;

  // BCP 47 déjà normalisé (ex. de-de → casse API)
  const lower = t.toLowerCase();
  const hitCase = langList.find((l) => l.value.toLowerCase() === lower);
  if (hitCase) return hitCase.value;

  const iso2 = ISO639_2_TO_CSL[n];
  if (iso2 && valueExists(iso2, langList)) return iso2;

  const name = NAME_OR_ALIAS_TO_CSL[n];
  if (name && valueExists(name, langList)) return name;

  const iso1 = ISO639_1_TO_CSL[n];
  if (iso1 && valueExists(iso1, langList)) return iso1;

  // Ex. "de" seul
  if (/^[a-z]{2}$/i.test(n)) {
    const byPrimary = langList.find((l) => l.value.toLowerCase().startsWith(`${n}-`));
    if (byPrimary) return byPrimary.value;
  }

  // Correspondance sur le libellé (ex. "German" → entrée "Deutsch (Deutschland)")
  const byLabel = langList.find((l) => {
    const lab = l.label.toLowerCase();
    return lab.includes(n) || n.length >= 3 && lab.includes(n.slice(0, 3));
  });
  if (byLabel) return byLabel.value;

  return '';
}
