import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { JSDOM } from "jsdom";
const source = await readFile(new URL('../public/suap-class-parser.js', import.meta.url), 'utf8');
const row = { unidade: '1', data: '07/10/2026', quantidade: '2', conteudo: 'Teoria dos sistemas', formato: 'Síncrona' };
const pageUrl = 'https://suap.ifba.edu.br/edu/diario/42/?tab=aulas';
const addUrl = 'https://suap.ifba.edu.br/edu/adicionar_aula_diario/42/';
function diary(saved = false) {
  return `<div class="action-bar search-and-filters"><select name="etapa"><option value="1">Unidade 1</option></select></div><a href="${addUrl}">Adicionar Aula</a><table id="table_registro_aula"><tbody>${saved ? `<tr><td></td><td>1</td><td>2</td><td>07/10/2026</td><td>Professor</td><td>Teoria dos sistemas</td></tr>` : ''}</tbody></table>`;
}
const form = `<form id="aula_form" method="post" action="${addUrl}">
<input type="hidden" name="csrfmiddlewaretoken" value="test-csrf">
<select name="professor_diario"><option value="77">Professor atual</option></select>
<select name="etapa"><option value="1">Unidade 1</option></select>
<input name="data"><input name="quantidade"><textarea name="conteudo"></textarea>
<select name="formato"><option value=""></option><option value="1">Síncrona</option><option value="2">Assíncrona</option></select></form>`;
function setup({ alreadySaved = false, formHtml = form, refuse = false, losePost = false, emptyWithoutTable = false, unavailable = false } = {}) {
  const dom = new JSDOM(diary(), { url: pageUrl, runScripts: 'outside-only' });
  let saved = alreadySaved;
  const calls = [];
  dom.window.fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (options.method === 'POST') {
      if (losePost) throw new Error('Connection lost');
      if (!refuse) saved = true;
      return { ok: true, url, text: async () => refuse ? '<ul class="errorlist"><li>Data fora do período</li></ul>' : diary(true) };
    }
    return { ok: true, url, text: async () => url === pageUrl ? (unavailable ? '<div>Carregando...</div>' : emptyWithoutTable && !saved ? diary().replace(/<table[^>]*>[\s\S]*?<\/table>/, '<div class="tab ajax-rendered" data-tab="aulas" data-counter="0"><p class="msg info">Nenhuma aula cadastrada.</p></div>') : diary(saved)) : formHtml };
  };
  vm.runInContext(source, dom.getInternalVMContext());
  const register = (extra = {}) => dom.window.SuapClassParser.registerClass({ confirmed: true, row, diaryUrl: pageUrl, ...extra });
  return { dom, calls, register };
}
test('direct registration confirms persisted record without opening or filling a live form', async () => {
  const state = setup();
  const result = await state.register();
  assert.equal(result.ok, true);
  assert.equal(result.saved, true);
  assert.equal(state.dom.window.document.querySelector('#aula_form'), null);
  const posts = state.calls.filter((call) => call.method === 'POST');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].body.get('csrfmiddlewaretoken'), 'test-csrf');
  assert.equal(posts[0].body.get('professor_diario'), '77');
  assert.equal(posts[0].body.get('conteudo'), row.conteudo);
  assert.equal(posts[0].body.get('formato'), '1');
  assert.equal(posts[0].credentials, 'same-origin');
  state.dom.window.close();
});
test('duplicates, missing session fields, wrong diary and unit do not POST', async () => {
  for (const [options, extra] of [
    [{ alreadySaved: true }, {}],
    [{ formHtml: form.replace('name="csrfmiddlewaretoken"', 'name="missing"') }, {}],
    [{}, { diaryUrl: pageUrl + 'other' }],
    [{}, { row: { ...row, unidade: '2' } }],
    [{}, { confirmed: false }],
    [{ formHtml: form.replace(`action="${addUrl}"`, 'action="https://example.com/"') }, {}],
  ]) {
    const state = setup(options);
    assert.equal((await state.register(extra)).ok, false);
    assert.equal(state.calls.filter((call) => call.method === 'POST').length, 0);
    state.dom.window.close();
  }
});
test('server refusal or unknown POST outcome is reported without automatic retry', async () => {
  for (const options of [{ refuse: true }, { losePost: true }]) {
    const state = setup(options);
    const result = await state.register();
    assert.equal(result.ok, false);
    assert.equal(result.attempted, true);
    assert.equal(state.calls.filter((call) => call.method === 'POST').length, 1);
    state.dom.window.close();
  }
});

test('first class can be registered when SUAP omits the table for an empty unit', async () => {
  const state = setup({ emptyWithoutTable: true });
  const result = await state.register();
  assert.equal(result.ok, true);
  assert.equal(result.saved, true);
  assert.equal(state.calls.filter((call) => call.method === 'POST').length, 1);
  state.dom.window.close();
});
test('unloaded or unavailable class section is not mistaken for an empty unit', async () => {
  const state = setup({ unavailable: true });
  assert.equal((await state.register()).ok, false);
  assert.equal(state.calls.filter((call) => call.method === 'POST').length, 0);
  state.dom.window.close();
});
