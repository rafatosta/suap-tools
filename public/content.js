chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
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

    if (message?.type === "SUAP_TOOLS_GET_CLASS_FORM") {
      if (!globalThis.SuapClassParser) {
        sendResponse({ ok: false, error: "Parser de aulas do SUAP Tools não foi carregado." });
        return;
      }

      sendResponse(globalThis.SuapClassParser.getClassFormState());
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
