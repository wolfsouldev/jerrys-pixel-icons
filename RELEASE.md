# Publicar una versión de Jerry's Pixel Icons

La web y la extensión se publican por separado. El CI existente despliega la web
al subir cambios probados a `master`; no cambia versiones ni publica extensiones.
Los dos workflows de release son manuales y solo aceptan `master`.

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
4. Revisa el PR y su aspecto en VS Code. Los PRs creados con `GITHUB_TOKEN` no
   disparan automáticamente otros workflows: ejecuta **Validate and package**
   manualmente sobre la rama `release/vX.Y.Z` antes de hacer merge. Ese workflow
   incluye las matrices Node 22/24 y los navegadores, sin desplegar esa rama.
5. Haz merge del PR en `master`. Crear o fusionar el PR NO publica la extensión.

Alternativa local (árbol de trabajo limpio): `pnpm run release:prepare minor`,
revisar el diff, ejecutar las pruebas y abrir un PR con los dos archivos cambiados.
Este comando no hace commits, tags, push ni publicación.
Si ya existe la rama/PR de la versión, revísala y reutilízala; no ejecutes otro
incremento por un error al crear el PR ni hagas force-push.

## Publicar

1. En **Actions → Publish extension → Run workflow**, selecciona `master` e
   introduce la versión exacta revisada, por ejemplo `0.4.0`.
2. Se comprueban identidad, versión y notas; se ejecutan pruebas, empaquetado y
   pruebas de navegador. El VSIX comprobado se conserva como artefacto.
3. El environment `marketplace` espera aprobación del mantenedor configurado.
4. Tras aprobar, se descarga y verifica **ese mismo VSIX** y se publica usando
   OIDC. No se vuelve a empaquetar ni se incrementa la versión durante el publish.
5. Se descarga el paquete público de esa versión y se verifica su SHA-256 contra
   el artefacto probado. El job solo termina correctamente si coinciden.

Si Microsoft tarda en procesar el paquete y falla la verificación, revisa primero
el estado en Marketplace. No aumentes otra vez la versión ni republiques a ciegas.
Descarga el artefacto de esa ejecución y ejecuta `pnpm run release:verify` desde
el mismo commit para repetir únicamente la comprobación pública. Una versión
publicada no puede sobrescribirse; las correcciones requieren otra versión.
Estos workflows no crean tags ni GitHub Releases y nunca despublican versiones.
