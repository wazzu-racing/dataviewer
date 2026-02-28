# Known Issues

Identified issues organized by priority. Items marked **Done** have been resolved.

---

## High Priority

### 1. Tiled layout not persisted — **Done**

`+page.svelte` now serializes the `layout` tree to `localStorage` on every change and restores it on mount.
Previously, refreshing the page always reset to a single "Load Data" pane.

### 2. Gauge widget config not persisted — **Done**

`GaugeWidget` now accepts a `config` prop and fires `onConfigChange` when the field selection changes,
using the same seed-once / mount-guard pattern as `GraphWidget`. The selected field survives layout
saves and restores.

### 3. Table widget config not persisted — **Done**

`TableWidget` now accepts a `config` prop and fires `onConfigChange` when visible columns change.
Column selections survive layout saves and restores.

### 4. `GaugeWidget` was a last-value display, not a gauge — **Done**

The linear progress bar has been replaced with a proper SVG arc (semi-circle) gauge.
The fill arc, value, unit, and min/max labels are all rendered in pure SVG — no extra dependency.

### 5. No data persistence across page reloads

Loaded telemetry is held in memory only (`globalData.lines`). Refreshing the page loses all data.
There is no export, re-import, or session/IndexedDB storage of the parsed rows.

---

## Medium Priority

### 6. `alert()` for parse errors — **Done**

`ReadData.svelte` now shows parse errors inline in red text instead of blocking `alert()` dialogs.

### 7. No progress feedback for large file loads

The whole `.bin` file is read into an `ArrayBuffer` synchronously before any rows are processed.
There is no spinner, progress bar, or chunked/streaming parse for large files. The UI will appear
frozen during the parse of large files.

### 8. `FloatingPane` resize dimensions not saved

`style="resize: both"` allows CSS-driven resizing, but the resulting dimensions are never written
back to `FloatingPaneState`. After docking a resized floating pane or reloading, the custom size
is lost.

### 9. `amb_air_temp` has no scaling

`row[45]` is passed through as-is (raw ADC integer) in `dataParser.ts`, unlike all adjacent analog
channels which have explicit unit conversions. Likely either a missing scaling step or intentional
pass-through that should be documented.

### 10. Map widget has no cursor sync with Graph

There is no link between the graph cursor position and a highlighted point on the map. Implementing
this would require a shared cursor-position store and a Leaflet marker that follows it.

---

## Low Priority

### 11. No Y-axis zoom/pan in GraphWidget

Only the X axis supports wheel-zoom and drag-pan. There is no way to zoom into a specific Y range.
Each series uses an independent auto-scaling Y axis (`y0`, `y1`, …) which helps with multi-unit
overlays but cannot be manually adjusted.

### 12. `GraphConfig.xField` / `yFields` typed as `string`

Should be narrowed to `keyof DataLine` (excluding `unixtime`) to catch field-name typos at compile
time. Currently both fields are `string` and each widget must cast to its internal `NumericField`
type at runtime.

### 13. No validation of row width in `dataParser.ts`

The parser trusts that every row in the binary file contains exactly `NUM_FIELDS` (48) int32 values.
There is no length check before the inner read loop; a truncated final row is silently skipped by
the `Math.floor` row-count calculation, but a file with the wrong field count would produce garbage
data with no warning.

### 14. `SPEED_SCALE` comment is ambiguous

The constant `447.04` in `dataParser.ts` is commented as converting raw units → mph, but the raw
unit (cm/s? mm/s?) is not documented, making the conversion hard to verify independently.

### 15. E2E "layout persistence" test does not verify persistence

`e2e/app.spec.ts` has a test called "layout persistence" that closes a pane and reloads, but only
checks that the sidebar `<aside>` is still visible — it would pass whether layout persists or not.
Should be updated to assert specific layout state after reload.

### 16. `GaugeWidget` field list diverges from `TableWidget`

`GaugeWidget` defines a hand-curated 35-field `NUMERIC_FIELDS` list inline, while `TableWidget`
defines its own 47-field `ALL_COLUMNS` list. Any new field added to `DataLine` must be manually
added to both. Consider extracting a shared constant.
