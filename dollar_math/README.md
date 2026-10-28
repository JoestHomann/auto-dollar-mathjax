# Auto Dollar MathJax

Type `$x^2$` in an Anki note field. As soon as you type the closing `$`, the
add-on replaces it with Anki's native inline MathJax equation. The saved field
contains `\(x^2\)`.

Use `$$x^2$$` for a displayed block equation. This saves as `\[x^2\]`.

## Convert older notes

Open the note in **Browse** or **Edit Current**, then click **Convert $…$** in
the editor toolbar. The button scans every field of that note, including
collapsed fields and fields displayed as HTML, and converts completed `$…$`
expressions to inline MathJax and `$$…$$` expressions to block MathJax. Anki saves the changes normally and reports how many expressions
were converted. You can also use it on a note you are adding.

This scans the current note, including the fields used on both sides of its
cards. It does not change other notes in your collection. Pressing it again
leaves expressions that are already converted alone.

## Install

1. Download [Auto-Dollar-MathJax.ankiaddon](https://github.com/JoestHomann/auto-dollar-mathjax/raw/refs/heads/main/downloads/Auto-Dollar-MathJax.ankiaddon), or build it with `python build.py`.
2. In Anki Desktop, open **Tools > Add-ons > Install from file…**.
3. Select the downloaded `.ankiaddon` file and restart Anki.
4. Open Add, Browse, or Edit Current and type `$x^2$` into a note field.

If the equation remains visible as `\(x^2\)`, turn on **Render MathJax** in the
editor's options menu. The equation will also render when reviewing the card.

## Examples

| Type | Saved MathJax |
| --- | --- |
| `$x^2$` | `\(x^2\)` |
| `$E=mc^2$` | `\(E=mc^2\)` |
| `$\frac{1}{2}$` | `\(\frac{1}{2}\)` |
| `$\alpha + \beta$` | `\(\alpha + \beta\)` |
| `$$x^2 + y^2 = z^2$$` | `\[x^2 + y^2 = z^2\]` |

Use **one dollar sign before and one after** for inline equations, or **two
dollar signs before and two after** for block equations. Write normal TeX
inside them; the add-on changes the delimiters, rather than translating prose
into TeX. For example, use `\frac{1}{2}` for a stacked fraction.

## Behavior

- Converts completed expressions while typing or pasting into rich text fields.
- Uses Anki's own equation renderer and standard saved delimiters. No separate
  LaTeX installation, account, API key, or internet connection is required.
- Continue typing after an equation. Click it to edit it using Anki's controls.
- Preserves formatting outside the expression. Formatting inside the expression
  becomes plain TeX, as required by MathJax.
- Converts `$…$` to inline and `$$…$$` to block MathJax. Block expressions can
  span line breaks. Inline expressions do not cross line breaks.
- Ignores empty pairs, incomplete expressions, existing equations,
  HTML code blocks, and the tags input. Equations do not cross images or media.
- Write literal currency as `\$5`. Spaces immediately inside the delimiters are
  left alone: use `$x + y$`, rather than `$ x + y $`. Ordinary `$5 and $10`
  remains unchanged, but dollar pairs in prose can be ambiguous; escape literal
  dollar signs with a backslash.
- Uses the editor's native undo command. Undo is not immediately reconverted.
- Only acts when editing; opening a note does not bulk-convert existing notes.
- The **Convert $…$** button scans both formats in every field of the current note.

## Compatibility and validation

For Anki Desktop editors that provide the `anki-mathjax` native component
(intended for Anki 23.10 and newer). Unsupported older editors are left alone.
The add-on does not run in AnkiMobile, AnkiDroid, or AnkiWeb. Converted notes
use standard MathJax and can be synced normally.

Checked against Anki's upstream editor initialization hook, native MathJax
component, and Fx insertion action on 2026-10-28:

- https://github.com/ankitects/anki/blob/main/qt/aqt/editor.py
- https://github.com/ankitects/anki/blob/main/ts/lib/editable/mathjax-element.svelte.ts
- https://github.com/ankitects/anki/blob/main/ts/routes/editor/editor-toolbar/LatexButton.svelte

Automated tests pass in headless Chromium using an Anki-like shadow DOM and
equation-component fixture, including cursor continuation, multiple expressions,
escaped dollars, formatted text, HTML characters, undo, and redo. Python loading
and package contents are also checked. A live Anki installation was not tested;
compatibility with every Anki release or other editor add-on is not guaranteed.

To disable or remove: **Tools > Add-ons**, select **Auto Dollar MathJax**, and
use **Toggle Enabled** or **Delete**. Restart Anki. Converted equations remain
ordinary MathJax in your notes.

## Development

```sh
python build.py
npm install
npx playwright install chromium
npm test
```

The build uses Python's standard library. Tests use Playwright and a simulated
Anki editor; they do not edit your Anki collection. To use an installed Chrome
instead of Playwright's Chromium, set `CHROME_BIN` to its executable path.

Source lives in `dollar_math/`. The build checks Python loading, hook
registration, and archive contents, and writes the installable package to
`dist/Auto-Dollar-MathJax.ankiaddon`.
