function getDefaultEnvironment() {
    return {
        matchMedia: typeof window !== "undefined" ? window.matchMedia.bind(window) : undefined,
        maxTouchPoints: typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0,
    };
}
/**
 * Resolves the runtime interaction policy for the current device.
 */
export function resolveInteractionMode(interactionMode = "auto", environment = getDefaultEnvironment()) {
    if (interactionMode !== "auto") {
        return interactionMode;
    }
    const hasCoarsePointer = Boolean(environment.matchMedia?.("(pointer: coarse)").matches || environment.matchMedia?.("(any-pointer: coarse)").matches);
    const lacksHover = Boolean(environment.matchMedia?.("(hover: none)").matches);
    const maxTouchPoints = environment.maxTouchPoints ?? 0;
    if (hasCoarsePointer || (maxTouchPoints > 0 && lacksHover)) {
        return "touch";
    }
    return "desktop";
}
//# sourceMappingURL=interaction-mode.js.map