import { getHighlighter, type BundledLanguage, type BundledTheme } from "shiki";
import { hookBracket } from "./bracket.js";
import { hookScroll } from "./scroll.js";
import { hookIndent, hookOutdent } from "./tab.js";

interface TextRange {
	offset: number;
	line: number;
	start: number;
	end: number;
}

interface OnHoverElementContext {
	content: string;
	element: Element;
	raw: string;
}

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

	onHoverElement?: (range: TextRange, context: OnHoverElementContext) => void;
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
	value: string;
	updateOptions(options: EditorOptions): void;
	/**
	 * Dispose the editor.
	 */
	dispose(): void;
}

function throttle<T extends (...args: any[]) => void>(fn: T, delay: number) {
	let last = 0;
	return (...args: any[]) => {
		const now = Date.now();
		if (now - last >= delay) {
			fn(...args);
			last = now;
		}
	};
}

export function create(domElement: HTMLElement, options?: EditorOptions): ICodeEditor {
	const doc = domElement.ownerDocument;

	const output = doc.createElement("div");
	const input = doc.createElement("textarea");

	output.classList.add("shiki-editor", "output");
	input.classList.add("shiki-editor", "input");

	input.setAttribute("autocapitalize", "off");
	input.setAttribute("autocomplete", "off");
	input.setAttribute("autocorrect", "off");
	input.setAttribute("spellcheck", "false");

	if (options?.lineNumbers !== "off") {
		output.classList.add("line-numbers");
		input.classList.add("line-numbers");
	}

	domElement.appendChild(input);
	domElement.appendChild(output);

	const theme_name = options?.theme ?? "github-light";

	const highlighter = getHighlighter({
		themes: [theme_name],
		langs: ["javascript"],
	});

	const render = async () => {
		const { codeToTokens, getTheme } = await highlighter;

		const theme = getTheme(theme_name);
		domElement.style.backgroundColor = theme.bg;
		domElement.style.color = theme.fg;
		domElement.style.setProperty("--caret-color", theme.fg);
		const codeToHtml = (code: string) => {
			const {
				tokens: tokensLines,
				fg, bg,
				themeName,
				rootStyle
			} = codeToTokens(code, {
				lang: "javascript",
				theme: theme,
			});
			const lines = tokensLines.map((tokenLine, index) => (`<span class="line">${
				tokenLine
					.map(token => `<span class="${
						`offset:${token.offset} ` +
						`position:${index + 1}:${token.offset + 1},${token.offset + 1 + token.content.length} ` +
						`font-style:${token.fontStyle}`
					}" style="color: ${token.color}">${token.content}</span>`)
					.join("")
			}</span>`))
			return `<pre class="shiki ${themeName}" style="background-color:${bg};color:${fg};${rootStyle ? rootStyle : ''}" tabindex="0"><code>${lines}</code></pre>`
		}
		output.innerHTML = codeToHtml(input.value);
	};

	if (options?.onHoverElement) {
		let prevOutputHoverElement: Element | null = null;
		input.addEventListener("mousemove", throttle(e => {
			input.style.pointerEvents = "none";
			output.style.pointerEvents = "auto";
			const outputHoverElement = document.elementFromPoint(e.clientX, e.clientY);
			input.style.pointerEvents = "";
			output.style.pointerEvents = "";
			if (outputHoverElement === prevOutputHoverElement) {
				return;
			}
			prevOutputHoverElement = outputHoverElement;
			if (outputHoverElement === null) {
				return;
			}
			if (
				outputHoverElement.className.includes("shiki-editor")
				&& outputHoverElement.className.includes("output")
			) {
				return;
			}

			if (!outputHoverElement?.className.includes("position")) {
				return;
			}

			const offsetStr = /offset:(\d+)/
				.exec(outputHoverElement.className)
				?.[1];
			if (!offsetStr) {
				return;
			}
			const offset = Number(offsetStr);
			if (isNaN(offset)) {
				return;
			}
			const [line, start, end] = /position:(\d+):(\d+),(\d+)/
				.exec(outputHoverElement.className)
				?.slice(1)
				?.map(Number)
				?? [];
			if (!line || !start || !end || [line, start, end].some(isNaN)) {
				return;
			}

			options.onHoverElement!({ offset, line: line, start: start, end: end }, {
				content: input.value.slice(start - 1, end - 1),
				element: outputHoverElement,
				raw: input.value,
			});
		}, 50));
	}
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
		hookScroll(input, output),
		() => {
			domElement.removeChild(input);
			domElement.removeChild(output);
		},
	];

	return {
		get value() {
			return input.value;
		},
		set value(value: string) {
			input.value = value;
			render();
		},
		updateOptions: (newOptions: EditorOptions) => {
			console.log("updateOptions", newOptions);
		},
		dispose() {
			cleanup.forEach((fn) => fn());
		},
	};
}
