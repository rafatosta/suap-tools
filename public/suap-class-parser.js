(() => {
  const cleanText = (value) =>
    String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const getCurrentUnit = () => {
    // Read the diary filter, never a select inserted by the Add Class dialog.
    const selects = Array.from(document.querySelectorAll('.action-bar.search-and-filters select'))
      .filter((select) => !select.closest('#aula_form, [role="dialog"], .modal'));
    for (const select of selects) {
      const option = select.options[select.selectedIndex];
      const label = cleanText(option?.textContent);
      const namedUnit = /etapa|unidade/i.test(select.name || select.id || "");
      const labelledUnit = /unidade|etapa/i.test(label);
      if ((namedUnit || labelledUnit) && /^[123]$/.test(String(option?.value))) {
        return { value: String(option.value), label, source: "page" };
      }
    }
    const titles = Array.from(document.querySelectorAll('.box > h3'))
      .filter((title) => !title.closest('#aula_form, [role="dialog"], .modal'));
    for (const title of titles) {
      const match = cleanText(title.textContent).match(/Unidade\s+([123])(?:\D|$)/i);
      if (match) return { value: match[1], label: `Unidade ${match[1]}`, source: "page" };
    }
    return { value: "", label: "", source: "unknown" };
  };

  const getAddClassUrl = () => {
    const link = Array.from(document.querySelectorAll('a[href*="/edu/adicionar_aula_diario/"]'))
      .find((a) => cleanText(a.textContent).toLowerCase().includes("adicionar aula"));

    return link?.href || "";
  };

  const parseClasses = () => {
    const table = document.querySelector("#table_registro_aula");
    if (!table) return [];

    const rows = Array.from(table.querySelectorAll(":scope > tbody > tr"));

    return rows.map((row) => {
      const cells = Array.from(row.children).filter((el) => el.tagName === "TD");

      const editLink = row.querySelector(
        'a[href*="/edu/adicionar_aula_diario/"][title="Editar"]'
      );
      const deleteLink = row.querySelector(
        'a[href*="/comum/excluir/edu/aula/"]'
      );

      return {
        unidade: cleanText(cells[1]?.textContent),
        quantidade: cleanText(cells[2]?.textContent),
        data: cleanText(cells[3]?.textContent),
        professor: cleanText(cells[4]?.textContent),
        conteudo: cleanText(cells[5]?.textContent),
        editUrl: editLink?.href || "",
        deleteUrl: deleteLink?.href || "",
      };
    });
  };

  const extractClasses = () => {
    const currentUnit = getCurrentUnit();
    const addUrl = getAddClassUrl();
    const classes = parseClasses();

    return {
      ok: Boolean(addUrl || document.querySelector('[data-tab="aulas"]')),
      diagnostics: {
        domainOk: location.hostname === "suap.ifba.edu.br",
        classesTabFound: Boolean(document.querySelector('[data-tab="aulas"]')),
        classTableFound: Boolean(document.querySelector("#table_registro_aula")),
        classCount: classes.length,
        addClassAvailable: Boolean(addUrl),
        writableActionsUsed: false,
      },
      metadata: {
        title: document.title,
        url: location.href,
        unit: currentUnit,
        addClassUrl: addUrl,
      },
      classes,
    };
  };

  const findClassForm = () => Array.from(document.querySelectorAll("#aula_form"))
    .find((form) => form.isConnected && form.getClientRects().length > 0 &&
      getComputedStyle(form).visibility !== "hidden" &&
      ["#id_quantidade", "#id_etapa", "#id_data", "#id_formato", "#id_conteudo"]
        .every((selector) => form.querySelector(selector)));

  const getClassFormState = () => {
    const form = findClassForm();

    if (!form) {
      return {
        ok: false,
        error: "O formulário 'Adicionar Aula' não está aberto.",
      };
    }

    const get = (selector) => form.querySelector(selector);

    return {
      ok: true,
      errors: Array.from(form.querySelectorAll(".errorlist, .errornote"))
        .map((element) => cleanText(element.textContent)).filter(Boolean),
      editing: Array.from(document.querySelectorAll('a[title="Editar"]'))
        .some((link) => link.href === form.action),
      fields: {
        professor_diario: get("#id_professor_diario")?.value ?? "",
        quantidade: get("#id_quantidade")?.value ?? "",
        etapa: get("#id_etapa")?.value ?? "",
        data: get("#id_data")?.value ?? "",
        formato: get("#id_formato")?.value ?? "",
        conteudo: get("#id_conteudo")?.value ?? "",
      },
    };
  };

  const setNativeValue = (element, value, notify = true) => {
    if (!element) return false;

    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : element instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;

    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    descriptor?.set?.call(element, String(value ?? ""));

    // Batch filling writes native form values without triggering SUAP's reload/reset
    // handlers. The user still submits the original form through its Save button.
    if (notify) {
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }

    return true;
  };

  const fillClassForm = (payload) => {
    const form = findClassForm();

    if (!form) {
      return {
        ok: false,
        error:
          "Abra o diálogo nativo 'Adicionar Aula' no SUAP e tente novamente.",
      };
    }

    const selectors = {
      quantidade: "#id_quantidade", etapa: "#id_etapa", data: "#id_data",
      formato: "#id_formato", conteudo: "#id_conteudo",
    };
    for (const [key, selector] of Object.entries(selectors)) {
      if (payload[key] === undefined || payload[key] === null) continue;
      const element = form.querySelector(selector);
      if (!element || element.disabled || element.readOnly) return { ok: false, error: `Campo indisponível no formulário: ${key}.` };
      if (element instanceof HTMLSelectElement && !Array.from(element.options).some((option) => option.value === String(payload[key]) && !option.disabled)) {
        return { ok: false, error: `Valor não disponível no SUAP para ${key}.` };
      }
    }

    const applied = [];

    const apply = (selector, key) => {
      if (payload[key] === undefined || payload[key] === null) return;
      const element = form.querySelector(selector);
      if (setNativeValue(element, payload[key], payload.mode !== "batch")) applied.push(key);
    };

    apply("#id_quantidade", "quantidade");
    apply("#id_etapa", "etapa");
    apply("#id_data", "data");
    apply("#id_formato", "formato");
    apply("#id_conteudo", "conteudo");

    return {
      ok: true,
      applied,
      submitted: false,
      message:
        "Campos preenchidos. O formulário NÃO foi enviado; revise e clique em Salvar manualmente no SUAP.",
    };
  };

  const submittedForms = new WeakMap();
  const submitClassForm = (payload = {}) => {
    if (payload.confirmedAutoSave !== true) return { ok: false, error: "O envio automático não foi autorizado para este lote." };
    const form = findClassForm();
    const state = getClassFormState();
    if (!form || !state.ok || state.editing) return { ok: false, error: "Não há um formulário de nova aula disponível para envio." };
    const keys = ["quantidade", "etapa", "data", "formato", "conteudo"];
    const expected = payload.expected;
    if (!expected || keys.some((key) => expected[key] === undefined || cleanText(state.fields[key]) !== cleanText(expected[key]))) {
      return { ok: false, error: "A aula mudou antes do envio. Confira o formulário no SUAP." };
    }
    const url = new URL(getAddClassUrl() || location.href, location.href);
    const id = url.pathname.match(/\/edu\/adicionar_aula_diario\/(\d+)(?:\/|$)/)?.[1];
    if (!id || payload.diary !== `${url.origin}/diario/${id}`) return { ok: false, error: "O diário de destino mudou antes do envio." };
    if (state.errors.length) return { ok: false, error: "O SUAP indica erros no formulário: " + state.errors.join(" ") };
    if (!form.checkValidity()) {
      form.reportValidity();
      return { ok: false, error: "O formulário possui campos inválidos. Confira os avisos do SUAP." };
    }
    const save = Array.from(form.querySelectorAll('button, input[type="submit"]'))
      .find((button) => button.type === "submit" && !button.disabled &&
        /^(salvar|salvar aula)$/i.test(cleanText(button.textContent || button.value)));
    if (!save) return { ok: false, error: "O botão Salvar não foi encontrado ou está indisponível." };
    const fingerprint = JSON.stringify(keys.map((key) => cleanText(expected[key])));
    if (submittedForms.get(form) === fingerprint) return { ok: false, error: "Esta aula já recebeu uma tentativa de envio. Confira o diário antes de tentar novamente." };
    submittedForms.set(form, fingerprint);
    // Use the original Save action, preserving native validation, submit handlers,
    // professor selection and the CSRF token. Never call form.submit().
    save.click();
    return { ok: true, submitted: true, message: "Envio solicitado. Aguardando confirmação do registro no diário." };
  };

  const openClassForm = () => {
    const link = Array.from(
      document.querySelectorAll('a[href*="/edu/adicionar_aula_diario/"]')
    ).find((a) => cleanText(a.textContent).toLowerCase().includes("adicionar aula"));

    if (!link) {
      return { ok: false, error: "Botão 'Adicionar Aula' não encontrado nesta página." };
    }

    link.click();
    return { ok: true, opened: true };
  };

  globalThis.SuapClassParser = {
    extractClasses,
    getClassFormState,
    fillClassForm,
    openClassForm,
    submitClassForm,
  };
})();
