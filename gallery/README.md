# Galería de Jerry's Pixel Icons

Una web estática dentro de este repositorio: HTML, CSS y módulos JavaScript, sin
backend, base de datos, analítica, fuentes remotas ni dependencias de navegador.
El catálogo canónico y los dibujos originales alimentan tanto el tema como esta web.

## Abrir localmente

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run gallery:preview
```

Abre **http://127.0.0.1:4173**. Usa `Ctrl+C` para parar. El servidor solo sirve
`dist/gallery/`, escucha en loopback y no expone el repositorio ni lista directorios.
No abras `index.html` con `file://`: los módulos y la carga del catálogo necesitan HTTP.

El comando vuelve a generar la web antes de servirla. Si cambias catálogo o código,
para y repite el comando; este servidor sencillo no hace recarga automática.
Para otro puerto: `pnpm run gallery:build` y luego
`node scripts/serve-gallery.mjs --port 4174`.

## Qué incluye

- Búsqueda por nombre, ID, palabras clave, nombres exactos y extensiones; no distingue
  mayúsculas ni acentos. Varios términos se combinan con AND.
- Filtros de archivos/carpetas, orden por nombre o número de asociaciones y vista
  de carpetas abiertas/cerradas.
- Detalle con asociaciones reales, descarga del SVG original y copia de ID.
  En carpetas, el SVG y el ID corresponden al estado cerrado o abierto seleccionado.
- Modo claro/oscuro persistido solo en el navegador; si no hay preferencia guardada,
  se usa la preferencia del sistema. No hay servicios externos para esta función.
- Búsqueda, tipo, orden y estado de las carpetas conservados en la URL.
- Tecla `/` para enfocar el buscador, `Escape` para borrar la búsqueda o cerrar el
  diálogo, navegación por teclado y mensajes de carga, error y resultados vacíos.

## Datos y construcción

Edita `catalog/icons.json`, no `dist/gallery/data.json`. Las entradas pueden tener
`label` y `tags` opcionales para presentación y búsqueda; esos campos no alteran
las asociaciones generadas para VS Code.

```json
{
  "id": "js",
  "label": "JavaScript",
  "tags": ["frontend"],
  "extensions": ["js", "mjs", "cjs"]
}
```

```sh
pnpm run gallery:build
```

El generador valida el catálogo y los SVG, crea `data.json` y copia la interfaz,
logo, licencia y los SVG referenciados a **`dist/gallery/`**. Esa carpeta es generada
y se reemplaza en cada build. No guarda estado de usuarios ni es una segunda fuente.

La salida es autocontenida y usa rutas relativas: puede servirse en la raíz o en
una subcarpeta de un alojamiento estático. Publicar o configurar un dominio es un
paso aparte; estos comandos no despliegan nada. La galería y sus resultados de
pruebas están excluidos del VSIX y verificados por `package:check`.

## Pruebas

```sh
pnpm test
pnpm exec playwright install chromium
pnpm run test:gallery
pnpm run package
```

Las pruebas unitarias incluyen filtros, normalización, estado de URL, datos,
construcción y límites del servidor estático. Playwright levanta y para su propio
servidor en el puerto 4183, y comprueba escritorio y móvil en Chromium, incluyendo
decodificar todos los SVG, teclado, filtros, diálogo, portapapeles, descarga y
recuperación ante un fallo del catálogo.

Si ya tienes Chromium instalado, puedes probarlo sin descargar otro binario:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm run test:gallery
```

El soporte oficial de Playwright se comprueba con su Chromium asociado; un binario
del sistema puede diferir. Las capturas y trazas están en
`dist/gallery-test-results/`, excluidas de Git y del paquete instalable. CI instala
el Chromium asociado y conserva capturas/trazas como artefactos; no publica la web.

La revisión de esta web no sustituye la revisión del tema real dentro de VS Code.
