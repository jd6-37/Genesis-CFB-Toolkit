# Design system

One set of tokens and components for both apps in this repo: the **Mod Toolkit** (indigo and yellow, the game's Game Setup screen) and **Dynasty** (neutral paper and ink; the only color on a page is a team's). They are two brands of one family: the same components, type and spacing, with different colors.

Owner's goal (2026-11-12): a documented system and component library, so any session, including cheaper models, produces consistent code and a consistent look.

## The look (owner, 2026-11-12 and 2026-11-13)

Picked from three Figma mockups (file "CFB-Toolkit", page "Directions"): **"B's structure with A's pixel numerals."**

- **Both apps borrow from the game's own menu screens** (owner, 2026-11-13: "you should be taking inspiration from the BW95 in-game menus design … Don't feel like you need to overdo it with the pixel font … The design still need to look good and be legible"):
  - a page's title sits in a double-line frame over a faint dither (`PageHead`), like the game's "TEAM ROSTER" box;
  - section headings are slanted block capitals in a bar (`SubHead`), like QUARTERBACK / RUNNING BACKS;
  - column headings are small uppercase labels in their own color (`--label`), like ENERGY SPEED QUICK;
  - every other table row sits on a bar (`--row`), with no rules between rows;
  - figures are in the pixel font. Words never are: headings and labels stay in Barlow Condensed so they read easily.
