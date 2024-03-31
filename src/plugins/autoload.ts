import type { IDisposeable, ShikiEditor } from "./index.js";

/**
 * Automatically load languages and themes when they are not already loaded.
 *
 * It's recommended to handle shiki highlighter by yourself if you know all the languages and themes you will use.
 * This plugin will convert the `updateOptions` method to async method.
 */
export function autoload(editor: ShikiEditor): IDisposeable {
	const updateOptions = editor.updateOptions;

	editor.updateOptions = async (newOptions) => {
		const themes = editor.highlighter.getLoadedThemes();
		const langs = editor.highlighter.getLoadedLanguages();

		themes.push("none");
		langs.push("text");

		if (newOptions.theme !== void 0 && !themes.includes(newOptions.theme)) {
			await editor.highlighter.loadTheme(newOptions.theme);
		}

		if (newOptions.language !== void 0 && !langs.includes(newOptions.language)) {
			await editor.highlighter.loadLanguage(newOptions.language);
		}

		updateOptions(newOptions);
	};

	return () => {
		editor.updateOptions = updateOptions;
	};
}
