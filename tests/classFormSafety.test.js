import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const source = await readFile(new URL("../public/suap-class-parser.js", import.meta.url), "utf8");
function parser() {
  class Input { constructor(value = "") { this._value = value; } set value(value) { this._value = value; } get value() { return this._value; } dispatchEvent() {} }
  class Select extends Input { constructor(options) { super(); this.options = options.map((value) => ({ value })); } }
  class Textarea extends Input {}
  const fields = {
    '#id_quantidade': new Input(), '#id_etapa': new Select(['1', '2', '3']),
    '#id_data': new Input(), '#id_formato': new Select(['', '1', '2']),
    '#id_conteudo': new Textarea(), '#id_professor_diario': new Input('unchanged'),
  };
  let submits = 0;
  const form = { querySelector: (selector) => fields[selector], submit: () => submits++, requestSubmit: () => submits++ };
  const context = vm.createContext({ document: { querySelector: () => form },
    HTMLInputElement: Input, HTMLSelectElement: Select, HTMLTextAreaElement: Textarea,
    Event: class {}, console });
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
