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
una subcarpeta de un alojamiento estático. Estos comandos locales no despliegan
nada; el workflow de Pages descrito más abajo realiza la publicación. La galería y sus resultados de
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
el Chromium asociado y conserva capturas/trazas como artefactos. Los pull requests
solo validan: no publican la web.

La revisión de esta web no sustituye la revisión del tema real dentro de VS Code.

## Publicar con GitHub Pages

El workflow existente **Validate and package**, en `.github/workflows/ci.yml`,
también publica la galería después de las validaciones. No crea releases ni publica
la extensión en Marketplace.

### Activación inicial del repositorio

1. En el repositorio, abre **Settings → Pages**.
2. En **Build and deployment → Source**, selecciona **GitHub Actions**.
3. Sube a `master` el workflow y los cambios revisados. No subas `dist/`: la web
   se construye dentro de Actions con el lockfile congelado.
4. En **Actions → Validate and package**, espera los checks de Node 22 y 24,
   las pruebas de navegador, **Prepare GitHub Pages**, **Deploy GitHub Pages** y
   **Verify published gallery**.
5. Abre la URL que devuelve el despliegue, no la des por publicada hasta que pase
   la verificación HTTP final.

URL predeterminada prevista para este repositorio:
`https://wolfsouldev.github.io/jerrys-pixel-icons/`.

Si se necesita repetir el proceso, usa **Run workflow** seleccionando `master`, o:

```sh
gh workflow run ci.yml --ref master
```

Eso requiere una sesión de GitHub CLI (`gh auth login`) y los permisos adecuados.
Un push normal ya inicia el proceso: no es necesario iniciar otro workflow en paralelo.

### Qué se publica y qué lo protege

- Solo el contenido de **`dist/gallery/`**, con el artefacto específico de Pages.
- Solo pushes o ejecuciones manuales de **`master`**; nunca PRs, tags ni otras ramas.
- Se exige que finalicen correctamente ambas versiones de Node y las pruebas
  de escritorio/móvil del **mismo commit**.
- Solo el job de despliegue recibe `pages: write` e `id-token: write`; utiliza el
  entorno protegido `github-pages` y no requiere guardar un token personal como secreto.
- Un despliegue de producción activo no se cancela al llegar un push nuevo.
- El último job comprueba por HTTP el HTML, CSS, módulos JavaScript, catálogo,
  logo, licencia y todos los SVG, comparando sus bytes con el commit desplegado.
  También comprueba el tipo MIME de los módulos y reintenta ante propagación del CDN.

Para repetir la comprobación desde el checkout del mismo commit:

```sh
pnpm run gallery:verify --url https://wolfsouldev.github.io/jerrys-pixel-icons/
```

Para la vista local también se permite HTTP en loopback:

```sh
pnpm run gallery:verify --url http://127.0.0.1:4173/ --attempts 1
```

### Si falla la publicación

- **Pages no está habilitado:** selecciona `GitHub Actions` como origen en Settings
  y repite el workflow. `configure-pages` no intenta habilitarlo con un PAT oculto.
- **Waiting for approval / deployment protection:** el mantenedor debe aprobar
  el entorno `github-pages` o revisar sus reglas. No elimines protecciones para saltarte la revisión.
- **Un check falla:** corrige ese fallo; los jobs de publicación no deben ejecutarse saltándolo.
- **Verificación HTTP falla:** puede haber contenido antiguo o archivos ausentes;
  revisa el error y no confundas el éxito del deploy con el éxito de la comprobación.

### Dominio propio, opcional

No necesitas comprar un dominio para usar la dirección `github.io`. Para usar uno
que te pertenezca, verifica su propiedad, añádelo en **Settings → Pages → Custom
domain**, configura sus DNS y activa HTTPS cuando esté disponible. Este cambio no
lo hace el workflow y no se debe modificar ningún registro de correo u otro servicio.

Con publicación por Actions no necesitas un archivo `CNAME` en la galería; el
dominio se administra en la configuración de Pages. Consulta la
[guía oficial de dominios](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
y la [guía de workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
