"""Build and check local distributable archives using only the standard library."""
import ast
import json
from pathlib import Path
import runpy
import shutil
import sys
import types
import zipfile

WORK = Path(__file__).resolve().parent
ROOT = WORK
SOURCE = WORK / "dollar_math"
OUTPUT = ROOT / "dist"
OUTPUT.mkdir(exist_ok=True)

ast.parse((SOURCE / "__init__.py").read_text(encoding="utf-8"))
hooks = types.SimpleNamespace(editor_did_init=[], editor_did_init_buttons=[])
aqt = types.ModuleType("aqt")
aqt.gui_hooks = hooks
sys.modules["aqt"] = aqt
utils = types.ModuleType("aqt.utils")
notifications = []
utils.tooltip = lambda message, **kwargs: notifications.append(message)
utils.showWarning = lambda message, **kwargs: notifications.append(message)
sys.modules["aqt.utils"] = utils
runpy.run_path(str(SOURCE / "__init__.py"))
assert len(hooks.editor_did_init) == 1
assert len(hooks.editor_did_init_buttons) == 1
injected = []
hooks.editor_did_init[0](types.SimpleNamespace(web=types.SimpleNamespace(eval=injected.append)))
assert injected == [(SOURCE / "dollar_math.js").read_text(encoding="utf-8")]
print("PASS Python import, hook registration, and script injection")
buttons = []
button_definition = {}
def add_button(**kwargs):
    button_definition.update(kwargs)
    return "<button>Convert $…$</button>"
editor = types.SimpleNamespace(
    addButton=add_button, parentWindow=None,
    web=types.SimpleNamespace(evalWithCallback=lambda script, callback: callback({"converted": 3, "fieldsChanged": 2})),
    saveNow=lambda callback, **kwargs: callback(),
)
hooks.editor_did_init_buttons[0](buttons, editor)
assert buttons == ["<button>Convert $…$</button>"]
assert button_definition["disables"] is False
button_definition["func"](editor)
assert notifications[-1] == "Converted 3 expression(s) in 2 field(s)."
print("PASS whole-note toolbar button, save callback, and conversion feedback")

with zipfile.ZipFile(OUTPUT / "Auto-Dollar-MathJax.ankiaddon", "w", zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(SOURCE.iterdir()):
        if file.is_file():
            archive.write(file, file.name)

test = (WORK / "test_editor.cjs").read_text(encoding="utf-8")
with zipfile.ZipFile(OUTPUT / "Auto-Dollar-MathJax-source.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(SOURCE.iterdir()):
        if file.is_file():
            archive.write(file, "dollar_math/" + file.name)
    archive.writestr("test_editor.cjs", test)
    for name in ("build.py", "package.json", ".gitignore", ".gitattributes", "TESTING.md", "README.md"):
        archive.write(WORK / name, name)

shutil.copyfile(SOURCE / "README.md", OUTPUT / "README.md")
with zipfile.ZipFile(OUTPUT / "Auto-Dollar-MathJax.ankiaddon") as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == {"__init__.py", "dollar_math.js", "manifest.json", "README.md"}
    manifest = json.loads(archive.read("manifest.json"))
    assert manifest["package"] == "auto_dollar_mathjax"
    assert archive.read("dollar_math.js").decode() == injected[0]
print("PASS installable archive, manifest, and source archive")
for file in sorted(OUTPUT.iterdir()):
    print(f"{file.name}: {file.stat().st_size:,} bytes")
