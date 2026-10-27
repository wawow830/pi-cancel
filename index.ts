/**
 * Double Escape to cancel.
 *
 * pi cancels the running agent, compaction, retry, or branch summary on a single Escape
 * (`app.interrupt`). This extension holds the first press while pi is busy and only passes the
 * second one through when it arrives within 500 ms, the same window pi uses for its own
 * double-Escape and double-Ctrl+C. While pi is idle, Escape behaves exactly as before
 * (closing autocomplete, leaving bash mode, double-Escape for /tree).
 */
import { CustomEditor, type ExtensionAPI, type ExtensionContext, type KeybindingsManager, keyText } from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";

/** pi's window for double-Escape and double-Ctrl+C. */
export const DOUBLE_PRESS_MS = 500;
export const STATUS_KEY = "pi-cancel";

export interface DoublePress {
	/** Records a press; true when it completes a double press. */
	press(): boolean;
	reset(): void;
}

export function createDoublePress(windowMs = DOUBLE_PRESS_MS, now: () => number = Date.now): DoublePress {
	let last: number | undefined;
	return {
		press() {
			const t = now();
			if (last !== undefined && t - last < windowMs) {
				last = undefined;
				return true;
			}
			last = t;
			return false;
		},
		reset() {
			last = undefined;
		},
	};
}

/** The main editor with a gate in front of `app.interrupt`; every other key goes to pi's editor. */
export class DoubleEscapeEditor extends CustomEditor {
	private readonly keys: KeybindingsManager;
	/** True to swallow this Escape press. */
	private readonly hold: () => boolean;

	constructor(tui: TUI, theme: EditorTheme, keys: KeybindingsManager, hold: () => boolean) {
		// pi's default editor embeds the working status in its top border.
		super(tui, theme, keys, { embedWorkingStatus: true });
		this.keys = keys;
		this.hold = hold;
	}

	override handleInput(data: string): void {
		// Escape that closes autocomplete is not a cancel.
		if (this.keys.matches(data, "app.interrupt") && !this.isShowingAutocomplete() && this.hold()) return;
		super.handleInput(data);
	}
}

export default function piCancel(pi: ExtensionAPI) {
	const presses = createDoublePress();
	let hintTimer: ReturnType<typeof setTimeout> | undefined;

	const clearHint = (ctx: ExtensionContext) => {
		if (hintTimer) clearTimeout(hintTimer);
		hintTimer = undefined;
		ctx.ui.setStatus(STATUS_KEY, undefined);
	};

	const hold = (ctx: ExtensionContext): boolean => {
		// Idle: nothing to cancel, leave Escape to pi.
		if (ctx.isIdle()) {
			presses.reset();
			clearHint(ctx);
			return false;
		}
		if (presses.press()) {
			clearHint(ctx);
			return false;
		}
		clearHint(ctx);
		ctx.ui.setStatus(STATUS_KEY, ctx.ui.theme.fg("warning", `Press ${keyText("app.interrupt")} again to cancel`));
		hintTimer = setTimeout(() => clearHint(ctx), DOUBLE_PRESS_MS);
		return true;
	};

	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		ctx.ui.setEditorComponent((tui, theme, keybindings) => new DoubleEscapeEditor(tui, theme, keybindings, () => hold(ctx)));
	});

	pi.on("session_shutdown", (_event, ctx) => {
		presses.reset();
		if (hintTimer) clearTimeout(hintTimer);
		hintTimer = undefined;
		if (ctx.mode === "tui") ctx.ui.setStatus(STATUS_KEY, undefined);
	});
}
