import { memo, useCallback, useEffect, useRef, useState } from "react"
import type { LegendListRef } from "@legendapp/list/react"
import type { ResolvedTranscriptRow } from "../KannaTranscript"
import { cn } from "../../lib/utils"

interface ScrollMinimapProps {
  resolvedRows: ResolvedTranscriptRow[]
  listRef: React.RefObject<LegendListRef | null>
  activeChatId: string | null
  headerOffsetPx: number
}

/** Thin vertical rail with dots for each user message. */
export const ScrollMinimap = memo(function ScrollMinimap({
  resolvedRows,
  listRef,
  activeChatId,
  headerOffsetPx,
}: ScrollMinimapProps) {
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const [scrollRatio, setScrollRatio] = useState(0)
  const railRef = useRef<HTMLDivElement>(null)

  // Extract user-message rows
  const userRows = resolvedRows.filter(
    (row): row is Extract<ResolvedTranscriptRow, { kind: "single" }> =>
      row.kind === "single" && row.message.kind === "user_prompt",
  )

  // Compute each user row's proportional position in the full row list
  const totalRows = resolvedRows.length
  const dotPositions = userRows.map((row) => {
    const rowIndex = resolvedRows.indexOf(row)
    return {
      id: row.id,
      ratio: totalRows > 1 ? rowIndex / (totalRows - 1) : 0.5,
    }
  })

  // Track scroll position to highlight the nearest dot
  useEffect(() => {
    const scrollNode = listRef.current?.getScrollableNode?.()
    if (!(scrollNode instanceof HTMLElement)) return

    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollNode
      const maxScroll = scrollHeight - clientHeight
      const ratio = maxScroll > 0 ? scrollTop / maxScroll : 0
      setScrollRatio(ratio)

      // Find which user-message element is closest to the viewport center.
      // LegendList uses absolute positioning so offsetTop is always 0;
      // we must use getBoundingClientRect() relative to the scroll container.
      const scrollRect = scrollNode.getBoundingClientRect()
      const viewportCenterY = scrollRect.top + clientHeight / 2
      let closestId: string | null = null
      let closestDist = Infinity

      for (const uRow of userRows) {
        const el = scrollNode.querySelector(`[data-transcript-row-id="${uRow.id}"]`)
        if (el instanceof HTMLElement) {
          const elRect = el.getBoundingClientRect()
          const rowCenterY = elRect.top + elRect.height / 2
          const dist = Math.abs(rowCenterY - viewportCenterY)
          if (dist < closestDist) {
            closestDist = dist
            closestId = uRow.id
          }
        }
      }

      setActiveRowId(closestId)
    }

    update()
    scrollNode.addEventListener("scroll", update, { passive: true })
    return () => scrollNode.removeEventListener("scroll", update)
  }, [activeChatId, listRef, userRows])

  const handleDotClick = useCallback(
    (rowId: string) => {
      const scrollNode = listRef.current?.getScrollableNode?.()
      if (!(scrollNode instanceof HTMLElement)) return

      // If the element is already in the DOM, scroll directly to it
      const el = scrollNode.querySelector(`[data-transcript-row-id="${rowId}"]`)
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        return
      }

      // Element is virtualized out — estimate scroll position from row index.
      // Scroll there first so LegendList renders the target, then fine-tune.
      const rowIndex = resolvedRows.findIndex((r) => r.id === rowId)
      if (rowIndex < 0) return

      const { scrollHeight, clientHeight } = scrollNode
      const maxScroll = scrollHeight - clientHeight
      const estimatedTop = maxScroll * (rowIndex / Math.max(resolvedRows.length - 1, 1))
      scrollNode.scrollTop = estimatedTop

      // After LegendList renders the new viewport, find the element and fine-tune
      const refine = (attempts: number) => {
        if (attempts <= 0) return
        window.requestAnimationFrame(() => {
          const target = scrollNode.querySelector(`[data-transcript-row-id="${rowId}"]`)
          if (target instanceof HTMLElement) {
            target.scrollIntoView({ behavior: "smooth", block: "center" })
          } else {
            refine(attempts - 1)
          }
        })
      }
      refine(10)
    },
    [listRef, resolvedRows],
  )

  if (userRows.length === 0) return null

  return (
    <div
      ref={railRef}
      className="absolute right-0 z-10 flex w-4 flex-col items-center opacity-40 transition-opacity hover:opacity-100"
      style={{ top: headerOffsetPx, bottom: 0 }}
    >
      {/* Viewport indicator */}
      <div
        className="absolute left-0.5 w-1 rounded-full bg-primary/20 transition-all duration-150"
        style={{
          height: `${Math.max(8, (1 / Math.max(resolvedRows.length, 1)) * 100)}%`,
          top: `${scrollRatio * 100}%`,
        }}
      />
      {/* Dots */}
      {dotPositions.map(({ id, ratio }) => (
        <button
          key={id}
          onClick={() => handleDotClick(id)}
          className={cn(
            "absolute left-1/2 -translate-x-1/2 rounded-full transition-all duration-150 cursor-pointer",
            "hover:scale-150",
            id === activeRowId
              ? "h-2 w-2 bg-primary shadow-sm shadow-primary/30"
              : "h-1.5 w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70",
          )}
          style={{ top: `${ratio * 100}%` }}
          aria-label="Jump to message"
        />
      ))}
    </div>
  )
})
