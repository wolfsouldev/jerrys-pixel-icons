# Guía para Agregar Nuevos Iconos

Esta guía explica paso a paso cómo contribuir un nuevo icono a **Jerry's Pixel Icons**.

---

## Requisitos Previos

- [Node.js](https://nodejs.org/) v18+
- [pnpm](https://pnpm.io/) como gestor de paquetes
- [VS Code](https://code.visualstudio.com/) v1.105.0 o superior
- Un editor de pixel art (recomendado: [Aseprite](https://www.aseprite.org/), [Piskel](https://www.piskelapp.com/) o [Pixilart](https://www.pixilart.com/))

---

## Estructura del Proyecto

```
jerrys-pixel-icons/
├── icons/
│   ├── files/          ← Iconos de archivos (.svg)
│   └── folders/        ← Iconos de carpetas (.svg)
├── src/
│   ├── baseTheme.ts    ← Definiciones de iconos y mapeos
│   ├── generator.ts    ← Generador del tema
│   └── extension.ts    ← Punto de entrada de la extensión
├── themes/
│   └── icon-theme.json ← Tema generado (NO editar manualmente)
├── docs/               ← Documentación
├── assets/             ← Logo e imágenes del marketplace
└── package.json
```

---

## Paso 1: Crear el Pixel Art

1. Crea tu icono en **16×16 píxeles**
2. Usa una paleta de colores vibrante y coherente con los iconos existentes
3. Exporta como **PNG a 256×256 píxeles** (escala 16x, sin suavizado/antialiasing)
   - En Aseprite: `File > Export > Resize: 1600%` con `Nearest Neighbor`
   - En otros editores: escala a 256×256 usando interpolación **Nearest Neighbor**

> **Importante:** Usa interpolación Nearest Neighbor para mantener los bordes nítidos del pixel art.

### Para carpetas

Si estás creando un icono de carpeta, necesitas **dos versiones**:

- `nombre.svg` → Carpeta cerrada
- `nombre-open.svg` → Carpeta abierta

---

## Paso 2: Convertir a SVG con Base64

Los iconos del proyecto son archivos SVG que contienen la imagen PNG embebida en base64.

### En Linux/macOS

```bash
BASE64=$(base64 -w 0 tu-icono.png)

cat > tu-icono.svg << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="256" height="256" xml:space="preserve" version="1.1" viewBox="0 0 256 256">
  <image width="256" height="256" xlink:href="data:image/png;base64,PLACEHOLDER"/>
</svg>
SVGEOF

sed -i "s|PLACEHOLDER|${BASE64}|" tu-icono.svg
```

### En Windows (PowerShell)

```powershell
$bytes = [IO.File]::ReadAllBytes("tu-icono.png")
$b64 = [Convert]::ToBase64String($bytes)
$tpl = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="256" height="256" xml:space="preserve" version="1.1" viewBox="0 0 256 256"><image width="256" height="256" xlink:href="data:image/png;base64,' + $b64 + '"/></svg>'
$tpl | Out-File -Encoding utf8 tu-icono.svg
```

### Manualmente

1. Convierte tu PNG a base64 con cualquier herramienta online
2. Usa esta plantilla SVG y reemplaza `TU_BASE64_AQUI`:

```xml
<svg xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink"
     width="256" height="256" xml:space="preserve"
     version="1.1" viewBox="0 0 256 256">
  <image width="256" height="256"
         xlink:href="data:image/png;base64,TU_BASE64_AQUI"/>
</svg>
```

---

## Paso 3: Colocar el Archivo SVG

| Tipo de icono   | Carpeta destino  |
| --------------- | ---------------- |
| Archivo         | `icons/files/`   |
| Carpeta cerrada | `icons/folders/` |
| Carpeta abierta | `icons/folders/` |

### Convención de nombres

- **Minúsculas**, sin espacios
- Archivos: `nombre.svg` (ej: `python.svg`, `docker.svg`)
- Carpetas cerradas: `nombre.svg` (ej: `components.svg`)
- Carpetas abiertas: `nombre-open.svg` (ej: `components-open.svg`)

---

## Paso 4: Registrar el Icono en el Código

Edita `src/baseTheme.ts` para registrar tu nuevo icono.

### 4.1 — Agregar en `ICON_PATHS`

```typescript
// Icono de archivo:
"mi_icono": "files/mi_icono.svg",

// Icono de carpeta (ambas versiones):
"mi_carpeta": "folders/mi_carpeta.svg",
"mi_carpeta_open": "folders/mi_carpeta-open.svg",
```

### 4.2 — Agregar mapeos según corresponda

**Extensiones de archivo** → objeto `FILE_EXTENSIONS`:

```typescript
"ext": "mi_icono",      // ej: "rb": "ruby"
```

**Nombres de archivo específicos** → objeto `FILE_NAMES`:

```typescript
"Gemfile": "ruby",       // nombre exacto → clave del icono
```

**Nombres de carpeta** → objetos `FOLDER_NAMES` y `FOLDER_NAMES_EXPANDED`:

```typescript
// FOLDER_NAMES:
"mi_carpeta": "mi_carpeta",

// FOLDER_NAMES_EXPANDED:
"mi_carpeta": "mi_carpeta_open",
```

---

## Paso 5: Compilar y Probar

```bash
# Instalar dependencias (solo la primera vez)
pnpm install

# Compilar TypeScript
pnpm run compile

# Probar en VS Code: presiona F5 para abrir la ventana de desarrollo
```

### Verificar

1. En la ventana de desarrollo, abre un proyecto con archivos/carpetas que usen tu icono
2. Verifica que aparece correctamente en el explorador
3. Prueba los tamaños con `Ctrl+Shift+P` → **Jerry's Pixel Icons: Change Icon Size**

---

## Paso 6: Crear el Pull Request

```bash
git checkout -b icon/nombre-del-icono
git add icons/ src/baseTheme.ts
git commit -m "feat: add nombre-del-icono icon"
git push origin icon/nombre-del-icono
```

En el PR incluye:

- **Descripción** del icono y qué archivos/carpetas representa
- **Screenshot** del icono en el explorador de VS Code
- **Archivos PNG originales** (opcional, para futuras ediciones)

---

## Checklist

- [ ] Pixel art creado a 16×16
- [ ] Exportado a PNG 256×256 con Nearest Neighbor
- [ ] Convertido a SVG con base64 embebido
- [ ] SVG en `icons/files/` o `icons/folders/`
- [ ] Si es carpeta: versión cerrada + abierta
- [ ] Registrado en `ICON_PATHS` en `src/baseTheme.ts`
- [ ] Mapeos en `FILE_EXTENSIONS`, `FILE_NAMES`, `FOLDER_NAMES` según corresponda
- [ ] Compila sin errores (`pnpm run compile`)
- [ ] Probado visualmente en VS Code (F5)

---

## Referencia: Configuración del Usuario

Los usuarios pueden personalizar los iconos desde VS Code Settings:

| Configuración                                 | Descripción                                   |
| --------------------------------------------- | --------------------------------------------- |
| `jerrysPixelIcons.iconSize`                   | Tamaño: `small`, `default`, `large`           |
| `jerrysPixelIcons.opacity`                    | Opacidad: 0.1 a 1.0                           |
| `jerrysPixelIcons.saturation`                 | Saturación: 0 (grises) a 1.0 (color completo) |
| `jerrysPixelIcons.hidesExplorerArrows`        | Ocultar flechas de carpetas                   |
| `jerrysPixelIcons.files.customAssociations`   | Asociar extensiones a iconos                  |
| `jerrysPixelIcons.folders.customAssociations` | Asociar carpetas a iconos                     |

### Comandos disponibles (`Ctrl+Shift+P`)

- **Jerry's Pixel Icons: Change Icon Size**
- **Jerry's Pixel Icons: Change Opacity**
- **Jerry's Pixel Icons: Change Saturation**
- **Jerry's Pixel Icons: Toggle Folder Arrows**
- **Jerry's Pixel Icons: Show Available Icons**
- **Jerry's Pixel Icons: Restore Default Configuration**
- **Jerry's Pixel Icons: Activate Icon Theme**
