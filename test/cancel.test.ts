import assert from "node:assert/strict";
import { describe, it } from "node:test";
import piCancel, { createDoublePress, DOUBLE_PRESS_MS, STATUS_KEY } from "../index.ts";

describe("createDoublePress", () => {
	it("completes on a second press inside the window", () => {
		let t = 1_000;
		const presses = createDoublePress(DOUBLE_PRESS_MS, () => t);
		assert.equal(presses.press(), false);
		t += DOUBLE_PRESS_MS - 1;
		assert.equal(presses.press(), true);
		// A completed double press starts over.
		t += 1;
		assert.equal(presses.press(), false);
	});

	it("starts over after the window or a reset", () => {
		let t = 0;
		const presses = createDoublePress(DOUBLE_PRESS_MS, () => t);
		assert.equal(presses.press(), false);
		t += DOUBLE_PRESS_MS;
		assert.equal(presses.press(), false);
		presses.reset();
		assert.equal(presses.press(), false);
		assert.equal(presses.press(), true);
	});
});

function harness(mode = "tui") {
	const handlers = new Map<string, (event: unknown, ctx: unknown) => unknown>();
	const statuses: (string | undefined)[] = [];
	let idle = false;
	let factory: unknown;
	const ctx = {
		mode,
		isIdle: () => idle,
		ui: {
			theme: { fg: (_color: string, text: string) => text },
			setStatus: (key: string, text: string | undefined) => {
				assert.equal(key, STATUS_KEY);
				statuses.push(text);
			},
			setEditorComponent: (f: unknown) => {
				factory = f;
			},
		},
	};
	piCancel({ on: (name: string, handler: (event: unknown, ctx: unknown) => unknown) => handlers.set(name, handler) } as never);
	handlers.get("session_start")!({}, ctx);
	return {
		handlers,
		ctx,
		statuses,
		get factory() {
			return factory;
		},
		setIdle(value: boolean) {
			idle = value;
		},
	};
}

describe("piCancel", () => {
	it("installs the editor only in the TUI", () => {
		assert.equal(typeof harness().factory, "function");
		assert.equal(harness("rpc").factory, undefined);
	});

	it("holds the first Escape while busy and passes the second", async () => {
		const h = harness();
		const passed: string[] = [];
		const tui = { requestRender() {}, terminal: { rows: 24, columns: 80 } };
		const theme = { borderColor: (s: string) => s, selectList: {} };
		const keys = { matches: (data: string, action: string) => action === "app.interrupt" && data === "\x1b" };
		const editor = (h.factory as (...args: unknown[]) => { handleInput(d: string): void; onEscape?: () => void })(tui, theme, keys);
		editor.onEscape = () => passed.push("esc");

		h.setIdle(false);
		editor.handleInput("\x1b");
		assert.deepEqual(passed, []);
		assert.match(h.statuses.at(-1) ?? "", /again to cancel/);
		editor.handleInput("\x1b");
		assert.deepEqual(passed, ["esc"]);
		assert.equal(h.statuses.at(-1), undefined);

		// Idle: every Escape goes straight to pi.
		h.setIdle(true);
		editor.handleInput("\x1b");
		assert.deepEqual(passed, ["esc", "esc"]);

		h.handlers.get("session_shutdown")!({}, h.ctx);
	});
});
