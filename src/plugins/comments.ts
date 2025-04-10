import type { EditorPlugin } from "./index.js";
import { setRangeText } from "./common.js";

interface CommentRule {
	readonly language: string;
	readonly lineComment?: string;
	readonly blockComment?: readonly [string, string];
	/**
	 * Insert a space after the line comment token and inside the block comments tokens.
	 * Defaults to true.
	 */
	readonly insertSpace?: boolean;
}

export function comments(...rule_list: CommentRule[]): EditorPlugin {
	const rules = new Map<string, CommentRule>();
	for (const rule of rule_list) {
		rules.set(rule.language, rule);
	}

	return (editor, options) => {
		const onKeydown = (e: KeyboardEvent) => {
			if (e.key !== "/" || !ctrlKey(e)) return;
			e.preventDefault();

			const lang = options.language;
			const rule = rules.get(lang);
			if (!rule) return;
			if (!rule.lineComment && !rule.blockComment) return;

			if (rule.lineComment) {
				const result = lineComment(editor.input, rule.lineComment, rule.insertSpace);
				if (result.patch) {
					setRangeText(
						editor.input,
						result.patch.value,
						result.patch.start,
						result.patch.end,
						result.patch.mode,
					);
					editor.input.dispatchEvent(new Event("input"));
					editor.input.dispatchEvent(new Event("change"));
				}
				if (result.select) {
					editor.input.setSelectionRange(result.select.start, result.select.end, result.select.direction);
					editor.input.dispatchEvent(new Event("selectionchange"));
				}
				return;
			}

			if (rule.blockComment) {
				const result = blockComment(editor.input, rule.blockComment, rule.insertSpace);
				if (result.patch) {
					setRangeText(
						editor.input,
						result.patch.value,
						result.patch.start,
						result.patch.end,
						result.patch.mode,
					);
					editor.input.dispatchEvent(new Event("input"));
					editor.input.dispatchEvent(new Event("change"));
				}
				if (result.select) {
					editor.input.setSelectionRange(result.select.start, result.select.end, result.select.direction);
					editor.input.dispatchEvent(new Event("selectionchange"));
				}
				return;
			}
		};

		editor.input.addEventListener("keydown", onKeydown);

		return () => {
			editor.input.removeEventListener("keydown", onKeydown);
		};
	};
}

interface PatchAction {
	value: string;
	start: number;
	end: number;
	mode?: SelectionMode;
}

interface SelectAction {
	start: number;
	end: number;
	direction?: "forward" | "backward" | "none";
}

interface Action {
	patch?: PatchAction;
	select?: SelectAction;
}

const empty_action: Action = {};

function lineComment(input: HTMLTextAreaElement, comment: string, insertSpace: boolean = true): Action {
	const { value, selectionStart, selectionEnd, selectionDirection } = input;

	// If there is no selection, just comment current line
	if (selectionStart === selectionEnd) {
		const line_start = getLineStart(value, selectionStart);
		const line_end = getLineEnd(value, selectionStart);
		const line = value.slice(line_start, line_end);

		// Check if line is already commented
		const trimmed = line.trimStart();
		const leading_space = line.length - trimmed.length;

		if (trimmed.startsWith(comment)) {
			// Check if there's a space after the comment that needs to be removed
			const afterComment = trimmed.substring(comment.length);
			const hasSpaceAfterComment = afterComment.startsWith(" ");
			const commentLength = comment.length + (hasSpaceAfterComment && insertSpace ? 1 : 0);

			// Remove comment and possibly the space
			const comment_pos = line_start + leading_space;
			return {
				patch: {
					value: "",
					start: comment_pos,
					end: comment_pos + commentLength,
					mode: "end",
				},
				select: {
					start: selectionStart - (selectionStart > comment_pos + commentLength ? commentLength : 0),
					end: selectionEnd - (selectionEnd > comment_pos + commentLength ? commentLength : 0),
					direction: selectionDirection,
				},
			};
		} else {
			// Add comment with optional space
			const afterCommentStr = insertSpace ? " " : "";
			const comment_pos = line_start + leading_space;
			return {
				patch: {
					value: comment + afterCommentStr,
					start: comment_pos,
					end: comment_pos,
					mode: "end",
				},
				select: {
					start:
						selectionStart + (selectionStart >= comment_pos ? comment.length + afterCommentStr.length : 0),
					end: selectionEnd + (selectionEnd >= comment_pos ? comment.length + afterCommentStr.length : 0),
					direction: selectionDirection,
				},
			};
		}
	}

	// Comment multiple lines
	const block_start = getLineStart(value, selectionStart);
	const block_end = getLineEnd(value, selectionEnd);
	const block = value.slice(block_start, block_end);

	// Check if all selected lines are commented
	const lines = block.split("\n");
	const all_commented = lines.every((line) => {
		const trimmed = line.trimStart();
		return trimmed.length === 0 || trimmed.startsWith(comment);
	});

	let replacement: string;
	let length_diff: number;
	const afterCommentStr = insertSpace ? " " : "";

	if (all_commented) {
		// Remove comments from all lines
		replacement = lines
			.map((line) => {
				const trimmed = line.trimStart();
				const leading_space = line.length - trimmed.length;
				if (trimmed.length === 0) return line;

				// Check if there's a space after the comment to remove as well
				const afterComment = trimmed.substring(comment.length);
				const hasSpaceAfterComment = afterComment.startsWith(" ");
				const commentLength = comment.length + (hasSpaceAfterComment && insertSpace ? 1 : 0);

				return line.slice(0, leading_space) + trimmed.slice(commentLength);
			})
			.join("\n");
		length_diff = block.length - replacement.length;
	} else {
		// Add comments to all lines
		replacement = lines
			.map((line) => {
				const trimmed = line.trimStart();
				const leading_space = line.length - trimmed.length;
				if (trimmed.length === 0) return line;
				return line.slice(0, leading_space) + comment + afterCommentStr + trimmed;
			})
			.join("\n");
		length_diff = replacement.length - block.length;
	}

	if (replacement === block) return empty_action;

	return {
		patch: {
			value: replacement,
			start: block_start,
			end: block_end,
			mode: "end",
		},
		select: {
			start: selectionStart,
			end: selectionEnd + (all_commented ? -length_diff : length_diff),
			direction: selectionDirection,
		},
	};
}

