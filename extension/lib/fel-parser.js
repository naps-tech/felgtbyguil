// Lectura de documentos FEL (SAT Guatemala, esquema GT_Documento 0.2.0).
// Busca los elementos por nombre local, así funciona con cualquier prefijo
// de espacio de nombres que use el certificador.
(function (global) {
  'use strict';

  const VERIFICADOR_SAT = 'https://felpub.c.sat.gob.gt/verificador-web/publico/vistas/verificacionDte.jsf';

  const TIPOS_DTE = {
    FACT: 'Factura',
    FCAM: 'Factura Cambiaria',
    FPEQ: 'Factura Pequeño Contribuyente',
    FCAP: 'Factura Cambiaria Pequeño Contribuyente',
    FESP: 'Factura Especial',
    NABN: 'Nota de Abono',
    RDON: 'Recibo por Donación',
    RECI: 'Recibo',
    NDEB: 'Nota de Débito',
    NCRE: 'Nota de Crédito',
    FACA: 'Factura Contribuyente Agropecuario',
    FCCA: 'Factura Cambiaria Contribuyente Agropecuario',
    FAPE: 'Factura Pequeño Contribuyente Régimen Electrónico',
    FCPE: 'Factura Cambiaria Pequeño Contribuyente Régimen Electrónico',
    FAAE: 'Factura Contribuyente Agropecuario Régimen Electrónico Especial',
    FCAE: 'Factura Cambiaria Contribuyente Agropecuario Régimen Electrónico Especial'
  };

  // Frases cuyo texto es conocido con certeza. Las demás se pueden definir
  // en la personalización (Tipo-Escenario=Texto).
  const FRASES = {
    '1-1': 'Sujeto a pagos trimestrales ISR',
    '1-2': 'Sujeto a retención definitiva ISR',
    '1-3': 'Sujeto a pago directo ISR',
    '2-1': 'Agente de Retención del IVA',
    '3-1': 'No genera derecho a crédito fiscal'
  };

  const AFILIACION_IVA = { GEN: 'General', PEQ: 'Pequeño Contribuyente', EXE: 'Exento', AGR: 'Agropecuario', PEE: 'Pequeño Contribuyente Electrónico', AGE: 'Agropecuario Electrónico' };

  function el(root, name) {
    if (!root) return null;
    const list = root.getElementsByTagNameNS('*', name);
    return list.length ? list[0] : null;
  }
  function all(root, name) {
    return root ? Array.from(root.getElementsByTagNameNS('*', name)) : [];
  }
  function kids(node, name) {
    return node ? Array.from(node.children).filter(c => c.localName === name) : [];
  }
  function txt(root, name) {
    const n = el(root, name);
    return n ? n.textContent.trim() : '';
  }
  function attr(node, name) {
    return node && node.hasAttribute(name) ? node.getAttribute(name).trim() : '';
  }
  function attrs(node) {
    const o = {};
    if (node) for (const a of Array.from(node.attributes)) {
      if (!a.name.startsWith('xmlns') && !a.name.includes(':')) o[a.name] = a.value.trim();
    }
    return o;
  }
  function num(s) {
    const n = parseFloat(String(s || '').replace(/,/g, ''));
    return isFinite(n) ? n : 0;
  }
  function direccion(node) {
    if (!node) return null;
    return {
      direccion: txt(node, 'Direccion'),
      codigoPostal: txt(node, 'CodigoPostal'),
      municipio: txt(node, 'Municipio'),
      departamento: txt(node, 'Departamento'),
      pais: txt(node, 'Pais')
    };
  }
  // Convierte un elemento en una lista plana de pares etiqueta/valor
  // (para complementos y adendas que no tienen un formato especial).
  function flatten(node, prefix = '') {
    const out = [];
    if (!node) return out;
    for (const [k, v] of Object.entries(attrs(node))) if (v) out.push({ label: separar(k), value: v });
    const children = Array.from(node.children);
    if (!children.length) {
      const t = node.textContent.trim();
      if (t) out.push({ label: separar(prefix || node.localName), value: t });
      return out;
    }
    for (const c of children) {
      if (c.children.length || c.attributes.length) out.push(...flatten(c, c.localName));
      else {
        const t = c.textContent.trim();
        if (t) out.push({ label: separar(c.localName), value: t });
      }
    }
    return out;
  }
  function separar(name) {
    return String(name).replace(/([a-záéíóú])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  }

  // Dígito verificador del NIT guatemalteco (módulo 11).
  function nitValido(nit) {
    const s = String(nit || '').toUpperCase().replace(/[^0-9K]/g, '');
    if (s.length < 2) return false;
    const cuerpo = s.slice(0, -1), dv = s.slice(-1);
    if (!/^\d+$/.test(cuerpo)) return false;
    let suma = 0;
    for (let i = 0; i < cuerpo.length; i++) suma += Number(cuerpo[i]) * (cuerpo.length + 1 - i);
    const r = (11 - (suma % 11)) % 11;
    return (r === 10 ? 'K' : String(r)) === dv;
  }

  function parseFel(xmlText) {
    const doc = new DOMParser().parseFromString(String(xmlText).replace(/^﻿/, ''), 'application/xml');
    const perr = doc.getElementsByTagName('parsererror')[0];
    if (perr) throw new Error('El archivo no es un XML válido: ' + perr.textContent.trim().split('\n')[0]);

    const root = doc.documentElement;
    if (root.localName === 'GTAnulacionDocumento') {
      throw new Error('Este XML es una anulación de DTE, no una factura. Cargue el XML del documento original.');
    }
    const emision = el(doc, 'DatosEmision');
    if (!emision) throw new Error('No se encontró el nodo DatosEmision: el archivo no parece ser un DTE FEL de la SAT.');

    const gen = el(emision, 'DatosGenerales');
    const emisorEl = el(emision, 'Emisor');
    const receptorEl = el(emision, 'Receptor');

    const tipo = attr(gen, 'Tipo');
    const fel = {
      tipo,
      tipoNombre: TIPOS_DTE[tipo] || tipo || 'Documento Tributario Electrónico',
      fechaEmision: attr(gen, 'FechaHoraEmision'),
      moneda: attr(gen, 'CodigoMoneda') || 'GTQ',
      numeroAcceso: attr(gen, 'NumeroAcceso'),
      exportacion: attr(gen, 'Exp') === 'SI',
      emisor: {
        nit: attr(emisorEl, 'NITEmisor'),
        nombre: attr(emisorEl, 'NombreEmisor'),
        nombreComercial: attr(emisorEl, 'NombreComercial'),
        establecimiento: attr(emisorEl, 'CodigoEstablecimiento'),
        correo: attr(emisorEl, 'CorreoEmisor'),
        afiliacionIVA: attr(emisorEl, 'AfiliacionIVA'),
        afiliacionNombre: AFILIACION_IVA[attr(emisorEl, 'AfiliacionIVA')] || attr(emisorEl, 'AfiliacionIVA'),
        direccion: direccion(el(emisorEl, 'DireccionEmisor'))
      },
      receptor: {
        id: attr(receptorEl, 'IDReceptor'),
        tipoEspecial: attr(receptorEl, 'TipoEspecial'),
        nombre: attr(receptorEl, 'NombreReceptor'),
        correo: attr(receptorEl, 'CorreoReceptor'),
        direccion: direccion(el(receptorEl, 'DireccionReceptor'))
      },
      frases: kids(el(emision, 'Frases'), 'Frase').map(f => ({
        tipo: attr(f, 'TipoFrase'),
        escenario: attr(f, 'CodigoEscenario'),
        resolucion: attr(f, 'NumeroResolucion'),
        fechaResolucion: attr(f, 'FechaResolucion')
      })),
      items: kids(el(emision, 'Items'), 'Item').map(it => ({
        linea: attr(it, 'NumeroLinea'),
        bienOServicio: attr(it, 'BienOServicio'),
        cantidad: num(txt(it, 'Cantidad')),
        unidad: txt(it, 'UnidadMedida'),
        descripcion: txt(it, 'Descripcion'),
        precioUnitario: num(txt(it, 'PrecioUnitario')),
        precio: num(txt(it, 'Precio')),
        descuento: num(txt(it, 'Descuento')),
        otrosDescuentos: num(txt(it, 'OtrosDescuento')),
        total: num(txt(it, 'Total')),
        impuestos: all(it, 'Impuesto').map(im => ({
          nombre: txt(im, 'NombreCorto'),
          codigoUnidadGravable: txt(im, 'CodigoUnidadGravable'),
          montoGravable: num(txt(im, 'MontoGravable')),
          cantidadUnidades: txt(im, 'CantidadUnidadesGravables'),
          monto: num(txt(im, 'MontoImpuesto'))
        }))
      })),
      totalImpuestos: all(el(emision, 'Totales'), 'TotalImpuesto').map(t => ({
        nombre: attr(t, 'NombreCorto'),
        monto: num(attr(t, 'TotalMontoImpuesto'))
      })),
      granTotalTexto: txt(el(emision, 'Totales'), 'GranTotal'),
      complementos: [],
      adenda: [],
      certificacion: null,
      firmas: all(doc, 'Signature').length
    };
    fel.granTotal = num(fel.granTotalTexto);

    // Complementos
    for (const comp of all(emision, 'Complemento')) {
      const nombre = attr(comp, 'NombreComplemento') || 'Complemento';
      const contenido = Array.from(comp.children);
      for (const c of contenido) {
        const ln = c.localName;
        if (ln === 'ReferenciasNota') {
          fel.complementos.push({ tipo: 'nota', nombre, datos: {
            motivo: attr(c, 'MotivoAjuste'),
            autorizacionOrigen: attr(c, 'NumeroAutorizacionDocumentoOrigen'),
            fechaOrigen: attr(c, 'FechaEmisionDocumentoOrigen'),
            serieOrigen: attr(c, 'SerieDocumentoOrigen'),
            numeroOrigen: attr(c, 'NumeroDocumentoOrigen'),
            regimenAntiguo: attr(c, 'RegimenAntiguo')
          } });
        } else if (ln === 'AbonosFacturaCambiaria') {
          fel.complementos.push({ tipo: 'abonos', nombre, datos: all(c, 'Abono').map(a => ({
            numero: txt(a, 'NumeroAbono'), vencimiento: txt(a, 'FechaVencimiento'), monto: num(txt(a, 'MontoAbono'))
          })) });
        } else if (ln === 'RetencionesFacturaEspecial') {
          fel.complementos.push({ tipo: 'retenciones', nombre, datos: {
            isr: num(txt(c, 'RetencionISR')), iva: num(txt(c, 'RetencionIVA')), totalMenosRetenciones: num(txt(c, 'TotalMenosRetenciones'))
          } });
        } else {
          fel.complementos.push({ tipo: 'generico', nombre: separar(nombre || ln), datos: flatten(c) });
        }
      }
    }

    const adenda = el(doc, 'Adenda');
    if (adenda) fel.adenda = flatten(adenda);

    const cert = el(doc, 'Certificacion');
    if (cert) {
      const na = el(cert, 'NumeroAutorizacion');
      fel.certificacion = {
        nitCertificador: txt(cert, 'NITCertificador'),
        nombreCertificador: txt(cert, 'NombreCertificador'),
        autorizacion: na ? na.textContent.trim() : '',
        serie: attr(na, 'Serie'),
        numero: attr(na, 'Numero'),
        fecha: txt(cert, 'FechaHoraCertificacion')
      };
    }
    fel.urlVerificacion = urlVerificacion(fel);
    fel.validaciones = validar(fel);
    return fel;
  }

  function urlVerificacion(fel) {
    if (!fel.certificacion || !fel.certificacion.autorizacion) return '';
    const p = [
      ['tipo', 'autorizacion'],
      ['numero', fel.certificacion.autorizacion],
      ['emisor', fel.emisor.nit],
      ['receptor', fel.receptor.id],
      ['monto', fel.granTotalTexto]
    ];
    return VERIFICADOR_SAT + '?' + p.map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  }

  // Revisiones de coherencia. No sustituyen la verificación en el portal de la SAT.
  function validar(fel) {
    const v = [];
    const add = (nivel, texto) => v.push({ nivel, texto });

    if (fel.certificacion && fel.certificacion.autorizacion) {
      add('ok', 'Documento certificado por ' + (fel.certificacion.nombreCertificador || 'el certificador') + '.');
    } else {
      add('error', 'El XML no tiene datos de certificación: no es un DTE válido para la SAT.');
    }
    if (fel.firmas > 0) add('ok', 'Contiene ' + fel.firmas + ' firma(s) electrónica(s).');
    else add('error', 'El XML no contiene firma electrónica.');

    if (nitValido(fel.emisor.nit)) add('ok', 'NIT del emisor con dígito verificador correcto.');
    else add('warn', 'El dígito verificador del NIT del emisor (' + fel.emisor.nit + ') no coincide.');

    const rid = (fel.receptor.id || '').toUpperCase();
    if (rid && rid !== 'CF' && !fel.receptor.tipoEspecial && !nitValido(rid)) {
      add('warn', 'El dígito verificador del NIT del receptor (' + fel.receptor.id + ') no coincide.');
    }

    if (!fel.items.length) add('error', 'El documento no tiene líneas de detalle.');
    const sumaItems = fel.items.reduce((s, i) => s + i.total, 0);
    if (fel.items.length) {
      if (Math.abs(sumaItems - fel.granTotal) <= 0.01) add('ok', 'La suma de las líneas coincide con el Gran Total.');
      else add('warn', 'La suma de las líneas (' + sumaItems.toFixed(2) + ') no coincide con el Gran Total (' + fel.granTotal.toFixed(2) + ').');
    }
    for (const t of fel.totalImpuestos) {
      const s = fel.items.reduce((a, i) => a + i.impuestos.filter(x => x.nombre === t.nombre).reduce((b, x) => b + x.monto, 0), 0);
      if (Math.abs(s - t.monto) > 0.01) add('warn', 'El total de ' + t.nombre + ' (' + t.monto.toFixed(2) + ') no coincide con la suma por línea (' + s.toFixed(2) + ').');
    }
    return v;
  }

  // "2026-11-20T16:37:19-06:00" -> "20-nov-2026 16:37:19" (hora local del documento, sin convertir zona)
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function formatoFecha(iso, conHora = true) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(iso || '');
    if (!m) return iso || '';
    const f = m[3] + '-' + MESES[Number(m[2]) - 1] + '-' + m[1];
    return conHora && m[4] ? f + ' ' + m[4] + ':' + m[5] + ':' + (m[6] || '00') : f;
  }

  global.FEL = { parseFel, nitValido, formatoFecha, TIPOS_DTE, FRASES, VERIFICADOR_SAT };
})(typeof window !== 'undefined' ? window : globalThis);
