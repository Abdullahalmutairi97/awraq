/* أوراق — أدوات PDF تعمل بالكامل داخل المتصفح */
(() => {
  'use strict';

  const { PDFDocument, degrees, PDFName, PDFDict, PDFArray, PDFRef, PDFNumber } = window.PDFLib;
  const pdfjsLib = window.pdfjsLib;
  if (pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const uid = () => Math.random().toString(36).slice(2, 9);

  const ICONS = {
    file: '<svg viewBox="0 0 24 24"><path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5L13.5 3Z"/><path d="M13.5 3v5.5H19"/></svg>',
    grip: '<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M3.5 6.5h17M9 6.5V4.2c0-.7.5-1.2 1.2-1.2h3.6c.7 0 1.2.5 1.2 1.2v2.3M18.6 6.5 17.6 20a2 2 0 0 1-2 1.9H8.4a2 2 0 0 1-2-1.9L5.4 6.5"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M20 6.5 9.6 17 4 11.4"/></svg>',
    merge: '<svg viewBox="0 0 24 24"><rect x="3.2" y="2.8" width="10.5" height="14.4" rx="2.2"/><rect x="10.3" y="6.8" width="10.5" height="14.4" rx="2.2"/><path d="M11.6 14.5h-4M9.8 12.7l-2.2 1.8 2.2 1.8"/></svg>',
    organize: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7.4" height="7.4" rx="2"/><rect x="13.6" y="3" width="7.4" height="7.4" rx="2"/><rect x="3" y="13.6" width="7.4" height="7.4" rx="2"/><rect x="13.6" y="13.6" width="7.4" height="7.4" rx="2"/></svg>',
    split: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.8"/><circle cx="6" cy="18" r="2.8"/><path d="M20.2 3.8 8.1 15.9M14.4 14.4l5.8 5.8M8.1 8.1l3.6 3.6"/></svg>',
    images: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2.6"/><circle cx="8.6" cy="8.6" r="1.6"/><path d="M21 15.2 16.4 10.6 5.2 21"/></svg>'
  };

  const MODES = {
    merge: {
      name: 'دمج PDF', cta: 'دمج الملفات', kind: 'pdf',
      hint: 'أضف ملفين أو أكثر، رتّب ترتيبهم، ثم ادمجهم في ملف واحد.',
      dropTitle: 'اسحب ملفات PDF هنا', dropHint: 'PDF فقط · يمكنك إضافة أكثر من ملف'
    },
    organize: {
      name: 'ترتيب الصفحات', cta: 'حفظ PDF', kind: 'pdf',
      hint: 'اسحب الصفحات، احذف أو دوّر ما لا تحتاجه، ثم احفظ ملفًا جديدًا.',
      dropTitle: 'اسحب ملف PDF هنا', dropHint: 'ستظهر كل صفحة كصورة مصغّرة'
    },
    split: {
      name: 'تقسيم PDF', cta: 'تقسيم', kind: 'pdf',
      hint: 'قسّم الملف إلى صفحات منفصلة أو نطاقات تحدّدها.',
      dropTitle: 'اسحب ملف PDF هنا', dropHint: 'PDF فقط'
    },
    images: {
      name: 'صور إلى PDF', cta: 'إنشاء PDF', kind: 'image',
      hint: 'أضف صور JPG أو PNG ورتّبها، وسنحوّلها إلى ملف PDF واحد.',
      dropTitle: 'اسحب صورك هنا', dropHint: 'JPG أو PNG · يمكنك إضافة أكثر من صورة'
    }
  };

  const state = {
    mode: null,
    docs: [],      // {id,file,name,size,bytes,pdfjs,pageCount,thumb,accepted}
    images: [],    // {id,file,name,size,url,w,h}
    pages: [],     // {id,docId,page,rot,thumb}
    sel: new Set(),
    busy: false,
    result: null,  // {blob,name}
    lastUndo: null
  };

  const el = {
    tools: $('#tools'),
    workspace: $('#workspace'),
    wsName: $('#wsName'), wsHint: $('#wsHint'), wsIcon: $('#wsIcon'), wsClose: $('#wsClose'),
    drop: $('#drop'), dropTitle: $('#dropTitle'), dropHint: $('#dropHint'),
    pickBtn: $('#pickBtn'), fileInput: $('#fileInput'), fileList: $('#fileList'),
    pagesWrap: $('#pagesWrap'), pageGrid: $('#pageGrid'),
    selectAll: $('#selectAll'), selCount: $('#selCount'),
    options: $('#options'), rangeRow: $('#rangeRow'), rangeInput: $('#rangeInput'), rangeHint: $('#rangeHint'),
    countLabel: $('#countLabel'), clearBtn: $('#clearBtn'),
    runBtn: $('#runBtn'), runLabel: $('#runLabel'),
    result: $('#result'), resultName: $('#resultName'), resultSize: $('#resultSize'), resultNote: $('#resultNote'),
    downloadBtn: $('#downloadBtn'), againBtn: $('#againBtn'),
    toast: $('#toast')
  };

  /* ---------------- helpers ---------------- */

  const fmtSize = b => b < 1024 ? `${b} بايت` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;
  const pagesWord = n => n === 1 ? 'صفحة واحدة' : n === 2 ? 'صفحتان' : (n >= 3 && n <= 10) ? `${n} صفحات` : `${n} صفحة`;
  const filesWord = n => n === 1 ? 'ملف واحد' : n === 2 ? 'ملفان' : (n >= 3 && n <= 10) ? `${n} ملفات` : `${n} ملف`;
  const baseName = name => name.replace(/\.[^.]+$/, '');
  const isPdfMode = m => m === 'merge' || m === 'organize' || m === 'split';

  let toastTimer = null;
  function toast(msg, undertone) {
    const t = el.toast;
    t.innerHTML = '';
    const span = document.createElement('span');
    span.textContent = msg;
    t.appendChild(span);
    if (undertone) {
      const b = document.createElement('button');
      b.className = 'undo';
      b.type = 'button';
      b.textContent = undertone.label;
      b.addEventListener('click', () => { t.classList.remove('show'); undertone.fn(); });
      t.appendChild(b);
    }
    t.classList.add('show');
    const bar = document.querySelector('.actionbar');
    let gap = 18;
    if (bar && !el.workspace.hidden) {
      const r = bar.getBoundingClientRect();
      if (r.top < window.innerHeight - 8) gap = Math.max(18, Math.round(window.innerHeight - r.top + 10));
    }
    t.style.bottom = `calc(${gap}px + env(safe-area-inset-bottom))`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), undertone ? 5200 : 3200);
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function busy(on, label) {
    state.busy = on;
    el.runBtn.classList.toggle('busy', on);
    el.runBtn.disabled = on || !canRun();
    el.runLabel.textContent = on ? (label || 'جارٍ المعالجة…') : (MODES[state.mode]?.cta || 'تنفيذ');
  }

  /* ---------------- pdf rendering ---------------- */

  const pageCache = new Map();
  async function renderThumb(docRec, pageNum, targetW = 150) {
    const key = `${docRec.id}:${pageNum}`;
    let pdfPage = pageCache.get(key);
    if (!pdfPage) {
      pdfPage = await docRec.pdfjs.getPage(pageNum);
      pageCache.set(key, pdfPage);
    }
    const base = pdfPage.getViewport({ scale: 1 });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = pdfPage.getViewport({ scale: (targetW * dpr) / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pdfPage.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.82);
  }

  async function loadPdfFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdfjs = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
    const rec = { id: uid(), file, name: file.name, size: file.size, bytes, pdfjs, pageCount: pdfjs.numPages, thumb: null };
    try { rec.thumb = await renderThumb(rec, 1, 120); } catch (_) { /* thumbnail is optional */ }
    return rec;
  }

  async function loadImageFile(file) {
    const url = URL.createObjectURL(file);
    const dims = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = rej;
      img.src = url;
    });
    return { id: uid(), file, name: file.name, size: file.size, url, w: dims.w, h: dims.h };
  }

  /* ---------------- mode + workspace ---------------- */

  function setMode(mode, opts = {}) {
    const prev = state.mode;
    if (prev && isPdfMode(prev) !== isPdfMode(mode)) clearFiles(true);
    state.mode = mode;

    $$('.tool-card').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.tool === mode)));
    document.body.classList.add('is-workspace');

    const cfg = MODES[mode];
    el.wsName.textContent = cfg.name;
    el.wsHint.textContent = cfg.hint;
    el.wsIcon.innerHTML = ICONS[mode];
    el.dropTitle.textContent = cfg.dropTitle;
    el.dropHint.textContent = cfg.dropHint;
    el.fileInput.accept = cfg.kind === 'pdf' ? 'application/pdf,.pdf' : 'image/jpeg,image/png,.jpg,.jpeg,.png';
    el.fileInput.value = '';
    el.runLabel.textContent = cfg.cta;

    // per-mode blocks
    el.pagesWrap.hidden = mode !== 'organize';
    el.options.hidden = mode !== 'split' && mode !== 'images';
    $$('[data-opt]').forEach(d => { d.hidden = d.dataset.opt !== mode; });

    el.result.hidden = true;
    el.workspace.hidden = false;
    if (mode === 'organize' && state.pages.length === 0 && state.docs.length) buildPages();
    render();

    if (!opts.keepScroll) {
      const top = el.workspace.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
    }
  }

  function closeWorkspace() {
    clearFiles(true);
    state.mode = null;
    document.body.classList.remove('is-workspace');
    el.workspace.hidden = true;
    el.result.hidden = true;
    $$('.tool-card').forEach(c => c.setAttribute('aria-pressed', 'false'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function clearFiles(silent) {
    for (const d of state.docs) { try { d.pdfjs.destroy(); } catch (_) {} }
    for (const im of state.images) URL.revokeObjectURL(im.url);
    pageCache.clear();
    state.docs = []; state.images = []; state.pages = []; state.sel.clear();
    state.lastUndo = null;
    el.fileList.innerHTML = '';
    el.pageGrid.innerHTML = '';
    el.selectAll.checked = false;
    el.selectAll.indeterminate = false;
    el.drop.classList.remove('has-files');
    if (!silent && state.mode) render();
  }

  /* ---------------- file intake ---------------- */

  async function addFiles(list) {
    if (!state.mode || state.busy) return;
    const files = Array.from(list || []);
    if (!files.length) return;

    const wanted = MODES[state.mode].kind;
    const accepted = [];
    for (const f of files) {
      const pdf = /pdf$/i.test(f.name) || f.type === 'application/pdf';
      const img = /\.(jpe?g|png)$/i.test(f.name) || /image\/(jpeg|png)/.test(f.type);
      if (wanted === 'pdf' && !pdf) { toast(`تخطّينا ${f.name} — ليس PDF`); continue; }
      if (wanted === 'image' && !img) { toast(`تخطّينا ${f.name} — الصيغ المدعومة JPG وPNG`); continue; }
      accepted.push(f);
    }
    if (!accepted.length) return;

    let step = 0;
    for (const f of accepted) {
      step++;
      if (accepted.length > 1) el.dropTitle.textContent = `يقرأ الملف ${step} من ${accepted.length}…`;
      try {
        if (wanted === 'pdf') {
          if (state.docs.some(d => d.name === f.name && d.size === f.size)) continue;
          const rec = await loadPdfFile(f);
          state.docs.push(rec);
          if (state.mode === 'organize') appendPagesFor(rec);
        } else {
          state.images.push(await loadImageFile(f));
        }
      } catch (err) {
        const pw = err && (err.name === 'PasswordException' || err.code === 1);
        toast(pw ? `«${f.name}» محمي بكلمة مرور` : `تعذّر قراءة «${f.name}»`);
      }
    }
    el.dropTitle.textContent = MODES[state.mode].dropTitle;
    el.fileInput.value = '';
    render();
  }

  /* ---------------- rendering ---------------- */

  function render() {
    renderFiles();
    if (state.mode === 'organize') {
      el.pagesWrap.hidden = state.docs.length === 0;
      updateSelUi();
    }
    el.drop.classList.toggle('has-files', (state.docs.length + state.images.length) > 0);
    el.selectAll.checked = state.pages.length > 0 && state.sel.size === state.pages.length;
    el.selectAll.indeterminate = state.sel.size > 0 && state.sel.size < state.pages.length;
    updateCount();
    if (state.mode === 'split') updateRangeHint();
  }

  function renderFiles() {
    el.fileList.innerHTML = '';
    if (state.mode === 'images') {
      state.images.forEach(im => {
        const row = document.createElement('div');
        row.className = 'file-row';
        row.draggable = true;
        row.dataset.id = im.id;
        row.setAttribute('role', 'listitem');
        row.innerHTML = `
          <span class="file-grip" aria-hidden="true">${ICONS.grip}</span>
          <span class="file-thumb"><img src="${im.url}" alt=""></span>
          <span class="file-main">
            <span class="file-name" title="${esc(im.name)}">${esc(im.name)}</span>
            <span class="file-meta">${im.w}×${im.h} · ${fmtSize(im.size)}</span>
          </span>
          <button class="icon-btn danger" type="button" aria-label="إزالة ${esc(im.name)}" data-remove="${im.id}">${ICONS.trash}</button>`;
        el.fileList.appendChild(row);
      });
    } else {
      state.docs.forEach(d => {
        const row = document.createElement('div');
        row.className = 'file-row';
        row.draggable = true;
        row.dataset.id = d.id;
        row.setAttribute('role', 'listitem');
        row.innerHTML = `
          <span class="file-grip" aria-hidden="true">${ICONS.grip}</span>
          <span class="file-thumb">${d.thumb ? `<img src="${d.thumb}" alt="">` : ICONS.file}</span>
          <span class="file-main">
            <span class="file-name" title="${esc(d.name)}">${esc(d.name)}</span>
            <span class="file-meta">${pagesWord(d.pageCount)} · ${fmtSize(d.size)}</span>
          </span>
          <button class="icon-btn danger" type="button" aria-label="إزالة ${esc(d.name)}" data-remove="${d.id}">${ICONS.trash}</button>`;
        el.fileList.appendChild(row);
      });
    }
    enableSort(el.fileList, '.file-row', syncFileOrder);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const pageObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      pageObserver.unobserve(e.target);
      paintPageThumb(e.target);
    }
  }, { rootMargin: '400px 0px' }) : null;

  async function paintPageThumb(tile) {
    const p = state.pages.find(x => x.id === tile.dataset.id);
    if (!p || tile.dataset.done === '1') return;
    tile.dataset.done = '1';
    try {
      if (!p.thumb) {
        const rec = state.docs.find(d => d.id === p.docId);
        p.thumb = await renderThumb(rec, p.page, 140);
      }
      const ph = tile.querySelector('.ph');
      if (ph) ph.remove();
      const img = document.createElement('img');
      img.src = p.thumb;
      img.alt = '';
      img.style.transform = `rotate(${p.rot}deg)`;
      tile.insertBefore(img, tile.firstChild);
    } catch (_) { tile.dataset.done = '0'; }
  }

  function buildPages() {
    state.pages = [];
    state.sel.clear();
    for (const d of state.docs) appendPagesFor(d, true);
    renderPages();
  }

  function appendPagesFor(rec, skipRender) {
    for (let n = 1; n <= rec.pageCount; n++) {
      state.pages.push({ id: uid(), docId: rec.id, page: n, rot: 0, thumb: null });
    }
    if (!skipRender) renderPages();
  }

  function renderPages() {
    if (pageObserver) $$('.page', el.pageGrid).forEach(t => pageObserver.unobserve(t));
    el.pageGrid.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const p of state.pages) {
      const tile = document.createElement('div');
      tile.className = 'page';
      tile.dataset.id = p.id;
      tile.setAttribute('role', 'checkbox');
      tile.setAttribute('aria-checked', String(state.sel.has(p.id)));
      tile.setAttribute('aria-label', `صفحة ${p.page}`);
      tile.tabIndex = 0;
      tile.draggable = true;
      tile.innerHTML = `
        <span class="tick" aria-hidden="true">${ICONS.check}</span>
        <span class="num">${p.page}</span>
        <span class="rot" ${p.rot ? '' : 'hidden'}>${p.rot}°</span>`;
      if (p.thumb) {
        const img = document.createElement('img');
        img.src = p.thumb;
        img.alt = '';
        img.style.transform = `rotate(${p.rot}deg)`;
        tile.appendChild(img);
      } else {
        const ph = document.createElement('span');
        ph.className = 'ph';
        tile.appendChild(ph);
      }
      frag.appendChild(tile);
      if (!p.thumb && pageObserver) pageObserver.observe(tile);
      else if (!p.thumb) paintPageThumb(tile);
    }
    el.pageGrid.appendChild(frag);
    enableSort(el.pageGrid, '.page', syncPageOrder);
    el.pagesWrap.hidden = state.pages.length === 0;
    updateSelUi();
  }

  function updateSelUi() {
    const n = state.sel.size;
    el.selCount.textContent = n ? `${n} محددة` : '';
    $$('.page', el.pageGrid).forEach(t => t.setAttribute('aria-checked', String(state.sel.has(t.dataset.id))));
    el.selectAll.checked = state.pages.length > 0 && n === state.pages.length;
    el.selectAll.indeterminate = n > 0 && n < state.pages.length;
    updateCount();
  }

  function updateCount() {
    if (!state.mode) { el.countLabel.textContent = 'لا ملفات بعد'; return; }
    if (state.mode === 'images') {
      const n = state.images.length;
      el.countLabel.textContent = n ? `${n === 1 ? 'صورة واحدة' : (n === 2 ? 'صورتان' : `${n} صور`)}` : 'لا صور بعد';
    } else {
      const total = state.mode === 'organize' ? state.pages.length : state.docs.reduce((s, d) => s + d.pageCount, 0);
      el.countLabel.textContent = state.docs.length
        ? `${filesWord(state.docs.length)} · ${pagesWord(total)}`
        : 'لا ملفات بعد';
    }
    el.runBtn.disabled = state.busy || !canRun();
  }

  function canRun() {
    if (!state.mode) return false;
    if (state.mode === 'images') return state.images.length > 0;
    if (state.mode === 'organize') return state.pages.length > 0;
    if (state.mode === 'split') return state.docs.length > 0;
    return state.docs.length > 0;
  }

  /* ---------------- drag sorting ---------------- */

  function enableSort(container, itemSel, onOrder) {
    container.__sortOrder = onOrder;
    if (container.__sortBound) return;
    container.__sortBound = true;
    let dragEl = null;
    container.addEventListener('dragstart', e => {
      const t = e.target.closest(itemSel);
      if (!t || !container.contains(t)) return;
      dragEl = t;
      t.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', t.dataset.id || 'x'); } catch (_) {}
    });
    container.addEventListener('dragend', () => {
      if (!dragEl) return;
      dragEl.classList.remove('dragging');
      dragEl = null;
      $$('.drag-over', container).forEach(n => n.classList.remove('drag-over'));
      if (typeof container.__sortOrder === 'function') container.__sortOrder();
    });
    container.addEventListener('dragover', e => {
      if (!dragEl) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const t = e.target.closest(itemSel);
      $$('.drag-over', container).forEach(n => n.classList.remove('drag-over'));
      if (!t || t === dragEl) return;
      t.classList.add('drag-over');
      const r = t.getBoundingClientRect();
      const rtl = getComputedStyle(t).direction === 'rtl';
      const insertBefore = rtl ? e.clientX > r.left + r.width / 2 : e.clientX < r.left + r.width / 2;
      container.insertBefore(dragEl, insertBefore ? t : t.nextSibling);
    });
    container.addEventListener('drop', e => {
      if (dragEl) e.preventDefault();
    });
  }

  function syncFileOrder() {
    const ids = $$('.file-row', el.fileList).map(r => r.dataset.id);
    if (state.mode === 'images') {
      state.images.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    } else {
      state.docs.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
      if (state.mode === 'organize') buildPages();
    }
  }

  function syncPageOrder() {
    const ids = $$('.page', el.pageGrid).map(r => r.dataset.id);
    state.pages.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    updateSelUi();
  }

  /* ---------------- organizer actions ---------------- */

  function togglePage(tile) {
    const id = tile.dataset.id;
    if (state.sel.has(id)) state.sel.delete(id); else state.sel.add(id);
    tile.setAttribute('aria-checked', String(state.sel.has(id)));
    updateSelUi();
  }

  function selectedPages() {
    return state.pages.filter(p => state.sel.has(p.id));
  }

  function rotateSelected() {
    const sel = selectedPages();
    if (!sel.length) return toast('حدّد صفحة أو أكثر أولًا');
    for (const p of sel) {
      p.rot = (p.rot + 90) % 360;
      const tile = $(`.page[data-id="${p.id}"]`, el.pageGrid);
      if (!tile) continue;
      const img = tile.querySelector('img');
      if (img) img.style.transform = `rotate(${p.rot}deg)`;
      const badge = tile.querySelector('.rot');
      badge.hidden = p.rot === 0;
      badge.textContent = `${p.rot}°`;
    }
  }

  function deleteSelected() {
    const sel = selectedPages();
    if (!sel.length) return toast('حدّد صفحة أو أكثر أولًا');
    const backup = state.pages.map(p => ({ ...p }));
    state.pages = state.pages.filter(p => !state.sel.has(p.id));
    state.sel.clear();
    renderPages();
    toast(`${sel.length === 1 ? 'حُذفت صفحة واحدة' : `حُذفت ${sel.length} صفحات`}`, {
      label: 'تراجع',
      fn: () => { state.pages = backup; renderPages(); }
    });
  }

  function moveSelected(dir) {
    if (!state.sel.size) return toast('حدّد صفحة أو أكثر أولًا');
    const idx = () => state.pages.map((p, i) => state.sel.has(p.id) ? i : -1).filter(i => i >= 0);
    if (dir < 0) {
      for (const i of idx()) {
        if (i === 0 || state.sel.has(state.pages[i - 1].id)) continue;
        [state.pages[i - 1], state.pages[i]] = [state.pages[i], state.pages[i - 1]];
      }
    } else {
      for (const i of idx().reverse()) {
        if (i === state.pages.length - 1 || state.sel.has(state.pages[i + 1].id)) continue;
        [state.pages[i + 1], state.pages[i]] = [state.pages[i], state.pages[i + 1]];
      }
    }
    renderPages();
    const first = $(`.page[data-id="${[...state.sel][0]}"]`, el.pageGrid);
    if (first) {
      const top = first.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  /* ---------------- processing ---------------- */

  // copyPages keeps the page widgets but not the AcroForm that registers them,
  // so a fillable form would lose its fields. Rebuild the field tree from the
  // widgets that landed in the output document.
  function rebuildAcroForm(srcDocs, out) {
    const roots = new Map();
    for (const page of out.getPages()) {
      let annots = page.node.get(PDFName.of('Annots'));
      if (!annots) continue;
      try { if (annots instanceof PDFRef) annots = out.context.lookup(annots); } catch { continue; }
      if (!(annots instanceof PDFArray)) continue;
      for (let i = 0; i < annots.size(); i++) {
        const ref = annots.get(i);
        let widget;
        try { widget = out.context.lookup(ref, PDFDict); } catch { continue; }
        if (!widget) continue;
        const subtype = widget.get(PDFName.of('Subtype'));
        if (!subtype || subtype.encodedName !== '/Widget') continue;
        let node = widget, fieldRef = ref, depth = 0;
        while (node.get(PDFName.of('Parent')) && depth++ < 16) {
          fieldRef = node.get(PDFName.of('Parent'));
          let parent;
          try { parent = out.context.lookup(fieldRef, PDFDict); } catch { break; }
          if (!parent) break;
          node = parent;
        }
        const key = fieldRef.toString();
        if (!roots.has(key)) roots.set(key, fieldRef);
      }
    }
    if (!roots.size) return false;
    let da = null;
    for (const doc of srcDocs) {
      try {
        const af = doc.catalog.lookup(PDFName.of('AcroForm'), PDFDict);
        if (af && af.get(PDFName.of('DA'))) { da = af.get(PDFName.of('DA')); break; }
      } catch { /* no form in this source */ }
    }
    const fields = out.context.obj([]);
    roots.forEach(ref => fields.push(ref));
    const form = out.context.obj({ Fields: fields });
    if (da) form.set(PDFName.of('DA'), da);
    out.catalog.set(PDFName.of('AcroForm'), out.context.register(form));
    return true;
  }

  function copyMeta(src, out) {
    if (!src) return;
    try {
      const t = src.getTitle(); if (t) out.setTitle(t);
      const a = src.getAuthor(); if (a) out.setAuthor(a);
      const s = src.getSubject(); if (s) out.setSubject(s);
      const k = src.getKeywords(); if (k) out.setKeywords(k.split(/[,;]\s*/).filter(Boolean));
    } catch { /* metadata is best effort */ }
  }

  // ---------- bookmarks (/Outlines) ----------
  // pdf-lib drops the outline tree, so walk it in the source and rebuild it in
  // the output, remapping every destination onto the copied page.

  function mapDest(src, out, pageMap, dest) {
    let arr = dest;
    try { if (arr instanceof PDFRef) arr = src.context.lookup(arr); } catch { return null; }
    if (!(arr instanceof PDFArray) || arr.size() === 0) return null;
    const pageRef = pageMap.get(arr.get(0).toString());
    if (!pageRef) return null;
    const built = out.context.obj([]);
    built.push(pageRef);
    for (let i = 1; i < arr.size(); i++) built.push(arr.get(i));
    return built;
  }

  function copyOutlineLevel(src, out, pageMap, firstRef, parentRef) {
    const refs = [];
    let ref = firstRef, guard = 0;
    while (ref && guard++ < 3000) {
      let node;
      try { node = src.context.lookup(ref, PDFDict); } catch { break; }
      if (!node) break;
      let placed = null, uriAction = null;
      const dest = node.get(PDFName.of('Dest'));
      const childFirst = node.get(PDFName.of('First'));
      if (dest) placed = mapDest(src, out, pageMap, dest);
      if (!placed) {
        let action = null;
        const actionRef = node.get(PDFName.of('A'));
        try { if (actionRef) action = src.context.lookup(actionRef, PDFDict); } catch { action = null; }
        const kind = action && action.get(PDFName.of('S'));
        if (kind && kind.encodedName === '/GoTo') {
          placed = mapDest(src, out, pageMap, action.get(PDFName.of('D')));
        } else if (kind && kind.encodedName === '/URI') {
          uriAction = action.get(PDFName.of('URI'));
        }
      }
      // a bookmark whose page did not survive (deleted or out of range) is dropped
      if (!placed && !childFirst && !uriAction) {
        ref = node.get(PDFName.of('Next'));
        continue;
      }

      const item = out.context.obj({});
      const itemRef = out.context.register(item);
      item.set(PDFName.of('Parent'), parentRef);
      const title = node.get(PDFName.of('Title'));
      if (title) item.set(PDFName.of('Title'), title);
      if (placed) item.set(PDFName.of('Dest'), placed);
      if (uriAction) {
        const a = out.context.obj({ Type: PDFName.of('Action'), S: PDFName.of('URI') });
        a.set(PDFName.of('URI'), uriAction);
        item.set(PDFName.of('A'), out.context.register(a));
      }
      if (childFirst) {
        const kids = copyOutlineLevel(src, out, pageMap, childFirst, itemRef);
        if (kids.refs.length) {
          item.set(PDFName.of('First'), kids.refs[0]);
          item.set(PDFName.of('Last'), kids.refs[kids.refs.length - 1]);
          let open = true;
          try {
            const c = node.get(PDFName.of('Count'));
            if (c && typeof c.asNumber === 'function') open = c.asNumber() >= 0;
          } catch { /* default open */ }
          item.set(PDFName.of('Count'), PDFNumber.of(open ? kids.count : -kids.count));
        }
      }
      refs.push(itemRef);
      const next = node.get(PDFName.of('Next'));
      if (!next) break;
      ref = next;
    }
    for (let i = 0; i < refs.length; i++) {
      const d = out.context.lookup(refs[i], PDFDict);
      if (i > 0) d.set(PDFName.of('Prev'), refs[i - 1]);
      if (i < refs.length - 1) d.set(PDFName.of('Next'), refs[i + 1]);
    }
    let count = refs.length;
    for (const r of refs) {
      const c = out.context.lookup(r, PDFDict).get(PDFName.of('Count'));
      if (c) count += Math.abs(c.asNumber());
    }
    return { refs, count };
  }

  function copyOutlines(sources, out, mapFor) {
    const outlines = out.context.obj({ Type: PDFName.of('Outlines') });
    const outlinesRef = out.context.register(outlines);
    const top = [];
    let total = 0;
    for (const src of sources) {
      const oref = src.catalog.get(PDFName.of('Outlines'));
      if (!oref) continue;
      let tree;
      try { tree = src.context.lookup(oref, PDFDict); } catch { continue; }
      const first = tree && tree.get(PDFName.of('First'));
      if (!first) continue;
      const res = copyOutlineLevel(src, out, mapFor(src) || new Map(), first, outlinesRef);
      if (res.refs.length) { top.push(...res.refs); total += res.count; }
    }
    if (!top.length) return false;
    top.forEach((ref, i) => {
      const d = out.context.lookup(ref, PDFDict);
      if (i > 0) d.set(PDFName.of('Prev'), top[i - 1]);
      if (i < top.length - 1) d.set(PDFName.of('Next'), top[i + 1]);
    });
    outlines.set(PDFName.of('First'), top[0]);
    outlines.set(PDFName.of('Last'), top[top.length - 1]);
    outlines.set(PDFName.of('Count'), PDFNumber.of(total));
    out.catalog.set(PDFName.of('Outlines'), outlinesRef);
    return true;
  }

  async function mergePdfs() {
    if (state.docs.length < 2) { toast('أضف ملفًا آخر على الأقل للدمج'); return; }
    const out = await PDFDocument.create();
    const loaded = [];
    const maps = new Map();
    for (const d of state.docs) {
      const src = await PDFDocument.load(d.bytes, { ignoreEncryption: false });
      loaded.push(src);
      const pages = await out.copyPages(src, src.getPageIndices());
      const pageMap = new Map();
      pages.forEach((p, i) => {
        out.addPage(p);
        pageMap.set(src.getPage(i).ref.toString(), p.ref);
      });
      maps.set(src, pageMap);
    }
    rebuildAcroForm(loaded, out);
    copyMeta(loaded[0], out);
    copyOutlines(loaded, out, src => maps.get(src));
    const bytes = await out.save();
    return { blob: new Blob([bytes], { type: 'application/pdf' }), name: `${baseName(state.docs[0].name)}-مدمج.pdf` };
  }

  async function saveOrganized() {
    if (!state.pages.length) throw new Error('empty');
    const out = await PDFDocument.create();
    const srcs = new Map();
    const maps = new Map();
    for (const p of state.pages) {
      let src = srcs.get(p.docId);
      if (!src) {
        const rec = state.docs.find(d => d.id === p.docId);
        src = await PDFDocument.load(rec.bytes);
        srcs.set(p.docId, src);
        maps.set(p.docId, new Map());
      }
      const [cp] = await out.copyPages(src, [p.page - 1]);
      if (p.rot) cp.setRotation(degrees((cp.getRotation().angle + p.rot) % 360));
      out.addPage(cp);
      maps.get(p.docId).set(src.getPage(p.page - 1).ref.toString(), cp.ref);
    }
    rebuildAcroForm([...srcs.values()], out);
    copyMeta(srcs.get(state.pages[0].docId), out);
    copyOutlines([...srcs.values()], out, (s) => {
      for (const [id, doc] of srcs) if (doc === s) return maps.get(id);
      return new Map();
    });
    const bytes = await out.save();
    const first = state.docs.find(d => d.id === state.pages[0].docId) || state.docs[0];
    return { blob: new Blob([bytes], { type: 'application/pdf' }), name: `${baseName(first.name)}-مرتّب.pdf` };
  }

  function parseRanges(text, max) {
    const norm = String(text)
      .replace(/[٠-٩]/g, ch => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)))
      .replace(/[–—−]/g, '-')
      .replace(/[،؛]/g, ',');
    const parts = norm.split(',').map(s => s.trim()).filter(Boolean);
    if (!parts.length) return { error: 'اكتب نطاقًا واحدًا على الأقل' };
    const ranges = [];
    for (const part of parts) {
      const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        let a = +m[1], b = +m[2];
        if (a > b) [a, b] = [b, a];
        if (a < 1 || b > max) return { error: `النطاق ${part} خارج نطاق الصفحات (1-${max})` };
        const pages = []; for (let i = a; i <= b; i++) pages.push(i);
        ranges.push({ label: `${a}-${b}`, pages });
        continue;
      }
      if (/^\d+$/.test(part)) {
        const n = +part;
        if (n < 1 || n > max) return { error: `الصفحة ${n} غير موجودة (1-${max})` };
        ranges.push({ label: `${n}`, pages: [n] });
        continue;
      }
      return { error: 'صيغة غير مفهومة — مثال: 1-3, 5, 8-10' };
    }
    return { ranges };
  }

  async function splitPdfs() {
    const mode = $('input[name="splitMode"]:checked').value;
    const zip = new JSZip();
    let emitted = 0;
    let single = null;

    for (const d of state.docs) {
      const src = await PDFDocument.load(d.bytes);
      const base = baseName(d.name);
      if (mode === 'every') {
        for (let n = 1; n <= src.getPageCount(); n++) {
          const out = await PDFDocument.create();
          const [cp] = await out.copyPages(src, [n - 1]);
          out.addPage(cp);
          rebuildAcroForm([src], out);
          copyMeta(src, out);
          copyOutlines([src], out, () => new Map([[src.getPage(n - 1).ref.toString(), cp.ref]]));
          const bytes = await out.save();
          const name = `${base}-صفحة-${String(n).padStart(2, '0')}.pdf`;
          zip.file(name, bytes);
          single = { bytes, name };
          emitted++;
        }
      } else {
        const parsed = parseRanges(el.rangeInput.value, src.getPageCount());
        if (parsed.error) throw new Error(parsed.error);
        for (const r of parsed.ranges) {
          const out = await PDFDocument.create();
          const idxs = r.pages.map(n => n - 1);
          const cps = await out.copyPages(src, idxs);
          cps.forEach(p => out.addPage(p));
          const pageMap = new Map();
          cps.forEach((p, i) => pageMap.set(src.getPage(idxs[i]).ref.toString(), p.ref));
          rebuildAcroForm([src], out);
          copyMeta(src, out);
          copyOutlines([src], out, () => pageMap);
          const bytes = await out.save();
          const name = `${base}-${r.label}.pdf`;
          zip.file(name, bytes);
          single = { bytes, name };
          emitted++;
        }
      }
    }
    if (!emitted) throw new Error('لم يُنتج أي ملف');
    if (emitted === 1) {
      return { blob: new Blob([single.bytes], { type: 'application/pdf' }), name: single.name };
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    return { blob, name: `${baseName(state.docs[0].name)}-مقسّم.zip` };
  }

  async function imagesToPdf() {
    const sizeMode = $('input[name="imgSize"]:checked').value;
    const out = await PDFDocument.create();
    const A4 = [595.28, 841.89];
    for (const im of state.images) {
      const bytes = new Uint8Array(await im.file.arrayBuffer());
      const isPng = /png$/i.test(im.name) || im.file.type === 'image/png';
      const img = isPng ? await out.embedPng(bytes) : await out.embedJpg(bytes);
      if (sizeMode === 'a4') {
        const page = out.addPage([A4[0], A4[1]]);
        const m = 28;
        const s = Math.min((A4[0] - m * 2) / img.width, (A4[1] - m * 2) / img.height);
        const w = img.width * s, h = img.height * s;
        page.drawImage(img, { x: (A4[0] - w) / 2, y: (A4[1] - h) / 2, width: w, height: h });
      } else {
        const w = img.width * 0.75, h = img.height * 0.75;
        const page = out.addPage([w, h]);
        page.drawImage(img, { x: 0, y: 0, width: w, height: h });
      }
    }
    const bytes = await out.save();
    const name = state.images.length === 1 ? `${baseName(state.images[0].name)}.pdf` : 'صور-إلى-PDF.pdf';
    return { blob: new Blob([bytes], { type: 'application/pdf' }), name };
  }

  async function run() {
    if (state.busy || !state.mode) return;
    if (!canRun()) return;
    busy(true);
    try {
      let res;
      if (state.mode === 'merge') res = await mergePdfs();
      else if (state.mode === 'organize') res = await saveOrganized();
      else if (state.mode === 'split') res = await splitPdfs();
      else res = await imagesToPdf();

      state.result = res;
      el.resultName.textContent = res.name;
      el.resultSize.textContent = fmtSize(res.blob.size);
      el.resultNote.textContent = res.name.endsWith('.zip')
        ? 'ملف مضغوط فيه النواتج — نزّله الآن، لن نحتفظ بأي نسخة.'
        : 'نزّل الملف الآن — لن نحتفظ بأي نسخة.';
      el.workspace.hidden = true;
      el.result.hidden = false;
      const top = el.result.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
      setTimeout(() => download(res.blob, res.name), 350);
    } catch (err) {
      const msg = err && err.message && err.message !== 'empty' ? err.message : 'حدث خطأ أثناء المعالجة';
      toast(/password|encrypt/i.test(String(err && err.message)) ? 'الملف محمي بكلمة مرور ولا يمكن معالجته' : msg);
    } finally {
      busy(false);
    }
  }

  /* ---------------- events ---------------- */

  function updateRangeHint() {
    const doc = state.docs[0];
    const custom = $('input[name="splitMode"]:checked').value === 'ranges';
    el.rangeRow.hidden = !custom;
    if (!custom) { el.rangeHint.textContent = ''; el.rangeHint.classList.remove('err'); return; }
    if (!doc) { el.rangeHint.textContent = 'أضف ملفًا أولًا لعرض عدد الصفحات'; return; }
    const parsed = parseRanges(el.rangeInput.value, doc.pageCount);
    if (!el.rangeInput.value.trim()) {
      el.rangeHint.classList.remove('err');
      el.rangeHint.textContent = `عدد الصفحات: ${doc.pageCount}`;
    } else if (parsed.error) {
      el.rangeHint.classList.add('err');
      el.rangeHint.textContent = parsed.error;
    } else {
      const n = parsed.ranges.reduce((s, r) => s + r.pages.length, 0);
      el.rangeHint.classList.remove('err');
      el.rangeHint.textContent = `${parsed.ranges.length === 1 ? 'ملف واحد' : `${parsed.ranges.length} ملفات`} · ${pagesWord(n)}`;
    }
  }

  el.tools.addEventListener('click', e => {
    const card = e.target.closest('.tool-card');
    if (!card) return;
    if (state.mode === card.dataset.tool) {
      if (el.result.hidden) return;
      el.result.hidden = true;
      el.workspace.hidden = false;
      return;
    }
    setMode(card.dataset.tool);
  });

  el.wsClose.addEventListener('click', closeWorkspace);

  el.pickBtn.addEventListener('click', e => { e.stopPropagation(); el.fileInput.click(); });
  el.drop.addEventListener('click', () => el.fileInput.click());
  el.drop.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.fileInput.click(); }
  });
  el.fileInput.addEventListener('change', () => addFiles(el.fileInput.files));

  ['dragenter', 'dragover'].forEach(ev => el.drop.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation(); el.drop.classList.add('is-over');
  }));
  ['dragleave', 'drop'].forEach(ev => el.drop.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation();
    if (ev === 'dragleave' && el.drop.contains(e.relatedTarget)) return;
    el.drop.classList.remove('is-over');
  }));
  el.drop.addEventListener('drop', e => { if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); });
  el.workspace.addEventListener('dragover', e => { if (!e.target.closest('.file-row,.page')) e.preventDefault(); });
  el.workspace.addEventListener('drop', e => {
    if (e.target.closest('.file-row,.page,.file-grip')) return;
    if (e.dataTransfer?.files?.length) { e.preventDefault(); addFiles(e.dataTransfer.files); }
  });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => e.preventDefault());

  el.fileList.addEventListener('click', e => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    const id = btn.dataset.remove;
    if (state.mode === 'images') {
      const im = state.images.find(x => x.id === id);
      if (im) URL.revokeObjectURL(im.url);
      state.images = state.images.filter(x => x.id !== id);
    } else {
      const d = state.docs.find(x => x.id === id);
      if (d) { try { d.pdfjs.destroy(); } catch (_) {} }
      state.docs = state.docs.filter(x => x.id !== id);
      if (state.mode === 'organize') buildPages();
    }
    render();
  });

  el.pageGrid.addEventListener('click', e => {
    const tile = e.target.closest('.page');
    if (tile) togglePage(tile);
  });
  el.pageGrid.addEventListener('keydown', e => {
    const tile = e.target.closest('.page');
    if (!tile) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); togglePage(tile); }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
  });

  el.selectAll.addEventListener('change', () => {
    if (el.selectAll.checked) state.pages.forEach(p => state.sel.add(p.id));
    else state.sel.clear();
    updateSelUi();
  });

  $('.page-actions').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'rotate') rotateSelected();
    if (act === 'delete') deleteSelected();
    if (act === 'move-start') moveSelected(-1);
    if (act === 'move-end') moveSelected(1);
  });

  $$('input[name="splitMode"]').forEach(r => r.addEventListener('change', updateRangeHint));
  el.rangeInput.addEventListener('input', updateRangeHint);

  el.clearBtn.addEventListener('click', () => {
    if (!state.docs.length && !state.images.length) return;
    clearFiles();
    toast('تم مسح الملفات');
  });
  el.runBtn.addEventListener('click', run);
  el.downloadBtn.addEventListener('click', () => { if (state.result) download(state.result.blob, state.result.name); });
  el.againBtn.addEventListener('click', () => {
    state.result = null;
    el.result.hidden = true;
    clearFiles();
    el.workspace.hidden = false;
    window.scrollTo({ top: Math.max(el.workspace.getBoundingClientRect().top + window.scrollY - 80, 0), behavior: 'smooth' });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.mode === 'organize' && state.sel.size) { state.sel.clear(); updateSelUi(); }
  });

  // deep link: #merge / #organize / #split / #images
  const hash = location.hash.replace('#', '');
  if (MODES[hash]) setMode(hash, { keepScroll: true });
})();
