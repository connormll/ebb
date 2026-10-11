/**
 * Search over the command registry, plus the per-speech "go to speech"
 * entries the speech switcher exposes. Powers the palette's command mode
 * (query prefixed with ">"): order-independent multi-token matching ranked
 * by relevance tier, same-tier ties in registry order.
 */

import { COMMANDS, type CommandId } from "@/lib/commands/registry";
import { speechTerms, type SpeechDef } from "@/lib/format/events";

import { rank } from "./match";

export interface CommandHit {
    id: CommandId;
    label: string;
}

const ALL = Object.values(COMMANDS);

/**
 * Rank commands against `query`; an empty query lists them all in order.
 * A command's `keywords` match in the secondary field, so a debater who
 * searches for the mark ("strikethrough") finds it, ranked below every
 * command whose label the query actually names.
 */
export function searchCommands(query: string): CommandHit[] {
    return rank(ALL, query, commandPrimary, commandSecondary, () => 0).map((c) => ({
        id: c.id,
        label: c.label,
    }));
}

const commandPrimary = (c: (typeof ALL)[number]) => c.label;
const commandSecondary = (c: (typeof ALL)[number]) => c.keywords ?? "";

export interface SpeechCommandHit {
    speechId: string;
    label: string;
}

/** The palette label for jumping the grid to `speech`. */
export function speechCommandLabel(speech: SpeechDef): string {
    return `Go to speech: ${speech.name}`;
}

/**
 * Rank the round's speeches as palette commands; an empty query lists them
 * all in speaking order. Dynamic, so these live outside the static registry.
 *
 * A speech's abbreviation and aliases match as strongly as its name, not as
 * weak context: "ns" is what a debater calls the Neg Summary, and it is also
 * buried inside "Co-ns-tructive", so matching it in the secondary field would
 * rank the speech the query names below two it does not.
 */
export function searchSpeechCommands(
    query: string,
    speeches: readonly SpeechDef[],
): SpeechCommandHit[] {
    return rank(
        speeches,
        query,
        speechPrimary,
        () => "",
        () => 0,
    ).map((s) => ({
        speechId: s.id,
        label: speechCommandLabel(s),
    }));
}

const speechPrimary = (s: SpeechDef) => `${speechCommandLabel(s)} ${speechTerms(s)}`;

export type PaletteCommandHit =
    | ({ kind: "command" } & CommandHit)
    | ({ kind: "speech" } & SpeechCommandHit);

/**
 * Commands and the round's speeches ranked as one list, so a speech the query
 * names outranks a command it only reaches through keywords: "2ar" is the
 * 2AR before it is a keyword of the decision view. An empty query lists the
 * commands in registry order, then the speeches in speaking order.
 */
export function searchPaletteCommands(
    query: string,
    speeches: readonly SpeechDef[],
): PaletteCommandHit[] {
    type Entry = { hit: PaletteCommandHit; primary: string; secondary: string };
    const entries: Entry[] = [
        ...ALL.map((c) => ({
            hit: { kind: "command" as const, id: c.id, label: c.label },
            primary: commandPrimary(c),
            secondary: commandSecondary(c),
        })),
        ...speeches.map((s) => ({
            hit: { kind: "speech" as const, speechId: s.id, label: speechCommandLabel(s) },
            primary: speechPrimary(s),
            secondary: "",
        })),
    ];
    return rank(
        entries,
        query,
        (e) => e.primary,
        (e) => e.secondary,
        () => 0,
    ).map((e) => e.hit);
}
