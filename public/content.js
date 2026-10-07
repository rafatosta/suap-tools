chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "SUAP_TOOLS_EXTRACT_GRADES") return;

  try {
    if (!globalThis.SuapGradeParser) {
      sendResponse({ ok: false, error: "Parser do SUAP Tools não foi carregado." });
      return;
    }

    sendResponse(globalThis.SuapGradeParser.extractGradebook());
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  return true;
});
