export type TableSpreadsheetInteractionMode = "auto" | "desktop" | "touch";

export type ResolvedTableSpreadsheetInteractionMode = Exclude<TableSpreadsheetInteractionMode, "auto">;

interface MatchMediaLike {
  (query: string): {
    matches: boolean;
  };
}

export interface InteractionModeEnvironment {
  matchMedia?: MatchMediaLike;
  maxTouchPoints?: number;
}

function getDefaultEnvironment(): InteractionModeEnvironment {
  return {
    matchMedia: typeof window !== "undefined" ? window.matchMedia.bind(window) : undefined,
    maxTouchPoints: typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0,
  };
}

/**
 * Resolves the runtime interaction policy for the current device.
 */
export function resolveInteractionMode(
  interactionMode: TableSpreadsheetInteractionMode = "auto",
  environment: InteractionModeEnvironment = getDefaultEnvironment(),
): ResolvedTableSpreadsheetInteractionMode {
  if (interactionMode !== "auto") {
    return interactionMode;
  }

  const hasCoarsePointer = Boolean(
    environment.matchMedia?.("(pointer: coarse)").matches || environment.matchMedia?.("(any-pointer: coarse)").matches,
  );
  const lacksHover = Boolean(environment.matchMedia?.("(hover: none)").matches);
  const maxTouchPoints = environment.maxTouchPoints ?? 0;

  if (hasCoarsePointer || (maxTouchPoints > 0 && lacksHover)) {
    return "touch";
  }

  return "desktop";
}
