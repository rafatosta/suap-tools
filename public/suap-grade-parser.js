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

  const importPlans = new Map();
  let savingGrade = false;
  const normalizedGrade = (value) => cleanText(value).replace(",", ".");
  const equalGrade = (a, b) => normalizedGrade(a) === "" || normalizedGrade(b) === ""
    ? normalizedGrade(a) === normalizedGrade(b) : Number(normalizedGrade(a)) === Number(normalizedGrade(b));
  const readImportCatalog = (root = document) => {
    const table = root.querySelector("#table_notas");
    if (!table) throw new Error("Abra Registro de Notas/Conceitos no diário antes de importar.");
    const headers = getHeaders(table);
    const students = [], stages = {};
    const seen = new Set(), fieldIds = new Set();
    for (const row of directRows(table)) {
      const student = parseStudentRow(row, headers);
      if (!student) continue;
      if (seen.has(student.matricula)) throw new Error("Há matrículas duplicadas na página. Confira o diário.");
      seen.add(student.matricula);
      const cells = Array.from(row.children).filter((cell) => cell.tagName === "TD");
      const fields = [];
      for (let i = 2; i < cells.length; i++) {
        const stage = headers[i];
        if (!/^Unidade [123]$/.test(stage)) continue;
        for (const assessment of directRows(cells[i].querySelector(":scope > table"))) {
          const input = assessment.querySelector('input[name]');
          if (!input || input.disabled || input.readOnly || !/^\d+;\d+;\d+$/.test(input.name)) continue;
          const match = (input.getAttribute("onblur") || "").match(/^\s*validar_nota\(\s*this\s*,\s*(\d+)\s*,\s*(\d+(?:\.\d+)?)\s*\)\s*;?\s*$/);
          if (!match || stage !== `Unidade ${input.name.split(";")[0]}`) continue;
          const label = readAssessmentLabel(assessment);
          if (!label) continue;
          if (fieldIds.has(match[1])) throw new Error("Há identificadores de avaliação duplicados na página. Confira o diário.");
          fieldIds.add(match[1]);
          fields.push({ stage, label, name: input.name, id: match[1], max: Number(match[2]), value: cleanText(input.value) });
          if (!row.classList.contains("disabled")) {
            stages[stage] ??= {};
            stages[stage][label] = Math.max(stages[stage][label] ?? 0, Number(match[2]));
          }
        }
      }
      students.push({ matricula: student.matricula, nome: student.nome, active: !row.classList.contains("disabled"), fields });
    }
    return { students, stages };
  };
  const getImportCatalog = () => {
    try { return { ok: true, ...readImportCatalog(), title: document.title, diaryUrl: location.href }; }
    catch (error) { return { ok: false, error: error.message }; }
  };
  const readImportPage = async (url) => {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", redirect: "error" });
    if (!response.ok) throw new Error("Não foi possível consultar as notas no SUAP. Confira sua sessão.");
    const doc = new DOMParser().parseFromString(await response.text(), "text/html");
    if (doc.querySelector('input[name="password"]')) throw new Error("Sua sessão expirou. Entre novamente no SUAP.");
    return readImportCatalog(doc);
  };
  const previewGradeImport = async (payload = {}) => {
    try {
      if (!Array.isArray(payload.rows) || !payload.rows.length || !payload.mapping || !/^Unidade [123]$/.test(payload.stage)) throw new Error("Informe o arquivo, a unidade e as avaliações de destino.");
      const diaryUrl = location.href;
      const notesUrl = new URL(diaryUrl); notesUrl.searchParams.set("tab", "notas"); notesUrl.hash = "";
      const catalog = await readImportPage(notesUrl.href);
      const entries = Object.entries(payload.mapping);
      if (!entries.length || new Set(entries.map(([, label]) => label)).size !== entries.length || entries.some(([, label]) => catalog.stages[payload.stage]?.[label] === undefined)) throw new Error("Cada coluna deve apontar para uma avaliação editável diferente da unidade escolhida.");
      const changes = [], seen = new Set();
      let blanks = 0, unchanged = 0;
      for (const row of payload.rows) {
        const matricula = String(row.matricula ?? "");
        if (!matricula || seen.has(matricula)) throw new Error("Há matrícula vazia ou repetida no arquivo.");
        seen.add(matricula);
        const student = catalog.students.find((item) => item.matricula === matricula);
        if (!student || !student.active) throw new Error(`Matrícula ${matricula}: aluno não encontrado ou inativo no diário.`);
        if (!row.grades || Object.keys(row.grades).length !== entries.length || entries.some(([column]) => !Object.hasOwn(row.grades, column))) throw new Error("As colunas do arquivo e as avaliações selecionadas não correspondem.");
        for (const [column, label] of entries) {
          const value = normalizedGrade(row.grades[column]);
          if (value === "") { blanks++; continue; }
          const fields = student.fields.filter((field) => field.stage === payload.stage && field.label === label);
          if (fields.length !== 1) throw new Error(`Matrícula ${matricula}: ${label} não está disponível para lançamento.`);
          const field = fields[0];
          if (!/^\d+(?:\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) > field.max) throw new Error(`Matrícula ${matricula}: ${label} deve estar entre 0 e ${field.max}.`);
          if (equalGrade(field.value, value)) { unchanged++; continue; }
          changes.push({ matricula, nome: student.nome, stage: payload.stage, label, name: field.name, id: field.id, max: field.max, oldValue: field.value, newValue: value, replacing: field.value !== "" });
        }
      }
      for (const [id, plan] of importPlans) if (plan.expires < Date.now()) importPlans.delete(id);
      const planId = crypto.randomUUID();
      importPlans.set(planId, { diaryUrl, notesUrl: notesUrl.href, changes, remaining: new Set(changes.map((change) => change.id)), attempted: new Set(), expires: Date.now() + 10 * 60 * 1000 });
      return { ok: true, planId, title: document.title, stage: payload.stage, changes, blanks, unchanged, replacements: changes.filter((change) => change.replacing).length };
    } catch (error) { return { ok: false, error: error.message }; }
  };
  const syncConfirmedGrade = (change) => {
    const input = Array.from(document.querySelectorAll("#table_notas input[name]"))
      .find((input) => input.name === change.name && (input.getAttribute("onblur") || "").match(/validar_nota\(\s*this\s*,\s*(\d+)/)?.[1] === change.id);
    if (!input || input.disabled || input.readOnly) return;
    input.value = change.newValue;
    input.defaultValue = change.newValue;
    input.oldvalue = change.newValue;
    // No blur/change event: those handlers would send the grade a second time.
  };
  const savePlannedGrade = async (payload = {}) => {
    const plan = importPlans.get(payload.planId);
    const change = plan?.changes.find((change) => change.id === payload.id);
    if (payload.confirmed !== true || !plan || plan.expires < Date.now() || !change || !plan.remaining.has(payload.id)) return { ok: false, attempted: false, error: "Atualize a prévia e confirme o envio das notas." };
    if (change.replacing && payload.allowReplace !== true) return { ok: false, attempted: false, error: "Autorize a substituição das notas já lançadas." };
    if (plan.attempted.has(change.id)) return { ok: false, attempted: false, error: "Esta nota já recebeu uma tentativa de envio. Confira o diário e prepare uma nova prévia." };
    if (savingGrade) return { ok: false, attempted: false, error: "Há uma nota sendo enviada. Aguarde." };
    savingGrade = true;
    let attempted = false;
    const findField = (catalog) => {
      const student = catalog.students.find((student) => student.matricula === change.matricula);
      if (!student?.active) return null;
      return student.fields.find((field) => field.id === change.id && field.name === change.name && field.stage === change.stage && field.label === change.label);
    };
    try {
      if (location.href !== plan.diaryUrl) throw new Error("A página do diário mudou. O envio foi interrompido.");
      const current = findField(await readImportPage(plan.notesUrl));
      if (!current || Number(change.newValue) > current.max) throw new Error("A avaliação não está mais disponível para essa nota.");
      if (equalGrade(current.value, change.newValue)) { syncConfirmedGrade(change); plan.remaining.delete(change.id); return { ok: true, saved: true, alreadySaved: true }; }
      if (!equalGrade(current.value, change.oldValue)) throw new Error("A nota atual mudou desde a prévia. Confira o diário antes de continuar.");
      if (location.href !== plan.diaryUrl) throw new Error("O diário mudou antes do envio.");
      attempted = true;
      plan.attempted.add(change.id);
      // This is the per-grade save endpoint used by validar_nota in SUAP.
      const endpoint = new URL(`/edu/registrar_nota_ajax/${change.id}/${Number(change.newValue)}/`, location.origin);
      const response = await fetch(endpoint.href, { method: "GET", credentials: "same-origin", cache: "no-store", redirect: "error" });
      if (!response.ok || (await response.text()).trim() !== "OK") throw new Error("O SUAP não confirmou o envio da nota. Confira o diário; não haverá reenvio automático.");
      for (let attempt = 0; attempt < 5; attempt++) {
        const saved = findField(await readImportPage(plan.notesUrl));
        if (saved && equalGrade(saved.value, change.newValue)) { syncConfirmedGrade(change); plan.remaining.delete(change.id); return { ok: true, saved: true }; }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      throw new Error("A nota foi enviada, mas não foi confirmada na leitura do diário. Confira antes de tentar novamente.");
    } catch (error) { return { ok: false, attempted, error: error.message }; }
    finally { savingGrade = false; }
  };

  globalThis.SuapGradeParser = { extractGradebook, getImportCatalog, previewGradeImport, savePlannedGrade };
})();
