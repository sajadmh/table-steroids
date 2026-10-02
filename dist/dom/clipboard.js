/**
 * Copies text and optional HTML with the legacy textarea-based clipboard fallback.
 */
function copyTextWithExecCommand(payload) {
    const textarea = document.createElement("textarea");
    textarea.value = payload.text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const handleCopy = (event) => {
        if (!event.clipboardData) {
            return;
        }
        event.preventDefault();
        event.clipboardData.setData("text/plain", payload.text);
        if (payload.html) {
            event.clipboardData.setData("text/html", payload.html);
        }
    };
    document.addEventListener("copy", handleCopy, true);
    try {
        return document.execCommand("copy");
    }
    catch (error) {
        console.warn("Copy to clipboard failed", error);
        return false;
    }
    finally {
        document.removeEventListener("copy", handleCopy, true);
        textarea.remove();
    }
}
/**
 * Copies text and optional HTML to the clipboard, using the modern API first and a fallback second.
 */
export async function copyTextToClipboard(text, html) {
    if (window.isSecureContext && navigator.clipboard) {
        try {
            if (html && typeof ClipboardItem !== "undefined" && typeof navigator.clipboard.write === "function") {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        "text/plain": new Blob([text], { type: "text/plain" }),
                        "text/html": new Blob([html], { type: "text/html" }),
                    }),
                ]);
            }
            else {
                await navigator.clipboard.writeText(text);
            }
            return true;
        }
        catch (error) {
            console.warn("Copy to clipboard failed", error);
        }
    }
    return copyTextWithExecCommand({ text, html });
}
