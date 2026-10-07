import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
test('import panel is embedded in the current page and reused without creating tabs or native dialogs', async () => {
  const dom = new JSDOM('<body><h1>Diário atual</h1></body>', { url: 'https://suap.ifba.edu.br/edu/diario/42/', runScripts: 'outside-only' });
  let receive;
  dom.window.chrome = { runtime: { getURL: (path) => 'chrome-extension://test/' + path,
    onMessage: { addListener: (callback) => { receive = callback; } } } };
  vm.runInContext(await readFile(new URL('../public/content.js', import.meta.url), 'utf8'), dom.getInternalVMContext());
  const open = () => receive({ type: 'SUAP_TOOLS_OPEN_IMPORT_PANEL', tabId: 7 }, {}, (result) => assert.equal(result.ok, true));
  open(); open();
  assert.equal(dom.window.document.querySelectorAll('#suap-tools-import-panel').length, 1);
  assert.match(dom.window.document.querySelector('iframe').src, /view=class-import&targetTab=7/);
  assert.equal(dom.window.document.querySelector('#aula_form'), null);
  receive({ type: 'SUAP_TOOLS_CLOSE_IMPORT_PANEL' }, {}, () => {});
  assert.equal(dom.window.document.querySelector('iframe'), null);
  dom.window.close();
});
