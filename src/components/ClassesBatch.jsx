import { useEffect, useRef, useState } from "react";

export default function ClassesBatch({ rows, targetTabId, onRunningChange, externalBusy = false }) {
  const stop = useRef(false);
  useEffect(() => () => { stop.current = true; }, []);
  const [autoSave, setAutoSave] = useState(false);
  const [running, setRunning] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState("");
  const [diary, setDiary] = useState(null);
  const [uncertain, setUncertain] = useState(false);
  useEffect(() => {
    if (!targetTabId) return;
    chrome.tabs.sendMessage(targetTabId, { type: "SUAP_TOOLS_EXTRACT_CLASSES" })
      .then((result) => setDiary(result?.metadata ?? null)).catch((err) => setError(err.message));
  }, [targetTabId]);
  async function register() {
    if (running || uncertain || externalBusy) return;
    stop.current = false;
    setRunning(true); onRunningChange(true); setError("");
    let current = savedCount;
    let received = true;
    try {
      do {
        const row = rows[current];
        received = false;
        const result = await chrome.tabs.sendMessage(targetTabId, {
          type: "SUAP_TOOLS_REGISTER_CLASS", payload: { confirmed: true, row, diaryUrl: diary.url },
        });
        received = true;
        if (!result?.ok || !result.saved) {
          setUncertain(result?.attempted !== false);
          throw new Error(result?.error || "Não foi possível confirmar o cadastro. Confira o diário.");
        }
        setSavedCount(++current);
      } while (autoSave && !stop.current && current < rows.length);
    } catch (err) { if (!received) setUncertain(true); setError(err.message); }
    finally { setRunning(false); onRunningChange(false); }
  }
  const duplicate = new Set(rows.map((row) => JSON.stringify([row.unidade, row.data, row.quantidade, row.conteudo.trim()]))).size !== rows.length;
  const wrongUnit = diary?.unit?.value && rows.some((row) => row.unidade !== diary.unit.value);
  const invalid = rows.some((row) => row.errors.length) || duplicate || wrongUnit;
  return <section className="batch-panel">
    <h3>Cadastrar no diário atual</h3>
    <p className="muted form-help">{diary?.title} · {diary?.unit?.label || "Abra Registro de Aulas no diário desejado"}</p>
    <label className="auto-save-option">
      <input type="checkbox" checked={autoSave} onChange={(event) => setAutoSave(event.target.checked)} disabled={running || externalBusy} />
      Enviar e salvar automaticamente todas as aulas deste lote
    </label>
    <p className="muted form-help">{autoSave ? "Ao iniciar, todas as aulas serão cadastradas em sequência, com confirmação de cada registro." : "Desmarcado: você confirma o cadastro de uma aula por vez aqui no painel."}</p>
    {duplicate && <div className="error">Há aulas repetidas no arquivo. Remova as duplicações antes de cadastrar.</div>}
    {wrongUnit && <div className="error">As aulas devem pertencer à unidade selecionada no diário atual.</div>}
    <button className="primary" onClick={register} disabled={running || externalBusy || invalid || !diary?.url || !rows.length || savedCount === rows.length || uncertain}>
      {running ? "Cadastrando..." : autoSave ? "Cadastrar todas as aulas" : "Cadastrar próxima aula"}
    </button>
    {running && <button className="secondary" onClick={() => { stop.current = true; }}>Parar após a aula atual</button>}
    <div aria-live="polite">
      <p className="import-safety">{savedCount} de {rows.length} cadastro(s) confirmado(s).</p>
      {!running && rows[savedCount] && <p className="muted">Próxima aula: {rows[savedCount].data} · linha {rows[savedCount].line}</p>}
      {savedCount === rows.length && <p>Todas as aulas foram cadastradas.</p>}
      {error && <div className="error" role="alert">{error}</div>}
    </div>
    <p className="muted import-safety">O cadastro usa sua sessão atual. Após concluir, feche o painel e atualize a lista de aulas do SUAP.</p>
  </section>;
}
