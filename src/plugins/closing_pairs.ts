import type { EditorPlugin } from "./index.js";

export type ClosingPair = [open: string, close: string];

export type ClosingPairsRules = {
	language: string;
	pairs: ClosingPair[];
};

interface ResolvedClosingPairsRules {
	auto_closing_pairs_open_by_start: Map<string, string>;
	auto_closing_pairs_open_by_end: Map<string, string>;
	auto_closing_pairs: Set<string>;
}

const should_auto_close = " \t\n.,;)]}>=";

/**
 * A plugin that automatically inserts closing pairs.
 */
export function hookClosingPairs(...bracketRuleList: ClosingPairsRules[]): EditorPlugin {
	const cache = new Map<string, ResolvedClosingPairsRules>();

	for (const { language, pairs: brackets } of bracketRuleList) {
		const auto_closing_pairs_open_by_start = new Map();
		const auto_closing_pairs_open_by_end = new Map();
		const auto_closing_paris = new Set<string>();
		brackets.forEach(([open, close]) => {
			auto_closing_pairs_open_by_start.set(open, close);
			auto_closing_pairs_open_by_end.set(close, open);
			auto_closing_paris.add(open + close);
		});
		cache.set(language, {
			auto_closing_pairs_open_by_start,
			auto_closing_pairs_open_by_end,
			auto_closing_pairs: auto_closing_paris,
		});
	}

	return ({ input }, options) => {
		const onKeydown = (e: KeyboardEvent) => {
			const config = cache.get(options.language);
			if (!config) {
				return;
			}

			const { selectionStart, selectionEnd } = input;

			if (isBackspace(e)) {
				if (selectionStart !== selectionEnd) {
					return;
				}

				const slice = input.value.slice(selectionStart - 1, selectionStart + 1);
				if (config.auto_closing_pairs.has(slice)) {
					input.setSelectionRange(selectionStart - 1, selectionStart + 1);
				}
				return;
			}

			if (
				!config.auto_closing_pairs_open_by_start.has(e.key) &&
				!config.auto_closing_pairs_open_by_end.has(e.key)
			) {
				return;
			}

			// add pairs surrounding the selection
			if (selectionStart !== selectionEnd && config.auto_closing_pairs_open_by_start.has(e.key)) {
				e.preventDefault();
				const text = input.value.slice(selectionStart, selectionEnd);
				const left = e.key;
				const right = config.auto_closing_pairs_open_by_start.get(left)!;
				input.setRangeText(left + text + right, selectionStart, selectionEnd, "select");
				input.dispatchEvent(new Event("input"));
				input.dispatchEvent(new Event("change"));
				return;
			}

			// add pairs at the cursor
			if (
				selectionStart === selectionEnd &&
				config.auto_closing_pairs_open_by_start.has(e.key) &&
				should_auto_close.includes(input.value[selectionStart] || "")
			) {
				const left = e.key;
				const right = config.auto_closing_pairs_open_by_start.get(left)!;
				input.setRangeText(right, selectionStart, selectionEnd, "start");
				return;
			}

			// skip right pairs
			if (selectionStart === selectionEnd && config.auto_closing_pairs_open_by_end.has(e.key)) {
				const prev = input.value[selectionStart - 1];
				const left = config.auto_closing_pairs_open_by_end.get(e.key)!;
				if (prev === left) {
					input.setSelectionRange(selectionStart + 1, selectionEnd + 1);
				}
			}
		};

		input.addEventListener("keydown", onKeydown);

		return () => {
			input.removeEventListener("keydown", onKeydown);
		};
	};
}

export const pairs_parentheses = ["(", ")"] satisfies ClosingPair;
export const pairs_brackets = ["[", "]"] satisfies ClosingPair;
export const pairs_braces = ["{", "}"] satisfies ClosingPair;
export const pairs_angle = ["<", ">"] satisfies ClosingPair;
export const pairs_quotes = ['"', '"'] satisfies ClosingPair;
export const pairs_single_quotes = ["'", "'"] satisfies ClosingPair;
export const pairs_backticks = ["`", "`"] satisfies ClosingPair;

const c_lang_pairs: ClosingPair[] = [
	pairs_parentheses,
	pairs_brackets,
	pairs_braces,
	pairs_quotes,
	pairs_single_quotes,
];

const c_lang_pairs_with_backticks: ClosingPair[] = [
	pairs_parentheses,
	pairs_brackets,
	pairs_braces,
	pairs_quotes,
	pairs_single_quotes,
	pairs_backticks,
];

export const default_pairs: ClosingPairsRules[] = [
	{
		language: "c",
		pairs: c_lang_pairs,
	},
	{
		language: "cpp",
		pairs: c_lang_pairs,
	},
	{
		language: "css",
		pairs: c_lang_pairs,
	},
	{
		language: "csharp",
		pairs: c_lang_pairs,
	},
	{
		language: "dart",
		pairs: c_lang_pairs_with_backticks,
	},
	{
		language: "go",
		pairs: c_lang_pairs_with_backticks,
	},
	{
		language: "java",
		pairs: c_lang_pairs,
	},
	{
		language: "json",
		pairs: [pairs_brackets, pairs_braces, pairs_quotes],
	},
	{
		language: "javascript",
		pairs: c_lang_pairs_with_backticks,
	},
	{
		language: "typescript",
		pairs: c_lang_pairs_with_backticks,
	},
	{
		language: "jsx",
		pairs: c_lang_pairs_with_backticks,
	},
	{
		language: "tsx",
		pairs: c_lang_pairs_with_backticks,
	},
	{
		language: "php",
		pairs: c_lang_pairs,
	},
	{
		language: "python",
		pairs: c_lang_pairs,
	},
	{
		language: "rust",
		pairs: [pairs_parentheses, pairs_brackets, pairs_braces, pairs_quotes],
	},
	{
		language: "ruby",
		pairs: c_lang_pairs_with_backticks,
	},
	{
		language: "sql",
		pairs: c_lang_pairs_with_backticks,
	},
];

function isBackspace(e: KeyboardEvent) {
	return e.key === "Backspace" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey;
}
