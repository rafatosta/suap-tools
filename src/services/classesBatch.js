const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const unitValue = (value) => clean(value).match(/(?:^|\s)([123])(?:\s|$)/)?.[1] ?? clean(value);
export const classKey = (row) => JSON.stringify([
  unitValue(row.unidade), clean(row.data), Number(row.quantidade), clean(row.conteudo),
]);

export const rowToForm = (row) => ({
  etapa: row.unidade, data: row.data, quantidade: row.quantidade,
  conteudo: row.conteudo, formato: { "": "", "Síncrona": "1", "Assíncrona": "2" }[row.formato],
});

// The Add Class URL can change query parameters while opening/closing a modal.
export function diaryKey(metadata) {
  if (!metadata?.addClassUrl) return "";
  const url = new URL(metadata.addClassUrl, "https://suap.ifba.edu.br");
  const id = url.pathname.match(/\/edu\/adicionar_aula_diario\/(\d+)(?:\/|$)/)?.[1];
  return id ? `${url.origin}/diario/${id}` : url.origin + url.pathname.replace(/\/$/, "");
}
function sameForm(form, expected) {
  return form?.ok && !form.editing && Object.entries(expected)
    .every(([field, value]) => clean(form.fields?.[field]) === clean(value));
}
function assertDiary(snapshot, key, unit) {
  const currentKey = diaryKey(snapshot?.metadata);
  const currentUnit = clean(snapshot?.metadata?.unit?.value);
  if ((currentKey && currentKey !== key) || (currentUnit && currentUnit !== unit)) {
    throw new Error("O diário ou a unidade mudou. O preenchimento foi interrompido.");
  }
}

