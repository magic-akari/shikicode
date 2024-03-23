const l2r: Record<string, string | undefined> = {
	// @ts-ignore
	__proto__: null,
	"(": ")",
	"{": "}",
	"[": "]",
	"'": "'",
	'"': '"',
};

const r2l: Record<string, string | undefined> = {
	// @ts-ignore
	__proto__: null,
	")": "(",
	"}": "{",
	"]": "[",
	"'": "'",
	'"': '"',
};

export function hookBracket(input: HTMLTextAreaElement) {
	let key = "";
	let [start, end] = [0, 0];

	const onKeydown = (e: KeyboardEvent) => {
		if (!(e.key in l2r) && !(e.key in r2l) && !isBackspace(e)) {
			return;
		}

		const { selectionStart, selectionEnd } = input;

		if (selectionStart !== selectionEnd) {
			if (e.key in l2r) {
				input.setRangeText(l2r[e.key]!, selectionEnd, selectionEnd);
				input.setSelectionRange(selectionStart, selectionStart);
				key = e.key;
				[start, end] = [selectionStart, selectionEnd];
			}
			return;
		}

		const next_p = selectionEnd;

		const prev_char = input.value[next_p - 1];
		const next_char = input.value[next_p];

		if (isBackspace(e) && prev_char in l2r && next_char === l2r[prev_char]) {
			input.setSelectionRange(next_p - 1, next_p + 1);
			return;
		}

		if (e.key in r2l && next_char === e.key && prev_char === r2l[e.key]) {
			input.setSelectionRange(next_p, next_p + 1);
			return;
		}

		if (e.key in l2r && (next_p === input.value.length || /\s/.test(next_char))) {
			input.setRangeText(l2r[e.key]!, next_p, next_p);
		}
	};

	const onKeyup = (e: KeyboardEvent) => {
		if (e.key === key) {
			input.setSelectionRange(start + 1, end + 1);
		}
		key = "";
	};

	input.addEventListener("keydown", onKeydown);
	input.addEventListener("keyup", onKeyup);
	return () => {
		input.removeEventListener("keydown", onKeydown);
		input.removeEventListener("keyup", onKeyup);
	};
}

function isBackspace(e: KeyboardEvent) {
	return e.key === "Backspace" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey;
}
