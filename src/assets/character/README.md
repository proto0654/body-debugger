# Character art library

Desk Hulk remains the default, currently bundled character. The approved cast below
has **432 transparent frames** ready for a later runtime pack selector: nine
characters × three builds × sixteen states. These assets do not yet change the
active character in the app.

Review the [build comparison](character-builds-preview.png) and the original
[casting sheet](character-casting-sheet.png).

## Sources

The built-in `image_gen` tool generated all character art using the approved
casting sheet as the identity/style reference. Exact generation or edit prompts
are saved beside each PNG with the suffix `.prompt.txt`.

| Character | Ordinary build | Lean and stocky sources |
|-----------|----------------|-------------------------|
| Альтуха | [Average](alt-girl/sprite-sheet-average.png) | [Lean + stocky](alt-girl/sprite-sheet-builds.png) |
| Нефор | [Average](punk/sprite-sheet-average.png) | [Lean + stocky](punk/sprite-sheet-builds.png) |
| Зумер | [Average](zoomer/sprite-sheet-average.png) | [Lean + stocky](zoomer/sprite-sheet-builds.png) |
| Милфа | [Average](cool-mom/sprite-sheet-average.png) | [Lean](cool-mom/sprite-sheet-lean.png), [stocky](cool-mom/sprite-sheet-stocky.png), [complete neglect body](cool-mom/sprite-neglect-3-stocky.png) |
| Метро | [Average](metro/sprite-sheet-average.png) | [Lean](metro/sprite-sheet-lean.png), [stocky](metro/sprite-sheet-stocky.png) |
| Стритвир | [Average](streetwear/sprite-sheet-average.png) | [Lean + stocky](streetwear/sprite-sheet-builds.png) |
| Инстадива | [Average](insta-diva/sprite-sheet-average.png) | [Lean + stocky](insta-diva/sprite-sheet-builds.png) |
| Инженер | [Average](engineer/sprite-sheet-average.png) | [Lean + stocky](engineer/sprite-sheet-builds.png) |
| Хипстер | [Average](hipster/sprite-sheet-average.png) | [Lean + stocky](hipster/sprite-sheet-builds.png) |

## Frame contract

[packs.json](packs.json) is the source of truth for pack ids, labels, source sheets,
build assignments, cell order and standalone replacements. Each pack has a
`frames/` output with these keys for **each** of `lean`, `average` and `stocky`:

- `stage-{0..5}-{build}.png`: six progression bodies.
- `neglect-{1..3}-{build}.png`: three temporary neglect bodies.
- `emotion-{tired,neutral,focused,happy,proud}-{build}.png`: five expressive busts.
- `pose-{power,mobility}-{build}.png`: two full-body exercise poses.

The ordinary sheets contain four rows of four cells. Combined build sheets repeat
that sixteen-cell order twice: lean first, stocky second. Separate sheets are
declared per pack when they provide a better result. The stocky mother's maximum
neglect body has a standalone replacement because its sheet cell was cropped;
the cutter uses the declared replacement, never the cropped cell.

Preserve the original source alpha. Rows can have different heights and nearby
figures can be joined by tiny alpha bridges, so equal-grid cropping is unsafe.
The cutter detects contours, rejects incomplete grids, isolates neighbouring
figures and prepares a complete pack before writing its 48 outputs. Never edit
generated `frames/` files by hand.

## Regeneration and checks

From the repository root (Pillow and NumPy are required):

```bash
python scripts/cut-character-sprites.py --packs
python scripts/cut-character-sprites.py --packs alt-girl punk
python -m unittest discover -s tests -p 'test_*.py'
npm test -- tests/unit/character-packs.test.ts
```

The cutter also updates the build comparison once all nine packs are available.
Python tests cover alpha preservation, neighbouring fragments, unequal row
heights, incomplete sheets and thin bridges. Vitest checks every source/prompt
and all 432 RGBA outputs, including distinct artwork for the three builds.

Runtime rules and the active Desk Hulk resolver are documented in
[Architecture](../../../docs/ARCHITECTURE.md). Running the cutter without `--packs`
still rebuilds Desk Hulk's existing 42 frames separately.
