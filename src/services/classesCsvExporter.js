const escapeCsv = (value) => {
  const text = String(value ?? "");
  if (/[;"\n\r]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
};

export const classesToCsv = (data) => {
  const rows = data?.classes ?? [];

  const headers = [
    "Unidade",
    "Quantidade",
    "Data",
    "Professor",
    "Conteúdo",
  ];

  return [
    headers,
    ...rows.map((item) => [
      item.unidade,
      item.quantidade,
      item.data,
      item.professor,
      item.conteudo,
    ]),
  ]
    .map((row) => row.map(escapeCsv).join(";"))
    .join("\r\n");
};

export const downloadClassesCsv = (data) => {
  const csv = classesToCsv(data);
  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  anchor.href = url;
  anchor.download = "suap-aulas-" + date + ".csv";
  anchor.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
