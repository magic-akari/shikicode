import type * as Shiki from "shiki";
import type { BundledLanguage, BundledTheme, Highlighter } from "shiki";

import { hookBracket } from "./bracket.js";
import { hookScroll } from "./scroll.js";
import { injectStyle } from "./style.js";
import { hookIndent, hookOutdent } from "./tab.js";

export interface UpdateOptions {
	language?: BundledLanguage;
	theme?: BundledTheme;

	/**
	 * Control the rendering of line numbers.
	 * Defaults to `on`.
	 */
	lineNumbers?: "on" | "off";
	/**
	 * Should the editor be read only.
	 * Defaults to false.
	 */
	readOnly?: boolean;
	/**
	 * The number of spaces a tab is equal to.
	 * This setting is overridden based on the file contents when `detectIndentation` is on.
	 * Defaults to 4.
	 */
	tabSize?: number;
	/**
	 * Insert spaces when pressing `Tab`.
	 * This setting is overridden based on the file contents when `detectIndentation` is on.
	 * Defaults to true.
	 */
	insertSpaces?: boolean;
}

export interface InitOptions extends UpdateOptions {
	language: BundledLanguage;
	theme: BundledTheme;

	supportedLanguages?: BundledLanguage[];
	supportedThemes?: BundledTheme[];

	/**
	 * The initial value of the editor.
	 * Defaults to an empty string.
	 */
	value?: string;
}

export type FullOptions = Required<InitOptions>;

const defaultOptions: FullOptions = {
	// @ts-ignore
	__proto__: null,
	value: "",
	language: "c",
	lineNumbers: "on",
	readOnly: false,
	theme: "github-light",
	tabSize: 4,
	insertSpaces: true,
};

export interface ICodeEditor {
	/**
	 * The current value of the editor.
	 * update this to change the editor content and trigger a re-render.
	 */
	value: string;

	/**
	 * trigger a re-render of the editor.
	 */
	forceRender(): void;

	/**
	 * Update the editor options and trigger a re-render.
	 */
	updateOptions(options: UpdateOptions): void;

	/**
	 * Dispose the editor.
	 */
	dispose(): void;

	/**
	 * The inner textarea element.
	 */
	textarea: HTMLTextAreaElement;

	/**
	 * @internal
	 */
	" updateHighlighter"(h: Highlighter): void;
}

/**
 * Create a code editor with a shiki highlighter.
 *
 * @param {Highlighter} highlighter - The shiki highlighter to use.
 * @param {HTMLElement} domElement - The container element for the editor.
 * @param {InitOptions} [options] - The initial options for the editor.
 * @returns {ICodeEditor} - The created editor.
 */
export function createWithHighlighter(
	highlighter: Highlighter,
	domElement: HTMLElement,
	options?: InitOptions,
): ICodeEditor {
	const config: FullOptions = { ...defaultOptions, ...options };

	const doc = domElement.ownerDocument;

	const output = doc.createElement("div");
	const input = doc.createElement("textarea");

	initIO(input, output);
	initContainer(domElement);

	domElement.append(input);
	domElement.append(output);

	updateIO(input, output, config);
	updateContainer(domElement, highlighter, config.theme);

	if (config.value) {
		input.value = config.value;
	}

	const onInput = () => {
		render(output, highlighter, input.value, config.language, config.theme);
	};
	input.addEventListener("input", onInput);
	onInput();

	const cleanup = [
		() => {
			input.removeEventListener("input", onInput);
		},
		hookIndent(input, config),
		hookOutdent(input, config),
		hookBracket(input),
		hookScroll(input, output),
		injectStyle(doc),
		() => {
			input.remove();
			output.remove();
		},
	];

	const forceRender = (value = input.value) => {
		render(output, highlighter, value, config.language, config.theme);
	};

	return {
		textarea: input,
		get value() {
			return input.value;
		},
		set value(code) {
			input.value = code;
			forceRender(code);
		},
		forceRender,
		updateOptions(newOptions) {
			if (shouldUpdateIO(config, newOptions)) {
				updateIO(input, output, newOptions);
			}

			if (shouldUpdateContainer(config, newOptions)) {
				updateContainer(domElement, highlighter, newOptions.theme!);
			}

			if (shouldRerender(config, newOptions)) {
				render(
					output,
					highlighter,
					input.value,
					newOptions.language || config.language,
					newOptions.theme || config.theme,
				);
			}

			Object.assign(config, newOptions);
		},
		" updateHighlighter"(h: Highlighter) {
			highlighter = h;
		},
		dispose() {
			cleanup.forEach((fn) => fn());
		},
	};
}

