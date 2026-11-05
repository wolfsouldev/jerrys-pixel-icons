# Contribuir a Jerry's Pixel Icons

Gracias por ayudar a mantener el estilo pixel art del tema. No necesitas crear una
extensión con código en ejecución: el proyecto es declarativo.

## 1. Preparar el entorno

- Node.js 22 o 24 (las versiones comprobadas por el flujo de CI).
- pnpm **12.15.0**, fijado en `package.json` mediante `packageManager`.
- VS Code para la revisión visual.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm test
```

No añadas tokens ni credenciales de Marketplace. Trabajar y empaquetar localmente
no requiere publicar ni instalar el tema en tu perfil habitual.

## 2. Una sola fuente de asociaciones

Edita **`catalog/icons.json`**. No edites `themes/icon-theme.json` a mano: es un
archivo generado que se incluye en el repositorio y en el paquete instalable.
El esquema `catalog/icons.schema.json` ofrece ayuda y autocompletado en VS Code.

El catálogo contiene:

| Campo | Uso |
| --- | --- |
| `version` | Versión del formato del catálogo; actualmente `1`, no la versión de la extensión. |
| `defaults.file` | ID del icono genérico de archivos. |
| `defaults.folder` | ID de la carpeta genérica; su estado abierto se deriva automáticamente. |
| `files` | Definiciones de archivos y sus extensiones/nombres exactos. |
| `folders` | Definiciones de carpetas con un único listado de nombres para ambos estados. |

Cada entrada admite `label` (nombre legible) y `tags` (palabras clave) opcionales
para la galería. Mantén esa información en el mismo catálogo: no modifiques las
asociaciones para conseguir que un término aparezca en el buscador.

### Añadir o asociar un icono de archivo

1. Busca primero si existe un icono adecuado en `files`.
2. Si ya existe, añade el nombre a su entrada; no crees otro ID para lo mismo.
3. Para arte nuevo, guarda `icons/files/<id>.svg` y añade una entrada como esta
   (ejemplo ilustrativo; no lo copies sin aportar su SVG):

```json
{
  "id": "vitest",
  "names": ["vitest.config.ts", "vitest.config.js"]
}
```

- `extensions` contiene sufijos sin el punto inicial, como `ts` o `module.ts`.
- `names` contiene nombres exactos, como `favicon.svg` o `package.json`.
- No se admiten comodines: `*.module.*` y `favicon.*` no funcionan como patrones.
- Los nombres se normalizan a minúsculas porque VS Code los compara sin distinguir
  mayúsculas. No dupliques `README.md` y `readme.md`.
- Los corchetes literales, como `[id].tsx`, sí son válidos.
- `icon` es opcional: permite reutilizar un SVG cuyo nombre no coincide con el ID,
  por ejemplo `{ "id": "router", "icon": "route" }`.
- No hay coincidencia arbitraria por subcadenas: `appRouter.ts` no se interpreta
  automáticamente como un archivo de rutas.

### Añadir una carpeta

Guarda **ambos** archivos:

```text
icons/folders/fixtures.svg
icons/folders/fixtures-open.svg
```

Declara los nombres una sola vez en `folders`:

```json
{
  "id": "fixtures",
  "names": ["fixtures", "__fixtures__"]
}
```

El generador produce las definiciones `fixtures` y `fixtures_open`, así como
`folderNames` y `folderNamesExpanded`. Rechaza archivos faltantes y alias duplicados
antes de escribir el resultado.

`icon` cambia el basename de ambos SVG. `expandedId` solo es necesario para mantener
IDs históricos, como `vscode_file` / `vscode_open`; usa el convenio normal para arte nuevo.
No escribas rutas ni extensiones en `icon`.

### Generar y revisar

```sh
pnpm run generate
pnpm run generate:check
pnpm test
pnpm run package
```

- `generate` ordena las asociaciones y genera siempre los mismos bytes para los
  mismos datos. El orden de las entradas o los alias no cambia el resultado.
- `generate:check` solo compara: falla si el archivo está desactualizado y **no lo
  reescribe**. Debes incluir catálogo y resultado generado en el mismo PR.
- `test` incluye lint, la comprobación del generado, la validación de los SVG y
  las pruebas de regresión.
- `package` vuelve a comprobar el proyecto, crea un `.vsix` y después lee el ZIP
  real para verificar manifest, tema, iconos y exclusión de archivos de desarrollo.
- Puedes repetir esa última revisión con `pnpm run package:check`.

## 3. Guía visual

### Cuadrícula y silueta

- Para arte nuevo, trabaja en una **cuadrícula lógica de 16 × 16 píxeles**. Diseña
  primero una silueta reconocible a tamaño real, no solo ampliada.
- Usa coordenadas enteras, bordes definidos y un margen transparente consistente
  con iconos similares. Evita detalles de menos de un píxel lógico.
- No uses desenfoque, suavizado ni escalado bilineal para simular pixel art.
- Mantén el peso visual y el volumen de las carpetas existentes. El estado abierto
  debe distinguirse del cerrado sin depender únicamente de cambiar de color.
- No rediseñes iconos existentes dentro de un PR de asociaciones.

### Paleta

No existe una paleta global obligatoria: los iconos de tecnologías conservan su
identidad. Estas referencias se han extraído de los dibujos existentes y sirven
para mantener consistencia, **no son una nueva restricción sobre el catálogo**:

| Referencia | Color base | Sombra / detalle |
| --- | --- | --- |
| Carpeta genérica | `#EBAE4B` | `#D29533` |
| Carpeta `src` | `#A7D32C` | `#709B1A`, detalle `#FFFFE5` |
| JavaScript | `#FFD541` | `#F9A31B`, detalle oscuro `#221C1A` |

