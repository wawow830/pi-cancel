# pi-cancel

A [pi](https://pi.dev) extension that makes cancelling take a **double Escape** instead of a single one, so a stray Escape no longer kills a long run.

## Install

```bash
pi install git:github.com/wawow830/pi-cancel
# or try it for one run
pi -e git:github.com/wawow830/pi-cancel
```

## How it works

- While pi is busy (agent run, compaction, auto-retry, branch summary), the first `app.interrupt` press (Escape by default) is held and the footer shows `Press escape again to cancel`.
- A second press within 500 ms, the same window pi uses for its double-Escape and double-Ctrl+C, cancels as usual, including restoring queued messages to the editor.
- While pi is idle, Escape is untouched: it still leaves bash mode and opens `/tree` (or `/fork`) on double Escape per `doubleEscapeAction`.
- Escape that closes autocomplete is never held.
- It follows your `app.interrupt` binding from `keybindings.json`.

It installs a custom editor that extends pi's `CustomEditor`, so it does not combine with other extensions that replace the editor. User `!` bash commands are not covered; a single Escape still stops them.

## License

MIT
