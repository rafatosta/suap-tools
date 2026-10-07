import { useEffect, useRef, useState } from "react";
import { fillClassesBatch } from "../services/classesBatch";

export default function ClassesBatch({ rows, onRunningChange }) {
  const [tabs, setTabs] = useState([]);
  const [tabId, setTabId] = useState("");
  const [running, setRunning] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!running) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);
  async function loadTabs() {
    setError("");
    try {
      const found = await chrome.tabs.query({ url: "https://suap.ifba.edu.br/*" });
      setTabs(found);
      setTabId(found.length === 1 ? String(found[0].id) : "");
      if (!found.length) setError("Abra o diário no SUAP em uma aba deste navegador.");
    } catch (err) { setError(err.message); }
  }
  async function start() {
    if (controller.current && !controller.current.signal.aborted) return;
    const abort = new AbortController();
    controller.current = abort;
    setError(""); setRunning(true); onRunningChange(true);
    const offset = savedCount;
    const selected = Number(tabId);
    try {
      await fillClassesBatch({ rows: rows.slice(offset), signal: abort.signal,
        send: async (type, payload) => {
          const tab = await chrome.tabs.get(selected);
          if (!tab.url?.startsWith("https://suap.ifba.edu.br/")) throw new Error("A aba escolhida saiu do SUAP ou foi fechada.");
          return chrome.tabs.sendMessage(selected, { type, payload });
        },
        onProgress: (next) => {
          setProgress({ ...next, index: next.index + offset });
          if (next.state === "saved") setSavedCount(next.index + offset + 1);
        },
      });
    } catch (err) {
      setError(err.name === "AbortError" ? "Lote interrompido. Confira a aula atual no SUAP antes de continuar; o formulário permanece sob seu controle." : err.message);
    } finally { controller.current = null; setRunning(false); onRunningChange(false); }
  }
  const invalid = rows.some((row) => row.errors.length);
  const labels = { opening: "Abrindo formulário", verifying: "Conferindo preenchimento ou salvamento", "waiting-save": "Preenchida: revise e clique em Salvar no SUAP", saved: "Salvamento confirmado", complete: "Todas as aulas do lote foram preenchidas e salvas manualmente" };
  return <section className="batch-panel">
    <h3>Preencher todas as aulas</h3>
    <p className="muted form-help">A extensão abre e preenche uma aula por vez. Você revisa e clica em Salvar no SUAP. Após confirmar o registro no diário, a próxima aula é preenchida automaticamente. Mantenha esta aba aberta e use somente o diário escolhido durante o lote.</p>
    <p className="muted form-help">O lote deve pertencer à unidade selecionada no SUAP. Nenhum botão Salvar é acionado pela extensão.</p>
    <div className="button-row">
      <button className="secondary" onClick={loadTabs} disabled={running}>Buscar abas do SUAP</button>
      <label className="import-label">Diário de destino
        <select value={tabId} onChange={(event) => setTabId(event.target.value)} disabled={running}>
          <option value="">Selecione a aba do diário</option>
          {tabs.map((tab) => <option key={tab.id} value={tab.id}>{tab.title || tab.url}</option>)}
        </select>
      </label>
      <button className="primary" onClick={start} disabled={running || !tabId || invalid || !rows.length || savedCount === rows.length}>
        {savedCount ? "Continuar preenchimento" : "Iniciar preenchimento automático"}
      </button>
      {running && <button className="secondary" onClick={() => controller.current?.abort()}>Interromper lote</button>}
    </div>
    {invalid && <p className="error">Corrija todas as linhas inválidas antes de iniciar o preenchimento.</p>}
    <div aria-live="polite">
      <p className="import-safety">{savedCount} de {rows.length} salvamento(s) confirmado(s).</p>
      {progress && <p>{labels[progress.state]}{progress.row && ` · linha ${progress.row.line} · ${progress.row.data}`}</p>}
      {error && <div className="error" role="alert">{error}</div>}
    </div>
  </section>;
}