Usa una paleta reducida por icono y contraste suficiente entre planos. Conserva
los colores reconocibles de cada tecnología; prueba los contornos sobre fondos
claros y oscuros y evita que toda la silueta desaparezca en uno de ellos.

### Exportación

- El catálogo actual y el validador esperan **SVG** con el namespace
  `xmlns="http://www.w3.org/2000/svg"`. Usa `.svg`, no un PNG renombrado.
- Para SVG nativo, usa un `viewBox` coherente y trazos alineados con la cuadrícula.
- También se conserva el formato histórico de SVG con PNG incrustado: si necesitas
  ampliar la cuadrícula de 16 a 256 px, hazlo con **nearest neighbor**, sin suavizado,
  y mantén las dimensiones del PNG, `viewBox` y tamaño del contenedor coherentes.
- La mayoría de los archivos existentes usan contenedores de 256 × 256; no se
  exige convertirlos ni son una prueba de que el dibujo sea vectorial.
- Mantén el fondo transparente. No incluyas referencias externas, fuentes remotas,
  scripts, animaciones, metadatos del editor innecesarios ni archivos temporales.
- Conserva el editable original durante el diseño. Si lo adjuntas al PR, indica su
  herramienta y licencia; no es necesario empaquetarlo con el tema.

### Nombres

- Assets e IDs nuevos: minúsculas y nombres descriptivos; usa guiones para separar
  palabras. El generador acepta letras, números, guiones y guiones bajos en el ID.
- Archivos: `icons/files/<nombre>.svg`.
- Carpetas: `icons/folders/<nombre>.svg` y `<nombre>-open.svg`.
- Evita cambiar IDs históricos, pues también se usan en las pruebas y asociaciones.

Los diez SVG del paquete adicional usan geometría nativa de píxeles enteros y
`viewBox="0 0 16 16"`, con exportación de 256 × 256 y bordes `crispEdges`.
No conviertas esos SVG a PNG incrustado. Los créditos y excepciones de licencia
están en `ICON_NOTICES.txt`, que debe conservarse en la web y el VSIX.

## 4. Revisión visual y pull request

1. Ejecuta las comprobaciones y pulsa `F5`.
2. En el Extension Development Host, selecciona **Jerry's Pixel** en
   **Preferences: File Icon Theme**.
3. Abre un proyecto con los nombres exactos que añadiste. Revisa iconos a tamaño
   normal con temas claro y oscuro, y ambas posiciones de cada carpeta.
4. Adjunta capturas. Si no puedes hacer la revisión visual, indícalo explícitamente.
5. Usa arte original o indica fuente y licencia. Los logos pueden tener condiciones
   de marca independientes de la licencia MIT del código.
6. Actualiza `CHANGELOG.md` bajo **Unreleased** sin inventar versiones ni fechas
   publicadas. No cambies `package.json.version` para un PR normal.

Las comprobaciones automáticas validan datos y archivos; **no prueban que el icono
se vea bien dentro del editor**.

Si cambias la galería, consulta [su guía](gallery/README.md), ejecuta
`pnpm run gallery:build` y `pnpm run test:gallery` (requiere el Chromium de Playwright)
y comprueba escritorio y móvil. La galería se empaqueta por separado del VSIX.

## 5. Qué comprueba GitHub Actions

`.github/workflows/ci.yml` se ejecuta en pushes, pull requests y manualmente, con
Node.js 22 y 24. Instala el lockfile sin scripts de instalación, ejecuta las pruebas,
empaqueta y revisa el VSIX. El paquete queda como artefacto durante siete días.

Los jobs de validación solo tienen permisos de lectura del repositorio. Después
de pasar esos checks, los pushes y ejecuciones manuales de `master` pueden publicar
la galería en GitHub Pages, si está habilitado como origen **GitHub Actions**.
Los PRs, tags y otras ramas nunca despliegan. Únicamente el job de publicación recibe
permisos de escritura de Pages y OIDC, dentro del entorno protegido `github-pages`.
Después se verifican por HTTP los archivos públicos contra el commit desplegado.
Consulta [la guía de publicación](gallery/README.md#publicar-con-github-pages).

La extensión solo se publica cuando el workflow de validación de `master` termina
con éxito y el workflow posterior detecta un aumento de `package.json.version`
con notas fechadas en `CHANGELOG.md`. La publicación reutiliza el VSIX producido
por ese CI; los cambios normales de código/iconos no publican una nueva versión.
Para preparar una versión,
revisarla y entender la aprobación de Marketplace/OIDC, consulta
[RELEASE.md](RELEASE.md). No se crean GitHub Releases. Las acciones están fijadas
a commits: revisa su código y conserva una referencia de versión al actualizarlas.
Un workflow preparado o un deploy exitoso no prueban por sí solos que la página
pública esté funcionando.

El flujo de publicación espera los checks de ambas versiones de Node y requiere
la aprobación configurada en el environment `marketplace`. Para impedir merges
con fallos, configura este workflow como comprobación requerida en las reglas de
protección de la rama; añadir el YAML por sí solo no activa esa protección.

Para solicitar un icono sin aportar código, usa la plantilla **Solicitar un icono**
en las issues e incluye nombres reales y referencias visuales.

Referencias: [asociaciones de temas de iconos de VS Code](https://code.visualstudio.com/api/extension-guides/file-icon-theme#file-association),
[instalación de pnpm en Actions](https://github.com/pnpm/action-setup) y
[artefactos de GitHub Actions](https://github.com/actions/upload-artifact).
