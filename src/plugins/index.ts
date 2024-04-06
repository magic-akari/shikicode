import type { BundledLanguage, BundledTheme } from "shiki";
import type { ShikiCode, ShikiOptions } from "../core.js";

export type IDisposable = () => void;
export type { ShikiCode } from "../core.js";

export interface PluginOptions extends ShikiOptions {
	readonly language: "text" | BundledLanguage;
	readonly theme: "none" | BundledTheme;
}

export type EditorPlugin = {
	(editor: ShikiCode, options: PluginOptions): IDisposable;
};

export * from "./autoload.js";
export * from "./closing_pairs.js";
export * from "./tab.js";
