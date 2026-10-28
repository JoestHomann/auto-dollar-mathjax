/* Auto Dollar MathJax. No network requests or external dependencies. */
(() => {
    "use strict";
    if (window.__autoDollarMathjax) return;
    window.__autoDollarMathjax = true;

    let converting = false;
    let sequence = 0;
    const ignored = "anki-mathjax, anki-frame, [contenteditable='false'], code, pre, script, style, textarea, input";
    const blocks = new Set(["DIV", "P", "BR", "LI", "UL", "OL", "TABLE", "TR", "TD", "TH", "BLOCKQUOTE", "HR", "H1", "H2", "H3", "H4", "H5", "H6"]);

    function escaped(text, index) {
        let count = 0;
        while (index > 0 && text[--index] === "\\") count++;
        return count % 2 === 1;
    }

    // Offsets refer to text nodes, never to serialized HTML or attributes.
    function collect(field) {
        let text = "";
        const points = [];
        function boundary() { text += "\n"; points.push(null); }
        function walk(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                for (let offset = 0; offset < node.data.length; offset++) {
                    text += node.data[offset];
                    points.push({ node, offset });
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.matches(ignored) || ["IMG", "AUDIO", "VIDEO", "IFRAME"].includes(node.tagName)) {
                    boundary();
                    return;
                }
                const block = blocks.has(node.tagName);
                if (block) boundary();
                for (const child of node.childNodes) walk(child);
                if (block) boundary();
            }
        }
        for (const child of field.childNodes) walk(child);
        return { text, points };
    }

    function findMath(text) {
        const matches = [];
        let opening = -1;
        for (let i = 0; i < text.length; i++) {
            if (text[i] === "\n" || text[i] === "\r") { opening = -1; continue; }
            // Keep existing MathJax, display math and legacy LaTeX untouched.
            let close = null;
            if (!escaped(text, i)) {
                if (text.startsWith("\\(", i)) close = "\\)";
                else if (text.startsWith("\\[", i)) close = "\\]";
                else if (text.startsWith("[latex]", i)) close = "[/latex]";
                else if (text.startsWith("[$$]", i)) close = "[/$$]";
                else if (text.startsWith("[$]", i)) close = "[/$]";
                else if (text.startsWith("$$", i)) close = "$$";
            }
            if (close) {
                const end = text.indexOf(close, i + (close === "[/latex]" ? 7 : close.startsWith("[/") ? close.length - 1 : 2));
                if (end < 0) break;
                i = end + close.length - 1;
                opening = -1;
                continue;
            }
            if (text[i] !== "$" || escaped(text, i)) continue;
            if (opening >= 0) {
                const body = text.slice(opening + 1, i);
                if (body && !/\s/u.test(body[0]) && !/\s/u.test(body[body.length - 1])) {
                    matches.push({ start: opening, end: i, body });
                    opening = -1;
                    continue;
                }
            }
            opening = i;
        }
        return matches;
    }

    function selectionFor(field) {
        const root = field.getRootNode();
        return typeof root.getSelection === "function" ? root.getSelection() : window.getSelection();
    }

    function htmlEscape(text) {
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\u00a0/g, " ");
    }

    function convert(field) {
        const selection = selectionFor(field);
        if (!selection || !selection.rangeCount || !selection.isCollapsed) return;
        let caret = selection.getRangeAt(0).cloneRange();
        if (!field.contains(caret.startContainer)) return;
        const { text, points } = collect(field);
        const matches = findMath(text);
        if (!matches.length) return;

        // This is the same component used by Anki's Fx -> MathJax inline action.
        const Mathjax = customElements.get("anki-mathjax");
        if (!Mathjax || typeof Mathjax.toUndecorated !== "function") return;

        converting = true;
        try {
            for (const match of matches.reverse()) {
                const start = points[match.start];
                const end = points[match.end];
                if (!start || !end || !start.node.isConnected || !end.node.isConnected) continue;
                const range = document.createRange();
                range.setStart(start.node, start.offset);
                range.setEnd(end.node, end.offset + 1);
                const caretInside = range.comparePoint(caret.startContainer, caret.startOffset) === 0;
                const id = `dollar-math-${++sequence}`;
                let html = Mathjax.toUndecorated(`\\(${htmlEscape(match.body)}\\)`);
                // toUndecorated also respects Anki's 'render MathJax' setting.
                html = html.replace("<anki-mathjax", `<anki-mathjax data-dollar-math-id="${id}"`);
                selection.removeAllRanges();
                selection.addRange(range);
                // Native editing command preserves Chromium's undo history.
                const inserted = document.execCommand("insertHTML", false, html);
                const math = field.querySelector(`[data-dollar-math-id="${id}"]`);
                // Initialize the registry on newer Chromium versions; older Qt
                // WebEngine versions use upgrade() alone.
                if (math) {
                    if (typeof customElements.initialize === "function") customElements.initialize(math);
                    customElements.upgrade(math);
                }
                if (math) math.removeAttribute("data-dollar-math-id");
                if (inserted && caretInside) {
                    if (math && typeof math.placeCaretAfter === "function") math.placeCaretAfter();
                    if (selection.rangeCount) caret = selection.getRangeAt(0).cloneRange();
                }
            }
        } finally {
            selection.removeAllRanges();
            selection.addRange(caret);
            converting = false;
        }
    }

    // Composed input events expose the real editable across Anki's shadow DOM.
    document.addEventListener("input", (event) => {
        if (converting || event.isComposing || event.inputType?.startsWith("history") || event.inputType?.startsWith("delete")) return;
        if (event.data && !event.data.includes("$")) return;
        const field = event.composedPath().find(node => node instanceof Element && node.matches("anki-editable[contenteditable='true']"));
        if (!field) return;
        // Finish the current native input/paste before issuing an editing command.
        queueMicrotask(() => { if (field.isConnected && !converting) convert(field); });
    }, true);

    document.addEventListener("compositionend", (event) => {
        const field = event.composedPath().find(node => node instanceof Element && node.matches("anki-editable[contenteditable='true']"));
        if (field) queueMicrotask(() => convert(field));
    }, true);
})();
