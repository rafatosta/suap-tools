import test from "node:test";
import assert from "node:assert/strict";
import { fillClassesBatch, rowToForm, diaryKey } from "../src/services/classesBatch.js";
const row = { line: 2, unidade: "1", data: "07/10/2026", quantidade: "2", conteudo: "Aula 1", formato: "Síncrona", errors: [] };
const row2 = { ...row, line: 3, data: "14/10/2026", conteudo: "Aula 2", formato: "Assíncrona" };
function scenario({ rows = [row, row2], existing = [], unit = "1", alreadyOpen = false, initialFields = null, editing = false, mismatch = false } = {}) {
  const abort = new AbortController();
  const records = [...existing];
  const events = [];
  let fields = initialFields, open = alreadyOpen, current;
  const send = async (type, payload) => {
    events.push(type);
    if (type === "SUAP_TOOLS_EXTRACT_CLASSES") return { ok: true, metadata: { addClassUrl: "https://suap.ifba.edu.br/edu/adicionar_aula_diario/42/", unit: { value: unit } }, classes: [...records] };
    if (type === "SUAP_TOOLS_GET_CLASS_FORM") return { ok: open, editing, fields: fields ?? { conteudo: "" } };
    if (type === "SUAP_TOOLS_OPEN_CLASS_FORM") { assert.equal(open, false, "never overwrite an open form"); open = true; fields = { conteudo: "" }; return { ok: true }; }
    if (type === "SUAP_TOOLS_FILL_CLASS_FORM") { fields = mismatch ? { ...payload, conteudo: "wrong" } : payload; return { ok: true }; }
    throw new Error("Unexpected mutation: " + type);
  };
  const onProgress = (progress) => { events.push(progress.state); if (progress.state === "waiting-save") current = rows[progress.index]; };
  const manualSave = async () => { if (current && open) { events.push("USER_SAVED"); records.push({ ...current, editUrl: "edit/" + records.length }); open = false; current = null; } };
  return { rows, send, signal: abort.signal, onProgress, wait: manualSave, abort, events, records,
    simulateSave: (row) => { records.push({ ...row, editUrl: "edit/" + records.length }); open = false; fields = null; current = null; } };
}
test("fills all rows sequentially only after each manual save, maps native format values", async () => {
  const state = scenario();
  await fillClassesBatch(state);
  assert.equal(state.records.length, 2);
  assert.equal(state.events.filter((event) => event === "SUAP_TOOLS_FILL_CLASS_FORM").length, 2);
  assert.ok(state.events.indexOf("USER_SAVED") < state.events.lastIndexOf("SUAP_TOOLS_OPEN_CLASS_FORM"));
  assert.equal(state.events.at(-1), "complete");
  assert.equal(rowToForm(row).formato, "1");
  assert.equal(rowToForm(row2).formato, "2");
  assert.equal(rowToForm({ ...row, formato: "" }).formato, "");
});
test("invalid, duplicate, registered and wrong-unit rows never open a form", async () => {
  for (const options of [{ rows: [{ ...row, errors: ["invalid"] }] }, { rows: [row, row] }, { existing: [{ ...row, editUrl: "existing" }] }, { unit: "2" }, { alreadyOpen: true, initialFields: { conteudo: "Unrelated lesson" } }, { alreadyOpen: true, editing: true }]) {
    const state = scenario(options);
    await assert.rejects(fillClassesBatch(state));
    assert.ok(!state.events.includes("SUAP_TOOLS_OPEN_CLASS_FORM"));
  }
});
test("canceling the dialog does not advance or count as a save", async () => {
  const state = scenario();
  let checks = 0;
  state.wait = async () => { if (++checks === 4) state.abort.abort(); };
  await assert.rejects(fillClassesBatch(state), { name: "AbortError" });
  assert.equal(state.events.filter((event) => event === "SUAP_TOOLS_OPEN_CLASS_FORM").length, 1);
  assert.ok(!state.events.includes("saved"));
});
test("field mismatch stops instead of waiting for save or advancing", async () => {
  const state = scenario({ mismatch: true });
  await assert.rejects(fillClassesBatch(state), /Não foi possível confirmar/);
  assert.ok(!state.events.includes("waiting-save"));
});
test("changing diaries while waiting stops the queue", async () => {
  const state = scenario();
  const originalSend = state.send;
  let changed = false;
  state.wait = async () => { changed = true; };
  state.send = async (...args) => {
    const result = await originalSend(...args);
    if (changed && args[0] === "SUAP_TOOLS_EXTRACT_CLASSES") result.metadata.addClassUrl = result.metadata.addClassUrl.replace("42", "43");
    return result;
  };
  await assert.rejects(fillClassesBatch(state), /diário ou a unidade mudou/);
  assert.ok(!state.events.includes("saved"));
});

