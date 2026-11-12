# Design system

One set of tokens and components for both apps in this repo: the **Mod Toolkit** (indigo and yellow, the game's Game Setup screen) and **Dynasty** (neutral paper and ink; the only color on a page is a team's). They are two brands of one family: the same components, type and spacing, with different colors.

Owner's goal (2026-11-12): a documented system and component library, so any session, including cheaper models, produces consistent code and a consistent look.

## Where things are

| What | Where |
|---|---|
| Tokens (colors per brand and theme, type sizes, spacing) | `src/ui/tokens.css` |
| Components | `src/ui/index.tsx`, styles in `src/ui/ui.css` |
| Stories (every component, every state) | `src/ui/*.stories.tsx` |
| Storybook config (brand and theme switch in the toolbar) | `.storybook/` |
| Token check | `npm run lint:design` (`cli/designlint.ts`) |
| Visual checks on pull requests | Chromatic (`.github/workflows/chromatic.yml`) |

Run `npm run storybook` to browse the components (port 6006).

## Rules

1. **Build pages from the components in `src/ui`.** Don't write a new button, table, select, note, page heading, modal or empty state by hand.
2. **A new kind of element becomes a component first:** add it to `src/ui/index.tsx`, style it in `ui.css`, give it a story, then use it.
3. **Only tokens in component styles.** No raw colors (`#fff`, `rgb()`) and no raw font sizes outside `tokens.css`. `npm run lint:design` fails otherwise.
4. **Colors are semantic.** Use `--surface`, `--text`, `--rule`, `--accent` and so on, never a brand's color by name, so a component works in every brand and theme.
5. **Mobile first.** Base styles are for a phone. Two breakpoints only: `min-width: 640px` and `min-width: 960px`.
6. **Check every component in all three looks** in Storybook: Dynasty light, Dynasty dark, Mod Toolkit.
7. **Team colors come from the ROM at run time**, as before. They are not tokens.

## Tokens

- **Brand and theme** are set with `data-brand="toolkit|dynasty"` and `data-theme="light|dark"` on a wrapper element. The toolkit has one look today.
- **Colors:** `--surface`, `--surface-raised`, `--surface-sunken`, `--text`, `--text-muted`, `--rule`, `--rule-strong`, `--accent`, `--on-accent`, `--field`, `--highlight`, `--good`, `--good-wash`, `--bad`, `--bad-wash`, `--scrim`.
- **Type:** `--font-display` (Barlow Condensed), `--font-body` (Barlow); sizes `--fs-1` (12 px) to `--fs-7` (44 px).
- **Spacing:** `--sp-1` (4 px) to `--sp-7` (48 px), built on the Genesis' 8 px tile.
- **Shape:** `--radius`, `--rule-w`.

## Components

| Component | Use it for |
|---|---|
| `Button` | An action, or a link that looks like one (`href`). `variant`: `primary` (one per view), `quiet`, `danger`. |
| `Row` | Buttons or controls side by side; wraps on phones. |
| `Note` | A message about what happened or what to do next. `kind`: `info`, `ok`, `error`. |
| `PageHead`, `SubHead` | A page's title with its line of text and controls; a section heading. |
| `Select` | A labeled dropdown (`hideLabel` keeps the label for screen readers). |
| `DataTable` | Any table of records: columns, rows, `mine` to mark the user's rows, `empty` text. Scrolls sideways inside itself on phones. |
| `Stat` | One number with a label (an OVR, a record). |
| `Empty` | A page with nothing yet: say what to do next. |
| `Modal` | A window for one decision. Escape or a click outside closes it. |

## Status (2026-11-12)

- Built: tokens, the components above, Storybook, the token check, the Chromatic workflow.
- **Not moved yet:** the apps' pages still use the older stylesheets (`src/styles.css`, `src/tools/dynasty/dynasty.css`) and hand-written markup. `npm run lint:design` prints how many raw colors and font sizes they still have. Pages move onto the components in later pull requests.
- **Provisional:** the Dynasty dark colors, and the toolkit's good/bad colors. The visual direction (how retro, pixel type, dither) is still to be decided with the owner; mockups go in Figma first.
- Dark mode toggle: not built. It needs the pages on the tokens first.
