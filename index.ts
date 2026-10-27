import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		let last = 0;
		ctx.ui.setEditorComponent((tui, theme, keybindings) => {
			const editor = new CustomEditor(tui, theme, keybindings, { embedWorkingStatus: true });
			const handleInput = editor.handleInput.bind(editor);
			editor.handleInput = (data) => {
				if (keybindings.matches(data, "app.interrupt") && !ctx.isIdle() && !editor.isShowingAutocomplete()) {
					const now = Date.now();
					if (now - last >= 500) return void (last = now);
					last = 0;
				}
				handleInput(data);
			};
			return editor;
		});
	});
}