- **Dynasty is neutral** (white, black, grays; dark mode as a negative) so that team colors are the only color on a page and never clash. **The Mod Toolkit is blue and yellow**, the game's own colors: yellow headings, light-blue labels, blue row bars.
- **Pixel numerals** (Press Start 2P, `--font-num`) for figures only: scores, ratings, table numbers. Never for words. The font is wide, so it has its own sizes: `--fs-num-1` (12 px, tables) to `--fs-num-4` (32 px, big ratings). Its digits sit 1/8 em above the baseline, so `tokens.css` loads it as 'Press Start Numerals' with a taller box (centered in table cells and chips); a figure on a shared baseline with text also gets `ui-num-drop`. Two more figure fonts (owner's picks, 2026-11-13): `--font-num-narrow` (Handjet) where Press Start 2P is too wide, and `--font-num-tiny` (Micro 5, always at `--fs-num-tiny`, 15 px) for really small figures such as a rank beside a team name.
- **The Mod Toolkit keeps its indigo and yellow** and takes the same components ("yes, toolkit too").
- **The Mod Toolkit's tab menu is "the subtle retro design"** (mockup A's toolkit frame): Barlow Condensed as today, square corners, 2 px rules and hard offset shadows. No pixel menu text and no chrome selection bar.
- **Dark mode is for Dynasty only** ("the blue design of the toolkit is enough").
- **Colors:** prefer Genesis palette values (each channel one of 0, 36, 73, 109, 146, 182, 219, 255) for solid UI colors. It's a guide that keeps the palette small and close to the game's art, not a hard rule.

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
- **Colors:** `--surface`, `--surface-raised`, `--surface-sunken`, `--text`, `--text-muted`, `--rule`, `--rule-strong`, `--bar`, `--on-bar`, `--bar-on` (section bars and the nav), `--masthead`, `--on-masthead` (the app's top bar: black in Dynasty light and dark), `--accent`, `--on-accent`, `--field`, `--highlight`, `--good`, `--good-wash`, `--bad`, `--bad-wash`, `--scrim`.
- **Type:** `--font-display` (Barlow Condensed), `--font-body` (Barlow), `--font-num` (Press Start 2P, figures only; sizes `--fs-num-1` to `--fs-num-4`); sizes `--fs-1` (12 px) to `--fs-8` (56 px). Every font size in the Dynasty app's stylesheet is one of these (or a `clamp` between two of them for the big titles).
- **Spacing:** `--sp-1` (4 px) to `--sp-7` (48 px), built on the Genesis' 8 px tile.
- **Shape:** `--radius` (0), `--rule-w` (1 px), `--rule-w-strong` (4 px).

## Components

| Component | Use it for |
|---|---|
| `Button` | An action, or a link that looks like one (`href`). `variant`: `primary` (one per view), `quiet`, `danger`, `link` (an action that reads as underlined text: undo, close, a name in a list or a table cell; `strong` makes it bold). |
| `Row` | Buttons or controls side by side; wraps on phones. |
| `Note` | A message about what happened or what to do next. `kind`: `info`, `ok`, `error`. |
| `PageHead`, `SubHead` | A page's title with its line of text and controls; a section heading (a bar with reversed type). |
| `Select` | A labeled dropdown (`hideLabel` keeps the label for screen readers). Options with the same `group`, one after the other, are listed under that heading. `compact` for table cells and tight rows. |
| `Field` | A labeled one-line field: `type` `text` (default), `number` or `search`; `hideLabel` as `Select`; `note` for a short line under it. |
| `DataTable` | Any table of records: columns (`left` for text, `num` for figures in pixel numerals), rows, `mine` to mark the user's rows, `empty` text. Scrolls sideways inside itself on phones. |
| `Stat` | One number with a label (an OVR, a record). |
| `Num` | A figure with commas in the thousands (`<Num value={12356} />`). In the pixel numerals it draws the comma tight against the digits; use it for any figure that can pass 999. |
| `Empty` | A page with nothing yet: say what to do next. |
| `Table` | A hand-written table (`thead`, `tbody`, `caption`) with the shared look, for tables `DataTable`'s columns can't describe: selects in cells, a totals row, columns that come and go. `figures` puts every cell in the pixel numerals except `ui-left` (text columns) and `ui-text` (a word, like a class or position); `ui-num` marks one figure cell in a table without `figures`; a totals row is `<tr className="ui-total">`. `className` is for column widths only. `words`: every cell is text, left-aligned, and a row heading (`th` in the body) reads as text (a reference list). `edit`: an editor, whose cells hold `compact` dropdowns and fields; mark a changed row with `ui-row-mine`. |
| `Check` | A checkbox with its label (a short phrase or a sentence or two); `checked`, `onChange`, `disabled`. |
| `FileButton` | A button that asks for a file: `label`, `accept`, `onFile` (the first file) or `onFiles` with `multiple`; `variant` as `Button`. |
| `Modal` | A window for one decision. Escape or a click outside closes it when it has `onClose`; without it the user must pick a button. `media` puts a picture beside the title, `sub` one line under it. |
| `Steps` | A process in order with the step the user is on (`label` for screen readers, `steps` with `label` and optional `href`, `current`). Steps before it read as done; a step with `href` is a link, for steps the user may jump to. On a phone only the current step shows, as "Step 3 of 8: Recruiting". |
| `Tabs` | The sections of a hub page, one open at a time: `label` (for screen readers), `tabs` (`value`, `label`, optional `count`), `value`, `onChange`. The page shows the open section itself. Scrolls sideways inside itself on phones. |
| `Meter` | A bar for a share from 0 to 1 (interest, a pitch's strength). `label` for screen readers; `color` only for a team's color. Put the figure beside it when it matters. |
| `Masthead` | An app's header: `title` (links to `href`), `sub` (one line under it), `left` and `right` for small controls and marks; its children sit under the title row (the `NavBar`). On a phone the title drops to its own row. |
| `NavBar` | An app's main menu: `label` (for screen readers) and `items` (`label`, `href`, `current`, `off`). One mark per item: a bar under it. Scrolls sideways inside itself on phones. |
| `ThemeToggle` | The light/dark switch in Dynasty's masthead. The app sets `data-theme` from it and keeps the choice in the browser. |

## Status (2026-11-13)

- Built: tokens, the components above, Storybook, the token check, Chromatic on pull requests.
- **Dynasty:** colors on the tokens, dark mode, and its pages use `Button`, `SubHead`, `PageHead`, `Note`, `Empty`, `Table`, `Select`, `Field`, `Modal` and `ThemeToggle`. Every dropdown, every one-line text field in the player editor and Manage, and all three windows (the ROM download, the rules' spoiler warning, the box score) are shared components. Corners are square and scores, OVRs and rating tiles use the pixel numerals.
- **Dynasty tables** all use `Table` (18 of them); figures are in the pixel numerals.
- **Dynasty's masthead and main menu** are `Masthead` and `NavBar`. The score ticker stays Dynasty's own (it is a scores strip, not a general element) and uses the tokens.
- **Dynasty, not moved yet:** the checkboxes in the cut list's rows, the training sliders, the rules page's number fields and the recruiting points stepper. The player page's rating tiles stay their own (a pip bar and the bold labels the owner asked for; `Stat` has neither).
- **Mod Toolkit:** every tab's title (`PageHead`), section headings (`SubHead`), buttons (`Button`, `FileButton`, the text-like `link` buttons), messages (`Note`, with `block` for lists), the dropdowns, text and number fields, checkboxes, and all four tables (the roster grids, the Teams table, a locked schedule's weeks, the CFB 27 list) are shared components. Still their own: the Patch tab's option cards (radio buttons), the Home / Away switch in the weeks table, the color swatches and the ROM cards; `styles.css` maps its own names to the tokens; corners are square and the ROM cards have the hard shadow.
- **Mod Toolkit, not moved yet:** its four tables, the selects and number fields in the editors, the link-style buttons (`ros-link`, `sty-link`), the tab menu's markup, the Team Swap rows, and the font sizes in its stylesheets.
- Team colors in charts: use `inkColor(d, team, dark)` so the color shows on the page in both themes.
- `Select` takes `title` (a tooltip), `note` (a line under it) and `placeholder` (shown while the value is '', for a menu that acts at once such as "Move"); `Field` takes `invalid` (a red border), `onBlur` (with it, Enter leaves the field too), `compact` and `digits` (whole numbers typed as text). `Select` and `Field` take `changed` (the value differs from what was loaded); `Select` takes `tone` (`dim` or `strong`, so the extremes stand out in a grid of values).
- `Button` takes `title` (a tooltip) and `label` (the name for screen readers); a link button with `disabled` has no address. `SubHead` takes `level={2}` for a section that isn't under a page title.
