/* АРМАДА — окно печати (без inline onclick: CSP script-src 'self') */
function printWindowToolbarHtml(printLabel) {
  const label = printLabel || 'Печать';
  return `<div class="print-toolbar">
    <button type="button" id="armada-print-btn">${esc(label)}</button>
    <button type="button" class="secondary" id="armada-close-btn">Закрыть</button>
  </div>`;
}

function wirePrintWindowControls(w) {
  if (!w) return;
  const attach = () => {
    try {
      const pb = w.document.getElementById('armada-print-btn');
      const cb = w.document.getElementById('armada-close-btn');
      if (pb) pb.addEventListener('click', () => w.print());
      if (cb) cb.addEventListener('click', () => w.close());
    } catch (_) {}
  };
  if (w.document.readyState === 'complete') attach();
  else w.addEventListener('load', attach);
}

function openPrintDocumentHtml(fullHtml) {
  const w = window.open('', '_blank');
  if (!w) {
    alert('Разрешите всплывающие окна, чтобы печатать документ');
    return null;
  }
  w.document.open();
  w.document.write(fullHtml);
  w.document.close();
  wirePrintWindowControls(w);
  return w;
}
