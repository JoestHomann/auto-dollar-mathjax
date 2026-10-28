const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({headless:true, ...(process.env.CHROME_BIN ? {executablePath:process.env.CHROME_BIN} : {}), args:['--disable-gpu']});
  const page = await browser.newPage();
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  page.on('console', m=>console.log('browser:',m.text()));
  await page.setContent('<div id="host"></div><input id="tags"><div id="other" contenteditable="true"></div>');
  await page.evaluate(() => {
    window.renderMath=true;
    // A small fixture for Anki's documented custom element and frame lifecycle.
    class Mathjax extends HTMLElement {
      static toUndecorated(html) { return window.renderMath ? html.replace(/\\\((.*?)\\\)/gs,'<anki-mathjax>$1</anki-mathjax>') : html; }
      connectedCallback() {
        if (this.parentElement?.tagName !== 'ANKI-FRAME') {
          const frame=document.createElement('anki-frame'); this.replaceWith(frame); frame.append(this); return;
        }
        if (this.hasAttribute('decorated')) return;
        this.dataset.mathjax=this.innerHTML;
        this.innerHTML='<img alt="MathJax">'; this.contentEditable='false'; this.setAttribute('decorated','true');
      }
      placeCaretAfter() {
        const r=document.createRange(); r.setStartAfter(this.parentElement); r.collapse(true);
        const s=this.getRootNode().getSelection(); s.removeAllRanges(); s.addRange(r);
      }
    }
    customElements.define('anki-mathjax', Mathjax);
    const root=document.querySelector('#host').attachShadow({mode:'open'});
    root.innerHTML='<style>anki-editable{display:block;min-height:40px} anki-frame{display:inline-block}</style><anki-editable contenteditable="true"></anki-editable>';
    window.field=root.querySelector('anki-editable');
    window.stored=()=> {
      const clone=field.cloneNode(true);
      clone.querySelectorAll('anki-mathjax').forEach(m=>{
        const box=document.createElement('span');box.innerHTML=m.dataset.mathjax ?? m.innerHTML;
        m.replaceWith(document.createTextNode('\\('+box.textContent+'\\)'));
      });
      clone.querySelectorAll('anki-frame').forEach(f=>f.replaceWith(...f.childNodes));
      return clone.textContent.replace(/\u00a0/g,' ');
    };
  });
  await page.addScriptTag({path:path.join(__dirname,'dollar_math/dollar_math.js')});
  async function reset(html='') {
    await page.evaluate(html=>{
      field.innerHTML=html;field.focus();const r=document.createRange();r.selectNodeContents(field);r.collapse(false);
      const s=field.getRootNode().getSelection();s.removeAllRanges();s.addRange(r);
    },html);
  }
  async function check(name, input, expected, count, html='') {
    await reset(html);
    await page.keyboard.insertText(input);
    await page.waitForTimeout(30);
    const result=await page.evaluate(()=>({text:stored(),count:field.querySelectorAll('anki-mathjax').length}));
    if(result.text !== expected || result.count !== count) console.log(await page.evaluate(()=>({html:field.innerHTML, type:field.querySelector('anki-mathjax')?.constructor.name, newType:document.createElement('anki-mathjax').constructor.name, owner:field.querySelector('anki-mathjax')?.ownerDocument===document, registry:field.getRootNode().customElementRegistry===customElements, errors:[]})),errors);
    assert.deepEqual(result,{text:expected,count},name); console.log('PASS '+name);
  }
  await check('inline typing','Energy $E=mc^2$','Energy \\(E=mc^2\\)',1);
  await page.keyboard.insertText(' next');
  assert.equal(await page.evaluate(()=>stored()),'Energy \\(E=mc^2\\) next');console.log('PASS caret after equation');
  await reset();await page.keyboard.type('$x^2$');await page.keyboard.type(' tail');
  assert.equal(await page.evaluate(()=>stored()),'\\(x^2\\) tail');console.log('PASS character by character typing');
  await check('paste multiple','$x$ + $y$','\\(x\\) + \\(y\\)',2);
  await check('fraction','$\\frac{1}{2}$','\\(\\frac{1}{2}\\)',1);
  await check('escaped currency','\\$5 and \\$10','\\$5 and \\$10',0);
  await check('ordinary prices','$5 and $10','$5 and $10',0);
  await check('incomplete','$x^2','$x^2',0);
  await check('empty','$$','$$',0);
  await check('display math unchanged','$$x+y$$','$$x+y$$',0);
  await check('existing delimiters','\\(x + $y$\\)','\\(x + $y$\\)',0);
  await check('legacy latex','[latex]$x$[/latex]','[latex]$x$[/latex]',0);
  await check('HTML special chars','$a<b & c>d$','\\(a<b & c>d\\)',1);
  await check('escaped dollar in formula','$x+\\$y$','\\(x+\\$y\\)',1);
  await reset('$<b>x</b>'); await page.keyboard.insertText('$');
  assert.equal(await page.evaluate(()=>stored()),'\\(x\\)');console.log('PASS split formatted text');
  await reset('<b>Keep</b> <i>format</i> '); await page.keyboard.insertText('$x$');
  assert.equal(await page.evaluate(()=>field.querySelector('b').textContent),'Keep');console.log('PASS outside formatting');
  await reset('<div>$x</div><div><br></div>');await page.keyboard.insertText('y$');
  assert.equal(await page.evaluate(()=>field.querySelectorAll('anki-mathjax').length),0);console.log('PASS no crossing line breaks');
  await reset('<code>$x$</code> tail ');await page.keyboard.insertText('$y$');
  assert.equal(await page.evaluate(()=>field.querySelector('code').textContent),'$x$');console.log('PASS code ignored');
  await page.locator('#tags').fill('$x$');assert.equal(await page.locator('#tags').inputValue(),'$x$');console.log('PASS tags ignored');
  await page.evaluate(()=>window.renderMath=false);
  await check('rendering disabled stores delimiters','$x$','\\(x\\)',0);
  // Undo must restore dollars without immediately triggering conversion again.
  await page.keyboard.press('Control+z');
  assert.equal(await page.evaluate(()=>stored()),'$x$');console.log('PASS native undo');
  await page.evaluate(()=>window.renderMath=true);
  await reset('before after');
  await page.evaluate(()=>{const r=document.createRange();r.setStart(field.firstChild,7);r.collapse(true);const s=field.getRootNode().getSelection();s.removeAllRanges();s.addRange(r)});
  await page.keyboard.insertText('$x$');await page.keyboard.insertText(' continue ');
  assert.equal(await page.evaluate(()=>stored()),'before \\(x\\) continue after');console.log('PASS insertion in middle');
  await reset();await page.keyboard.insertText('$z$');
  await page.keyboard.press('Control+z');
  assert.equal(await page.evaluate(()=>stored()),'$z$');console.log('PASS rendered equation undo');
  await page.keyboard.press('Control+y');
  assert.equal(await page.evaluate(()=>stored()),'\\(z\\)');console.log('PASS rendered equation redo');
  const manual=await page.evaluate(()=>{
    const values=[
      '<b>Older $x^2$</b> <img src="example.png">',
      '$\\frac{1}{2}$',
      '<div>Collapsed $a+b$ and $c$</div>',
      '<code>$code$</code> and \\(existing\\)',
      'HTML $a&lt;b &amp; c&gt;d$',
      '<script>window.manualScriptExecuted=true</script>$safe$',
    ];
    window.manualStores=values.map(value=>({value, writes:0, subscribe(callback){callback(this.value);return ()=>{}},set(html){this.value=html;this.writes++}}));
    window.require=name=>{if(name!=='anki/NoteEditor')throw Error(name);return {instances:[{fields:manualStores.map(content=>({editingArea:{content}}))}]}};
    return {result:autoDollarMathjax.scanNote(), values:manualStores.map(s=>s.value), writes:manualStores.map(s=>s.writes), scriptRan:!!window.manualScriptExecuted};
  });
  assert.deepEqual(manual.result,{converted:6,fieldsChanged:5});
  assert.equal(manual.values[0],'<b>Older \\(x^2\\)</b> <img src="example.png">');
  assert.equal(manual.values[1],'\\(\\frac{1}{2}\\)');
  assert.equal(manual.values[2],'<div>Collapsed \\(a+b\\) and \\(c\\)</div>');
  assert.equal(manual.values[3],'<code>$code$</code> and \\(existing\\)');
  assert.equal(manual.values[4],'HTML \\(a&lt;b &amp; c&gt;d\\)');
  assert.deepEqual(manual.writes,[1,1,1,0,1,1]);
  assert.equal(manual.scriptRan,false);console.log('PASS scan all stored fields, including collapsed and HTML-only fields');
  assert.deepEqual(await page.evaluate(()=>autoDollarMathjax.scanNote()),{converted:0,fieldsChanged:0});console.log('PASS whole-note scan is idempotent');
  assert.equal(await page.evaluate(()=>{window.require=()=>({instances:[]});return !!autoDollarMathjax.scanNote().error}),true);console.log('PASS unsupported editor produces useful feedback');
  assert.deepEqual(errors,[]);console.log('PASS no JavaScript errors');
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