test("a new matching record must be accompanied by a closed form", async () => {
  const state = scenario();
  let checks = 0;
  state.wait = async () => {
    if (++checks === 1) state.records.push({ ...row, editUrl: "new-record" });
    if (checks === 3) state.abort.abort();
  };
  await assert.rejects(fillClassesBatch(state), { name: "AbortError" });
  assert.ok(!state.events.includes("saved"));
});

test("reuses an already open blank form without opening a second dialog", async () => {
  const state = scenario({ alreadyOpen: true });
  await fillClassesBatch(state);
  assert.equal(state.records.length, 2);
  assert.equal(state.events.filter((event) => event === "SUAP_TOOLS_OPEN_CLASS_FORM").length, 1);
});
test("resumes a matching filled form without clearing or refilling it", async () => {
  const state = scenario({ alreadyOpen: true, initialFields: rowToForm(row) });
  await fillClassesBatch(state);
  assert.equal(state.records.length, 2);
  assert.equal(state.events.filter((event) => event === "SUAP_TOOLS_FILL_CLASS_FORM").length, 1);
});
test("query parameters never redefine the diary identity", () => {
  assert.equal(diaryKey({ addClassUrl: "https://suap.ifba.edu.br/edu/adicionar_aula_diario/42/?etapa=1" }),
    diaryKey({ addClassUrl: "https://suap.ifba.edu.br/edu/adicionar_aula_diario/42/?popup=1&etapa=1" }));
  assert.notEqual(diaryKey({ addClassUrl: "https://suap.ifba.edu.br/edu/adicionar_aula_diario/43/" }),
    diaryKey({ addClassUrl: "https://suap.ifba.edu.br/edu/adicionar_aula_diario/42/" }));
});
test("modal transitions with missing unit and changing query params do not interrupt", async () => {
  const state = scenario();
  const original = state.send;
  let filled = false;
  state.send = async (...args) => {
    const result = await original(...args);
    if (args[0] === "SUAP_TOOLS_FILL_CLASS_FORM") { filled = true; assert.equal(args[1].mode, "batch"); }
    if (filled && args[0] === "SUAP_TOOLS_EXTRACT_CLASSES") {
      result.metadata.addClassUrl += "?popup=1";
      result.metadata.unit.value = "";
    }
    return result;
  };
  await fillClassesBatch(state);
  assert.equal(state.records.length, 2);
});

test("a quick manual save before field verification is counted, including the final class", async () => {
  const state = scenario();
  let current;
  const originalProgress = state.onProgress;
  state.onProgress = (progress) => {
    originalProgress(progress);
    if (progress.state === "verifying") current = progress.row;
  };
  state.wait = async () => {
    if (current) { state.simulateSave(current); current = null; }
  };
  await fillClassesBatch(state);
  assert.equal(state.records.length, 2);
  assert.equal(state.events.filter((event) => event === "saved").length, 2);
  assert.equal(state.events.at(-1), "complete");
});
test("a saved record that appears after a short reload is confirmed without refilling", async () => {
  const state = scenario({ rows: [row] });
  const originalProgress = state.onProgress;
  const originalSend = state.send;
  let current, reads = 0;
  state.onProgress = (progress) => { originalProgress(progress); if (progress.state === "verifying") current = progress.row; };
  state.wait = async () => { if (current) { state.simulateSave(current); current = null; } };
  state.send = async (...args) => {
    const result = await originalSend(...args);
    if (state.records.length && args[0] === "SUAP_TOOLS_EXTRACT_CLASSES" && ++reads < 3) result.classes = [];
    return result;
  };
  await fillClassesBatch(state);
  assert.equal(state.events.filter((event) => event === "SUAP_TOOLS_FILL_CLASS_FORM").length, 1);
  assert.equal(state.events.at(-1), "complete");
});
