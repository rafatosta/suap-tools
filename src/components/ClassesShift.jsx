import { useEffect, useRef, useState } from "react";

export default function ClassesShift({ targetTabId, onRunningChange, busy, initiallyOpen = false }) {
  const [startDate, setStartDate] = useState("");
  const [days, setDays] = useState("7");
  const [preview, setPreview] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [used, setUsed] = useState(false);
  const [error, setError] = useState("");
  const stop = useRef(false), execution = useRef(false);
  useEffect(() => () => { stop.current = true; }, []);
  const send = (type, payload) => chrome.tabs.sendMessage(targetTabId, { type, payload });
  const reset = () => { setPreview(null); setConfirmed(false); setUsed(false); setCount(0); setError(""); execution.current = false; };
  async function prepare() {
    reset(); setLoading(true);
    try {
      const result = await send("SUAP_TOOLS_PREVIEW_CLASS_SHIFT", { startDate, days });
      if (!result?.ok) throw new Error(result?.error || "Não foi possível preparar o deslocamento.");
      setPreview(result);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  async function apply() {
    if (busy || running || used || !confirmed || execution.current) return;
    execution.current = true; stop.current = false;
    setRunning(true); onRunningChange(true); setUsed(true); setError("");
    try {
      for (const row of preview.rows) {
        if (stop.current) break;
        const result = await send("SUAP_TOOLS_APPLY_CLASS_SHIFT", { planId: preview.planId, id: row.id, confirmed: true });
        if (!result?.ok || !result.shifted) throw new Error(result?.error || "Resultado incerto. Confira as datas no diário.");
        setCount((value) => value + 1);
      }
    } catch (err) { setError(err.message); }
    finally { setRunning(false); onRunningChange(false); setConfirmed(false); }
  }
  return <details className="card diagnostic-details" open={initiallyOpen || undefined}>
    <summary><span>Deslocar datas das aulas</span><span aria-hidden="true">⌄</span></summary>
    <div className="diagnostic-content">
      <p className="form-help">Edita apenas as datas das aulas da unidade atual, a partir da data inicial, incluindo esse dia. Conteúdo, quantidade e professor permanecem iguais.</p>
      <div className="form-grid">
        <label>Data inicial<input placeholder="dd/mm/aaaa" value={startDate} disabled={busy || loading} onChange={(event) => { reset(); setStartDate(event.target.value); }} /></label>
        <label>Deslocamento em dias<input type="number" step="1" value={days} disabled={busy || loading} onChange={(event) => { reset(); setDays(event.target.value); }} /></label>
      </div>
      <p className="muted form-help">Exemplo: 01/10/2026 e +7 dias → 08/10/2026. Use um número negativo para antecipar.</p>
      <button className="secondary" disabled={busy || loading} onClick={prepare}>{loading ? "Consultando..." : "Mostrar prévia"}</button>
      {preview && <>
        <p className="import-safety"><strong>{preview.title}</strong> · Unidade {preview.unit}</p>
        <p>{preview.rows.length} registro(s) a deslocar; {preview.unchangedCount} anterior(es) à data inicial sem alteração.</p>
        <div className="table-wrap"><table><thead><tr><th>Data atual</th><th>Nova data</th><th>Qtd.</th><th>Conteúdo</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.id}><td>{row.data}</td><td>{row.newDate}</td><td>{row.quantidade}</td><td>{row.conteudo}</td></tr>)}</tbody></table></div>
        {!!preview.rows.length && <>
          <label className="auto-save-option"><input type="checkbox" checked={confirmed} disabled={busy || used} onChange={(event) => setConfirmed(event.target.checked)} />Confirmo alterar as datas dos {preview.rows.length} registros desta prévia.</label>
          <button className="primary" disabled={busy || used || !confirmed} onClick={apply}>Aplicar deslocamento</button>
        </>}
        {running && <button className="secondary" onClick={() => { stop.current = true; }}>Parar após a edição atual</button>}
        <p className="import-safety" aria-live="polite">{count} de {preview.rows.length} edição(ões) confirmada(s).</p>
        {used && !running && <p className="muted">Confira as datas no diário antes de preparar outro deslocamento, principalmente se a execução foi parcial.</p>}
      </>}
      {error && <div className="error" role="alert">{error}</div>}
    </div>
  </details>;
}
