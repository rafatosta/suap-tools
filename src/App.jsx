import { useEffect, useMemo, useState } from "react";
import ClassesDelete from "./components/ClassesDelete";
import ClassesImport from "./components/ClassesImport";
import { downloadCsv } from "./services/csvExporter";
import { downloadClassesCsv } from "./services/classesCsvExporter";

const getActiveTab = async () => {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.id) {
    throw new Error("Não foi possível identificar a aba ativa.");
  }

  if (!tab.url?.startsWith("https://suap.ifba.edu.br/")) {
    throw new Error("Abra uma página do SUAP IFBA antes de usar a extensão.");
  }

  return tab;
};

const sendMessage = async (type, payload) => {
  const tab = await getActiveTab();
  return chrome.tabs.sendMessage(tab.id, { type, payload });
};

function DiagnosticItem({ ok, children }) {
  return (
    <div className={"diagnostic " + (ok ? "ok" : "warn")}>
      <span className="diagnostic-icon">{ok ? "✓" : "!"}</span>
      <span>{children}</span>
    </div>
  );
}

function App() {
  const importWorkspace = new URLSearchParams(window.location.search).get("view") === "class-import";
  const targetTabId = Number(new URLSearchParams(window.location.search).get("targetTab"));
  const [importRunning, setImportRunning] = useState(false);
  const [activeTool, setActiveTool] = useState("notas");
  const [gradebook, setGradebook] = useState(null);
  const [classesData, setClassesData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadGrades = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await sendMessage("SUAP_TOOLS_EXTRACT_GRADES");

      if (!result) {
        throw new Error(
          "A extensão não recebeu resposta da página. Recarregue o SUAP e tente novamente."
        );
      }

      if (!result.ok && result.error) {
        throw new Error(result.error);
      }

      setGradebook(result);
    } catch (err) {
      setGradebook(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await sendMessage("SUAP_TOOLS_EXTRACT_CLASSES");

      if (!result) {
        throw new Error(
          "A extensão não recebeu resposta da página. Recarregue o SUAP e tente novamente."
        );
      }

      if (!result.ok && result.error) {
        throw new Error(result.error);
      }

      setClassesData(result);


    } catch (err) {
      setClassesData(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!importWorkspace) loadGrades();
  }, []);

  useEffect(() => {
    if (!importWorkspace && activeTool === "aulas") loadClasses();
  }, [activeTool]);

  const gradePreview = useMemo(
    () => gradebook?.students?.slice(0, 8) ?? [],
    [gradebook]
  );

  const classPreview = useMemo(
    () => classesData?.classes?.slice(0, 8) ?? [],
    [classesData]
  );

  const openDeletionPanel = async () => {
    setError("");
    try {
      const tab = await getActiveTab();
      const result = await chrome.tabs.sendMessage(tab.id, { type: "SUAP_TOOLS_OPEN_IMPORT_PANEL", tabId: tab.id, section: "delete" });
      if (!result?.ok) throw new Error(result?.error || "Não foi possível abrir as opções de exclusão.");
    } catch (err) { setError(err.message); }
  };

  const gradeDiagnostics = gradebook?.diagnostics;
  const classDiagnostics = classesData?.diagnostics;

  if (importWorkspace) {
    return <main className="app import-workspace">
      <header className="header">
        <div><h1>SUAP Tools · Aulas</h1><p>Importação no diário atual</p></div>
        <button className="secondary" disabled={importRunning} onClick={() => chrome.tabs.sendMessage(targetTabId, { type: "SUAP_TOOLS_CLOSE_IMPORT_PANEL" })}>Fechar</button>
      </header>
      <ClassesImport workspace targetTabId={targetTabId} onRunningChange={setImportRunning} externalBusy={importRunning} />
      <ClassesDelete targetTabId={targetTabId} onRunningChange={setImportRunning} busy={importRunning} initiallyOpen={new URLSearchParams(window.location.search).get("section") === "delete"} />
      <footer>Os dados são descartados ao fechar este painel ou recarregar a página. O envio automático depende da opção escolhida antes de iniciar o lote.</footer>
    </main>;
  }

  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>SUAP Tools</h1>
          <p>v0.6.0 · notas e aulas</p>
        </div>
        <span className="readonly-badge">SAFE MODE</span>
      </header>

      <nav className="tool-tabs">
        <button
          className={activeTool === "notas" ? "active" : ""}
          onClick={() => setActiveTool("notas")}
        >
          Notas
        </button>
        <button
          className={activeTool === "aulas" ? "active" : ""}
          onClick={() => setActiveTool("aulas")}
        >
          Aulas
        </button>
      </nav>

      {error && <div className="error">{error}</div>}

      {activeTool === "notas" && (
        <>
          <details className="card diagnostic-details">
            <summary>
              <span>Diagnóstico</span>
              <svg className="diagnostic-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
            <div className="diagnostic-content">

            {gradeDiagnostics ? (
              <div className="diagnostics">
                <DiagnosticItem ok={gradeDiagnostics.domainOk}>
                  Domínio do SUAP detectado
                </DiagnosticItem>
                <DiagnosticItem ok={gradeDiagnostics.gradeTableFound}>
                  Tabela de notas{" "}
                  {gradeDiagnostics.gradeTableFound ? "encontrada" : "não encontrada"}
                </DiagnosticItem>
                <DiagnosticItem ok={gradeDiagnostics.studentCount > 0}>
                  {gradeDiagnostics.studentCount} aluno(s) identificado(s)
                </DiagnosticItem>
                <DiagnosticItem ok={!gradeDiagnostics.writableActionsUsed}>
                  Nenhuma ação de escrita executada
                </DiagnosticItem>
              </div>
            ) : (
              <p className="muted">Aguardando leitura da página.</p>
            )}

            <button className="secondary" onClick={loadGrades} disabled={loading}>
              {loading ? "Lendo..." : "Ler página novamente"}
            </button>
          </div>
          </details>

          {gradebook?.ok && (
            <>
              <section className="card">
                <h2>Diário detectado</h2>
                <p className="page-title">
                  {gradebook.metadata?.heading || gradebook.metadata?.title || "SUAP"}
                </p>
                <p className="muted truncate">{gradebook.metadata?.url}</p>

                <div className="header-chips">
                  {(gradeDiagnostics?.headers ?? []).slice(2).map((header) => (
                    <span key={header}>{header}</span>
                  ))}
                </div>
              </section>

              <section className="card preview-card">
                <div className="section-header">
                  <div>
                    <h2>Prévia</h2>
                    <p className="muted">Primeiros {gradePreview.length} registros</p>
                  </div>
                  <button
                    className="primary"
                    onClick={() => downloadCsv(gradebook)}
                    disabled={!gradebook.students?.length}
                  >
                    Exportar CSV
                  </button>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Matrícula</th>
                        <th>Aluno</th>
                        <th>Campos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradePreview.map((student) => {
                        const fieldCount = Object.values(student.notas ?? {}).reduce(
                          (total, section) =>
                            total + Object.keys(section ?? {}).length,
                          0
                        );

                        return (
                          <tr key={student.matricula}>
                            <td>{student.matricula}</td>
                            <td>{student.nome}</td>
                            <td>{fieldCount}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}

      {activeTool === "aulas" && (
        <>
          <ClassesImport />
          <button className="secondary delete-launcher" onClick={openDeletionPanel}>Excluir aulas da unidade...</button>
          <details className="card diagnostic-details">
            <summary>
              <span>Diagnóstico</span>
              <svg className="diagnostic-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </summary>
            <div className="diagnostic-content">

            {classDiagnostics ? (
              <div className="diagnostics">
                <DiagnosticItem ok={classDiagnostics.domainOk}>
                  Domínio do SUAP detectado
                </DiagnosticItem>
                <DiagnosticItem ok={classDiagnostics.classesTabFound}>
                  Aba Registro de Aulas detectada
                </DiagnosticItem>
                <DiagnosticItem ok={classDiagnostics.addClassAvailable}>
                  Ação Adicionar Aula disponível
                </DiagnosticItem>
                <DiagnosticItem ok={!classDiagnostics.writableActionsUsed}>
                  Leitura das aulas não altera registros
                </DiagnosticItem>
              </div>
            ) : (
              <p className="muted">Aguardando leitura da página.</p>
            )}

            <div className="button-row">
              <button className="secondary" onClick={loadClasses} disabled={loading}>
                {loading ? "Lendo..." : "Ler aulas novamente"}
              </button>
            </div>
          </div>
          </details>

          {classesData?.ok && (
            <>
              <section className="card preview-card">
                <div className="section-header">
                  <div>
                    <h2>Aulas registradas</h2>
                    <p className="muted">
                      {classesData.classes?.length ?? 0} aula(s) ·{" "}
                      {classesData.metadata?.unit?.label || "Unidade não identificada"}
                    </p>
                  </div>
                  <button
                    className="primary"
                    onClick={() => downloadClassesCsv(classesData)}
                    disabled={!classesData.classes?.length}
                  >
                    Exportar CSV
                  </button>
                </div>

                {classPreview.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Data</th>
                          <th>Qtd.</th>
                          <th>Conteúdo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classPreview.map((item, index) => (
                          <tr key={item.editUrl || item.data + index}>
                            <td>{item.data}</td>
                            <td>{item.quantidade}</td>
                            <td>{item.conteudo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted">Nenhuma aula cadastrada nesta unidade.</p>
                )}
              </section>


            </>
          )}
        </>
      )}

      <footer>
        O envio automático e a exclusão de aulas exigem confirmação no painel.
      </footer>
    </main>
  );
}

export default App;