interface ShikiConfig {
	langs: BundledLanguage[];
	themes: BundledTheme[];
}

export type ShikiInstance = Pick<typeof Shiki, "getHighlighter">;

/**
 * Create a code editor with shiki.
 *
 * @param {ShikiInstance} shiki - The shiki instance to use.
 * @param {HTMLElement} domElement - The container element for the editor.
 * @param {InitOptions} [options] - The initial options for the editor.
 * @returns {Promise<ICodeEditor>} - The created editor.
 */
export async function createWithShiki(
	shiki: ShikiInstance,
	domElement: HTMLElement,
	options?: InitOptions,
): Promise<ICodeEditor> {
	const config: FullOptions = { ...defaultOptions, ...options };
	const shiki_config: ShikiConfig = {
		themes: config.supportedThemes || [config.theme],
		langs: config.supportedLanguages || [config.language],
	};

	let highlighter = await shiki.getHighlighter(shiki_config);

	const editor = createWithHighlighter(highlighter, domElement, config);
	const updateOptions = editor.updateOptions;

	editor.updateOptions = async (newOptions: UpdateOptions) => {
		let should_update = false;
		if (newOptions.theme && !shiki_config.themes.includes(newOptions.theme)) {
			shiki_config.themes.push(newOptions.theme);
			should_update = true;
		}
		if (newOptions.language && !shiki_config.langs.includes(newOptions.language)) {
			shiki_config.langs.push(newOptions.language);
			should_update = true;
		}
		if (should_update) {
			const h = await shiki.getHighlighter(shiki_config);
			editor[" updateHighlighter"](h);
		}

		updateOptions(newOptions);
	};

	return editor;
}

function initContainer(container: HTMLElement) {
	container.style.color = "var(--fg)";
	container.style.backgroundColor = "var(--bg)";
	container.style.position = "relative";
}

function shouldUpdateContainer(config: FullOptions, newOptions: UpdateOptions) {
	return newOptions.theme !== void 0 && newOptions.theme !== config.theme;
}

function updateContainer(container: HTMLElement, highlighter: Highlighter, theme_name: string) {
	const theme = highlighter.getTheme(theme_name);
	container.style.setProperty("--fg", theme.fg);
	container.style.setProperty("--bg", theme.bg);
}

function initIO(input: HTMLTextAreaElement, output: HTMLElement) {
	input.setAttribute("autocapitalize", "off");
	input.setAttribute("autocomplete", "off");
	input.setAttribute("autocorrect", "off");
	input.setAttribute("spellcheck", "false");

	input.classList.add("shiki-editor", "input");
	output.classList.add("shiki-editor", "output");
}

function shouldUpdateIO(config: FullOptions, newOptions: UpdateOptions) {
	return (
		(newOptions.lineNumbers !== void 0 && newOptions.lineNumbers !== config.lineNumbers) ||
		(newOptions.tabSize !== void 0 && newOptions.tabSize !== config.tabSize) ||
		(newOptions.readOnly !== void 0 && newOptions.readOnly !== config.readOnly)
	);
}

function updateIO(input: HTMLTextAreaElement, output: HTMLElement, options: UpdateOptions) {
	switch (options.lineNumbers) {
		case "on": {
			input.classList.add("line-numbers");
			output.classList.add("line-numbers");
			break;
		}
		case "off": {
			input.classList.remove("line-numbers");
			output.classList.remove("line-numbers");
			break;
		}
	}

	if (options.tabSize !== void 0) {
		input.style.setProperty("--tab-size", options.tabSize.toString());
		output.style.setProperty("--tab-size", options.tabSize.toString());
	}

	if (options.readOnly !== void 0) {
		input.readOnly = options.readOnly;
	}
}

function render(output: HTMLElement, highlighter: Highlighter, value: string, lang: string, theme: string) {
	const { codeToHtml } = highlighter;
	output.innerHTML = codeToHtml(value, {
		lang,
		theme,
	});
}

function shouldRerender(config: FullOptions, newOptions: UpdateOptions) {
	return (
		(newOptions.theme !== void 0 && newOptions.theme !== config.theme) ||
		(newOptions.language !== void 0 && newOptions.language !== config.language)
	);
}
