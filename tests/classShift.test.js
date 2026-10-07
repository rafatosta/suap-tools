import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const source = await readFile(new URL('../public/suap-class-parser.js', import.meta.url), 'utf8');
const page = 'https://suap.ifba.edu.br/edu/meu_diario/256617/2/?tab=aulas';
const dates = ['17/09/2026', '24/09/2026', '01/10/2026', '08/10/2026', '15/10/2026', '22/10/2026', '29/10/2026', '05/11/2026', '12/11/2026', '19/11/2026', '26/11/2026', '03/12/2026', '10/12/2026'];
function html(rows) {
  return `<div class="action-bar search-and-filters"><select name="etapa"><option value="2">Unidade 2</option><option value="1">Unidade 1</option></select></div><table id="table_registro_aula"><tbody>${rows.map((row) => `<tr><td><a title="Editar" href="/edu/adicionar_aula_diario/256617/${row.unit}/${row.id}/">Editar</a></td><td>Unidade ${row.unit}</td><td>3</td><td>${row.date}</td><td>Professor</td><td>Conteúdo ${row.id}</td></tr>`).join('')}</tbody></table>`;
}
function setup({ customDates = dates, fail = false } = {}) {
  const rows = customDates.map((date, index) => ({ id: String(100 + index), unit: '2', date }));
  rows.push({ id: '999', unit: '1', date: '01/10/2026' });
  const dom = new JSDOM(html(rows), { url: page, runScripts: 'outside-only' });
  const calls = [];
  dom.window.fetch = async (url, options) => {
    calls.push({ url, ...options });
    const id = new URL(url).pathname.match(/\/adicionar_aula_diario\/256617\/2\/(\d+)\//)?.[1];
    const row = rows.find((row) => row.id === id);
    if (options.method === 'POST') {
      if (fail) throw new Error('Connection lost');
      row.date = options.body.get('data');
      return { type: 'opaqueredirect' };
    }
    const form = row ? `<form id="aula_form" method="post" action=""><input name="csrfmiddlewaretoken" value="test-token"><input name="professor_diario" value="77"><input name="etapa" value="2"><input name="quantidade" value="3"><input name="data" value="${row.date}"><textarea name="conteudo">Conteúdo ${row.id}</textarea><input name="formato" value="2"><input name="extra" value="preserved"></form>` : '';
    return { ok: true, text: async () => id ? form : html(rows) };
  };
  vm.runInContext(source, dom.getInternalVMContext());
  return { dom, rows, calls, api: dom.window.SuapClassParser };
}
test('user example shifts 11 existing records by seven days, preserving prior dates and other fields', async () => {
  const state = setup();
  const plan = await state.api.previewClassShift({ startDate: '01/10/2026', days: '7' });
  assert.equal(plan.ok, true);
  assert.equal(plan.rows.length, 11);
  assert.equal(plan.unchangedCount, 2);
  assert.equal(plan.rows[0].data, '10/12/2026');
  assert.equal(plan.rows[0].newDate, '17/12/2026');
  assert.equal(plan.rows.at(-1).newDate, '08/10/2026');
  for (const row of plan.rows) assert.equal((await state.api.applyPlannedClassShift({ planId: plan.planId, id: row.id, confirmed: true })).shifted, true);
  assert.equal(state.rows[0].date, '17/09/2026');
  assert.equal(state.rows[1].date, '24/09/2026');
  assert.equal(state.rows.find((row) => row.id === '999').date, '01/10/2026');
  const posts = state.calls.filter((call) => call.method === 'POST');
  assert.equal(posts.length, 11);
  for (const call of posts) {
    assert.equal(call.body.get('professor_diario'), '77');
    assert.equal(call.body.get('quantidade'), '3');
    assert.equal(call.body.get('formato'), '2');
    assert.equal(call.body.get('extra'), 'preserved');
    assert.equal(call.body.get('csrfmiddlewaretoken'), 'test-token');
  }
  assert.equal((await state.api.applyPlannedClassShift({ planId: plan.planId, id: plan.rows[0].id, confirmed: true })).ok, false);
  assert.equal(state.calls.filter((call) => call.method === 'POST').length, 11);
  state.dom.window.close();
});
test('invalid dates, fractional or zero offset, and collision with unaffected dates prevent a plan', async () => {
  const state = setup();
  for (const input of [{ startDate: '31/02/2026', days: 7 }, { startDate: '01/10/2026', days: 0 }, { startDate: '01/10/2026', days: 1.5 }, { startDate: '01/10/2026', days: -7 }]) assert.equal((await state.api.previewClassShift(input)).ok, false);
  assert.equal(state.calls.filter((call) => call.method === 'POST').length, 0);
  state.dom.window.close();
});
test('negative offsets run earliest first, and leap-year transitions are valid', async () => {
  const state = setup({ customDates: ['28/02/2028', '29/02/2028'] });
  const plan = await state.api.previewClassShift({ startDate: '28/02/2028', days: -1 });
  assert.equal(plan.ok, true);
  assert.equal(plan.rows[0].data, '28/02/2028');
  assert.equal(plan.rows[0].newDate, '27/02/2028');
  assert.equal(plan.rows[1].newDate, '28/02/2028');
  state.dom.window.close();
});
test('unconfirmed, out-of-plan, stale records and changed units never POST', async () => {
  for (const kind of ['confirm', 'id', 'stale', 'unit']) {
    const state = setup();
    const plan = await state.api.previewClassShift({ startDate: '01/10/2026', days: 7 });
    if (kind === 'stale') state.rows.find((row) => row.id === plan.rows[0].id).date = '11/12/2026';
    if (kind === 'unit') state.dom.window.document.querySelector('select').value = '1';
    const result = await state.api.applyPlannedClassShift({ planId: plan.planId, id: kind === 'id' ? '999' : plan.rows[0].id, confirmed: kind !== 'confirm' });
    assert.equal(result.ok, false);
    assert.equal(state.calls.filter((call) => call.method === 'POST').length, 0);
    state.dom.window.close();
  }
});
test('unknown edit outcome stops without automatic retry', async () => {
  const state = setup({ fail: true });
  const plan = await state.api.previewClassShift({ startDate: '01/10/2026', days: 7 });
  const result = await state.api.applyPlannedClassShift({ planId: plan.planId, id: plan.rows[0].id, confirmed: true });
  assert.equal(result.ok, false);
  assert.equal(result.attempted, true);
  assert.equal(state.calls.filter((call) => call.method === 'POST').length, 1);
  state.dom.window.close();
});
