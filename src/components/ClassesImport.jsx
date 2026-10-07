import ClassesBatch from "./ClassesBatch";
import { useState } from "react";
import { downloadClassesTemplate, importClassesFile } from "../services/classesImport";

export default function ClassesImport({ workspace = false, targetTabId, onRunningChange = () => {} }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [filename, setFilename] = useState("");
  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setResult(null);
    setError("");
    setFilename(file.name);
    try { setResult(await importClassesFile(file)); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível ler o arquivo."); }
    finally { setBusy(false); }
  }
  async function openWorkspace() {
    setError("");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url?.startsWith("https://suap.ifba.edu.br/")) throw new Error("Abra o diário no SUAP antes de importar aulas.");
      const response = await chrome.tabs.sendMessage(tab.id, { type: "SUAP_TOOLS_OPEN_IMPORT_PANEL", tabId: tab.id });
      if (!response?.ok) throw new Error(response?.error || "Não foi possível abrir a importação.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir o painel de importação.");
    }
  }
  const valid = result?.rows.filter((row) => !row.errors.length) ?? [];
  const invalid = result?.rows.filter((row) => row.errors.length) ?? [];
  return <section className="card import-card">
    <h2>Importar aulas</h2>
    <details className="form-help"><summary>Formato do arquivo</summary>
    <p className="muted form-help">Use os cabeçalhos exatos Unidade, Data, Quantidade, Conteúdo e, opcionalmente, Formato. CSV separado por ponto e vírgula ou vírgula; XLSX com uma única aba. A ordem das colunas pode variar.</p>
    <p className="muted form-help">Unidade: 1, 2 ou 3. Data: dd/mm/aaaa (texto no XLSX). Quantidade: inteiro positivo. Conteúdo: obrigatório. Formato: vazio, Síncrona ou Assíncrona. O CSV de exportação das aulas registradas tem outro formato; use este modelo.</p>
    </details>
    <div className="button-row">
      <button className="secondary" onClick={downloadClassesTemplate}>Baixar modelo CSV</button>
      {workspace ? <label className="import-label">Importar CSV/XLSX
        <input type="file" accept=".csv,.xlsx" onChange={importFile} disabled={busy || batchRunning} />
      </label> : <button className="primary" onClick={openWorkspace}>Importar aulas nesta página</button>}
    </div>
    {!workspace && <p className="muted import-safety">A importação aparece nesta página do SUAP, sem abrir outra aba.</p>}
    <div aria-live="polite">
      {busy && <p className="muted">Validando arquivo...</p>}
      {filename && <p className="import-filename">{filename}</p>}
      {error && <div className="error" role="alert">{error}</div>}
      {!!result?.columnErrors.length && <div className="error" role="alert"><strong>Arquivo inválido. Use o modelo oficial.</strong><ul>{result.columnErrors.map((message) => <li key={message}>{message}</li>)}</ul></div>}
      {result && !result.columnErrors.length && <>
        <p className="form-help">{result.rows.length} registro(s): {valid.length} válido(s), {invalid.length} inválido(s). Simulação: {result.totalQuantity} aula(s) nas linhas válidas.</p>
        {Object.entries(result.units).map(([unit, quantity]) => <p className="muted" key={unit}>Unidade {unit}: {quantity} aula(s)</p>)}
        {!result.rows.length && <div className="error">Nenhum registro encontrado. Preencha o modelo antes de importar.</div>}
        {!!invalid.length && <div className="error" role="alert"><strong>Corrija as linhas inválidas e importe novamente.</strong><ul>{invalid.map((row) => <li key={row.line}>Linha {row.line}: {row.errors.join(" ")}</li>)}</ul></div>}
        {!!valid.length && <><h3>Prévia das linhas válidas</h3><div className="table-wrap"><table><thead><tr><th>Linha</th><th>Unidade</th><th>Data</th><th>Qtd.</th><th>Conteúdo</th><th>Formato</th></tr></thead><tbody>{valid.map((row) => <tr key={row.line}><td>{row.line}</td><td>{row.unidade}</td><td>{row.data}</td><td>{row.quantidade}</td><td>{row.conteudo}</td><td>{row.formato || "Não informado"}</td></tr>)}</tbody></table></div></>}
      </>}
    </div>
    {workspace && result && !result.columnErrors.length && result.rows.length > 0 &&
      <ClassesBatch key={filename + JSON.stringify(result.rows)} rows={result.rows} targetTabId={targetTabId} onRunningChange={(running) => { setBatchRunning(running); onRunningChange(running); }} />}
    <p className="muted import-safety">A seleção do arquivo apenas valida e mostra a prévia. O cadastro começa quando você confirma o envio; o salvamento só é automático se você marcar a opção de envio do lote.</p>
  </section>;
}
