const style = `.shiki-editor.input, .shiki-editor.output {
	font-family: var(--font-family, monospace);
	font-size: inherit;
	line-height: inherit;
	tab-size: var(--tab-size);
	border: 0;
	margin: 0;
	padding: 0;
	position: absolute;
	inset: 0;
}

.shiki-editor.input {
	resize: none;
	color: transparent;
	caret-color: var(--fg, black);
	white-space: pre;
	box-sizing: border-box;
	background-color: transparent;
	outline: none;
	width: 100%;
	height: 100%;
	padding-left: 2em;
	overflow: auto;
}

.shiki-editor.output {
	pointer-events: none;
	counter-reset: shiki-line 0;
	overflow: hidden;
}

.shiki-editor.output > pre {
	display: contents;
}

.shiki-editor.output .line {
	counter-increment: shiki-line 1;
}

.shiki-editor.output .line::before {
	content: counter(shiki-line);
	color: var(--bg);
	background-color: var(--bg);
	text-align: right;
	box-sizing: border-box;
	width: 2em;
	display: inline-block;
	position: sticky;
	left: 0;
}

.shiki-editor.output.line-numbers .line::before {
	color: var(--fg);
	width: 5em;
	padding-right: 2em;
}

.shiki-editor.input.line-numbers {
	padding-left: 5em;
}
`;

function noop() {}

export function injectStyle(doc: Document) {
	const hash = `shiki-editor-${djb2(style).toString(36)}`;
	if (doc.getElementById(hash)) return noop;
	const element = doc.createElement("style");
	element.id = hash;
	element.appendChild(doc.createTextNode(""));
	doc.head.appendChild(element);

	try {
		const sheet = getSheet(element, doc);
		sheet.insertRule(style);
	} catch (e) {
		element.appendChild(doc.createTextNode(style));
	}
	return () => {
		doc.head.removeChild(element);
	};
}

function djb2(s: string, hash = 5381) {
	let i = s.length;

	while (i) {
		hash = (hash * 33) ^ s.charCodeAt(--i);
	}

	return hash;
}

function getSheet(tag: HTMLStyleElement, doc: Document): CSSStyleSheet {
	if (tag.sheet) {
		return tag.sheet;
	}

	// Avoid Firefox quirk where the style element might not have a sheet property
	const { styleSheets } = doc;
	for (let i = 0, l = styleSheets.length; i < l; i++) {
		const sheet = styleSheets[i];
		if (sheet.ownerNode === tag) {
			return sheet;
		}
	}

	throw Error("Could not find CSSStyleSheet object");
}
