export function floorTab(width: number, tabSize: number): number {
	switch (tabSize) {
		case 2:
			return width & ~1;
		case 4:
			return width & ~3;
		case 8:
			return width & ~7;
	}
	return Math.floor(width / tabSize) * tabSize;
}

export function ceilTab(width: number, tabSize: number): number {
	switch (tabSize) {
		case 2:
			return (width + 1) & ~1;
		case 4:
			return (width + 3) & ~3;
		case 8:
			return (width + 7) & ~7;
	}
	return Math.ceil(width / tabSize) * tabSize;
}

/**
 * A offset in a position is the gap between two adjacent characters. The methods here
 * work with a concept called "visible width". A visible width is a very rough approximation
 * of the horizontal screen position of a offset. For example, using a tab size of 4:
 * ```txt
 * |<TAB>|<TAB>|T|ext
 * |     |     | \---- offset = 3, visible width = 9
 * |     |     \------ offset = 2, visible width = 8
 * |     \------------ offset = 1, visible width = 4
 * \------------------ offset = 0, visible width = 0
 * ```
 *
 * **ATTENTION**: This offset is 0-based
 *
 * **NOTE**: Visual columns do not work well for RTL text or variable-width fonts or characters.
 *
 */
export function visibleWidthFromLeft(
	content: string,
	offset: number,
	tabSize: number,
	left?: number,
): [width: number, span: number] {
	if (left === void 0) {
		left = offset;
		while (left > 0 && content[left - 1] !== "\n") {
			left--;
		}
	}
	let width = 0;
	for (let i = left; i < offset; i++) {
		width++;
		if (content[i] === "\t") {
			width = ceilTab(width, tabSize);
		}
	}
	return [width, offset - left];
}

export function visibleWidthLeadingSpace(line: string, tabSize: number): [width: number, span: number] {
	let width = 0;
	let i = 0;
	while (i < line.length) {
		if (line[i] === " ") {
			width++;
		} else if (line[i] === "\t") {
			width = ceilTab(width + 1, tabSize);
		} else {
			break;
		}
		i++;
	}
	return [width, i];
}
