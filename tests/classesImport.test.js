import test from "node:test";
import assert from "node:assert/strict";
import { validateClassRows, parseClassesCsv, validDate, TEMPLATE_CSV, importClassesFile } from "../src/services/classesImport.js";
const headers = ["Unidade", "Data", "Quantidade", "Conteúdo", "Formato"];
const good = ["1", "29/02/2024", "2", "Teoria geral", "Síncrona"];

test("template uses the fixed contract and has no sample classes", () => {
  assert.deepEqual(parseClassesCsv(TEMPLATE_CSV).columnErrors, []);
  assert.equal(parseClassesCsv(TEMPLATE_CSV).rows.length, 0);
});
test("calendar dates require exact format and a real date", () => {
  for (const value of ["31/04/2026", "29/02/2026", "00/01/2026", "01/13/2026", "1/01/2026", "2026-01-01", "01/01/0000"]) assert.equal(validDate(value), false, value);
  for (const value of ["29/02/2024", "01/01/2026", "31/12/2026"]) assert.equal(validDate(value), true, value);
});
test("missing, arbitrary, duplicate and inexact headers block the whole file", () => {
  for (const bad of [["Semana", "Aula", "Duração", "Metodologia"], [...headers, "Professor"], [...headers, "Data"], ["unidade", ...headers.slice(1)], ["Unidade ", ...headers.slice(1)]]) {
    const result = validateClassRows([bad, good]);
    assert.ok(result.columnErrors.length);
    assert.equal(result.rows.length, 0);
    assert.equal(result.totalQuantity, 0);
  }
});
test("optional Formato and reordered fixed columns work with XLSX numeric cells", () => {
  const result = validateClassRows([["Conteúdo", "Quantidade", "Unidade", "Data"], ["Aula", 3, 2, "07/10/2026"]]);
  assert.deepEqual(result.columnErrors, []);
  assert.deepEqual(result.rows[0].errors, []);
  assert.equal(result.totalQuantity, 3);
});
test("every field is validated and invalid rows are excluded from simulation", () => {
  const result = validateClassRows([headers, good, ["4", "31/04/2026", "0", " ", "Presencial"], ["2", "01/01/2026", "1.5", "Aula", ""], ["3", "01/01/2026", "-1", "Aula", ""], ["3", "01/01/2026", "1e2", "Aula", ""], ["3", "01/01/2026", "9007199254740992", "Aula", ""]]);
  assert.equal(result.rows[1].errors.length, 5);
  assert.equal(result.rows[1].line, 3);
  assert.ok(result.rows.slice(2).every((row) => row.errors.length));
  assert.equal(result.totalQuantity, 2);
  assert.deepEqual(result.units, { 1: 2 });
});
test("blank rows preserve row numbers; extra populated cells fail", () => {
  const result = validateClassRows([headers, [], [...good, "extra"], good]);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].line, 3);
  assert.equal(result.rows[0].errors.length, 1);
  assert.equal(result.rows[1].line, 4);
});
test("CSV handles BOM, delimiters, escaped quotes and multiline content", () => {
  for (const delimiter of [";", ","]) {
    const result = parseClassesCsv('\uFEFF' + headers.join(delimiter) + '\r\n' + ['1', '07/10/2026', '2', '"Sistemas; redes, e ""dados""\ncontinuação"', 'Assíncrona'].join(delimiter));
    assert.deepEqual(result.columnErrors, []);
    assert.deepEqual(result.rows[0].errors, []);
    assert.equal(result.rows[0].conteudo, 'Sistemas; redes, e "dados"\ncontinuação');
  }
});
test("malformed CSV fails instead of accepting partial data", () => {
  assert.throws(() => parseClassesCsv(headers.join(";") + '\n1;07/10/2026;1;"unfinished;'), /CSV inválido/);
});
test("native XLSX dates do not silently bypass the text contract", () => {
  const result = validateClassRows([headers, [1, new Date("2026-10-07"), 1, "Aula", ""]]);
  assert.match(result.rows[0].errors.join(" "), /Data/);
});
test("file import validates type, size, and CSV reading", async () => {
  await assert.rejects(importClassesFile({ name: "aulas.xls", size: 1 }), /CSV ou XLSX/);
  await assert.rejects(importClassesFile({ name: "aulas.csv", size: 6 * 1024 * 1024 }), /5 MB/);
  const result = await importClassesFile({ name: "AULAS.CSV", size: 100, text: async () => headers.join(";") + "\n" + good.join(";") });
  assert.equal(result.totalQuantity, 2);
});

test("real XLSX file passes the browser reader; multiple sheets fail", async () => {
  const { DOMParser } = await import("@xmldom/xmldom");
  const { readFile } = await import("node:fs/promises");
  globalThis.DOMParser = DOMParser;
  try {
    const file = new File([await readFile(new URL("./fixtures/aulas.xlsx", import.meta.url))], "aulas.xlsx");
    const result = await importClassesFile(file);
    assert.deepEqual(result.columnErrors, []);
    assert.equal(result.totalQuantity, 2);
    assert.equal(result.rows[0].formato, "Síncrona");
    const multiple = new File([await readFile(new URL("./fixtures/multiple-sheets.xlsx", import.meta.url))], "multiple.xlsx");
    await assert.rejects(importClassesFile(multiple), /exatamente uma aba/);
    await assert.rejects(importClassesFile(new File(["invalid"], "corrupt.xlsx")));
  } finally { delete globalThis.DOMParser; }
});
