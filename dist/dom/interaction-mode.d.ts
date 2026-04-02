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
/**
 * Resolves the runtime interaction policy for the current device.
 */
export declare function resolveInteractionMode(interactionMode?: TableSpreadsheetInteractionMode, environment?: InteractionModeEnvironment): ResolvedTableSpreadsheetInteractionMode;
export {};
//# sourceMappingURL=interaction-mode.d.ts.map