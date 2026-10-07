import { useEffect, useRef, useState } from "react";

export default function ClassesDelete({ targetTabId, onRunningChange, busy, initiallyOpen = false }) {
  const [preview, setPreview] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleted, setDeleted] = useState(0);
  const [used, setUsed] = useState(false);
  const stop = useRef(false);
  const execution = useRef(false);
  useEffect(() => () => { stop.current = true; }, []);
  const send = (type, payload) => chrome.tabs.sendMessage(targetTabId, { type, payload });
  async function loadPreview() {
    execution.current = false;
    setLoading(true); setError(""); setPassword(""); setConfirmed(false); setDeleted(0); setUsed(false);
    try {
      const result = await send("SUAP_TOOLS_PREVIEW_CLASS_DELETION");
      if (!result?.ok) throw new Error(result?.error || "Não foi possível consultar as aulas.");
      setPreview(result);
    } catch (err) { setPreview(null); setError(err.message); }
    finally { setLoading(false); }
  }
  async function removeAll() {
    if (!confirmed || !password || used || running || busy || execution.current) return;
    execution.current = true;
    let secret = password;
    setPassword(""); setUsed(true); setRunning(true); onRunningChange(true); setError(""); stop.current = false;
    try {
      for (const row of preview.rows) {
        if (stop.current) break;
        const result = await send("SUAP_TOOLS_DELETE_PLANNED_CLASS", { planId: preview.planId, id: row.id, password: secret, confirmed: true });
        if (!result?.ok || !result.deleted) throw new Error(result?.error || "Resultado incerto. Confira o diário antes de continuar.");
        setDeleted((count) => count + 1);
      }
    } catch (err) { setError(String(err.message).split(secret).join("[senha ocultada]")); }
    finally { secret = ""; setPassword(""); setConfirmed(false); setRunning(false); onRunningChange(false); }
  }
  return <details className="card diagnostic-details deletion-card" open={initiallyOpen || undefined}>
    <summary><span>Excluir aulas da unidade</span><span aria-hidden="true">⌄</span></summary>
    <div className="diagnostic-content">
      <p className="form-help">Exclui os registros da unidade atualmente selecionada neste diário. Confira a prévia antes de confirmar; as exclusões não serão desfeitas pela extensão.</p>
      <button className="secondary" disabled={busy || loading} onClick={loadPreview}>{loading ? "Consultando..." : "Preparar exclusão"}</button>
      {preview && <>
        <p className="import-safety"><strong>{preview.title}</strong></p>
        <p>Unidade {preview.unit}: {preview.rows.length} registro(s), totalizando {preview.totalQuantity} aula(s).</p>
        <div className="table-wrap"><table><thead><tr><th>Data</th><th>Qtd.</th><th>Conteúdo</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.id}><td>{row.data}</td><td>{row.quantidade}</td><td>{row.conteudo}</td></tr>)}</tbody></table></div>
        {!!preview.rows.length && <>
          <label className="password-label">Senha do SUAP
            <input type="password" autoComplete="off" value={password} disabled={busy || used} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="auto-save-option"><input type="checkbox" checked={confirmed} disabled={busy || used} onChange={(event) => setConfirmed(event.target.checked)} />Confirmo excluir os {preview.rows.length} registros da Unidade {preview.unit} deste diário.</label>
          <button className="danger" disabled={busy || used || !confirmed || !password} onClick={removeAll}>Excluir todas as aulas da Unidade {preview.unit}</button>
        </>}
        {running && <button className="secondary" onClick={() => { stop.current = true; }}>Parar após a exclusão atual</button>}
        <p aria-live="polite" className="import-safety">{deleted} de {preview.rows.length} exclusão(ões) confirmada(s).</p>
        {used && !running && <p className="muted">Confira o diário e prepare uma nova prévia para as aulas restantes, se necessário.</p>}
      </>}
      {error && <div className="error" role="alert">{error}</div>}
      <p className="muted import-safety">A senha é enviada apenas ao SUAP durante a execução e não é salva pela extensão. Parar impede as próximas exclusões; uma exclusão já enviada pode concluir.</p>
    </div>
  </details>;
}
