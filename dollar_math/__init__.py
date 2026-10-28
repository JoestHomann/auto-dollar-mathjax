"""Convert dollar-delimited math using Anki's native editor component."""

from pathlib import Path

from aqt import gui_hooks
from aqt.utils import showWarning, tooltip


_SCRIPT = (Path(__file__).parent / "dollar_math.js").read_text(encoding="utf-8")


def _install(editor):
    editor.web.eval(_SCRIPT)


def _scan_note(editor):
    def finished(result):
        if not isinstance(result, dict) or result.get("error"):
            showWarning(
                (result or {}).get("error", "Could not scan the current note.")
                if isinstance(result, dict)
                else "Could not scan the current note.",
                parent=editor.parentWindow,
            )
            return
        count = result["converted"]
        fields = result["fieldsChanged"]
        message = (
            f"Converted {count} expression(s) in {fields} field(s)."
            if count else "No unconverted $…$ expressions found in this note."
        )
        # Flush the updated field stores through Anki's normal save mechanism.
        editor.saveNow(lambda: tooltip(message, parent=editor.parentWindow), keepFocus=True)

    editor.web.evalWithCallback("window.autoDollarMathjax.scanNote()", finished)


def _add_button(buttons, editor):
    buttons.append(editor.addButton(
        icon=None,
        cmd="autoDollarMathjaxScanNote",
        func=_scan_note,
        tip="Convert $…$ to inline and $$…$$ to block MathJax in every field of this note",
        label="Convert $…$",
        disables=False,
    ))


gui_hooks.editor_did_init.append(_install)
gui_hooks.editor_did_init_buttons.append(_add_button)

