/** Marqueur interne PandoCit — jamais affiché à l'utilisateur. */
export const PWC_MARKER_RE = /\[\[PWC:[^\]]+\]\]|\[PWC:[^\]]+\]\]?/g;

export function stripPwcMarker(text: string): string {
  return text.replace(PWC_MARKER_RE, '').replace(/\n{2,}/g, '\n').trim();
}

export function markerIdFromAnnotationId(annId: string): string {
  return annId.replace(/^pdf-/, '');
}
