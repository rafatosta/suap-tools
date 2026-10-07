import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source = await readFile(new URL("../public/suap-class-parser.js", import.meta.url), "utf8");
function parser({ resetOnChange = false, visible = true } = {}) {
  class Input { constructor(value = "") { this._value = value; } set value(value) { this._value = value; } get value() { return this._value; } dispatchEvent(event) { if (resetOnChange && event.type === "change") queueMicrotask(() => { for (const input of Object.values(fields)) input._value = ""; }); } }
  class Select extends Input { set value(value) { this._value = value; } get value() { return this._value; } constructor(options) { super(); this.options = options.map((value) => ({ value })); } }
  class Textarea extends Input { set value(value) { this._value = value; } get value() { return this._value; } }
  const fields = {
    '#id_quantidade': new Input(), '#id_etapa': new Select(['1', '2', '3']),
    '#id_data': new Input(), '#id_formato': new Select(['', '1', '2']),
    '#id_conteudo': new Textarea(), '#id_professor_diario': new Input('unchanged'),
  };
  let submits = 0;
  const form = { isConnected: true, getClientRects: () => visible ? [{}] : [], querySelector: (selector) => fields[selector], submit: () => submits++, requestSubmit: () => submits++ };
  const context = vm.createContext({ document: { querySelector: () => form, querySelectorAll: (selector) => selector === "#aula_form" ? [form] : [] },
    getComputedStyle: () => ({ visibility: "visible" }),
    HTMLInputElement: Input, HTMLSelectElement: Select, HTMLTextAreaElement: Textarea,
    Event: class { constructor(type) { this.type = type; } }, console });
  vm.runInContext(source, context);
  return { fields, api: context.SuapClassParser, submits: () => submits };
}
test("native filling never submits or changes professor; missing fields fail before mutation", () => {
  const state = parser();
  const payload = { quantidade: '2', etapa: '1', data: '07/10/2026', formato: '1', conteudo: 'Aula' };
  assert.equal(state.api.fillClassForm(payload).ok, true);
  assert.equal(state.submits(), 0);
  assert.equal(state.fields['#id_professor_diario'].value, 'unchanged');
  delete state.fields['#id_conteudo'];
  assert.equal(state.api.fillClassForm({ ...payload, quantidade: '3' }).ok, false);
  assert.equal(state.fields['#id_quantidade'].value, '2');
});
test("unsupported native select values fail before filling any field", () => {
  const state = parser();
  assert.equal(state.api.fillClassForm({ quantidade: '2', formato: 'Presencial' }).ok, false);
  assert.equal(state.fields['#id_quantidade'].value, '');
  assert.equal(state.submits(), 0);
});

test("batch values survive SUAP reset handlers because no change events are emitted", async () => {
  const state = parser({ resetOnChange: true });
  const payload = { quantidade: '2', etapa: '1', data: '07/10/2026', formato: '1', conteudo: 'Aula', mode: 'batch' };
  assert.equal(state.api.fillClassForm(payload).ok, true);
  await Promise.resolve();
  const actual = state.api.getClassFormState();
  for (const key of ['quantidade', 'etapa', 'data', 'formato', 'conteudo']) assert.equal(actual.fields[key], payload[key]);
  assert.equal(state.submits(), 0);
});
test("a hidden modal is not an open form and is never filled", () => {
  const state = parser({ visible: false });
  assert.equal(state.api.getClassFormState().ok, false);
  assert.equal(state.api.fillClassForm({ conteudo: 'Aula', mode: 'batch' }).ok, false);
});

test("unit detection ignores dialog fields and unrelated page filters", () => {
  const select = (name, value, label, modal = false) => ({ name, selectedIndex: 0,
    options: [{ value, textContent: label }], closest: () => modal ? {} : null });
  const context = vm.createContext({
    location: { hostname: 'suap.ifba.edu.br', href: 'https://suap.ifba.edu.br/edu/diario/42/' },
    document: { title: 'Diário', querySelector: () => null,
      querySelectorAll: (selector) => selector === '.action-bar.search-and-filters select'
        ? [select('professor', '2', 'Professor'), select('etapa', '3', 'Unidade 3', true), select('etapa', '1', 'Unidade 1')]
        : [] },
  });
  vm.runInContext(source, context);
  const result = context.SuapClassParser.extractClasses();
  assert.equal(result.metadata.unit.value, '1');
});
