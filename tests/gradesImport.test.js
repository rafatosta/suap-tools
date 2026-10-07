import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGradesCsv } from '../src/services/gradesImport.js';
test('CSV supports single/multiple grades, decimal comma, blanks, zero and leading zero enrollment', () => {
  const single = parseGradesCsv('\uFEFFmatrícula;nota\r\n0001;8,5');
  assert.equal(single.rows[0].matricula, '0001');
  assert.equal(single.rows[0].grades.Nota, '8.5');
  const multi = parseGradesCsv('Matrícula;Nota1;Nota2;Nota3\n0001;0;;9.0');
  assert.equal(multi.rows[0].grades.Nota1, '0');
  assert.equal(multi.rows[0].grades.Nota2, '');
});
test('arbitrary headers, duplicates and malformed grades fail before preview', () => {
  for (const text of ['Aluno;Nota\nx;8', 'Matrícula;Nota;Nota2\nx;8;7', 'Matrícula;Nota1;Nota1\nx;8;7', 'Matrícula;Nota\nx;-1', 'Matrícula;Nota\nx;1e1', 'Matrícula;Nota\nx;8\nx;9', 'Matrícula;Nota\nx;NaN', 'Matrícula;Nota\nx;8;extra']) assert.throws(() => parseGradesCsv(text));
});
