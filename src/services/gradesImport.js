import Papa from "papaparse";
export function parseGradesCsv(source) {
  const parsed = Papa.parse(source.replace(/^\uFEFF/, ""), { delimitersToGuess: [";", ","], skipEmptyLines: "greedy" });
  if (parsed.errors.length) throw new Error("CSV inválido. Confira os separadores e as aspas.");
  const headers = (parsed.data[0] ?? []).map((value, index) => index > 0 && /^nota(?:[1-9]\d*)?$/i.test(value.trim()) ? "Nota" + value.trim().slice(4) : value.trim());
  if (!/^matr[ií]cula$/i.test(headers[0])) throw new Error("A primeira coluna deve ser Matrícula.");
  const columns = headers.slice(1);
  if (!columns.length || new Set(columns).size !== columns.length || !columns.every((name) => name === "Nota" || /^Nota[1-9]\d*$/.test(name)) || (columns.includes("Nota") && columns.length !== 1)) throw new Error("Use Matrícula;Nota ou Matrícula;Nota1;Nota2;Nota3 (somente as colunas necessárias).");
  const seen = new Set();
  const rows = parsed.data.slice(1).map((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`Linha ${index + 2}: quantidade de colunas inválida.`);
    const matricula = String(cells[0]).trim();
    if (!matricula || seen.has(matricula)) throw new Error(`Linha ${index + 2}: matrícula vazia ou repetida.`);
    seen.add(matricula);
    const grades = Object.fromEntries(columns.map((column, i) => {
      const value = cells[i + 1].trim();
      if (value && !/^\d+(?:[.,]\d{1,2})?$/.test(value)) throw new Error(`Linha ${index + 2}: ${column} deve ser um número, com até duas casas decimais, ou ficar vazia.`);
      return [column, value.replace(",", ".")];
    }));
    return { line: index + 2, matricula, grades };
  });
  if (!rows.length) throw new Error("O arquivo não contém alunos.");
  return { columns, rows };
}
export function downloadGradesTemplate(multiple = false) {
  const text = multiple ? "Matrícula;Nota1;Nota2;Nota3\r\n" : "Matrícula;Nota\r\n";
  const url = URL.createObjectURL(new Blob(["\uFEFF", text], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = multiple ? "suap-modelo-varias-notas.csv" : "suap-modelo-nota.csv"; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