function blockComment(
	input: HTMLTextAreaElement,
	comment: readonly [string, string],
	insertSpace: boolean = true,
): Action {
	const { value, selectionStart, selectionEnd, selectionDirection } = input;
	const [open_comment, close_comment] = comment;

	// Check if selection is already wrapped with comment
	const before = value.slice(Math.max(0, selectionStart - open_comment.length), selectionStart);
	const after = value.slice(selectionEnd, Math.min(value.length, selectionEnd + close_comment.length));

	// Check for spaces after open_comment and before close_comment
	const hasSpaceAfterOpen = value.slice(selectionStart, selectionStart + 1) === " ";
	const hasSpaceBeforeClose = value.slice(selectionEnd - 1, selectionEnd) === " ";

	if (before === open_comment && after === close_comment) {
		// Check if there are spaces to remove as well
		const adjustedSelectionStart = selectionStart + (hasSpaceAfterOpen && insertSpace ? 1 : 0);
		const adjustedSelectionEnd = selectionEnd - (hasSpaceBeforeClose && insertSpace ? 1 : 0);

		// Remove both comments at once
		return {
			patch: {
				value: value.slice(adjustedSelectionStart, adjustedSelectionEnd),
				start: selectionStart - open_comment.length,
				end: selectionEnd + close_comment.length,
				mode: "select",
			},
			select: {
				start: selectionStart - open_comment.length,
				end: adjustedSelectionEnd - adjustedSelectionStart + selectionStart - open_comment.length,
				direction: selectionDirection,
			},
		};
	} else {
		// Add both comments with optional spaces
		const spaceAfter = insertSpace ? " " : "";
		const spaceBefore = insertSpace ? " " : "";
		return {
			patch: {
				value:
					open_comment + spaceAfter + value.slice(selectionStart, selectionEnd) + spaceBefore + close_comment,
				start: selectionStart,
				end: selectionEnd,
				mode: "select",
			},
			select: {
				start: selectionStart + open_comment.length + spaceAfter.length,
				end: selectionEnd + open_comment.length + spaceAfter.length,
				direction: selectionDirection,
			},
		};
	}
}

function getLineStart(text: string, index: number): number {
	while (index > 0 && text[index - 1] !== "\n") {
		index--;
	}
	return index;
}

function getLineEnd(text: string, index: number): number {
	while (index < text.length && text[index] !== "\n" && text[index] !== "\r") {
		index++;
	}
	return index;
}

let isMacintosh = false;

if (typeof navigator === "object" && typeof navigator.userAgent === "string") {
	isMacintosh = navigator.userAgent.indexOf("Macintosh") >= 0;
}

function ctrlKey(e: KeyboardEvent) {
	return isMacintosh ? e.metaKey : e.ctrlKey;
}
