import './view.js';

const host = document.getElementById('host');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const progress = document.getElementById('progress');
const status = document.getElementById('status');

/** @type {import('./view.js').View | null} */
let view = null;

const post = (payload) => {
  parent.postMessage({ source: 'pandocit-epub-bridge', ...payload }, '*');
};

const percentFormat = new Intl.NumberFormat(undefined, {
  style: 'percent',
  maximumFractionDigits: 0,
});

const wireNav = () => {
  if (!view) return;
  btnPrev.onclick = () => void view.goLeft();
  btnNext.onclick = () => void view.goRight();
  progress.oninput = (e) => {
    const frac = parseFloat(/** @type {HTMLInputElement} */ (e.target).value);
    if (Number.isFinite(frac)) void view.goToFraction(frac);
  };
  for (const fraction of view.getSectionFractions()) {
    const option = document.createElement('option');
    option.value = String(fraction);
    progress.appendChild(option);
  }
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowLeft' || ev.key === 'h') void view.goLeft();
    else if (ev.key === 'ArrowRight' || ev.key === 'l') void view.goRight();
  });
  view.addEventListener('relocate', ({ detail }) => {
    const { fraction, location, pageItem } = detail;
    progress.value = String(fraction);
    const loc = pageItem
      ? `p. ${pageItem.label}`
      : location?.current != null
        ? `#${location.current}`
        : '';
    status.textContent = `${percentFormat.format(fraction)} ${loc}`.trim();
    post({ type: 'pwc-relocate', fraction, location });
  });
  view.addEventListener('load', ({ detail: { doc } }) => {
    doc.addEventListener('mouseup', () => {
      const sel = doc.getSelection?.() ?? window.getSelection();
      const text = sel?.toString?.().trim();
      if (!text || text.length < 2) return;
      try {
        const range = sel.rangeCount ? sel.getRangeAt(0) : null;
        const index = view.renderer?.getContents?.()?.[0]?.index ?? 0;
        const cfi = range ? view.getCFI(index, range) : undefined;
        post({ type: 'pwc-selection', text, cfi });
        sel.removeAllRanges();
      } catch (e) {
        console.error('[PandoCit EPUB bridge] selection', e);
      }
    });
  });
};

const openBook = async ({ name, buffer, annotations }) => {
  if (view) {
    view.close();
    view.remove();
    view = null;
  }
  host.innerHTML = '';
  progress.replaceChildren();
  progress.value = '0';
  status.textContent = '';

  const bytes =
    buffer instanceof ArrayBuffer ? buffer : buffer?.buffer ?? buffer;
  const file = new File([bytes], name || 'book.epub', {
    type: 'application/epub+zip',
  });

  view = document.createElement('foliate-view');
  host.appendChild(view);
  await view.open(file);
  await view.init({ showTextStart: true });
  wireNav();

  if (Array.isArray(annotations)) {
    for (const a of annotations) {
      if (a?.cfi) view.addAnnotation({ value: a.cfi, color: a.color });
    }
  }
  post({ type: 'pwc-ready' });
};

window.addEventListener('message', (ev) => {
  const data = ev.data;
  if (!data || data.type !== 'pwc-open') return;
  openBook(data).catch((e) => {
    console.error('[PandoCit EPUB bridge]', e);
    post({ type: 'pwc-error', message: String(e?.message ?? e) });
  });
});

post({ type: 'pwc-bridge-loaded' });
