import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { parseGradesCsv } from '../src/services/gradesImport.js';
const source = await readFile(new URL('../public/suap-grade-parser.js', import.meta.url), 'utf8');
const page = 'https://suap.ifba.edu.br/edu/meu_diario/42/1/?tab=notas';
function setup({ failSave = false } = {}) {
  const values = { '101': '2.0', '102': '4.5', '103': '', '201': '', '202': '', '203': '9.5' };
  function html() {
    const cells = (student) => [1,2,3].map((n) => `<tr><td><label>A${n}</label></td><td><input name="1;${student};${500+n}" onblur="validar_nota(this, ${student*100+n}, ${n===2?'5.0':'10.0'})" value="${values[student*100+n]??''}"></td></tr>`).join('');
    return `<table id="table_notas"><thead><tr><th>#</th><th>Aluno</th><th>Unidade 1</th><th>RP1</th><th>MD</th></tr></thead><tbody>${[1,2,3].map((student) => `<tr class="${student===3?'disabled':''}"><td>${student}</td><td><dl><dd>Aluno ${student} (<a href="/edu/aluno/000${student}/">000${student}</a>)</dd></dl></td><td><table><tbody>${cells(student)}<tr><td>Nota</td><td><input disabled value="7,0"></td></tr></tbody></table></td><td><table><tbody><tr><td>A1</td><td><input disabled value="8"></td></tr></tbody></table></td><td>7</td></tr>`).join('')}</tbody></table>`;
  }
  const dom = new JSDOM(html(), { url: page, runScripts: 'outside-only' });
  const writes = [];
  dom.window.fetch = async (url, options) => {
    const match = new URL(url).pathname.match(/^\/edu\/registrar_nota_ajax\/(\d+)\/([\d.]+)\/$/);
    if (match) {
      writes.push({ id: match[1], value: match[2], options });
      if (failSave) throw new Error('Connection lost');
      values[match[1]] = match[2];
      return { ok: true, text: async () => 'OK' };
    }
    return { ok: true, text: async () => html() };
  };
  vm.runInContext(source, dom.getInternalVMContext());
  return { dom, values, writes, api: dom.window.SuapGradeParser };
}
function request(csv, mapping = { Nota1: 'A1', Nota2: 'A2', Nota3: 'A3' }) {
  return { rows: parseGradesCsv(csv).rows, stage: 'Unidade 1', mapping };
}
test('multiple grades save only listed cells; blanks, averages and other grades remain untouched', async () => {
  const state = setup();
  const catalog = state.api.getImportCatalog();
  assert.equal(catalog.ok, true);
  assert.equal(Object.keys(catalog.stages['Unidade 1']).join(','), 'A1,A2,A3');
  const plan = await state.api.previewGradeImport(request('Matrícula;Nota1;Nota2;Nota3\n0001;0;;9\n0002;8,5;;9,5'));
  assert.equal(plan.ok, true);
  assert.equal(plan.changes.length, 3);
  assert.equal(plan.blanks, 2);
  assert.equal(plan.unchanged, 1);
  assert.equal(plan.replacements, 1);
  for (const change of plan.changes) assert.equal((await state.api.savePlannedGrade({ planId: plan.planId, id: change.id, confirmed: true, allowReplace: true })).saved, true);
  assert.deepEqual(state.writes.map((write) => write.id), ['101', '103', '201']);
  assert.equal(state.values['101'], '0');
  assert.equal(state.values['102'], '4.5');
  assert.equal(state.values['203'], '9.5');
  const inputs = [...state.dom.window.document.querySelectorAll("input[name]")];
  assert.equal(inputs.find((input) => input.name === "1;1;501").value, "0");
  assert.equal(inputs.find((input) => input.name === "1;1;502").value, "4.5");
  assert.ok(state.writes.every((write) => write.options.credentials === 'same-origin' && write.options.redirect === 'error'));
  state.dom.window.close();
});
test('single column can target A2 and uses its actual five-point scale', async () => {
  const state = setup();
  const plan = await state.api.previewGradeImport(request('Matrícula;Nota\n0002;4,9', { Nota: 'A2' }));
  assert.equal(plan.ok, true);
  assert.equal(plan.changes[0].id, '202');
  assert.equal((await state.api.previewGradeImport(request('Matrícula;Nota\n0002;6', { Nota: 'A2' }))).ok, false);
  state.dom.window.close();
});
test('unknown/inactive enrollments, duplicated mappings and unavailable assessments block preview', async () => {
  const state = setup();
  for (const payload of [request('Matrícula;Nota\n9999;8', { Nota:'A1' }), request('Matrícula;Nota\n0003;8', { Nota:'A1' }), request('Matrícula;Nota1;Nota2\n0001;8;9', { Nota1:'A1', Nota2:'A1' }), request('Matrícula;Nota\n0001;8', { Nota:'Nota' })]) assert.equal((await state.api.previewGradeImport(payload)).ok, false);
  assert.equal(state.writes.length, 0);
  state.dom.window.close();
});
test('overwrite requires permission; stale current values stop instead of replacing them', async () => {
  const state = setup();
  const plan = await state.api.previewGradeImport(request('Matrícula;Nota\n0001;8', { Nota:'A1' }));
  assert.equal((await state.api.savePlannedGrade({ planId:plan.planId, id:'101', confirmed:true })).ok, false);
  state.values['101']='6';
  assert.equal((await state.api.savePlannedGrade({ planId:plan.planId, id:'101', confirmed:true, allowReplace:true })).ok, false);
  assert.equal(state.writes.length, 0);
  state.dom.window.close();
});
test('confirmation and target scope are required; an uncertain write is not retried', async () => {
  const state = setup({ failSave:true });
  const plan = await state.api.previewGradeImport(request('Matrícula;Nota\n0002;8', { Nota:'A1' }));
  assert.equal((await state.api.savePlannedGrade({ planId:plan.planId, id:'201', confirmed:false })).ok,false);
  assert.equal((await state.api.savePlannedGrade({ planId:plan.planId, id:'101', confirmed:true })).ok,false);
  const result = await state.api.savePlannedGrade({ planId:plan.planId, id:'201', confirmed:true });
  assert.equal(result.ok,false);
  assert.equal(result.attempted,true);
  assert.equal(state.writes.length,1);
  assert.equal((await state.api.savePlannedGrade({ planId:plan.planId, id:"201", confirmed:true })).ok,false);
  assert.equal(state.writes.length,1);
  state.dom.window.close();
});
