import test from "node:test";
import assert from "node:assert/strict";
import { build } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Render the actual JSX entry in both extension views without launching SUAP.
test("file selection stays in the same-page panel, outside the transient popup", async () => {
  const bundle = await build({
    configFile: false, esbuild: { jsx: "automatic" },
    logLevel: "silent",
    build: { ssr: new URL("../src/App.jsx", import.meta.url).pathname, write: false },
  });
  const entry = bundle.output.find((chunk) => chunk.type === "chunk" && chunk.isEntry);
  const code = entry.code.replace(/from (["'])(react(?:\/[^"']*)?|papaparse)\1/g,
    (_, quote, name) => `from ${quote}${import.meta.resolve(name)}${quote}`);
  const { default: App } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
  globalThis.window = { location: { search: "?view=class-import" } };
  try {
    const workspace = renderToStaticMarkup(createElement(App));
    assert.match(workspace, /type="file"/);
    assert.match(workspace, /Importação no diário atual/);
    assert.doesNotMatch(workspace, /Diagnóstico de aulas/);
    assert.doesNotMatch(workspace, /Preencher diálogo aberto/);
    // Check the popup component directly because the default App opens Notas.
    const componentBundle = await build({ configFile: false, esbuild: { jsx: "automatic" }, logLevel: "silent",
      build: { ssr: new URL("../src/components/ClassesImport.jsx", import.meta.url).pathname, write: false } });
    const componentCode = componentBundle.output.find((chunk) => chunk.type === "chunk" && chunk.isEntry).code
      .replace(/from (["'])(react(?:\/[^"']*)?|papaparse)\1/g,
        (_, quote, name) => `from ${quote}${import.meta.resolve(name)}${quote}`);
    const { default: ClassesImport } = await import("data:text/javascript;base64," + Buffer.from(componentCode).toString("base64"));
    const popup = renderToStaticMarkup(createElement(ClassesImport));
    assert.match(popup, /Importar aulas nesta página/);
    assert.doesNotMatch(popup, /type="file"/);
  } finally { delete globalThis.window; }
});

test("automatic saving is visibly optional and unchecked by default", async () => {
  const bundle = await build({ configFile: false, esbuild: { jsx: "automatic" }, logLevel: "silent",
    build: { ssr: new URL("../src/components/ClassesBatch.jsx", import.meta.url).pathname, write: false } });
  const code = bundle.output.find((chunk) => chunk.type === "chunk" && chunk.isEntry).code
    .replace(/from (["'])(react(?:\/[^"']*)?)\1/g,
      (_, quote, name) => `from ${quote}${import.meta.resolve(name)}${quote}`);
  const { default: ClassesBatch } = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
  const html = renderToStaticMarkup(createElement(ClassesBatch, { rows: [], onRunningChange: () => {} }));
  assert.match(html, /type="checkbox"/);
  assert.doesNotMatch(html, /checked=""/);
  assert.match(html, /Enviar e salvar automaticamente todas as aulas deste lote/);
  assert.match(html, /Desmarcado: você confirma o cadastro de uma aula/);
});
