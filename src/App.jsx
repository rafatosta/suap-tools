import { useEffect, useMemo, useState } from "react";
import { downloadCsv } from "./services/csvExporter";

const sendExtractMessage = async () => {
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

  return chrome.tabs.sendMessage(tab.id, {
    type: "SUAP_TOOLS_EXTRACT_GRADES",
  });
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
  const [gradebook, setGradebook] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const extract = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await sendExtractMessage();

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

  useEffect(() => {
    extract();
  }, []);

  const preview = useMemo(
    () => gradebook?.students?.slice(0, 8) ?? [],
    [gradebook]
  );

  const diagnostics = gradebook?.diagnostics;

  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>SUAP Tools</h1>
          <p>v0.1 · modo somente leitura</p>
        </div>
        <span className="readonly-badge">READ ONLY</span>
      </header>

      <section className="card">
        <h2>Diagnóstico</h2>

        {error ? (
          <div className="error">{error}</div>
        ) : diagnostics ? (
          <div className="diagnostics">
            <DiagnosticItem ok={diagnostics.domainOk}>
              Domínio do SUAP detectado
            </DiagnosticItem>
            <DiagnosticItem ok={diagnostics.gradeTableFound}>
              Tabela de notas {diagnostics.gradeTableFound ? "encontrada" : "não encontrada"}
            </DiagnosticItem>
            <DiagnosticItem ok={diagnostics.studentCount > 0}>
              {diagnostics.studentCount} aluno(s) identificado(s)
            </DiagnosticItem>
            <DiagnosticItem ok={!diagnostics.writableActionsUsed}>
              Nenhuma ação de escrita executada
            </DiagnosticItem>
          </div>
        ) : (
          <p className="muted">Aguardando leitura da página.</p>
        )}

        <button className="secondary" onClick={extract} disabled={loading}>
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
              {(diagnostics?.headers ?? []).slice(2).map((header) => (
                <span key={header}>{header}</span>
              ))}
            </div>
          </section>

          <section className="card preview-card">
            <div className="section-header">
              <div>
                <h2>Prévia</h2>
                <p className="muted">Primeiros {preview.length} registros</p>
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
                  {preview.map((student) => {
                    const fieldCount = Object.values(student.notas ?? {}).reduce(
                      (total, section) => total + Object.keys(section ?? {}).length,
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

      <footer>
        Esta versão apenas lê o DOM da página atual e exporta dados. Ela não altera notas.
      </footer>
    </main>
  );
}

export default App;
