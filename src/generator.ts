import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  ICON_PATHS,
  FILE_EXTENSIONS,
  FILE_NAMES,
  FOLDER_NAMES,
  FOLDER_NAMES_EXPANDED,
} from "./baseTheme";

interface IconTheme {
  hidesExplorerArrows?: boolean;
  iconDefinitions: Record<string, { iconPath: string }>;
  file: string;
  folder: string;
  folderExpanded: string;
  fileExtensions: Record<string, string>;
  fileNames: Record<string, string>;
  folderNames: Record<string, string>;
  folderNamesExpanded: Record<string, string>;
}

const SIZE_VIEWBOX: Record<string, string> = {
  small: "-51 -51 358 358",
  default: "0 0 256 256",
  large: "32 32 192 192",
};

export function generateTheme(extensionPath: string): void {
  const config = vscode.workspace.getConfiguration("jerrysPixelIcons");

  const hidesArrows = config.get<boolean>("hidesExplorerArrows", false);
  const opacity = config.get<number>("opacity", 1.0);
  const saturation = config.get<number>("saturation", 1.0);
  const iconSize = config.get<string>("iconSize", "default");
  const customFileAssoc = config.get<Record<string, string>>(
    "files.customAssociations",
    {},
  );
  const customFolderAssoc = config.get<Record<string, string>>(
    "folders.customAssociations",
    {},
  );

  const needsModifiedSvgs =
    opacity < 1.0 || saturation < 1.0 || iconSize !== "default";

  let iconBaseRelative: string;

  if (needsModifiedSvgs) {
    const generatedDir = path.join(extensionPath, "icons-generated");
    generateModifiedSvgs(
      extensionPath,
      generatedDir,
      opacity,
      saturation,
      iconSize,
    );
    iconBaseRelative = "../icons-generated";
  } else {
    iconBaseRelative = "../icons";
  }

  const iconDefinitions: Record<string, { iconPath: string }> = {};
  for (const [key, relativePath] of Object.entries(ICON_PATHS)) {
    iconDefinitions[key] = {
      iconPath: `${iconBaseRelative}/${relativePath}`,
    };
  }

  const fileExtensions = { ...FILE_EXTENSIONS, ...customFileAssoc };
  const folderNames = { ...FOLDER_NAMES, ...customFolderAssoc };

  const folderNamesExpanded = { ...FOLDER_NAMES_EXPANDED };
  for (const [name, iconKey] of Object.entries(customFolderAssoc) as [
    string,
    string,
  ][]) {
    const openKey = `${iconKey}_open`;
    if (ICON_PATHS[openKey]) {
      folderNamesExpanded[name] = openKey;
    } else {
      folderNamesExpanded[name] = iconKey;
    }
  }

  const theme: IconTheme = {
    iconDefinitions,
    file: "_file",
    folder: "_folder",
    folderExpanded: "_folder_open",
    fileExtensions,
    fileNames: { ...FILE_NAMES },
    folderNames,
    folderNamesExpanded,
  };

  if (hidesArrows) {
    theme.hidesExplorerArrows = true;
  }

  const themePath = path.join(extensionPath, "themes", "icon-theme.json");
  fs.writeFileSync(themePath, JSON.stringify(theme, null, 2), "utf-8");
}

function generateModifiedSvgs(
  extensionPath: string,
  outputDir: string,
  opacity: number,
  saturation: number,
  size: string,
): void {
  const filesDir = path.join(outputDir, "files");
  const foldersDir = path.join(outputDir, "folders");
  fs.mkdirSync(filesDir, { recursive: true });
  fs.mkdirSync(foldersDir, { recursive: true });

  const sourceIconsDir = path.join(extensionPath, "icons");

  for (const subDir of ["files", "folders"]) {
    const sourceDir = path.join(sourceIconsDir, subDir);
    const destDir = path.join(outputDir, subDir);

    if (!fs.existsSync(sourceDir)) {
      continue;
    }

    const files = fs
      .readdirSync(sourceDir)
      .filter((f: string) => f.endsWith(".svg"));
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file);
      const destPath = path.join(destDir, file);
      let svg = fs.readFileSync(sourcePath, "utf-8");
      svg = modifySvg(svg, opacity, saturation, size);
      fs.writeFileSync(destPath, svg, "utf-8");
    }
  }
}

function modifySvg(
  svg: string,
  opacity: number,
  saturation: number,
  size: string,
): string {
  if (size !== "default") {
    const newViewBox = SIZE_VIEWBOX[size] || SIZE_VIEWBOX["default"];
    svg = svg.replace(/viewBox="0 0 256 256"/, `viewBox="${newViewBox}"`);
  }

  const needsFilter = saturation < 1.0;
  const needsOpacity = opacity < 1.0;

  if (!needsFilter && !needsOpacity) {
    return svg;
  }

  let filterDef = "";
  let filterAttr = "";

  if (needsFilter) {
    filterDef = `<defs><filter id="c"><feColorMatrix type="saturate" values="${saturation}"/></filter></defs>`;
    filterAttr = ` filter="url(#c)"`;
  }

  let opacityAttr = "";
  if (needsOpacity) {
    opacityAttr = ` opacity="${opacity}"`;
  }

  svg = svg.replace(
    /(<svg[^>]*>)([\s\S]*?)(<\/svg>)/,
    `$1${filterDef}<g${opacityAttr}${filterAttr}>$2</g>$3`,
  );

  return svg;
}
