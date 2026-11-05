# Publicar una versión de Jerry's Pixel Icons

La web y la extensión se publican por separado. El CI despliega la web al subir
cambios probados a `master`. El workflow **Publish extension** también escucha
esos pushes, pero solo empaqueta y publica cuando `package.json.version` subió
respecto al commit anterior y el changelog tiene notas fechadas para esa versión.
Los demás commits no publican en Marketplace. `Prepare extension release` sigue
siendo manual y abre un PR revisable para cada versión.

## Configuración inicial (una sola vez)

1. En GitHub, **Settings → Actions → General → Workflow permissions**, habilita
   **Allow GitHub Actions to create and approve pull requests**. El workflow solo
   crea un PR; no lo aprueba ni hace merge. Si una política de organización lo
   impide, prepara la versión localmente como se describe más abajo.
2. Crea el environment **marketplace**, restringido a la rama `master`, con
   **Required reviewers** (al menos un mantenedor) y sin saltarse la aprobación.
   El nombre del environment en el YAML NO configura los revisores por sí solo.
3. La persona con acceso al publisher **MelissaGutierrez** debe entrar en
   [administrar publishers](https://marketplace.visualstudio.com/manage/publishers/),
   abrir **Trusted Publishing → Create** y registrar exactamente:

   | Campo | Valor |
   | --- | --- |
   | Policy name | Jerry icons release |
   | Repository owner | `wolfsouldev` |
   | Repository | `jerrys-pixel-icons` |
   | Workflow | `publish.yml` |
   | Environment | `marketplace` |

No se necesita guardar un PAT ni enviarlo por chat. Se usa OIDC con `vsce` 4.1.0.
Consulta la [documentación oficial de publicación](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#publish-with-github-actions-and-trusted-publishing).
La sesión de GitHub no concede por sí sola acceso al publisher de Microsoft.

## Preparar y revisar la versión

1. Asegúrate de que los cambios de iconos ya están en `master` y de que hay notas
   bajo `## [Unreleased]` en `CHANGELOG.md`.
2. En **Actions → Prepare extension release → Run workflow**, selecciona `master`
   y el incremento: `patch` para correcciones, `minor` para nuevos iconos,
   `major` para cambios incompatibles. Desde 0.3.0, `minor` prepara **0.4.0**.
3. El workflow actualiza automáticamente `package.json`, mueve las notas a una
   sección fechada, prueba el paquete y abre un PR `release/vX.Y.Z`.
4. Revisa el PR, las notas y el aspecto en VS Code. El PR no publica.
5. Haz merge del PR en `master`. Ese cambio de versión dispara automáticamente
   las pruebas Node 22/24, empaquetado, verificaciones y pruebas de navegador.
   Tras superarlas, el environment `marketplace` solicita la aprobación
   configurada; después publica el mismo VSIX probado con OIDC y verifica que
   los bytes públicos coinciden.

Alternativa local (árbol de trabajo limpio): `pnpm run release:prepare minor`,
revisar el diff, ejecutar las pruebas y abrir un PR con los dos archivos cambiados.
Este comando no hace commits, tags, push ni publicación.
Si ya existe la rama/PR de la versión, revísala y reutilízala; no ejecutes otro
incremento por un error al crear el PR ni hagas force-push.

## Reintentar manualmente

Si el workflow automático falló, revisa primero el error. En **Actions → Publish
extension → Run workflow**, selecciona `master` e introduce la versión exacta ya
revisada. El flujo valida identidad/notas, vuelve a probar y empaquetar, y usa
`--skip-duplicate` para poder recuperar un timeout tras una publicación aceptada.
La comprobación SHA-256 falla si Marketplace contiene bytes distintos; en ese caso
no trates de sobrescribir esa versión: revisa Marketplace antes de preparar otra.
El environment `marketplace` mantiene la aprobación requerida también en el
reintento. No se vuelve a incrementar la versión durante esta operación.

Si Microsoft tarda en procesar el paquete y falla la verificación, revisa primero
el estado en Marketplace. No aumentes otra vez la versión ni republiques a ciegas.
Descarga el artefacto de esa ejecución y ejecuta `pnpm run release:verify` desde
el mismo commit para repetir únicamente la comprobación pública. Estos workflows
no crean tags ni GitHub Releases y nunca despublican versiones.