export function batchDelay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Interrompido", "AbortError"));
    const abort = () => { clearTimeout(timer); reject(new DOMException("Interrompido", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}

// Automatic submission is opt-in and is never retried after an uncertain response.
export async function fillClassesBatch({ rows, send, signal, onProgress, wait = batchDelay, autoSave = false }) {
  const check = () => { if (signal.aborted) throw new DOMException("Interrompido", "AbortError"); };
  const request = async (type, payload) => { check(); const result = await send(type, payload); check(); return result; };
  const initial = await request("SUAP_TOOLS_EXTRACT_CLASSES");
  if (!initial?.ok || !initial.metadata?.addClassUrl) throw new Error("Abra Registro de Aulas no diário escolhido e recarregue a página do SUAP.");
  const diary = diaryKey(initial.metadata);
  const unit = clean(initial.metadata.unit?.value);
  if (!unit || rows.some((row) => row.unidade !== unit)) throw new Error("O lote deve conter somente aulas da unidade selecionada no SUAP. Selecione a unidade correspondente antes de iniciar.");
  if (rows.some((row) => row.errors?.length)) throw new Error("Corrija todas as linhas inválidas antes de preencher.");
  const existingForm = await request("SUAP_TOOLS_GET_CLASS_FORM");
  if (existingForm?.ok && (existingForm.editing || (clean(existingForm.fields?.conteudo) && !sameForm(existingForm, rowToForm(rows[0]))))) {
    throw new Error("O formulário aberto contém outra aula. Revise e salve ou feche esse formulário antes de iniciar o lote.");
  }
  if (rows.some((row) => initial.classes.some((existing) => classKey(existing) === classKey(row)))) throw new Error("Uma aula deste lote já aparece no diário (mesma unidade, data, quantidade e conteúdo). Remova-a do arquivo para evitar duplicação.");
  if (new Set(rows.map(classKey)).size !== rows.length) throw new Error("O arquivo contém aulas duplicadas. Remova as repetições antes de iniciar.");
  for (let index = 0; index < rows.length; index++) {
    check();
    const row = rows[index];
    const before = await request("SUAP_TOOLS_EXTRACT_CLASSES");
    assertDiary(before, diary, unit);
    if (!before?.ok || !diaryKey(before.metadata)) throw new Error("Aguarde o diário terminar de carregar antes de continuar.");
    if (before.classes.some((item) => classKey(item) === classKey(row))) throw new Error("A aula atual já aparece no diário. Confira os registros antes de continuar para evitar duplicação.");
    const existingIds = new Set(before.classes.map((item) => item.editUrl).filter(Boolean));
    onProgress({ index, state: "opening", row });
    let form = index === 0 ? existingForm : await request("SUAP_TOOLS_GET_CLASS_FORM");
    if (!form?.ok) {
      const opened = await request("SUAP_TOOLS_OPEN_CLASS_FORM");
      if (!opened?.ok) throw new Error(opened?.error || "Não foi possível abrir Adicionar Aula.");
      for (let attempt = 0; attempt < 40; attempt++) {
        form = await request("SUAP_TOOLS_GET_CLASS_FORM");
        if (form?.ok) break;
        await wait(500, signal);
      }
    }
    if (!form?.ok) throw new Error("O formulário não abriu. Verifique a página do SUAP e tente novamente.");
    await wait(500, signal);
    form = await request("SUAP_TOOLS_GET_CLASS_FORM");
    if (!form?.ok) throw new Error("O formulário fechou durante a abertura. Tente iniciar novamente.");
    assertDiary(await request("SUAP_TOOLS_EXTRACT_CLASSES"), diary, unit);
    const expected = rowToForm(row);
    if (form.editing || (clean(form.fields?.conteudo) && !sameForm(form, expected))) {
      throw new Error("O formulário contém outra aula. Revise-o antes de continuar.");
    }
    if (!sameForm(form, expected)) {
      const filled = await request("SUAP_TOOLS_FILL_CLASS_FORM", { ...expected, mode: "batch" });
      if (!filled?.ok) throw new Error(filled?.error || "Não foi possível preencher a aula.");
    }
    onProgress({ index, state: "verifying", row });
    // Save can happen before this post-fill check. A closed/cleared form is not
    // a field mismatch if the new class already exists in the diary.
    const newRecord = (snapshot) => snapshot?.ok && snapshot.classes.some((item) =>
      item.editUrl && !existingIds.has(item.editUrl) && classKey(item) === classKey(row));
    let saved = false;
    let verified = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      await wait(attempt === 0 ? 1000 : 500, signal);
      let actual;
      let snapshot;
      try {
        actual = await request("SUAP_TOOLS_GET_CLASS_FORM");
        snapshot = await request("SUAP_TOOLS_EXTRACT_CLASSES");
      } catch (error) {
        if (signal.aborted || attempt === 9) throw error;
        continue; // Manual saving may briefly navigate/reload the page.
      }
      assertDiary(snapshot, diary, unit);
      if (newRecord(snapshot) && !actual?.ok) { saved = true; break; }
      if (sameForm(actual, expected)) { verified = true; break; }
    }
    if (saved) { onProgress({ index, state: "saved", row }); continue; }
    if (!verified) throw new Error("Não foi possível confirmar o preenchimento ou o salvamento da aula. Confira o registro no diário antes de continuar.");
    let uncertainSubmission = false;
    if (autoSave === true) {
      assertDiary(await request("SUAP_TOOLS_EXTRACT_CLASSES"), diary, unit);
      onProgress({ index, state: "submitting", row });
      let submission;
      try {
        submission = await request("SUAP_TOOLS_SUBMIT_CLASS_FORM", {
          confirmedAutoSave: true, expected, diary,
        });
      } catch (error) {
        if (signal.aborted) throw error;
        // A successful navigation can close the message channel. Observe the
        // resulting record, never repeat the Save click on an unknown outcome.
        uncertainSubmission = true;
      }
      if (!uncertainSubmission && !submission?.ok) throw new Error(submission?.error || "O SUAP não confirmou a tentativa de envio. Confira o diário antes de continuar.");
    }
    onProgress({ index, state: autoSave === true ? "waiting-confirmation" : "waiting-save", row });
    // Observe the actual new record, not just the disappearance of the dialog.
    let failures = 0;
    const maxAttempts = autoSave === true ? 60 : 1800;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
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
      assertDiary(snapshot, diary, unit);
      if (!snapshot?.ok) continue;
      const recordFound = newRecord(snapshot);
      if (recordFound) {
        if ((await request("SUAP_TOOLS_GET_CLASS_FORM"))?.ok) continue;
        saved = true;
        break;
      }
      if (autoSave === true) {
        const state = await request("SUAP_TOOLS_GET_CLASS_FORM");
        if (state?.errors?.length) throw new Error("O SUAP recusou a aula: " + state.errors.join(" "));
      }
    }
    if (!saved) throw new Error(autoSave === true
      ? "O envio foi solicitado, mas o registro não foi confirmado em 60 segundos. Confira o diário antes de continuar; a aula não será reenviada automaticamente."
      : "Não foi possível confirmar o salvamento em 30 minutos. Confira o diário antes de continuar.");
    onProgress({ index, state: "saved", row });
  }
  onProgress({ index: rows.length, state: "complete" });
}
