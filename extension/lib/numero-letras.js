// Monto en letras, en español: 1250.5 -> "UN MIL DOSCIENTOS CINCUENTA QUETZALES CON 50/100"
(function (global) {
  'use strict';

  const BASICOS = ['CERO', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
    'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE',
    'VEINTIOCHO', 'VEINTINUEVE'];
  const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS',
    'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  const MONEDAS = {
    GTQ: ['QUETZAL', 'QUETZALES'],
    USD: ['DÓLAR', 'DÓLARES'],
    EUR: ['EURO', 'EUROS'],
    MXN: ['PESO', 'PESOS']
  };

  function menorMil(n) {
    if (n < 30) return BASICOS[n];
    if (n < 100) {
      const d = Math.floor(n / 10), u = n % 10;
      return DECENAS[d] + (u ? ' Y ' + BASICOS[u] : '');
    }
    if (n === 100) return 'CIEN';
    const c = Math.floor(n / 100), r = n % 100;
    return CENTENAS[c] + (r ? ' ' + menorMil(r) : '');
  }

  // "UNO" delante de un sustantivo se apocopa: UN MIL, VEINTIÚN QUETZALES
  function apocope(s) {
    return s.replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/(^|\s)UNO$/, '$1UN');
  }

  function entero(n) {
    if (n === 0) return 'CERO';
    const partes = [];
    const millones = Math.floor(n / 1e6);
    const miles = Math.floor((n % 1e6) / 1000);
    const resto = n % 1000;
    if (millones) partes.push(millones === 1 ? 'UN MILLÓN' : apocope(entero(millones)) + ' MILLONES');
    if (miles) partes.push(miles === 1 ? 'UN MIL' : apocope(menorMil(miles)) + ' MIL');
    if (resto) partes.push(menorMil(resto));
    return partes.join(' ');
  }

  function montoEnLetras(monto, moneda = 'GTQ') {
    const v = Math.round(Math.abs(Number(monto) || 0) * 100);
    const ent = Math.floor(v / 100), cent = v % 100;
    const [sing, plur] = MONEDAS[moneda] || [moneda, moneda];
    let letras = ent === 1 ? 'UN' : apocope(entero(ent));
    if (/(MILLÓN|MILLONES)$/.test(letras)) letras += ' DE';
    return letras + ' ' + (ent === 1 ? sing : plur) + ' CON ' + String(cent).padStart(2, '0') + '/100';
  }

  global.montoEnLetras = montoEnLetras;
})(typeof window !== 'undefined' ? window : globalThis);
