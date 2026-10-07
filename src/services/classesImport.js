import Papa from "papaparse";

export const REQUIRED_HEADERS = ["Unidade", "Data", "Quantidade", "Conteúdo"];
export const TEMPLATE_HEADERS = [...REQUIRED_HEADERS, "Formato"];
export const TEMPLATE_CSV = TEMPLATE_HEADERS.join(";") + "\r\n";
const text = (value) => String(value ?? "").trim();

export function validDate(value) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return false;
  const [day, month, year] = value.split("/").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return year > 0 && date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function validateClassRows(rows) {
  const headers = (rows[0] ?? []).map((value) => String(value ?? ""));
  const columnErrors = [];
  for (const header of REQUIRED_HEADERS) {
    if (!headers.includes(header)) columnErrors.push(`Coluna obrigatória ausente: ${header}.`);
  }
  headers.forEach((header, index) => {
    if (!TEMPLATE_HEADERS.includes(header)) columnErrors.push(`Coluna ${index + 1} não reconhecida: ${header || "(vazia)"}.`);
    if (headers.indexOf(header) !== index) columnErrors.push(`Coluna duplicada: ${header}.`);
  });
  const result = { columnErrors, rows: [], totalQuantity: 0, units: {} };
  if (columnErrors.length) return result;
  rows.slice(1).forEach((cells, index) => {
    if (cells.every((cell) => text(cell) === "")) return;
    const values = Object.fromEntries(headers.map((header, i) => [header, text(cells[i])]));
    const errors = [];
    if (cells.slice(headers.length).some((cell) => text(cell))) errors.push("Há valores além das colunas do modelo.");
    if (!["1", "2", "3"].includes(values.Unidade)) errors.push("Unidade deve ser 1, 2 ou 3.");
    if (!validDate(values.Data)) errors.push("Data deve ser válida no formato dd/mm/aaaa (no XLSX, use texto).");
    if (!/^\d+$/.test(values.Quantidade) || !Number.isSafeInteger(Number(values.Quantidade)) || Number(values.Quantidade) <= 0) errors.push("Quantidade deve ser um inteiro maior que zero.");
    if (!values.Conteúdo) errors.push("Conteúdo é obrigatório.");
    if (!["", "Síncrona", "Assíncrona"].includes(values.Formato ?? "")) errors.push("Formato deve ser vazio, Síncrona ou Assíncrona.");
    const row = { line: index + 2, unidade: values.Unidade, data: values.Data,
      quantidade: values.Quantidade, conteudo: values.Conteúdo, formato: values.Formato ?? "", errors };
    result.rows.push(row);
    if (!errors.length) {
      result.totalQuantity += Number(row.quantidade);
      result.units[row.unidade] = (result.units[row.unidade] ?? 0) + Number(row.quantidade);
    }
  });
  return result;
}

export function parseClassesCsv(source) {
  const parsed = Papa.parse(source.replace(/^\uFEFF/, ""), {
    delimitersToGuess: [";", ","], skipEmptyLines: false,
  });
  if (parsed.errors.length) throw new Error("CSV inválido: " + parsed.errors.map((error) => error.message).join("; "));
  return validateClassRows(parsed.data);
}

export async function importClassesFile(file) {
  if (file.size > 5 * 1024 * 1024) throw new Error("O arquivo deve ter no máximo 5 MB.");
  if (/\.csv$/i.test(file.name)) return parseClassesCsv(await file.text());
  if (/\.xlsx$/i.test(file.name)) {
    const { default: readXlsxFile, readSheetNames } = await import("read-excel-file");
    const sheets = await readSheetNames(file);
    if (sheets.length !== 1) throw new Error("O XLSX deve conter exatamente uma aba com o modelo de aulas.");
    return validateClassRows(await readXlsxFile(file, { trim: false, ignoreEmptyRows: false }));
  }
  throw new Error("Selecione um arquivo CSV ou XLSX do modelo oficial.");
}

export function downloadClassesTemplate() {
  const url = URL.createObjectURL(new Blob(["\uFEFF", TEMPLATE_CSV], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "suap-modelo-aulas.csv";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
