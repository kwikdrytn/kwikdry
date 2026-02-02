
# Fix Sidebar Hover Background Color

## Problem
The sidebar buttons currently use `--sidebar-accent` for hover states, but this CSS variable is set to `228 66% 61%` - a lighter blue color. You want the hover background to match the primary color (`230 50% 41%` / `#35479e`).

## Solution
Update the `--sidebar-accent` CSS variable in `src/index.css` to match the primary color value.

## Changes

### File: `src/index.css`

**Line 54** - Update the light theme sidebar accent:
```css
/* Before */
--sidebar-accent: 228 66% 61%;

/* After */
--sidebar-accent: 230 50% 41%;
```

This single change will ensure that all sidebar button hover states use the same color as the primary color (`#35479e`), giving you a solid, consistent hover background without any transparency or lightness issues.

---

## Technical Details

| Token | Current Value | New Value | Color |
|-------|--------------|-----------|-------|
| `--sidebar-accent` | `228 66% 61%` | `230 50% 41%` | `#35479e` |

The sidebar buttons already use `hover:bg-sidebar-accent` via the `sidebarMenuButtonVariants` in `src/components/ui/sidebar.tsx`. By updating the CSS variable, all hover states will automatically use the correct primary color.
