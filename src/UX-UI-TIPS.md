# UX/UI Tips — Frozen Sick Campaign Timeline

Tips to improve the timeline app’s look and feel, plus how to use the **Calendar of Harptos** stations for month symbols and colors.

---

## 1. General UX/UI improvements

### Visual hierarchy
- **Header vs content**: Keep the campaign title and tab nav clearly separated (e.g. subtle bottom border or background difference) so the main content reads as “below” the chrome.
- **Sidebar vs timeline**: Slightly different surface tones (`--surface` vs `--surface-2`) are already in use; consider a thin vertical divider or stronger border so the timeline feels like the primary canvas.
- **Event cards**: A small left border in the event type color is good; add a very subtle inner shadow or 1px lighter top edge so cards feel slightly raised.

### Timeline axis
- **Month visibility**: At year-scale zoom the axis only shows years (e.g. `1344 DR`–`1540 DR`). When zoomed to month or week, month names already appear; ensure the zoom steps make “month” scale easy to reach (e.g. scroll sensitivity or a “Zoom to months” control).
- **Grid lines**: Minor grid at month boundaries (when zoomed in) help align events to the calendar; keep minor grid color distinct but low-contrast (`--border`) so it doesn’t compete with events.
- **Label legibility**: Axis labels use `--text-muted`; if the background is very dark, consider 12px and slightly higher weight for the main scale (e.g. year) so key dates scan quickly.

### Affordances and feedback
- **Add Event**: The “+ NEW EVENT” and “+ ADD EVENT” buttons are clear; keep them the single primary action (gold/accent) so they stay discoverable.
- **Filters**: Type chips and timeline checkboxes are good. Consider a small “active filter” count or pill (e.g. “3 filters”) next to “Clear all” when any filter is on.
- **Selection**: Selected event is already highlighted (gold ring); ensure the detail panel scrolls into view or is obvious so users see the connection between click and content.
- **Empty state**: When “Showing 0 of N events”, a short line like “No events match the current filters” or “Try adjusting filters” reduces confusion.

### Spacing and density
- **Sidebar**: Slightly more padding between “Event Type”, “Timelines”, “Characters”, and “Tags” sections (e.g. 12–16px) improves scanning.
- **Detail panel**: The meta row (date, timeline) is compact; a bit more gap between the title and the meta block (e.g. 10–12px) helps the title stand out.
- **Tags**: Tag chips are dense; a 4–6px gap between chips keeps them from feeling cramped.

### Accessibility and polish
- **Focus states**: Visible focus ring on buttons and inputs (e.g. `outline: 2px solid var(--gold)` on `:focus-visible`) helps keyboard users.
- **Tooltips**: Event tooltips already show title, date, and a bit of description; keep the overflow cap and ensure tooltip contrast against the timeline background.
- **Scrollbars**: Custom scrollbars are themed; ensure thumb has enough contrast for visibility (`--border-bright` / `--gold-dim`).

---

## 2. Calendar of Harptos — stations, symbols, and colors

The **Calendar of Harptos** gives each month a “station” (seasonal theme). Use these for **month-level visuals** so the timeline and event details feel tied to the in-world calendar.

### Suggested palette (by station)

| Month     | Station              | Suggested use (color / feel) |
|----------|----------------------|------------------------------|
| Hammer   | Deepwinter           | Cold: `#6b8cae`, `#8faac4` — snow, ice, bare branches |
| Alturiak | The Claw of Winter   | Late winter: `#7a9bb8`, muted blue-grey |
| Ches     | The Claw of the Sunsets | Early spring: `#7d9e7d`, thaw, first green |
| Tarsakh  | The Claw of the Storms | Spring: `#5a9a5a`, `#7ab87a` — storms, growth |
| Mirtul   | The Melting          | Late spring: `#6bab6b`, lush green, flowers |
| Kythorn  | The Time of Flowers  | Early summer: `#8fbc8f`, meadows, bloom |
| Flamerule| Summertide           | Peak summer: `#c9a227`, `#e8c547` — sun, heat |
| Eleasias | Highsun             | Late summer: `#d4a84b`, golden fields |
| Eleint   | The Fading           | Early autumn: `#b8860b`, `#c9a227` — first leaves turning |
| Marpenoth| Leaffall            | Autumn: `#a0522d`, `#cd5c5c` — reds, oranges |
| Uktar    | The Rotting         | Late autumn: `#6b5b4f`, `#8b7355` — decay, browns |
| Nightal  | The Drawing Down    | Winter return: `#4a5568`, `#5a6578` — dark, cold |

Use these as **optional** `station` and `color` on each calendar month (see schema and defaults). When present, the UI can show:

- **Timeline axis**: When the scale is “month”, give each month label a small left border or background tint in that month’s color so the year reads as a band of seasons.
- **Event tooltips / detail**: Next to the date text, show a small **month indicator** — e.g. a 6–8px dot or thin vertical bar in the month’s color, or a tiny icon (snowflake / leaf / sun) derived from the station name.
- **Calendar config (Settings)**: In the month list, show the station name and a color swatch so DMs can see and tweak the “season” of each month.

### Symbols and icons (optional)

If you add icons per month/station, keep them simple and consistent (e.g. Lucide or a single icon set):

- **Winter (Hammer, Alturiak, Nightal)**: snowflake, cloud-snow
- **Spring (Ches, Tarsakh, Mirtul)**: leaf, flower, sun
- **Summer (Kythorn, Flamerule, Eleasias)**: sun, flower2
- **Autumn (Eleint, Marpenoth, Uktar)**: leaf-fall, tree-pine

Use one icon per “season” or one per station; same icon can repeat for months in the same season if that keeps the UI clean.

### Implementation notes

- **No hardcoding in components**: Store station name and optional color on `CalendarMonth` (e.g. `station?: string`, `color?: string`). Default calendar data can be filled from a Harptos constant; other campaigns can leave them blank or set their own.
- **Graceful fallback**: If a month has no `color`, use a neutral (e.g. `--border-bright`) or omit the tint so custom calendars still work.
- **Accessibility**: Use month color as an enhancement (border, dot, background tint), not as the only way to convey the month; the month name in text remains primary.

---

## 3. Quick wins

1. **Month color on axis**: When `scale === 'month'`, style `.vis-time-axis .vis-text` (or the minor label) with a left border or background using `calendar.months[i].color` if present.
2. **Event detail date**: Add a small colored dot or bar next to `formatDate(ev.date, cal)` using the event’s month `color` from the calendar.
3. **Filter count**: Show “3 filters” (or similar) next to “Clear all” when `hasFilters` is true.
4. **Empty filter state**: When `filteredCount === 0` and `totalCount > 0`, show a one-line hint: “No events match. Try clearing some filters.”
5. **Focus ring**: Add a global `:focus-visible` style for buttons and inputs using `var(--gold)` or `var(--gold-dim)`.

These keep the current architecture (vis-timeline, Svelte 5, Tailwind) and make the app feel more polished and calendar-aware without large refactors.
