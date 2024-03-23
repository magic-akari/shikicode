import * as shiki from "shiki";

import type { ICodeEditor, InitOptions } from "./core.js";
import { createWithShiki } from "./core.js";

export * from "./core.js";

export async function create(domElement: HTMLElement, options?: InitOptions): Promise<ICodeEditor> {
	return createWithShiki(shiki, domElement, options);
}
