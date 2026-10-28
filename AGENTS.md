# Receipt field changes

Whenever fields are added, removed, renamed or reordered:
- Read the live Sheet headers and map by header name, never physical column index.
- Check the table header order, every rendered cell, the editor fields, and the write mapping together.
- Preserve fields not edited by the user and verify dependent pending/summary formulas after Sheet changes.
- Keep Weight and Quantity independent; do not substitute one for the other or invent missing quantities.
- Run `node --check app.js` and `node schema.test.cjs` before pushing.
- Verify ascending, descending and cleared sorting; cleared sorting restores original Sheet row order.
- Bump the app.js version in index.html when the schema or rendering changes.
