import * as vscode from "vscode";
import { generateTheme } from "./generator";
import { AVAILABLE_FILE_ICONS, AVAILABLE_FOLDER_ICONS } from "./baseTheme";

export function activate(context: vscode.ExtensionContext): void {
  generateTheme(context.extensionPath);

  const configWatcher = vscode.workspace.onDidChangeConfiguration(
    (e: vscode.ConfigurationChangeEvent) => {
      if (e.affectsConfiguration("jerrysPixelIcons")) {
        generateTheme(context.extensionPath);
        promptReload();
      }
    },
  );

  const toggleArrows = vscode.commands.registerCommand(
    "jerrysPixelIcons.toggleArrows",
    async () => {
      const config = vscode.workspace.getConfiguration("jerrysPixelIcons");
      const current = config.get<boolean>("hidesExplorerArrows", false);
      await config.update(
        "hidesExplorerArrows",
        !current,
        vscode.ConfigurationTarget.Global,
      );
    },
  );

  const changeIconSize = vscode.commands.registerCommand(
    "jerrysPixelIcons.changeIconSize",
    async () => {
      const options: vscode.QuickPickItem[] = [
        {
          label: "$(dash) Small",
          description: "Iconos más pequeños con más espacio",
          detail: "small",
        },
        {
          label: "$(circle-outline) Default",
          description: "Tamaño estándar de iconos",
          detail: "default",
        },
        {
          label: "$(add) Large",
          description: "Iconos más grandes, menos espacio",
          detail: "large",
        },
      ];

      const selected = await vscode.window.showQuickPick(options, {
        placeHolder: "Selecciona el tamaño de los iconos",
      });

      if (selected) {
        const config = vscode.workspace.getConfiguration("jerrysPixelIcons");
        await config.update(
          "iconSize",
          selected.detail,
          vscode.ConfigurationTarget.Global,
        );
      }
    },
  );

  const changeOpacity = vscode.commands.registerCommand(
    "jerrysPixelIcons.changeOpacity",
    async () => {
      const options: vscode.QuickPickItem[] = [
        { label: "25%", detail: "0.25" },
        { label: "50%", detail: "0.5" },
        { label: "75%", detail: "0.75" },
        { label: "100%", description: "(Default)", detail: "1.0" },
      ];

      const selected = await vscode.window.showQuickPick(options, {
        placeHolder: "Selecciona la opacidad de los iconos",
      });

      if (selected) {
        const config = vscode.workspace.getConfiguration("jerrysPixelIcons");
        await config.update(
          "opacity",
          parseFloat(selected.detail!),
          vscode.ConfigurationTarget.Global,
        );
      }
    },
  );

  const changeSaturation = vscode.commands.registerCommand(
    "jerrysPixelIcons.changeSaturation",
    async () => {
      const options: vscode.QuickPickItem[] = [
        { label: "0% (Escala de grises)", detail: "0" },
        { label: "25%", detail: "0.25" },
        { label: "50%", detail: "0.5" },
        { label: "75%", detail: "0.75" },
        { label: "100%", description: "(Default)", detail: "1.0" },
      ];

      const selected = await vscode.window.showQuickPick(options, {
        placeHolder: "Selecciona la saturación de color de los iconos",
      });

      if (selected) {
        const config = vscode.workspace.getConfiguration("jerrysPixelIcons");
        await config.update(
          "saturation",
          parseFloat(selected.detail!),
          vscode.ConfigurationTarget.Global,
        );
      }
    },
  );

  const restoreDefaults = vscode.commands.registerCommand(
    "jerrysPixelIcons.restoreDefaults",
    async () => {
      const config = vscode.workspace.getConfiguration("jerrysPixelIcons");
      await config.update(
        "hidesExplorerArrows",
        undefined,
        vscode.ConfigurationTarget.Global,
      );
      await config.update(
        "opacity",
        undefined,
        vscode.ConfigurationTarget.Global,
      );
      await config.update(
        "saturation",
        undefined,
        vscode.ConfigurationTarget.Global,
      );
      await config.update(
        "iconSize",
        undefined,
        vscode.ConfigurationTarget.Global,
      );
      await config.update(
        "files.customAssociations",
        undefined,
        vscode.ConfigurationTarget.Global,
      );
      await config.update(
        "folders.customAssociations",
        undefined,
        vscode.ConfigurationTarget.Global,
      );
      vscode.window.showInformationMessage(
        "Jerry's Pixel Icons: Configuración restaurada a los valores por defecto.",
      );
    },
  );

  const activateTheme = vscode.commands.registerCommand(
    "jerrysPixelIcons.activateTheme",
    async () => {
      await vscode.workspace
        .getConfiguration()
        .update(
          "workbench.iconTheme",
          "jerrys-pixel",
          vscode.ConfigurationTarget.Global,
        );
      vscode.window.showInformationMessage("Jerry's Pixel Icons activado!");
    },
  );

  const showAvailableIcons = vscode.commands.registerCommand(
    "jerrysPixelIcons.showAvailableIcons",
    async () => {
      const type = await vscode.window.showQuickPick(
        [
          { label: "$(file) Iconos de archivos", detail: "files" },
          { label: "$(folder) Iconos de carpetas", detail: "folders" },
        ],
        { placeHolder: "¿Qué tipo de iconos quieres ver?" },
      );

      if (!type) {
        return;
      }

      const icons =
        type.detail === "files" ? AVAILABLE_FILE_ICONS : AVAILABLE_FOLDER_ICONS;

      const items = icons.map((icon) => ({ label: icon }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Iconos disponibles (selecciona para copiar la clave)",
      });

      if (selected) {
        await vscode.env.clipboard.writeText(selected.label);
        vscode.window.showInformationMessage(
          `Clave "${selected.label}" copiada al portapapeles. Úsala en customAssociations.`,
        );
      }
    },
  );

  context.subscriptions.push(
    configWatcher,
    toggleArrows,
    changeIconSize,
    changeOpacity,
    changeSaturation,
    restoreDefaults,
    activateTheme,
    showAvailableIcons,
  );
}

export function deactivate(): void {}

function promptReload(): void {
  const msg =
    "Jerry's Pixel Icons: El tema ha sido actualizado. Es posible que necesites recargar para ver los cambios.";
  const action = "Recargar ventana";
  vscode.window
    .showInformationMessage(msg, action)
    .then((selected: string | undefined) => {
      if (selected === action) {
        vscode.commands.executeCommand("workbench.action.reloadWindow");
      }
    });
}
