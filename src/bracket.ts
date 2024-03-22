export function hookBracket(input: HTMLTextAreaElement) {
	const onKeydown = (e: KeyboardEvent) => {
		let right;

		switch (e.key) {
			case "(": {
				right = ")";
				break;
			}
			case "{": {
				right = "}";
				break;
			}
			case "[": {
				right = "]";
				break;
			}
			default: {
				return;
			}
		}
		if (input.selectionStart !== input.selectionEnd) {
			const selection = input.value.slice(input.selectionStart, input.selectionEnd);
			e.preventDefault();
			input.setRangeText(`${e.key}${selection}${right}`, input.selectionStart, input.selectionEnd, "select");
		} else {
			input.setRangeText(right, input.selectionEnd, input.selectionEnd, "start");
		}
		input.dispatchEvent(new Event("input"));
	};

	input.addEventListener("keydown", onKeydown);
	return () => {
		input.removeEventListener("keydown", onKeydown);
	};
}
