import { useEffect, useRef, useState } from "react";
import { downloadGradesTemplate, parseGradesCsv } from "../services/gradesImport";

export default function GradesImport({ workspace = false, targetTabId, onRunningChange = () => {} }) {
  const [catalog, setCatalog] = useState(null), [fileData, setFileData] = useState(null);
  const [stage, setStage] = useState(""), [mapping, setMapping] = useState({});
  const [plan, setPlan] = useState(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [running, setRunning] = useState(false);
  const [confirmed, setConfirmed] = useState(false), [allowReplace, setAllowReplace] = useState(false);
  const [count, setCount] = useState(0), [used, setUsed] = useState(false), [filename, setFilename] = useState("");
  const stop = useRef(false), execution = useRef(false);
  useEffect(() => () => { stop.current = true; }, []);
  const send = (type, payload) => chrome.tabs.sendMessage(targetTabId, { type, payload });
  const resetPlan = () => { setPlan(null); setConfirmed(false); setAllowReplace(false); setUsed(false); setCount(0); execution.current = false; };
  async function loadCatalog() {
    setError(""); setBusy(true); resetPlan();
    try {
      const result = await send("SUAP_TOOLS_GRADES_CATALOG");
      if (!result?.ok) throw new Error(result?.error || "Abra Registro de Notas/Conceitos no SUAP.");
      setCatalog(result);
      const first = Object.keys(result.stages)[0] || "";
      setStage(first); setMapping({});
      if (!first) throw new Error("Nenhuma avaliação está disponível para lançamento neste diário.");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (workspace && targetTabId) loadCatalog(); }, [workspace, targetTabId]);
  async function openPanel() {
    setError("");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url?.startsWith("https://suap.ifba.edu.br/")) throw new Error("Abra o diário no SUAP antes de importar notas.");
      const result = await chrome.tabs.sendMessage(tab.id, { type: "SUAP_TOOLS_OPEN_IMPORT_PANEL", tabId: tab.id, section: "grades" });
      if (!result?.ok) throw new Error(result?.error || "Não foi possível abrir a importação.");
    } catch (err) { setError(err.message); }
  }
  async function readFile(event) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    resetPlan(); setFileData(null); setError(""); setBusy(true); setFilename(file.name);
    try {
      if (!/\.csv$/i.test(file.name) || file.size > 5 * 1024 * 1024) throw new Error("Use um CSV de até 5 MB.");
      const parsed = parseGradesCsv(await file.text()); setFileData(parsed);
      setMapping(Object.fromEntries(parsed.columns.map((column) => [column, column === "Nota" ? "" : `A${column.slice(4)}`])));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function preview() {
    resetPlan(); setError(""); setBusy(true);
    try {
      const result = await send("SUAP_TOOLS_PREVIEW_GRADE_IMPORT", { rows: fileData.rows, mapping, stage });
      if (!result?.ok) throw new Error(result?.error || "Não foi possível validar as notas.");
      setPlan(result);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!confirmed || used || execution.current || (plan.replacements && !allowReplace)) return;
    execution.current = true; stop.current = false; setUsed(true); setRunning(true); onRunningChange(true); setError("");
    try {
      for (const change of plan.changes) {
        if (stop.current) break;
        const result = await send("SUAP_TOOLS_SAVE_PLANNED_GRADE", { planId: plan.planId, id: change.id, confirmed: true, allowReplace });
        if (!result?.ok || !result.saved) throw new Error(result?.error || "Resultado incerto. Confira o diário antes de continuar.");
        setCount((value) => value + 1);
      }
    } catch (err) { setError(err.message); }
    finally { setRunning(false); setConfirmed(false); onRunningChange(false); }
  }
  const assessments = Object.keys(catalog?.stages[stage] ?? {});
  return <section className="card">
    <h2>Importar notas CSV</h2>
    <p className="muted form-help">Uma avaliação: Matrícula;Nota. Várias: Matrícula;Nota1;Nota2;Nota3. Células vazias mantêm as notas atuais; zero lança 0. Use ponto ou vírgula decimal.</p>
    <div className="button-row">
      <button className="secondary" onClick={() => downloadGradesTemplate()}>Modelo de uma nota</button>
      <button className="secondary" onClick={() => downloadGradesTemplate(true)}>Modelo de várias notas</button>
      {!workspace && <button className="primary" onClick={openPanel}>Importar notas nesta página</button>}
    </div>
    {workspace && <>
      <p className="import-filename">{catalog?.title}</p>
      <button className="secondary" disabled={busy || running} onClick={loadCatalog}>Atualizar avaliações</button>
      <div className="form-grid">
        <label>Unidade<select value={stage} disabled={busy || running} onChange={(event) => { resetPlan(); setStage(event.target.value); }}>{Object.keys(catalog?.stages ?? {}).map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Arquivo CSV<input type="file" accept=".csv" disabled={busy || running || !stage} onChange={readFile} /></label>
        {fileData?.columns.map((column) => <label key={column}>{column} → Avaliação
          <select value={mapping[column] ?? ""} disabled={busy || running} onChange={(event) => { resetPlan(); setMapping({ ...mapping, [column]: event.target.value }); }}>
            <option value="">Selecione a avaliação</option>
            {assessments.map((label) => <option key={label}>{label}</option>)}
          </select>
        </label>)}
      </div>
      {filename && <p className="import-filename">{filename}</p>}
      {fileData && <button className="primary" disabled={busy || running || fileData.columns.some((column) => !assessments.includes(mapping[column]))} onClick={preview}>Validar e mostrar prévia</button>}
      {busy && <p className="muted">Consultando e validando...</p>}
      {plan && <>
        <p className="import-safety">{plan.stage}: {plan.changes.length} alteração(ões), {plan.replacements} substituição(ões), {plan.blanks} célula(s) vazia(s) preservada(s), {plan.unchanged} nota(s) já igual(is).</p>
        {!plan.changes.length && <p className="muted">Nenhuma nota precisa ser alterada.</p>}
        <div className="table-wrap"><table><thead><tr><th>Matrícula</th><th>Aluno</th><th>Avaliação</th><th>Nota atual</th><th>Nova nota</th></tr></thead><tbody>{plan.changes.map((change) => <tr key={change.id}><td>{change.matricula}</td><td>{change.nome}</td><td>{change.label}</td><td>{change.oldValue || "Não lançada"}</td><td>{change.newValue}</td></tr>)}</tbody></table></div>
        {!!plan.changes.length && <>
          {!!plan.replacements && <label className="auto-save-option"><input type="checkbox" checked={allowReplace} disabled={running || used} onChange={(event) => { setAllowReplace(event.target.checked); setConfirmed(false); }} />Autorizo substituir as {plan.replacements} notas já lançadas desta prévia.</label>}
          <label className="auto-save-option"><input type="checkbox" checked={confirmed} disabled={running || used} onChange={(event) => setConfirmed(event.target.checked)} />Confirmo enviar somente as {plan.changes.length} notas listadas acima.</label>
          <button className="primary" disabled={!confirmed || used || running || (plan.replacements > 0 && !allowReplace)} onClick={save}>Enviar notas</button>
        </>}
        {running && <button className="secondary" onClick={() => { stop.current = true; }}>Parar após a nota atual</button>}
        <p aria-live="polite" className="import-safety">{count} de {plan.changes.length} nota(s) confirmada(s).</p>
        {used && !running && <p className="muted">Confira o diário. Atualize a prévia antes de enviar as notas restantes.</p>}
      </>}
    </>}
    {error && <div className="error" role="alert">{error}</div>}
  </section>;
}
