"use client";

/**
 * DecisionView - the round laid out for writing a decision: the cross-ex
 * sheet and every flow sheet's last speeches side by side, beside the RFD.
 *
 * Read-only and rendered from FlowSheet data rather than through
 * Handsontable, so any number of sheets fit on screen at once; flowing
 * happens in the grid, one chord or one tab away.
 */

import { Plus, X } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tip } from "@/components/ui/tooltip";
import { metaToClassName } from "@/lib/grid/codec";
import { orderOf } from "@/lib/grid/flowColumns";
import type { FlowRound, FlowSheet } from "@/lib/model/flow";
import {
    DECISION_SPEECHES_DEFAULT,
    decisionPanels,
    type DecisionPanel,
} from "@/lib/rfd/decisionView";
import { useFlowStore } from "@/lib/store/useFlowStore";
import { cn } from "@/lib/utils";

import RfdEditor, { RfdModeTabs, type RfdMode } from "./RfdEditor";

/** Column widths in px: a cross-ex sheet carries a pair per period, so its columns run narrower. */
const FLOW_COL_WIDTH = 200;
const CX_COL_WIDTH = 170;

const RFD_MIN_WIDTH = 280;

/** Ink for a sheet's title: the cross-ex sheet holds both sides, so it stays neutral. */
function titleInk(sheet: FlowSheet): string {
    if (sheet.kind === "cx") return "text-foreground";
    return sheet.group === "neg" ? "text-neg" : "text-aff";
}

/** The cross-ex period tier: one merged header per run of columns sharing a period, as the grid draws it. */
function periodSpans(columns: DecisionPanel["columns"]) {
    const spans: { label: string; span: number; index: number }[] = [];
    for (const { col, index } of columns) {
        const last = spans.at(-1);
        if (last && last.label === (col.group ?? "")) last.span++;
        else spans.push({ label: col.group ?? "", span: 1, index });
    }
    return spans;
}

