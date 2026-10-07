const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const unitValue = (value) => clean(value).match(/(?:^|\s)([123])(?:\s|$)/)?.[1] ?? clean(value);
export const classKey = (row) => JSON.stringify([
  unitValue(row.unidade), clean(row.data), Number(row.quantidade), clean(row.conteudo),
]);

export const rowToForm = (row) => ({
  etapa: row.unidade, data: row.data, quantidade: row.quantidade,
  conteudo: row.conteudo, formato: { "": "", "Síncrona": "1", "Assíncrona": "2" }[row.formato],
});

export function batchDelay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Interrompido", "AbortError"));
    const abort = () => { clearTimeout(timer); reject(new DOMException("Interrompido", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}

// Only OPEN, GET, EXTRACT and FILL messages are used. Saving remains native/manual.
export async function fillClassesBatch({ rows, send, signal, onProgress, wait = batchDelay }) {
  const check = () => { if (signal.aborted) throw new DOMException("Interrompido", "AbortError"); };
  const request = async (type, payload) => { check(); const result = await send(type, payload); check(); return result; };
  const initial = await request("SUAP_TOOLS_EXTRACT_CLASSES");
  if (!initial?.ok || !initial.metadata?.addClassUrl) throw new Error("Abra Registro de Aulas no diário escolhido e recarregue a página do SUAP.");
  const diary = initial.metadata.addClassUrl;
  const unit = initial.metadata.unit?.value;
  if (!unit || rows.some((row) => row.unidade !== unit)) throw new Error("O lote deve conter somente aulas da unidade selecionada no SUAP. Selecione a unidade correspondente antes de iniciar.");
  if (rows.some((row) => row.errors?.length)) throw new Error("Corrija todas as linhas inválidas antes de preencher.");
  if ((await request("SUAP_TOOLS_GET_CLASS_FORM"))?.ok) throw new Error("Já existe um formulário aberto. Revise e salve ou feche esse formulário antes de iniciar o lote.");
  if (rows.some((row) => initial.classes.some((existing) => classKey(existing) === classKey(row)))) throw new Error("Uma aula deste lote já aparece no diário (mesma unidade, data, quantidade e conteúdo). Remova-a do arquivo para evitar duplicação.");
  if (new Set(rows.map(classKey)).size !== rows.length) throw new Error("O arquivo contém aulas duplicadas. Remova as repetições antes de iniciar.");
  for (let index = 0; index < rows.length; index++) {
    check();
    const row = rows[index];
    const before = await request("SUAP_TOOLS_EXTRACT_CLASSES");
    if (!before?.ok || before.metadata?.addClassUrl !== diary || before.metadata?.unit?.value !== unit) throw new Error("O diário ou a unidade mudou. O preenchimento foi interrompido.");
    if (before.classes.some((item) => classKey(item) === classKey(row))) throw new Error("A aula atual já aparece no diário. Confira os registros antes de continuar para evitar duplicação.");
    const existingIds = new Set(before.classes.map((item) => item.editUrl).filter(Boolean));
    onProgress({ index, state: "opening", row });
    const opened = await request("SUAP_TOOLS_OPEN_CLASS_FORM");
    if (!opened?.ok) throw new Error(opened?.error || "Não foi possível abrir Adicionar Aula.");
    let form;
    for (let attempt = 0; attempt < 40; attempt++) {
      form = await request("SUAP_TOOLS_GET_CLASS_FORM");
      if (form?.ok) break;
      await wait(500, signal);
    }
    if (!form?.ok) throw new Error("O formulário não abriu. Verifique a página do SUAP e tente novamente.");
    // An existing nonempty form must never be overwritten by this batch.
    if (clean(form.fields?.conteudo)) throw new Error("O formulário já contém conteúdo. Revise-o antes de continuar.");
    const filled = await request("SUAP_TOOLS_FILL_CLASS_FORM", rowToForm(row));
    if (!filled?.ok) throw new Error(filled?.error || "Não foi possível preencher a aula.");
    const actual = await request("SUAP_TOOLS_GET_CLASS_FORM");
    const expected = rowToForm(row);
    if (!actual?.ok || Object.entries(expected).some(([field, value]) => clean(actual.fields?.[field]) !== clean(value))) throw new Error("Os campos do formulário não correspondem à aula importada. Confira o formulário; o lote foi interrompido.");
    onProgress({ index, state: "waiting-save", row });
    // Observe the actual new record, not just the disappearance of the dialog.
    let saved = false;
    let failures = 0;
    for (let attempt = 0; attempt < 1800; attempt++) {
      await wait(1000, signal);
      let snapshot;
      try { snapshot = await request("SUAP_TOOLS_EXTRACT_CLASSES"); }
      catch (error) {
        if (signal.aborted) throw error;
        // Navigation after manual save can briefly disconnect the content script.
        if (++failures < 10) continue;
        throw error;
      }
      failures = 0;
      if (snapshot?.metadata?.addClassUrl && (snapshot.metadata.addClassUrl !== diary || snapshot.metadata.unit?.value !== unit)) throw new Error("O diário ou a unidade mudou. O preenchimento foi interrompido.");
      if (!snapshot?.ok) continue;
      const recordFound = snapshot.classes.some((item) => item.editUrl && !existingIds.has(item.editUrl) && classKey(item) === classKey(row));
      if (recordFound) {
        if ((await request("SUAP_TOOLS_GET_CLASS_FORM"))?.ok) continue;
        saved = true;
        break;
      }
    }
    if (!saved) throw new Error("Não foi possível confirmar o salvamento em 30 minutos. Confira o diário antes de continuar.");
    onProgress({ index, state: "saved", row });
  }
  onProgress({ index: rows.length, state: "complete" });
}
