"""Convert dollar-delimited math using Anki's native editor component."""

from pathlib import Path

from aqt import gui_hooks


_SCRIPT = (Path(__file__).parent / "dollar_math.js").read_text(encoding="utf-8")


def _install(editor):
    editor.web.eval(_SCRIPT)


gui_hooks.editor_did_init.append(_install)

