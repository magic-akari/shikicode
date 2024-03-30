import { ceilTab, floorTab, visibleWidthFromLeft, visibleWidthLeadingSpace } from "./common.js";

export interface IndentConfig {
	tabSize: number;
	insertSpaces: boolean;
}

export interface State {
	/**
	 * The whole text content.
	 */
	value: string;
	/**
	 * The start of the selection.
	 */
	selectionStart: number;
	/**
	 * The end of the selection.
	 */
	selectionEnd: number;
	/**
	 * The direction of the selection.
	 */
	selectionDirection?: "forward" | "backward" | "none";
}

export interface PatchAction {
	value: string;
	start: number;
	end: number;
	mode?: SelectionMode;
}

export interface SelectAction {
	start: number;
	end: number;
	direction?: "forward" | "backward" | "none";
}

export interface Action {
	/**
	 * The patched text content.
	 */
	patch?: PatchAction;
	/**
	 * The new selection.
	 */
	select?: SelectAction;
}

export function indentText(input: State, config: IndentConfig): Action {
	if (
		input.selectionStart !== input.selectionEnd &&
		(bothEndsSelected(input.value, input.selectionStart, input.selectionEnd) ||
			input.value.slice(input.selectionStart, input.selectionEnd).includes("\n"))
	) {
		return blockIndentText(input, config);
	}

	return simpleIndentText(input, config);
}

function simpleIndentText(input: State, config: IndentConfig): Action {
	const { value, selectionStart, selectionEnd } = input;
	const { tabSize, insertSpaces } = config;

	if (!insertSpaces) {
		return {
			patch: {
				value: "\t",
				start: selectionStart,
				end: selectionEnd,
				mode: "end",
			},
		};
	}

	const [width_from_left] = visibleWidthFromLeft(value, selectionStart, tabSize);
	const indent = " ".repeat(ceilTab(width_from_left + 1, tabSize) - width_from_left);
	return {
		patch: {
			value: indent,
			start: selectionStart,
			end: selectionEnd,
			mode: "end",
		},
	};
}

function blockIndentText(input: State, config: IndentConfig): Action {
	const { tabSize, insertSpaces } = config;
	const { value, selectionStart, selectionEnd, selectionDirection } = input;

	const block_start = getLineStart(value, selectionStart);
	const block_end = getLineEnd(value, selectionEnd);

	const block = value.slice(block_start, block_end);

	const replacement = block.replaceAll(/^[ \t]*/gm, (leading, offset, str) => {
		if (str[offset] === "\n" || str[offset] === "\r" || offset === block_end) return leading;

		let [tab_width] = visibleWidthFromLeft(leading, leading.length, tabSize, 0);
		tab_width = ceilTab(tab_width + 1, tabSize);

		if (insertSpaces) {
			return " ".repeat(tab_width);
		}
		return "\t".repeat(tab_width / tabSize);
	});

	const patch = {
		value: replacement,
		start: block_start,
		end: block_end,
		mode: "end",
	} satisfies PatchAction;

	// restore selection
	// By default, the selection is anchored at both ends.
	const select = {
		start: selectionStart,
		end: selectionEnd + replacement.length - block.length,
		direction: selectionDirection,
	} satisfies SelectAction;

	if (selectionStart !== block_start) {
		const line_start = block_start;
		const cursor_offset = selectionStart - line_start;
		const line = value.slice(line_start, selectionStart);
		const [, old_leading_offset] = visibleWidthLeadingSpace(line, tabSize);
		const [, max_leading_offset] = visibleWidthLeadingSpace(replacement, tabSize);

		if (cursor_offset > old_leading_offset) {
			// |<TAB>|<TAB>|T|ext
			//               ^
			select.start += max_leading_offset - old_leading_offset;
		} else if (cursor_offset > max_leading_offset) {
			// |     |     |Text (old)
			//           ^
			// |<TAB>|<TAB>|<TAB>|Text (new)
			//                   ^
			select.start = line_start + max_leading_offset;
		}
	}

	if (selectionEnd < block_end) {
		const line_start = getLineStart(value, selectionEnd);
		const cursor_offset = selectionEnd - line_start;
		const line = value.slice(line_start, selectionEnd);
		const [, old_leading_offset] = visibleWidthLeadingSpace(line, tabSize);

		const new_bottom_line_offset = getLineStart(replacement, replacement.length);
		const new_bottom_line = replacement.slice(new_bottom_line_offset);
		const [, max_leading_offset] = visibleWidthLeadingSpace(new_bottom_line, tabSize);

		if (cursor_offset <= old_leading_offset) {
			select.end = block_start + new_bottom_line_offset + cursor_offset;

			if (cursor_offset > max_leading_offset) {
				select.end += max_leading_offset - old_leading_offset;
			}
		}
	}

	return {
		patch,
		select,
	} satisfies Action;
}

