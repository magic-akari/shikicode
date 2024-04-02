import type { BundledLanguage, BundledTheme } from "shiki";
import type { ShikiEditor, ShikiOptions } from "../core.js";

export type IDisposeable = () => void;
export type { ShikiEditor } from "../core.js";

export interface PluginOptions extends ShikiOptions {
	readonly language: "text" | BundledLanguage;
	readonly theme: "none" | BundledTheme;
}

export type EditorPlugin = {
	(editor: ShikiEditor, options: PluginOptions): IDisposeable;
};

export * from "./autoload.js";
export * from "./bracket.js";
export * from "./tab.js";
