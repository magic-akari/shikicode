import { getHighlighter, type BundledLanguage, type BundledTheme } from 'shiki'
import { hookIndent, hookOutdent } from "./tab.js";
import { hookBracket } from "./bracket.js";

interface EditorOptions {
	value?: string;
	language: BundledLanguage;
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

	theme?: BundledTheme;
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

const defaultOptions: EditorOptions = {
	value: "",
	language: "c",
	lineNumbers: "on",
	readOnly: false,
	theme: "github-light",
	tabSize: 4,
	insertSpaces: true,
};

interface ICodeEditor {
	updateOptions(options: EditorOptions): void;
	/**
	 * Dispose the editor.
	 */
	dispose(): void;
}

export function create(domElement: HTMLElement, options?: EditorOptions): ICodeEditor {
	const doc = domElement.ownerDocument;

	const output = doc.createElement("div");
	const input = doc.createElement("textarea");

	output.classList.add("shiki-editor", "output");
	input.classList.add("shiki-editor", "input");

	domElement.appendChild(output);
	domElement.appendChild(input);

	const highlighter = getHighlighter({
		themes: ["github-light"],
		langs: ["javascript"],
	});

	const render = async () => {
		const { codeToTokens } = await highlighter;

		const codeToHtml = (code: string) => {
			const {
				tokens: tokensLines,
				fg, bg,
				themeName,
				rootStyle
			} = codeToTokens(code, {
				lang: "javascript",
				theme: "github-light",
			});
			const lines = tokensLines.map((tokenLine, index) => (`<span class="line">${
				tokenLine
					.map(token => `<span class="${
						`position:${index + 1}:${token.offset + 1},${token.offset + 1 + token.content.length}` + " " +
						`font-style:${token.fontStyle}`
					}" style="color: ${token.color}">${token.content}</span>`)
					.join("")
			}</span>`))
			return `<pre class="shiki ${themeName}" style="background-color:${bg};color:${fg};${rootStyle ? rootStyle : ''}" tabindex="0"><code>${lines}</code></pre>`
		}
		output.innerHTML = codeToHtml(input.value);
	};

	input.addEventListener("input", render);

	if (options?.value) {
		input.value = options.value;
	}
	render();

	const cleanup = [
		() => {
			input.removeEventListener("input", render);
		},
		hookIndent(input, options?.tabSize ?? 4, options?.insertSpaces ?? true),
		hookOutdent(input, options?.tabSize ?? 4, options?.insertSpaces ?? true),
		hookBracket(input),
		() => {
			domElement.removeChild(input);
			domElement.removeChild(output);
		},
	];

	return {
		updateOptions: (newOptions: EditorOptions) => {
			console.log("updateOptions", newOptions);
		},
		dispose() {
			cleanup.forEach((fn) => fn());
		},
	};
}
