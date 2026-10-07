chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    if (message?.type === "SUAP_TOOLS_OPEN_IMPORT_PANEL") {
      const existing = document.getElementById("suap-tools-import-panel");
      if (existing) { sendResponse({ ok: true }); return; }
      const panel = document.createElement("iframe");
      panel.id = "suap-tools-import-panel";
      panel.title = "Importar aulas — SUAP Tools";
      panel.src = chrome.runtime.getURL("index.html?view=class-import&targetTab=" + message.tabId + (["delete", "shift"].includes(message.section) ? "&section=" + message.section : ""));
      panel.style.cssText = "position:fixed;inset:12px 12px 12px auto;width:min(960px,95vw);height:calc(100vh - 24px);z-index:2147483647;border:1px solid #d0d5dd;border-radius:12px;background:white;box-shadow:0 10px 40px #0004";
      document.body.append(panel);
      sendResponse({ ok: true }); return;
    }
    if (message?.type === "SUAP_TOOLS_CLOSE_IMPORT_PANEL") {
      document.getElementById("suap-tools-import-panel")?.remove();
      sendResponse({ ok: true }); return;
    }
    if (message?.type === "SUAP_TOOLS_PREVIEW_CLASS_DELETION" || message?.type === "SUAP_TOOLS_DELETE_PLANNED_CLASS") {
      const parser = globalThis.SuapClassParser;
      const operation = message.type === "SUAP_TOOLS_PREVIEW_CLASS_DELETION" ? parser.previewClassDeletion(message.payload ?? {}) : parser.deletePlannedClass(message.payload ?? {});
      operation.then(sendResponse, () => sendResponse({ ok: false, error: "Não foi possível confirmar a operação. Confira o diário." }));
      return true;
    }
    if (message?.type === "SUAP_TOOLS_PREVIEW_CLASS_SHIFT" || message?.type === "SUAP_TOOLS_APPLY_CLASS_SHIFT") {
      const parser = globalThis.SuapClassParser;
      const operation = message.type === "SUAP_TOOLS_PREVIEW_CLASS_SHIFT" ? parser.previewClassShift(message.payload ?? {}) : parser.applyPlannedClassShift(message.payload ?? {});
      operation.then(sendResponse, () => sendResponse({ ok: false, error: "Não foi possível confirmar a edição. Confira o diário." }));
      return true;
    }
    if (message?.type === "SUAP_TOOLS_REGISTER_CLASS") {
      globalThis.SuapClassParser.registerClass(message.payload ?? {})
        .then(sendResponse, (error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (message?.type === "SUAP_TOOLS_EXTRACT_GRADES") {
      if (!globalThis.SuapGradeParser) {
        sendResponse({ ok: false, error: "Parser de notas do SUAP Tools não foi carregado." });
        return;
      }

      sendResponse(globalThis.SuapGradeParser.extractGradebook());
      return true;
    }

    if (message?.type === "SUAP_TOOLS_EXTRACT_CLASSES") {
      if (!globalThis.SuapClassParser) {
        sendResponse({ ok: false, error: "Parser de aulas do SUAP Tools não foi carregado." });
        return;
      }

      sendResponse(globalThis.SuapClassParser.extractClasses());
      return true;
    }

    if (message?.type === "SUAP_TOOLS_OPEN_CLASS_FORM") {
      if (!globalThis.SuapClassParser) {
        sendResponse({ ok: false, error: "Parser de aulas do SUAP Tools não foi carregado." });
        return;
      }

      sendResponse(globalThis.SuapClassParser.openClassForm());
      return true;
    }

    if (message?.type === "SUAP_TOOLS_GET_CLASS_FORM") {
      if (!globalThis.SuapClassParser) {
        sendResponse({ ok: false, error: "Parser de aulas do SUAP Tools não foi carregado." });
        return;
      }

      sendResponse(globalThis.SuapClassParser.getClassFormState());
      return true;
    }

    if (message?.type === "SUAP_TOOLS_SUBMIT_CLASS_FORM") {
      if (!globalThis.SuapClassParser) {
        sendResponse({ ok: false, error: "Parser de aulas do SUAP Tools não foi carregado." });
        return;
      }
      sendResponse(globalThis.SuapClassParser.submitClassForm(message.payload ?? {}));
      return true;
    }

    if (message?.type === "SUAP_TOOLS_FILL_CLASS_FORM") {
      if (!globalThis.SuapClassParser) {
        sendResponse({ ok: false, error: "Parser de aulas do SUAP Tools não foi carregado." });
        return;
      }

      sendResponse(globalThis.SuapClassParser.fillClassForm(message.payload ?? {}));
      return true;
    }
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
});
