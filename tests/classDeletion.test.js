import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const source = await readFile(new URL('../public/suap-class-parser.js', import.meta.url), 'utf8');
const url = 'https://suap.ifba.edu.br/edu/meu_diario/42/1/?tab=aulas';
const initialRows = [{ id: '11', unit: '1' }, { id: '12', unit: '1' }, { id: '21', unit: '2' }];
function html(rows) {
  return `<title>Diário de teste</title><div class="action-bar search-and-filters"><select name="etapa"><option value="1">Unidade 1</option><option value="2">Unidade 2</option></select></div><table id="table_registro_aula"><tbody>${rows.map((row) => `<tr><td><a href="/comum/excluir/edu/aula/${row.id}/">Remover</a></td><td>Unidade ${row.unit}</td><td>2</td><td>07/10/2026</td><td>Professor</td><td>${row.content || 'Aula ' + row.id}</td></tr>`).join('')}</tbody></table>`;
}
function setup({ wrongPassword = false, missingToken = false, loseResponse = false } = {}) {
  const dom = new JSDOM(html(initialRows), { url, runScripts: 'outside-only' });
  let rows = initialRows.map((row) => ({ ...row }));
  const calls = [];
  dom.window.fetch = async (target, options) => {
    calls.push({ target, ...options });
    const id = new URL(target).pathname.match(/\/aula\/(\d+)\//)?.[1];
    if (options.method === 'POST') {
      if (loseResponse) throw new Error('Connection lost');
      if (wrongPassword) return { ok: true, type: 'basic', text: async () => '<ul class="errorlist"><li>Senha incorreta</li></ul>' };
      rows = rows.filter((row) => row.id !== id);
      return { type: 'opaqueredirect' };
    }
    const form = `<form id="excluirregistro_form" action="" method="POST">${missingToken ? '' : '<input type="hidden" name="csrfmiddlewaretoken" value="test-token">'}<input type="password" name="senha"><input type="submit" name="excluirregistro_form" value="Excluir"></form>`;
    return { ok: true, text: async () => id ? form : rows.some((row) => row.unit === '1') ? html(rows) : html(rows).replace(/<table[^>]*>[\s\S]*?<\/table>/, '<div class="tab ajax-rendered" data-tab="aulas" data-counter="0"><p class="msg info">Nenhuma aula cadastrada.</p></div>') };
  };
  vm.runInContext(source, dom.getInternalVMContext());
  const api = dom.window.SuapClassParser;
  return { dom, api, calls, rows: () => rows, mutate: () => { rows[0].content = 'Alterado'; } };
}
test('preview restricts deletion to the selected unit, preserves other units and confirms each removal', async () => {
  const state = setup();
  const preview = await state.api.previewClassDeletion();
  assert.equal(preview.ok, true);
  assert.equal(preview.rows.length, 2);
  assert.equal(preview.totalQuantity, 4);
  for (const row of preview.rows) {
    const payload = { planId: preview.planId, id: row.id, confirmed: true, password: 'test-only-password' };
    const result = await state.api.deletePlannedClass(payload);
    assert.equal(result.ok, true);
    assert.equal(result.deleted, true);
    assert.equal(payload.password, '');
  }
  assert.deepEqual(state.rows().map((row) => row.id), ['21']);
  const posts = state.calls.filter((call) => call.method === 'POST');
  assert.equal(posts.length, 2);
  assert.equal(posts[0].body.get('senha'), 'test-only-password');
  assert.equal(posts[0].body.get('csrfmiddlewaretoken'), 'test-token');
  assert.equal(posts[0].body.get('excluirregistro_form'), 'Excluir');
  assert.equal(posts[0].redirect, 'manual');
  assert.ok(posts.every((call) => !call.target.includes('test-only-password')));
  state.dom.window.close();
});
test('confirmation, scope, password and plan validation reject deletion without a POST', async () => {
  for (const invalid of [{ confirmed: false }, { id: '21' }, { password: '' }, { planId: 'not-a-plan' }]) {
    const state = setup();
    const preview = await state.api.previewClassDeletion();
    const result = await state.api.deletePlannedClass({ planId: preview.planId, id: '11', confirmed: true, password: 'test-only-password', ...invalid });
    assert.equal(result.ok, false);
    assert.equal(state.calls.filter((call) => call.method === 'POST').length, 0);
    state.dom.window.close();
  }
});
test('changed unit, edited record or missing CSRF token prevents deletion', async () => {
  for (const kind of ['unit', 'record', 'csrf']) {
    const state = setup({ missingToken: kind === 'csrf' });
    const preview = await state.api.previewClassDeletion();
    if (kind === 'unit') state.dom.window.document.querySelector('select').value = '2';
    if (kind === 'record') state.mutate();
    const result = await state.api.deletePlannedClass({ planId: preview.planId, id: '11', confirmed: true, password: 'test-only-password' });
    assert.equal(result.ok, false);
    assert.equal(state.calls.filter((call) => call.method === 'POST').length, 0);
    state.dom.window.close();
  }
});
test('wrong password and unknown outcomes stop without retry or password retention', async () => {
  for (const options of [{ wrongPassword: true }, { loseResponse: true }]) {
    const state = setup(options);
    const preview = await state.api.previewClassDeletion();
    const payload = { planId: preview.planId, id: '11', confirmed: true, password: 'test-only-password' };
    const result = await state.api.deletePlannedClass(payload);
    assert.equal(result.ok, false);
    assert.equal(result.attempted, true);
    assert.equal(state.calls.filter((call) => call.method === 'POST').length, 1);
    assert.equal(payload.password, '');
    assert.ok(!result.error.includes('test-only-password'));
    assert.equal(state.rows().length, 3);
    state.dom.window.close();
  }
});

test('an expired preview requires new review before any deletion', async () => {
  const state = setup();
  const preview = await state.api.previewClassDeletion();
  state.dom.window.Date.now = () => Date.now() + 11 * 60 * 1000;
  const payload = { planId: preview.planId, id: '11', confirmed: true, password: 'test-only-password' };
  const result = await state.api.deletePlannedClass(payload);
  assert.equal(result.ok, false);
  assert.equal(payload.password, '');
  assert.equal(state.calls.filter((call) => call.method === 'POST').length, 0);
  state.dom.window.close();
});
test('already confirmed deletion is not submitted again', async () => {
  const state = setup();
  const preview = await state.api.previewClassDeletion();
  const payload = () => ({ planId: preview.planId, id: '11', confirmed: true, password: 'test-only-password' });
  assert.equal((await state.api.deletePlannedClass(payload())).ok, true);
  assert.equal((await state.api.deletePlannedClass(payload())).ok, false);
  assert.equal(state.calls.filter((call) => call.method === 'POST').length, 1);
  state.dom.window.close();
});
