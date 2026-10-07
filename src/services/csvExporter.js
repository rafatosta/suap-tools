const escapeCsv = (value) => {
  const text = String(value ?? "");
  if (/[;"\n\r]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
};

const collectGradeColumns = (students) => {
  const columns = [];
  const seen = new Set();

  for (const student of students) {
    for (const [section, values] of Object.entries(student.notas ?? {})) {
      for (const assessment of Object.keys(values ?? {})) {
        const key = section + " - " + assessment;
        if (!seen.has(key)) {
          seen.add(key);
          columns.push({ section, assessment, key });
        }
      }
    }
  }

  return columns;
};

export const gradebookToCsv = (gradebook) => {
  const students = gradebook?.students ?? [];
  const gradeColumns = collectGradeColumns(students);

  const headers = [
    "Matrícula",
    "Aluno",
    ...gradeColumns.map((column) => column.key),
  ];

  const rows = students.map((student) => [
    student.matricula,
    student.nome,
    ...gradeColumns.map(
      ({ section, assessment }) => student.notas?.[section]?.[assessment] ?? ""
    ),
  ]);

  return [headers, ...rows]
    .map((row) => row.map(escapeCsv).join(";"))
    .join("\r\n");
};

export const downloadCsv = (gradebook) => {
  const csv = gradebookToCsv(gradebook);
  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  anchor.href = url;
  anchor.download = "suap-notas-" + date + ".csv";
  anchor.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