function Panel({ panel }: { panel: DecisionPanel }) {
    const setDecisionPanel = useFlowStore((s) => s.setDecisionPanel);
    const { sheet, columns, rows } = panel;
    const width = columns.length * (sheet.kind === "cx" ? CX_COL_WIDTH : FLOW_COL_WIDTH);

    return (
        <section
            aria-label={sheet.title}
            data-testid={`decision-panel-${sheet.id}`}
            className="border-border flex h-full flex-none flex-col border-r"
            style={{ width }}
        >
            <div className="border-border flex h-9 flex-none items-center justify-between gap-2 border-b px-3">
                <h2
                    className={cn(
                        "truncate text-[12px] font-semibold tracking-wider uppercase",
                        titleInk(sheet),
                    )}
                >
                    {sheet.title}
                </h2>
                <Tip label="Hide sheet">
                    <button
                        type="button"
                        aria-label={`Hide ${sheet.title}`}
                        data-testid={`decision-hide-${sheet.id}`}
                        onClick={() => setDecisionPanel(sheet.id, false)}
                        className="text-muted-foreground hover:text-foreground flex-none rounded transition-colors focus-visible:outline-2"
                    >
                        <X className="size-3.5" />
                    </button>
                </Tip>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
                <table className="decision-flow font-flow w-full table-fixed border-collapse">
                    <thead className="bg-background sticky top-0">
                        {sheet.kind === "cx" && (
                            <tr>
                                {periodSpans(columns).map(({ label, span, index }) => (
                                    <th
                                        key={index}
                                        scope="colgroup"
                                        colSpan={span}
                                        className="border-border text-foreground truncate border-b border-l px-2 py-1.5 text-center text-[11px] font-bold first:border-l-0"
                                    >
                                        {label}
                                    </th>
                                ))}
                            </tr>
                        )}
                        <tr>
                            {columns.map(({ col, index }) => (
                                <th
                                    key={index}
                                    scope="col"
                                    className={cn(
                                        "border-border border-b border-l px-2 py-1.5 text-center text-[11px] font-bold first:border-l-0",
                                        col.side === "aff" ? "text-aff" : "text-neg",
                                    )}
                                >
                                    {col.short}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ row, cells }) => (
                            <tr key={row}>
                                {cells.map((text, i) => {
                                    const { col, index } = columns[i];
                                    return (
                                        <td
                                            key={index}
                                            className={cn(
                                                "border-border border-l px-2 py-1 align-top text-[13px] leading-snug break-words whitespace-pre-wrap first:border-l-0",
                                                col.side === "aff" ? "text-aff" : "text-neg",
                                                metaToClassName(sheet.meta[`${row},${index}`]),
                                            )}
                                        >
                                            {text}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {rows.length === 0 && (
                    <p className="text-muted-foreground px-3 py-2 text-[12px]">
                        Nothing written here yet.
                    </p>
                )}
            </div>
        </section>
    );
}

/**
 * Picks the earliest speech each flow sheet shows, from the last rebuttals
 * back to the round's first speech. Stored as a count of speeches from the
 * end, so the choice carries across rounds and events.
 */
function SpeechRange({ round }: { round: FlowRound }) {
    const count = useFlowStore((s) => s.decisionSpeeches);
    const setDecisionSpeeches = useFlowStore((s) => s.setDecisionSpeeches);
    const order = orderOf(round);
    const items = order
        .slice(0, order.length - DECISION_SPEECHES_DEFAULT + 1)
        .map((speech, i) => ({ value: String(order.length - i), label: speech.short }))
        .reverse();
    const value = String(Math.min(count, order.length));

    return (
        <div className="flex flex-none items-center gap-1.5">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                From
            </span>
            <Select
                value={value}
                items={items}
                onValueChange={(v) => setDecisionSpeeches(Number(v))}
            >
                <SelectTrigger
                    size="sm"
                    aria-label="Earliest speech shown"
                    data-testid="decision-from"
                    className="h-6 px-2 text-[12px]"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {items.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                            {item.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function Toolbar({ round, hidden }: { round: FlowRound; hidden: DecisionPanel[] }) {
    const setDecisionPanel = useFlowStore((s) => s.setDecisionPanel);

    return (
        <div className="border-border flex flex-none flex-wrap items-center gap-1.5 border-b px-3 py-1.5">
            <SpeechRange round={round} />
            {hidden.length > 0 && (
                <span className="text-muted-foreground ml-2 text-[11px] font-semibold tracking-wider uppercase">
                    Hidden
                </span>
            )}
            {hidden.map(({ sheet }) => (
                <button
                    key={sheet.id}
                    type="button"
                    aria-label={`Show ${sheet.title}`}
                    data-testid={`decision-show-${sheet.id}`}
                    onClick={() => setDecisionPanel(sheet.id, true)}
                    className={cn(
                        "border-border hover:bg-accent/50 flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[12px] transition-colors focus-visible:outline-2",
                        titleInk(sheet),
                    )}
                >
                    <Plus className="size-3" />
                    {sheet.title}
                </button>
            ))}
        </div>
    );
}

function RfdPanel() {
    // Roughly a third of the window; dragging the left edge resizes.
    const [width, setWidth] = useState(() =>
        Math.max(RFD_MIN_WIDTH, Math.round(window.innerWidth * 0.3)),
    );
    // Transient per-mount, like the drawer's: the view always opens in edit mode.
    const [mode, setMode] = useState<RfdMode>("edit");

    function startResize(e: React.PointerEvent) {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = width;
        const max = window.innerWidth * 0.7;
        function onMove(ev: PointerEvent) {
            // Dragging left (smaller clientX) grows the panel.
            setWidth(Math.max(RFD_MIN_WIDTH, Math.min(max, startWidth + (startX - ev.clientX))));
        }
        function onUp() {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        }
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    }

    return (
        <section
            aria-label="Reason for decision"
            data-testid="decision-rfd"
            className="border-border bg-card relative flex flex-none flex-col border-l"
            style={{ width }}
        >
            <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize reason for decision"
                onPointerDown={startResize}
                className="hover:bg-accent absolute inset-y-0 left-0 w-1 cursor-col-resize"
            />
            <div className="border-border flex h-9 flex-none items-center justify-between gap-2 border-b px-3.5">
                <span className="text-foreground text-[12px] font-semibold tracking-wider uppercase">
                    Reason for decision
                </span>
                <RfdModeTabs mode={mode} onChange={setMode} />
            </div>
            <RfdEditor mode={mode} />
        </section>
    );
}

export default function DecisionView() {
    const round = useFlowStore((s) => s.round);
    const overrides = useFlowStore((s) => s.decisionPanels);
    const count = useFlowStore((s) => s.decisionSpeeches);
    const panels = useMemo(
        () => (round ? decisionPanels(round, overrides, count) : { shown: [], hidden: [] }),
        [round, overrides, count],
    );

    return (
        <div data-testid="decision-view" className="no-print flex min-h-0 min-w-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
                {round && <Toolbar round={round} hidden={panels.hidden} />}
                {panels.shown.length > 0 ? (
                    <div className="flex min-h-0 flex-1 overflow-x-auto">
                        {panels.shown.map((panel) => (
                            <Panel key={panel.sheet.id} panel={panel} />
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground p-6 text-[13px]">
                        No sheets shown. A sheet appears here once the speeches shown or its
                        cross-ex have text in them
                        {panels.hidden.length > 0 &&
                            "; show one from the list above to lay it out now"}
                        .
                    </p>
                )}
            </div>
            <RfdPanel />
        </div>
    );
}
