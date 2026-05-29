import * as pdfjsLib from '../build/pdf.mjs';
import { EventBus, PDFLinkService, PDFViewer } from './pdf_viewer.mjs';

const params = new URLSearchParams(location.search);
const file = params.get('file');
const pageParam = Number(params.get('page') || '1');

const eventBus = new EventBus();
const linkService = new PDFLinkService({ eventBus });
const viewerContainer = document.getElementById('viewerContainer');
const viewer = document.getElementById('viewer');
const pageInfo = document.getElementById('pageInfo');
const pageInput = document.getElementById('pageInput');

pdfjsLib.GlobalWorkerOptions.workerSrc = '../build/pdf.worker.mjs';

const pdfViewer = new PDFViewer({
  container: viewerContainer,
  viewer,
  eventBus,
  linkService,
  textLayerMode: 1,
  annotationMode: 2,
});
linkService.setViewer(pdfViewer);

const loadingTask = pdfjsLib.getDocument({
  url: file,
  cMapUrl: '../cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '../standard_fonts/',
  wasmUrl: '../wasm/',
  iccUrl: '../iccs/',
});

const pdfDoc = await loadingTask.promise;
pdfViewer.setDocument(pdfDoc);
linkService.setDocument(pdfDoc, null);

const initialPage = Math.max(
  1,
  Math.min(pdfDoc.numPages, Number.isFinite(pageParam) ? pageParam : 1)
);
pdfViewer.currentPageNumber = initialPage;
pageInput.value = String(initialPage);
pageInfo.textContent = `${initialPage} / ${pdfDoc.numPages}`;

eventBus.on('pagechanging', ({ pageNumber }) => {
  pageInput.value = String(pageNumber);
  pageInfo.textContent = `${pageNumber} / ${pdfDoc.numPages}`;
});

document.getElementById('prev').addEventListener('click', () => {
  pdfViewer.currentPageNumber = Math.max(1, pdfViewer.currentPageNumber - 1);
});
document.getElementById('next').addEventListener('click', () => {
  pdfViewer.currentPageNumber = Math.min(
    pdfDoc.numPages,
    pdfViewer.currentPageNumber + 1
  );
});
document.getElementById('go').addEventListener('click', () => {
  const p = Number(pageInput.value || '1');
  if (!Number.isFinite(p)) return;
  pdfViewer.currentPageNumber = Math.max(1, Math.min(pdfDoc.numPages, p));
});
document.getElementById('zoomIn').addEventListener('click', () => {
  pdfViewer.currentScale = Math.min(4, (pdfViewer.currentScale || 1) * 1.15);
});
document.getElementById('zoomOut').addEventListener('click', () => {
  pdfViewer.currentScale = Math.max(0.25, (pdfViewer.currentScale || 1) / 1.15);
});
