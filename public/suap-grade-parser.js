(() => {
  const cleanText = (value) =>
    String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const directRows = (table) => {
    const tbody = table?.querySelector(":scope > tbody");
    return tbody ? Array.from(tbody.children).filter((el) => el.tagName === "TR") : [];
  };

  const readValueCell = (row) => {
    const input = row.querySelector('input[type="text"], input[type="number"]');
    if (input) return cleanText(input.value);

    const valueCell = row.querySelector("td:last-child");
    return cleanText(valueCell?.textContent);
  };

  const readAssessmentLabel = (row) => {
    const firstCell = row.querySelector("td:first-child");
    return cleanText(firstCell?.textContent);
  };

  const parseStageCell = (cell) => {
    const table = cell.querySelector(":scope > table");
    if (!table) return {};

    const result = {};
    for (const row of directRows(table)) {
      const label = readAssessmentLabel(row);
      if (!label) continue;

      const value = readValueCell(row);
      let key = label;
      let suffix = 2;

      while (Object.prototype.hasOwnProperty.call(result, key)) {
        key = label + " (" + suffix + ")";
        suffix += 1;
      }

      result[key] = value;
    }

    return result;
  };

  const findGradeTable = () => document.querySelector("#table_notas");

  const getHeaders = (table) =>
    Array.from(table.querySelectorAll(":scope > thead > tr > th")).map((th) =>
      cleanText(th.textContent)
    );

  const getStudentName = (studentCell) => {
    const dd = studentCell.querySelector("dd");
    if (!dd) return "";

    const clone = dd.cloneNode(true);
    clone.querySelectorAll("a").forEach((a) => a.remove());

    return cleanText(clone.textContent).replace(/\(\s*\)$/, "").trim();
  };

  const parseStudentRow = (row, headers) => {
    const cells = Array.from(row.children).filter((el) => el.tagName === "TD");
    const studentCell = cells[1];
    const link = studentCell?.querySelector('a[href*="/edu/aluno/"]');
    if (!link) return null;

    const matricula =
      cleanText(link.textContent) ||
      link.getAttribute("href")?.match(/\/edu\/aluno\/([^/]+)\//)?.[1] ||
      "";

    const student = {
      matricula,
      nome: getStudentName(studentCell),
      notas: {},
    };

    for (let i = 2; i < cells.length; i += 1) {
      const header = headers[i] || ("Coluna " + (i + 1));
      const stageData = parseStageCell(cells[i]);
      if (Object.keys(stageData).length) student.notas[header] = stageData;
    }

    return student;
  };

  const getPageMetadata = (table) => {
    const candidates = [
      document.querySelector("h2"),
      document.querySelector("h1"),
      table?.closest(".box")?.querySelector("h3"),
    ].filter(Boolean);

    const heading = candidates
      .map((el) => cleanText(el.textContent))
      .find((text) => text && text.toLowerCase() !== "lançamento de notas");

    return {
      title: document.title,
      heading: heading || "",
      url: location.href,
    };
  };

  const extractGradebook = () => {
    const table = findGradeTable();

    if (!table) {
      return {
        ok: false,
        diagnostics: {
          domainOk: location.hostname === "suap.ifba.edu.br",
          gradeTableFound: false,
          studentCount: 0,
          headers: [],
          writableActionsUsed: false,
        },
        metadata: getPageMetadata(null),
        students: [],
      };
    }

    const headers = getHeaders(table);
    const tbody = table.querySelector(":scope > tbody");
    const rows = tbody
      ? Array.from(tbody.children).filter((el) => el.tagName === "TR")
      : [];

    const students = rows.map((row) => parseStudentRow(row, headers)).filter(Boolean);

    return {
      ok: true,
      diagnostics: {
        domainOk: location.hostname === "suap.ifba.edu.br",
        gradeTableFound: true,
        studentCount: students.length,
        headers,
        writableActionsUsed: false,
      },
      metadata: getPageMetadata(table),
      students,
    };
  };

  globalThis.SuapGradeParser = { extractGradebook };
})();
