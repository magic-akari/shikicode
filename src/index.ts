import { getHighlighter, type Highlighter, type BundledLanguage, type BundledTheme } from "shiki";
import { hookBracket } from "./bracket.js";
import { hookScroll } from "./scroll.js";
import { hookIndent, hookOutdent } from "./tab.js";
import { injectStyle } from "./style.js";

interface UpdateOptions {
	language?: BundledLanguage;
	theme?: BundledTheme;

	/**
	 * Control the rendering of line numbers.
	 * Defaults to `on`.
	 */
	lineNumbers?: "on" | "off";
	/**
	 * Should the editor be read only. See also `domReadOnly`.
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

interface InitOptions extends UpdateOptions {
	language: BundledLanguage;
	theme: BundledTheme;
	supportedLanguages?: BundledLanguage[];
	supportedThemes?: BundledTheme[];
	value?: string;
}

type FullOptions = Required<InitOptions>;

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
	value: string;
	updateOptions(options: UpdateOptions): void;
	/**
	 * Dispose the editor.
	 */
	dispose(): void;
}

interface ShikiConfig {
	langs: BundledLanguage[];
	themes: BundledTheme[];
}

export function create(domElement: HTMLElement, options?: InitOptions): ICodeEditor {
	const config: FullOptions = { ...defaultOptions, ...options };
	const shiki_config: ShikiConfig = {
		themes: config.supportedThemes || [config.theme],
		langs: config.supportedLanguages || [config.language],
	};

	let highlighter = getHighlighter(shiki_config);

	const doc = domElement.ownerDocument;

	const output = doc.createElement("div");
	const input = doc.createElement("textarea");

	initIO(input, output);
	initContainer(domElement);

	domElement.appendChild(input);
	domElement.appendChild(output);

	updateIO(input, output, config);
	highlighter.then((highlighter) => {
		updateContainer(domElement, highlighter, config.theme);
	});

	if (config.value) {
		input.value = config.value;
	}

	const onInput = async () => {
		render(output, await highlighter, input.value, config.language, config.theme);
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
			domElement.removeChild(input);
			domElement.removeChild(output);
		},
	];

	return {
		get value() {
			return input.value;
		},
		set value(code) {
			input.value = code;
			highlighter.then((highlighter) => {
				render(output, highlighter, code, config.language, config.theme);
			});
		},
		updateOptions(newOptions) {
			{
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
					highlighter = getHighlighter(shiki_config);
				}
			}

			if (shouldUpdateIO(config, newOptions)) {
				updateIO(input, output, newOptions);
			}

			const should_update_container = shouldUpdateContainer(config, newOptions);
			const should_rerender = shouldRerender(config, newOptions);

			highlighter.then((highlighter) => {
				if (should_update_container) {
					updateContainer(domElement, highlighter, newOptions.theme!);
				}

				if (should_rerender) {
					render(
						output,
						highlighter,
						input.value,
						newOptions.language || config.language,
						newOptions.theme || config.theme,
					);
				}
			});

			Object.assign(config, newOptions);
		},
		dispose() {
			cleanup.forEach((fn) => fn());
		},
	};
}

function initContainer(container: HTMLElement) {
	container.style.color = "var(--fg)";
	container.style.backgroundColor = "var(--bg)";
	container.style.position = "relative";
}

function shouldUpdateContainer(config: FullOptions, newOptions: UpdateOptions) {
	return typeof newOptions.theme !== "undefined" && newOptions.theme !== config.theme;
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
		(typeof newOptions.lineNumbers !== "undefined" && newOptions.lineNumbers !== config.lineNumbers) ||
		(typeof newOptions.tabSize !== "undefined" && newOptions.tabSize !== config.tabSize) ||
		(typeof newOptions.readOnly !== "undefined" && newOptions.readOnly !== config.readOnly)
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

	if (typeof options.tabSize !== "undefined") {
		input.style.setProperty("--tab-size", options.tabSize.toString());
		output.style.setProperty("--tab-size", options.tabSize.toString());
	}

	if (typeof options.readOnly !== "undefined") {
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
		(typeof newOptions.theme !== "undefined" && newOptions.theme !== config.theme) ||
		(typeof newOptions.language !== "undefined" && newOptions.language !== config.language)
	);
}
