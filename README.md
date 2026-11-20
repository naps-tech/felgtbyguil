# FEL Factura Personalizada (extensión de Chrome)

Convierte el **XML certificado de una factura electrónica FEL (SAT Guatemala)** en una factura con **tu propio diseño** (logo, colores, tipo de letra, datos de contacto, notas), lista para imprimir o guardar como PDF.

La factura siempre se puede validar porque conserva todos los datos fiscales del XML:

- Número de autorización (UUID), serie y número de DTE
- NIT y nombre del emisor y del receptor, dirección
- Fechas de emisión y de certificación, moneda
- Detalle, impuestos por línea, totales y frases (p. ej. «Sujeto a pagos trimestrales ISR»)
- Datos del certificador
- **Código QR al verificador oficial de la SAT**, con la misma URL que pone la SAT en su PDF:
  `https://felpub.c.sat.gob.gt/verificador-web/publico/vistas/verificacionDte.jsf?tipo=autorizacion&numero=…&emisor=…&receptor=…&monto=…`

El XML firmado sigue siendo el documento legal; el PDF es su representación gráfica.

## Instalación

1. Descarga o clona este repositorio.
2. En Chrome abre `chrome://extensions`.
3. Activa **Modo de desarrollador** (arriba a la derecha).
4. Pulsa **Cargar extensión sin empaquetar** y elige la carpeta `extension/`.
5. Fija el ícono de la extensión en la barra de Chrome.

## Uso

**Opción A: desde el archivo**
1. Haz clic en el ícono de la extensión; se abre el generador.
2. Arrastra uno o varios XML (o pulsa «Seleccionar archivos XML», o pega el contenido del XML).
3. Pulsa **Imprimir / Guardar PDF** y elige **Destino: Guardar como PDF**. Activa «Gráficos de fondo» en «Más opciones» para conservar los colores.

**Opción B: directamente desde el portal**
- Clic derecho sobre el enlace de descarga del XML → **Generar factura personalizada desde este XML**.
  La descarga se hace dentro de la misma página, con la sesión que ya tienes abierta.
- Si el portal muestra el XML en una pestaña (URL terminada en `.xml`), clic derecho en la página → **Generar factura personalizada desde esta página XML**.

Si el portal descarga el XML con un botón que no es un enlace normal, descárgalo y arrástralo al generador (opción A).

## Personalización

En el panel izquierdo puedes cambiar:

- Logo (se reduce automáticamente) y su tamaño
- Color principal y color de fondo de los bloques
- Tipo de letra y tamaño de papel (Carta o A4)
- Nombre destacado (nombre comercial o razón social) y datos de contacto adicionales
- Columnas de descuentos, impuestos por línea, total en letras, adenda, número de decimales
- Notas o condiciones, pie de página
- Texto de las frases que la extensión no reconozca (formato `Tipo-Escenario=Texto`, p. ej. `4-1=…`)

La configuración se guarda en el navegador. Con **Exportar configuración** obtienes un `.json` para respaldarla o usarla en otra computadora (**Importar**).

## Revisiones del XML

Al cargar cada documento la extensión revisa que:

- tenga datos de certificación y firma electrónica;
- el NIT del emisor (y del receptor, si no es CF) tenga dígito verificador correcto;
- la suma de las líneas coincida con el Gran Total y la suma de impuestos con el total de impuestos.

Estas revisiones no sustituyen la verificación de la SAT: usa el botón **Verificar en SAT** o escanea el QR.

## Tipos de documento

FACT, FCAM, FPEQ, FCAP, FESP, NABN, RDON, RECI, NDEB, NCRE, FACA, FCCA, FAPE, FCPE, FAAE y FCAE. Se muestran los complementos de referencia de notas (NCRE/NDEB), los abonos de facturas cambiarias, las retenciones de facturas especiales y, de forma genérica, cualquier otro complemento o adenda.

## Estructura

```
extension/
  manifest.json          Manifest V3
  background.js          Abre el generador y agrega el menú contextual
  app.html/.css/.js      Generador: carga, personalización, vista previa, impresión
  lib/fel-parser.js      Lectura del XML FEL y revisiones
  lib/invoice-render.js  Diseño de la factura
  lib/numero-letras.js   Monto en letras
  lib/qrcode.js          Generador de QR (Kazuhiko Arase, licencia MIT)
examples/                XML de ejemplo con datos ficticios
```

No se envía ningún dato a servidores externos: todo se procesa en el navegador.
