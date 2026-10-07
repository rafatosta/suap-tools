import { useEffect, useMemo, useState } from "react";
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
  const [activeTool, setActiveTool] = useState("notas");
  const [gradebook, setGradebook] = useState(null);
  const [classesData, setClassesData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [classFormStatus, setClassFormStatus] = useState("");
  const [classForm, setClassForm] = useState({
    quantidade: "1",
    etapa: "1",
    data: "",
    formato: "",
    conteudo: "",
  });

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
    setClassFormStatus("");

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

      if (result?.metadata?.unit?.value) {
        setClassForm((current) => ({
          ...current,
          etapa: result.metadata.unit.value,
        }));
      }
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

  const openClassForm = async () => {
    setError("");
    setClassFormStatus("");

    try {
      const result = await sendMessage("SUAP_TOOLS_OPEN_CLASS_FORM");
      if (!result?.ok) {
        throw new Error(result?.error || "Não foi possível abrir o formulário de aula.");
      }

      setClassFormStatus(
        "Formulário nativo aberto no SUAP. Reabra a extensão depois de o diálogo aparecer."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const fillClassForm = async () => {
    setError("");
    setClassFormStatus("");

    try {
      const result = await sendMessage("SUAP_TOOLS_FILL_CLASS_FORM", classForm);

      if (!result?.ok) {
        throw new Error(
          result?.error ||
            "Não foi possível preencher o formulário. Abra primeiro o diálogo 'Adicionar Aula'."
        );
      }

      setClassFormStatus(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const gradeDiagnostics = gradebook?.diagnostics;
  const classDiagnostics = classesData?.diagnostics;

  if (importWorkspace) {
    return <main className="app import-workspace">
      <header className="header">
        <div><h1>SUAP Tools · Aulas</h1><p>Importação e prévia</p></div>
        <span className="readonly-badge">SAFE MODE</span>
      </header>
      <ClassesImport workspace />
      <footer>Mantenha esta aba aberta durante a revisão. Os dados são descartados ao recarregar ou fechar esta aba. Nenhuma aula é salva automaticamente.</footer>
    </main>;
  }

  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>SUAP Tools</h1>
          <p>v0.3.1 · notas e aulas</p>
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
          <section className="card">
            <h2>Diagnóstico</h2>

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
          </section>

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
          <section className="card">
            <h2>Diagnóstico de aulas</h2>

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
                  Nenhuma aula salva automaticamente
                </DiagnosticItem>
              </div>
            ) : (
              <p className="muted">Aguardando leitura da página.</p>
            )}

            <div className="button-row">
              <button className="secondary" onClick={loadClasses} disabled={loading}>
                {loading ? "Lendo..." : "Ler aulas novamente"}
              </button>
              <button className="secondary" onClick={openClassForm}>
                Abrir Adicionar Aula
              </button>
            </div>
          </section>

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

              <section className="card">
                <h2>Preencher formulário nativo</h2>
                <p className="muted form-help">
                  Esta ferramenta só preenche o diálogo do SUAP. O botão Salvar deve
                  ser acionado manualmente por você.
                </p>

                <div className="form-grid">
                  <label>
                    Quantidade
                    <input
                      type="number"
                      min="0"
                      value={classForm.quantidade}
                      onChange={(event) =>
                        setClassForm({ ...classForm, quantidade: event.target.value })
                      }
                    />
                  </label>

                  <label>
                    Unidade
                    <select
                      value={classForm.etapa}
                      onChange={(event) =>
                        setClassForm({ ...classForm, etapa: event.target.value })
                      }
                    >
                      <option value="1">Unidade 1</option>
                      <option value="2">Unidade 2</option>
                      <option value="3">Unidade 3</option>
                    </select>
                  </label>

                  <label>
                    Data
                    <input
                      type="text"
                      placeholder="dd/mm/aaaa"
                      value={classForm.data}
                      onChange={(event) =>
                        setClassForm({ ...classForm, data: event.target.value })
                      }
                    />
                  </label>

                  <label>
                    Formato
                    <select
                      value={classForm.formato}
                      onChange={(event) =>
                        setClassForm({ ...classForm, formato: event.target.value })
                      }
                    >
                      <option value="">Não informado</option>
                      <option value="1">Síncrona</option>
                      <option value="2">Assíncrona</option>
                    </select>
                  </label>

                  <label className="full">
                    Conteúdo
                    <textarea
                      rows="5"
                      value={classForm.conteudo}
                      onChange={(event) =>
                        setClassForm({ ...classForm, conteudo: event.target.value })
                      }
                    />
                  </label>
                </div>

                <button className="primary" onClick={fillClassForm}>
                  Preencher diálogo aberto
                </button>

                {classFormStatus && (
                  <div className="success-message">{classFormStatus}</div>
                )}
              </section>
            </>
          )}
        </>
      )}

      <footer>
        O SUAP Tools não salva aulas automaticamente nesta versão. Exclusão de aulas
        também não é realizada.
      </footer>
    </main>
  );
}

export default App;
