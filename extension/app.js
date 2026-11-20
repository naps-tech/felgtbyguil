(function () {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  // ---------- Almacenamiento de la configuración ----------
  const store = {
    async get() {
      try {
        if (hasChrome) return (await chrome.storage.local.get('settings')).settings || {};
        return JSON.parse(localStorage.getItem('fel-settings') || '{}');
      } catch { return {}; }
    },
    async set(v) {
      try {
        if (hasChrome) await chrome.storage.local.set({ settings: v });
        else localStorage.setItem('fel-settings', JSON.stringify(v));
      } catch (e) { toast('No se pudo guardar la configuración: ' + e.message); }
    }
  };

  let settings = Object.assign({}, FelRender.DEFAULTS);
  const docs = []; // { id, name, fel?, error? }
  let seq = 0;

  // ---------- Utilidades ----------
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 4500);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const readText = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsText(f, 'UTF-8'); });
  const readDataUrl = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); });

  // Reduce el logo para que la configuración no pese demasiado.
  async function prepararLogo(file) {
    const url = await readDataUrl(file);
    if (file.type === 'image/svg+xml') return url;
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const max = 600;
    const k = Math.min(1, max / Math.max(img.width, img.height));
    if (k === 1 && file.size < 300000) return url;
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }

  // ---------- Documentos ----------
  function addXml(text, name) {
    const d = { id: ++seq, name: name || 'documento.xml' };
    try {
      d.fel = FEL.parseFel(text);
      const aut = d.fel.certificacion && d.fel.certificacion.autorizacion;
      if (aut && docs.some(x => x.fel && x.fel.certificacion && x.fel.certificacion.autorizacion === aut)) {
        toast('«' + d.name + '» ya estaba cargado.');
        return;
      }
    } catch (e) {
      d.error = e.message;
    }
    docs.push(d);
  }

  async function addFiles(files) {
    for (const f of Array.from(files)) {
      if (!/\.xml$/i.test(f.name) && !/xml/.test(f.type)) { toast('«' + f.name + '» no es un archivo XML.'); continue; }
      try { addXml(await readText(f), f.name); } catch (e) { toast('No se pudo leer ' + f.name + ': ' + e.message); }
    }
    render();
  }

  function docTitulo(fel) {
    const c = fel.certificacion || {};
    return fel.tipoNombre + (c.serie ? ' ' + c.serie + '-' + c.numero : '');
  }

  function renderList() {
    const ul = $('#docs');
    if (!docs.length) {
      ul.innerHTML = '<li class="empty">Todavía no hay documentos cargados.</li>';
      $('#printAll').disabled = true;
      return;
    }
    $('#printAll').disabled = !docs.some(d => d.fel);
    $('#printAll').textContent = docs.filter(d => d.fel).length > 1 ? 'Imprimir / Guardar PDF (todos)' : 'Imprimir / Guardar PDF';
    ul.innerHTML = docs.map(d => {
      if (d.error) {
        return `<li class="doc err" data-id="${d.id}">
          <div class="doc-h"><b>${esc(d.name)}</b><button class="link" data-act="del">Quitar</button></div>
          <div class="msg error">${esc(d.error)}</div></li>`;
      }
      const f = d.fel;
      const peor = f.validaciones.some(v => v.nivel === 'error') ? 'error' : f.validaciones.some(v => v.nivel === 'warn') ? 'warn' : 'ok';
      const etiqueta = { ok: 'Coherente', warn: 'Revisar', error: 'No válido' }[peor];
      return `<li class="doc" data-id="${d.id}">
        <div class="doc-h"><b>${esc(docTitulo(f))}</b><span class="badge ${peor}">${etiqueta}</span></div>
        <div class="doc-s">${esc(f.receptor.nombre)} · ${esc(f.moneda)} ${Number(f.granTotal).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <details><summary>Revisiones del XML</summary><ul class="checks">${f.validaciones.map(v => `<li class="${v.nivel}">${esc(v.texto)}</li>`).join('')}</ul></details>
        <div class="doc-a">
          <button class="btn small" data-act="print">Imprimir esta</button>
          ${f.urlVerificacion ? `<a class="btn small" href="${esc(f.urlVerificacion)}" target="_blank" rel="noopener">Verificar en SAT</a>` : ''}
          <button class="link" data-act="del">Quitar</button>
        </div></li>`;
    }).join('');
  }

  function renderPreview() {
    const main = $('#preview');
    main.innerHTML = '';
    const ok = docs.filter(d => d.fel);
    if (!ok.length) {
      main.innerHTML = '<div class="placeholder no-print"><p>Cargue un XML de factura FEL para ver aquí la vista previa.</p></div>';
      return;
    }
    for (const d of ok) {
      try {
        const page = FelRender.renderInvoice(d.fel, settings);
        page.dataset.id = d.id;
        main.appendChild(page);
      } catch (e) {
        const div = document.createElement('div');
        div.className = 'placeholder no-print';
        div.textContent = 'Error al generar ' + d.name + ': ' + e.message;
        main.appendChild(div);
      }
    }
  }

  function applyPaper() {
    const a4 = settings.papel === 'A4';
    document.body.classList.toggle('paper-a4', a4);
    $('#page-size').textContent = '@page { size: ' + (a4 ? 'A4' : 'letter') + '; margin: 10mm; }';
  }

  function render() {
    applyPaper();
    renderList();
    renderPreview();
  }

  // ---------- Impresión ----------
  function imprimir(id) {
    const ok = docs.filter(d => d.fel && (id == null || d.id === id));
    if (!ok.length) return;
    const tituloOriginal = document.title;
    // El título se usa como nombre sugerido del PDF.
    document.title = ok.length === 1 ? docTitulo(ok[0].fel).replace(/[\\/:*?"<>|]/g, '-') : 'Facturas FEL (' + ok.length + ')';
    document.querySelectorAll('.fel-page').forEach(p => p.classList.toggle('skip-print', id != null && Number(p.dataset.id) !== id));
    const fin = () => {
      document.title = tituloOriginal;
      document.querySelectorAll('.fel-page.skip-print').forEach(p => p.classList.remove('skip-print'));
      window.removeEventListener('afterprint', fin);
    };
    window.addEventListener('afterprint', fin);
    window.print();
  }

  // ---------- Formulario de personalización ----------
  const form = $('#settings');
  function fillForm() {
    for (const elx of form.elements) {
      if (!elx.name || !(elx.name in settings)) continue;
      if (elx.type === 'checkbox') elx.checked = !!settings[elx.name];
      else elx.value = settings[elx.name];
    }
    const lp = $('#logoPreview');
    lp.hidden = !settings.logo;
    if (settings.logo) lp.src = settings.logo; else lp.removeAttribute('src');
  }
  let saveTimer;
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => store.set(settings), 300);
  }
  function onFormChange(ev) {
    const t = ev.target;
    if (!t.name) return;
    settings[t.name] = t.type === 'checkbox' ? t.checked : (t.type === 'range' || t.name === 'decimales' ? Number(t.value) : t.value);
    saveSoon();
    render();
  }
  form.addEventListener('input', onFormChange);
  form.addEventListener('change', onFormChange);

  $('#logoPick').addEventListener('click', () => $('#logoFile').click());
  $('#logoFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      settings.logo = await prepararLogo(f);
      fillForm(); saveSoon(); render();
    } catch { toast('No se pudo leer la imagen.'); }
  });
  $('#logoClear').addEventListener('click', () => { settings.logo = ''; fillForm(); saveSoon(); render(); });

  $('#export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'configuracion-factura-fel.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#import').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await readText(f));
      const limpio = {};
      for (const k of Object.keys(FelRender.DEFAULTS)) if (k in data) limpio[k] = data[k];
      settings = Object.assign({}, FelRender.DEFAULTS, limpio);
      fillForm(); store.set(settings); render();
      toast('Configuración importada.');
    } catch { toast('El archivo de configuración no es válido.'); }
  });
  $('#reset').addEventListener('click', () => {
    if (!confirm('¿Restablecer toda la personalización (incluido el logo)?')) return;
    settings = Object.assign({}, FelRender.DEFAULTS);
    fillForm(); store.set(settings); render();
  });

  // ---------- Carga de archivos ----------
  $('#pick').addEventListener('click', () => $('#file').click());
  $('#file').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });
  $('#pasteBtn').addEventListener('click', () => {
    const t = $('#pasteText').value.trim();
    if (!t) return;
    addXml(t, 'XML pegado');
    $('#pasteText').value = '';
    render();
  });

  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => {
    e.preventDefault();
    if (ev === 'dragleave' && e.relatedTarget) return;
    drop.classList.remove('over');
  }));
  document.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });
  drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#file').click(); } });

  $('#docs').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = Number(b.closest('[data-id]').dataset.id);
    if (b.dataset.act === 'del') {
      const i = docs.findIndex(d => d.id === id);
      if (i >= 0) docs.splice(i, 1);
      render();
    } else if (b.dataset.act === 'print') {
      imprimir(id);
    }
  });
  $('#clear').addEventListener('click', () => { docs.length = 0; render(); });
  $('#printAll').addEventListener('click', () => imprimir(null));

  // ---------- XML recibido desde el menú contextual ----------
  async function cargarPendiente() {
    const key = new URLSearchParams(location.search).get('pending');
    if (!key || !hasChrome || !chrome.storage.session) return;
    const data = (await chrome.storage.session.get(key))[key];
    await chrome.storage.session.remove(key);
    history.replaceState(null, '', location.pathname);
    if (!data) return;
    if (data.error || !data.text) {
      toast('No se pudo descargar el XML desde el portal (' + (data.error || 'respuesta vacía') + '). Descárguelo y arrástrelo aquí.');
      return;
    }
    addXml(data.text, data.name);
  }

  (async function init() {
    settings = Object.assign({}, FelRender.DEFAULTS, await store.get());
    fillForm();
    await cargarPendiente();
    render();
  })();
})();