export function outdentText(input: State, config: IndentConfig): Action {
	const { tabSize, insertSpaces } = config;
	const { value, selectionStart, selectionEnd, selectionDirection } = input;

	const block_start = getLineStart(value, selectionStart);
	const block_end = getLineEnd(value, selectionEnd);

	const block = value.slice(block_start, block_end);

	const replacement = block.replaceAll(/^[ \t]*/gm, (leading) => {
		let [tab_width] = visibleWidthFromLeft(leading, leading.length, tabSize, 0);
		tab_width = floorTab(tab_width - 1, tabSize);

		if (tab_width <= 0) return "";

		if (insertSpaces) {
			return " ".repeat(tab_width);
		}
		return "\t".repeat(tab_width / tabSize);
	});
	if (replacement === block) return {};

	const patch = {
		value: replacement,
		start: block_start,
		end: block_end,
		mode: "end",
	} satisfies PatchAction;

	// restore selection
	// By default, the selection is anchored at both ends.
	const select = {
		start: selectionStart,
		end: selectionEnd + replacement.length - block.length,
		direction: selectionDirection,
	} satisfies SelectAction;

	if (selectionStart !== block_start) {
		const line_start = block_start;
		const cursor_offset = selectionStart - line_start;
		const line = value.slice(line_start, selectionStart);
		const [, old_leading_offset] = visibleWidthLeadingSpace(line, tabSize);
		const [, max_leading_offset] = visibleWidthLeadingSpace(replacement, tabSize);

		if (cursor_offset > old_leading_offset) {
			// |<TAB>|<TAB>|T|ext
			//               ^
			select.start += max_leading_offset - old_leading_offset;
		} else if (cursor_offset > max_leading_offset) {
			// |     |     |Text (old)
			//           ^
			// |<TAB>|<TAB>|<TAB>|Text (new)
			//                   ^
			select.start = line_start + max_leading_offset;
		}
	}

	if (selectionEnd < block_end) {
		const line_start = getLineStart(value, selectionEnd);
		const cursor_offset = selectionEnd - line_start;
		const line = value.slice(line_start, selectionEnd);
		const [, old_leading_offset] = visibleWidthLeadingSpace(line, tabSize);

		const new_bottom_line_offset = getLineStart(replacement, replacement.length);
		const new_bottom_line = replacement.slice(new_bottom_line_offset);
		const [, max_leading_offset] = visibleWidthLeadingSpace(new_bottom_line, tabSize);

		if (cursor_offset <= old_leading_offset) {
			select.end = block_start + new_bottom_line_offset + cursor_offset;

			if (cursor_offset > max_leading_offset) {
				select.end += max_leading_offset - old_leading_offset;
			}
		}
	}

	return {
		patch,
		select,
	} satisfies Action;
}

function enter(input: State, config: IndentConfig): Action {
	if (input.selectionStart !== input.selectionEnd) {
		return {};
	}
	const { value, selectionStart } = input;
	const line_start = getLineStart(value, selectionStart);
	if (line_start === selectionStart) {
		return {};
	}

	const line = value.slice(line_start, selectionStart);
	let [leading_space] = visibleWidthLeadingSpace(line, config.tabSize);
	leading_space = floorTab(leading_space, config.tabSize);
	let indet_space = leading_space;

	switch (value[selectionStart - 1]) {
		case "(":
		case "[":
		case "{": {
			indet_space += config.tabSize;
		}
	}

	let replacement = "\n" + " ".repeat(indet_space);
	if (config.insertSpaces) {
		replacement = "\n" + "\t".repeat(indet_space / config.tabSize);
	}

	let select: SelectAction | undefined;

	switch (value.slice(selectionStart - 1, selectionStart + 1)) {
		case "{}":
		case "[]":
		case "()": {
			select = {
				start: selectionStart + replacement.length,
				end: selectionStart + replacement.length,
				direction: "none",
			};

			if (config.insertSpaces) {
				replacement += "\n" + " ".repeat(leading_space);
			} else {
				replacement += "\n" + "\t".repeat(leading_space / config.tabSize);
			}
		}
	}

	return {
		patch: {
			value: replacement,
			start: selectionStart,
			end: selectionStart,
			mode: "end",
		},
		select,
	};
}

function bothEndsSelected(text: string, start: number, end: number): boolean {
	const is_start = start === 0 || text[start - 1] === "\n";
	const is_end = end === text.length || text[end] === "\n" || text[end] === "\r";
	return start !== end && is_start && is_end;
}

function getLineStart(text: string, index: number): number {
	while (index > 0 && text[index - 1] !== "\n") {
		index--;
	}
	return index;
}

/**
 * Get the end index of the line.
 * - all suffix "\n" and "\r" are ignored.
 * - text[end] === "\n" || text[end] === "\r" || end === text.length
 * - text.slice(start, end) should not include "\n" at the end.
 */
function getLineEnd(text: string, index: number): number {
	if (text[index - 1] === "\n") {
		index--;
	}

	while (index > 0 && (index === text.length || text[index] === "\n" || text[index] === "\r")) {
		index--;
	}

	while (index < text.length && text[index] !== "\n" && text[index] !== "\r") {
		index++;
	}

	return index;
}

export function hookTab(input: HTMLTextAreaElement, config: IndentConfig) {
	const onKeydown = (e: KeyboardEvent) => {
		console.log(e.key);
		switch (e.key) {
			case "Tab": {
				const action = e.shiftKey ? outdentText : indentText;
				const { patch, select } = action(e.target as HTMLTextAreaElement, config);
				if (patch || select) {
					e.preventDefault();
				}
				if (patch) {
					input.setRangeText(patch.value, patch.start, patch.end, patch.mode);
					input.dispatchEvent(new Event("input"));
					input.dispatchEvent(new Event("change"));
				}
				if (select) {
					input.setSelectionRange(select.start, select.end, select.direction);
					input.dispatchEvent(new Event("selectionchange"));
				}
				break;
			}

			case "Enter": {
				const { patch, select } = enter(e.target as HTMLTextAreaElement, config);
				if (patch || select) {
					e.preventDefault();
				}
				if (patch) {
					input.setRangeText(patch.value, patch.start, patch.end, patch.mode);
					input.dispatchEvent(new Event("input"));
					input.dispatchEvent(new Event("change"));
				}
				if (select) {
					input.setSelectionRange(select.start, select.end, select.direction);
					input.dispatchEvent(new Event("selectionchange"));
				}
				break;
			}

			case "Backspace": {
				break;
			}

			default:
				return;
		}
	};

	input.addEventListener("keydown", onKeydown);
	return () => {
		input.removeEventListener("keydown", onKeydown);
	};
}
