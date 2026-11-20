// Service worker: abre el generador y agrega el menú contextual
// "Generar factura personalizada" sobre enlaces a XML.

const APP_URL = chrome.runtime.getURL('app.html');

function openApp(query = '') {
  return chrome.tabs.create({ url: APP_URL + query });
}

chrome.action.onClicked.addListener(() => openApp());

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'fel-link',
      title: 'Generar factura personalizada desde este XML',
      contexts: ['link']
    });
    chrome.contextMenus.create({
      id: 'fel-page',
      title: 'Generar factura personalizada desde esta página XML',
      contexts: ['page'],
      documentUrlPatterns: ['*://*/*.xml', '*://*/*.xml?*', '*://*/*.XML', 'file:///*.xml', 'file:///*.XML']
    });
  });
});

// Se ejecuta dentro de la página del portal: así la descarga usa la sesión
// (cookies) con la que el usuario ya inició sesión.
async function fetchInPage(url) {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return { error: 'El portal respondió ' + res.status + ' ' + res.statusText };
    const text = await res.text();
    return { text };
  } catch (e) {
    return { error: String(e && e.message || e) };
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const url = info.menuItemId === 'fel-link' ? info.linkUrl : (info.pageUrl || tab?.url);
  let payload;
  try {
    const [res] = await chrome.scripting.executeScript({
      target: info.frameId ? { tabId: tab.id, frameIds: [info.frameId] } : { tabId: tab.id },
      func: fetchInPage,
      args: [url]
    });
    payload = res?.result || { error: 'No se obtuvo respuesta de la página.' };
  } catch (e) {
    payload = { error: String(e && e.message || e) };
  }
  const name = decodeURIComponent((url || '').split(/[?#]/)[0].split('/').pop() || 'documento.xml');
  const key = 'pending-' + Date.now();
  await chrome.storage.session.set({ [key]: { ...payload, name, url } });
  openApp('?pending=' + encodeURIComponent(key));
});
