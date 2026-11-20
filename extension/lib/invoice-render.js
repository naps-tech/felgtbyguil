// Genera la representación gráfica personalizada de un DTE FEL.
// Incluye siempre los datos que la SAT requiere para validar el documento:
// emisor, receptor, número de autorización, serie, número, fechas,
// frases, datos del certificador y QR al verificador de la SAT.
(function (global) {
  'use strict';

  const SIMBOLOS = { GTQ: 'Q', USD: '$', EUR: '€', MXN: 'MX$' };

  const DEFAULTS = {
    logo: '',
    logoAlto: 70,
    colorPrimario: '#0b5e94',
    colorSecundario: '#eef4f9',
    fuente: 'helvetica',
    nombreDestacado: 'comercial',
    encabezadoExtra: '',
    mostrarDescuentos: true,
    ocultarColumnasVacias: true,
    mostrarImpuestoLinea: true,
    mostrarEnLetras: true,
    decimales: 2,
    notas: '',
    piePagina: '',
    mostrarAdenda: true,
    frasesPersonalizadas: '',
    papel: 'letter'
  };

  const FUENTES = {
    helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    georgia: 'Georgia, "Times New Roman", serif',
    verdana: 'Verdana, Geneva, sans-serif',
    trebuchet: '"Trebuchet MS", "Segoe UI", sans-serif',
    courier: '"Courier New", Courier, monospace'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function lineas(s) {
    return esc(s).replace(/\r?\n/g, '<br>');
  }
  function fmt(n, dec = 2) {
    return Number(n || 0).toLocaleString('es-GT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function fmtCant(n) {
    return Number(n || 0).toLocaleString('es-GT', { maximumFractionDigits: 6 });
  }

  function qrSvg(texto) {
    if (!texto || typeof qrcode === 'undefined') return '';
    const qr = qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    const n = qr.getModuleCount(), m = 2;
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + (n + 2 * m) + ' ' + (n + 2 * m) +
      '" shape-rendering="crispEdges" role="img" aria-label="Código QR de verificación SAT"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }

  function frasesTexto(fel, settings) {
    const extra = {};
    String(settings.frasesPersonalizadas || '').split(/\r?\n/).forEach(l => {
      const m = /^\s*(\d+)\s*-\s*(\d+)\s*=\s*(.+)$/.exec(l);
      if (m) extra[m[1] + '-' + m[2]] = m[3].trim();
    });
    return fel.frases.map(f => {
      const k = f.tipo + '-' + f.escenario;
      let t = extra[k] || FEL.FRASES[k] || ('Frase tipo ' + f.tipo + ', escenario ' + f.escenario);
      if (f.resolucion) t += ' (Resolución ' + f.resolucion + (f.fechaResolucion ? ' del ' + FEL.formatoFecha(f.fechaResolucion, false) : '') + ')';
      return t;
    });
  }

  function direccionTexto(d) {
    if (!d) return '';
    let s = d.direccion || '';
    const low = s.toLowerCase();
    const extra = [d.municipio, d.departamento].filter(x => x && !low.includes(x.toLowerCase()));
    if (extra.length) s += (s ? ', ' : '') + extra.join(', ');
    return s;
  }

  function idReceptorEtiqueta(r) {
    if (r.tipoEspecial === 'CUI') return 'CUI';
    if (r.tipoEspecial === 'EXT') return 'ID Extranjero';
    return 'NIT';
  }

  function renderInvoice(fel, userSettings) {
    const s = Object.assign({}, DEFAULTS, userSettings || {});
    const dec = Number(s.decimales) || 2;
    const sim = SIMBOLOS[fel.moneda] || fel.moneda;
    const cert = fel.certificacion || {};
    const e = fel.emisor, r = fel.receptor;

    const nombrePrincipal = s.nombreDestacado === 'emisor' ? e.nombre : (e.nombreComercial || e.nombre);
    const nombreSecundario = s.nombreDestacado === 'emisor' ? e.nombreComercial : e.nombre;

    const hayDesc = fel.items.some(i => i.descuento);
    const hayOtros = fel.items.some(i => i.otrosDescuentos);
    const colDesc = s.mostrarDescuentos && (!s.ocultarColumnasVacias || hayDesc);
    const colOtros = s.mostrarDescuentos && (!s.ocultarColumnasVacias || hayOtros);
    const colImp = s.mostrarImpuestoLinea && fel.items.some(i => i.impuestos.length);
    const hayUnidad = fel.items.some(i => i.unidad);

    const totDesc = fel.items.reduce((a, i) => a + i.descuento, 0);
    const totOtros = fel.items.reduce((a, i) => a + i.otrosDescuentos, 0);

    const filas = fel.items.map(i => `
      <tr>
        <td class="c">${esc(i.linea)}</td>
        <td class="c">${i.bienOServicio === 'S' ? 'Servicio' : 'Bien'}</td>
        <td class="r">${fmtCant(i.cantidad)}${hayUnidad && i.unidad ? ' <small>' + esc(i.unidad) + '</small>' : ''}</td>
        <td class="desc">${lineas(i.descripcion)}</td>
        <td class="r">${fmt(i.precioUnitario, dec)}</td>
        ${colDesc ? `<td class="r">${fmt(i.descuento, dec)}</td>` : ''}
        ${colOtros ? `<td class="r">${fmt(i.otrosDescuentos, dec)}</td>` : ''}
        <td class="r b">${fmt(i.total, dec)}</td>
        ${colImp ? `<td class="imp">${i.impuestos.map(x => `<div><span>${esc(x.nombre)}</span><span>${fmt(x.monto, dec)}</span></div>`).join('')}</td>` : ''}
      </tr>`).join('');

    const frases = frasesTexto(fel, s);

    const filasDatosDoc = [
      ['Serie', cert.serie],
      ['Número de DTE', cert.numero],
      ['Fecha de emisión', FEL.formatoFecha(fel.fechaEmision)],
      ['Fecha de certificación', FEL.formatoFecha(cert.fecha)],
      ['Moneda', fel.moneda],
      fel.numeroAcceso ? ['Número de acceso', fel.numeroAcceso] : null
    ].filter(Boolean);

    const html = `
    <article class="fel-page" style="--c1:${esc(s.colorPrimario)};--c2:${esc(s.colorSecundario)};--font:${FUENTES[s.fuente] || FUENTES.helvetica}">
      <header class="fel-head">
        <div class="fel-brand">
          ${s.logo ? `<img class="fel-logo" src="${esc(s.logo)}" alt="Logo" style="max-height:${Number(s.logoAlto) || 70}px">` : ''}
          <div class="fel-emisor">
            <div class="fel-nombre">${esc(nombrePrincipal)}</div>
            ${nombreSecundario && nombreSecundario !== nombrePrincipal ? `<div class="fel-nombre2">${esc(nombreSecundario)}</div>` : ''}
            <div>NIT Emisor: <b>${esc(e.nit)}</b></div>
            ${direccionTexto(e.direccion) ? `<div>${esc(direccionTexto(e.direccion))}</div>` : ''}
            ${e.correo ? `<div>${esc(e.correo)}</div>` : ''}
            ${s.encabezadoExtra ? `<div class="fel-extra">${lineas(s.encabezadoExtra)}</div>` : ''}
          </div>
        </div>
        <div class="fel-docbox">
          <div class="fel-tipo">${esc(fel.tipoNombre)}</div>
          <div class="fel-sub">Documento Tributario Electrónico</div>
          <div class="fel-aut-l">NÚMERO DE AUTORIZACIÓN</div>
          <div class="fel-aut">${esc(cert.autorizacion || 'SIN CERTIFICAR')}</div>
          <table class="fel-kv">${filasDatosDoc.map(([k, v]) => `<tr><th>${esc(k)}:</th><td>${esc(v)}</td></tr>`).join('')}</table>
        </div>
      </header>

      <section class="fel-receptor">
        <div><span class="lbl">${idReceptorEtiqueta(r)} Receptor:</span> <b>${esc(r.id)}</b></div>
        <div><span class="lbl">Nombre Receptor:</span> <b>${esc(r.nombre)}</b></div>
        ${direccionTexto(r.direccion) ? `<div class="full"><span class="lbl">Dirección:</span> ${esc(direccionTexto(r.direccion))}</div>` : ''}
        ${r.correo ? `<div><span class="lbl">Correo:</span> ${esc(r.correo)}</div>` : ''}
      </section>

      ${fel.complementos.filter(c => c.tipo === 'nota').map(c => renderComplemento(c, fel, dec)).join('')}

      <table class="fel-items">
        <thead><tr>
          <th>#No</th><th>B/S</th><th>Cantidad</th><th>Descripción</th><th>P. Unitario (${esc(sim)})</th>
          ${colDesc ? `<th>Descuentos (${esc(sim)})</th>` : ''}
          ${colOtros ? `<th>Otros Descuentos (${esc(sim)})</th>` : ''}
          <th>Total (${esc(sim)})</th>
          ${colImp ? '<th>Impuestos</th>' : ''}
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>

      <section class="fel-resumen">
        <div class="fel-izq">
          ${s.mostrarEnLetras && typeof montoEnLetras === 'function' ? `<div class="fel-letras"><span class="lbl">Total en letras:</span> ${esc(montoEnLetras(fel.granTotal, fel.moneda))}</div>` : ''}
          ${frases.length ? `<ul class="fel-frases">${frases.map(f => `<li>* ${esc(f)}</li>`).join('')}</ul>` : ''}
        </div>
        <table class="fel-totales">
          ${totDesc ? `<tr><th>Descuentos</th><td>${esc(sim)} ${fmt(totDesc, dec)}</td></tr>` : ''}
          ${totOtros ? `<tr><th>Otros descuentos</th><td>${esc(sim)} ${fmt(totOtros, dec)}</td></tr>` : ''}
          ${fel.totalImpuestos.map(t => `<tr><th>${esc(t.nombre)}${t.nombre === 'IVA' ? ' (incluido)' : ''}</th><td>${esc(sim)} ${fmt(t.monto, dec)}</td></tr>`).join('')}
          <tr class="fel-gran"><th>TOTAL</th><td>${esc(sim)} ${fmt(fel.granTotal, 2)}</td></tr>
        </table>
      </section>

      ${fel.complementos.filter(c => c.tipo !== 'nota').map(c => renderComplemento(c, fel, dec)).join('')}

      ${s.mostrarAdenda && fel.adenda.length ? `<section class="fel-bloque"><h4>Información adicional</h4>${kvGrid(fel.adenda)}</section>` : ''}

      ${s.notas ? `<section class="fel-notas">${lineas(s.notas)}</section>` : ''}

      <footer class="fel-foot">
        <div class="fel-cert">
          <h4>Datos del certificador</h4>
          <div>${esc(cert.nombreCertificador || '—')} &nbsp; NIT: ${esc(cert.nitCertificador || '—')}</div>
          <p class="fel-verif">Verifique la validez de este documento escaneando el código QR o en
            <b>felpub.c.sat.gob.gt/verificador-web</b> con el número de autorización, el NIT del emisor, el ID del receptor y el monto.</p>
          ${s.piePagina ? `<div class="fel-pie">${lineas(s.piePagina)}</div>` : ''}
        </div>
        <div class="fel-qr">${qrSvg(fel.urlVerificacion)}</div>
      </footer>
    </article>`;
    const tpl = document.createElement('template');
    tpl.innerHTML = html.trim();
    return tpl.content.firstElementChild;
  }

  function kvGrid(pares) {
    return `<dl class="fel-kvgrid">${pares.map(p => `<div><dt>${esc(p.label)}</dt><dd>${esc(p.value)}</dd></div>`).join('')}</dl>`;
  }

  function renderComplemento(c, fel, dec) {
    const sim = SIMBOLOS[fel.moneda] || fel.moneda;
    if (c.tipo === 'nota') {
      const d = c.datos;
      return `<section class="fel-bloque fel-ref"><h4>Documento que se ajusta</h4>${kvGrid([
        { label: 'Número de autorización', value: d.autorizacionOrigen },
        d.serieOrigen ? { label: 'Serie', value: d.serieOrigen } : null,
        d.numeroOrigen ? { label: 'Número', value: d.numeroOrigen } : null,
        { label: 'Fecha de emisión', value: FEL.formatoFecha(d.fechaOrigen, false) },
        { label: 'Motivo del ajuste', value: d.motivo }
      ].filter(x => x && x.value))}</section>`;
    }
    if (c.tipo === 'abonos') {
      return `<section class="fel-bloque"><h4>Abonos de la factura cambiaria</h4>
        <table class="fel-mini"><thead><tr><th>No. abono</th><th>Fecha de vencimiento</th><th>Monto (${esc(sim)})</th></tr></thead>
        <tbody>${c.datos.map(a => `<tr><td class="c">${esc(a.numero)}</td><td class="c">${esc(FEL.formatoFecha(a.vencimiento, false))}</td><td class="r">${fmt(a.monto, 2)}</td></tr>`).join('')}</tbody></table></section>`;
    }
    if (c.tipo === 'retenciones') {
      const d = c.datos;
      return `<section class="fel-bloque"><h4>Retenciones (Factura Especial)</h4>${kvGrid([
        { label: 'Retención ISR', value: sim + ' ' + fmt(d.isr, dec) },
        { label: 'Retención IVA', value: sim + ' ' + fmt(d.iva, dec) },
        { label: 'Total menos retenciones', value: sim + ' ' + fmt(d.totalMenosRetenciones, 2) }
      ])}</section>`;
    }
    if (!c.datos.length) return '';
    return `<section class="fel-bloque"><h4>${esc(c.nombre)}</h4>${kvGrid(c.datos)}</section>`;
  }

  global.FelRender = { renderInvoice, DEFAULTS, FUENTES };
})(typeof window !== 'undefined' ? window : globalThis);
