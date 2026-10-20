# Bridger docs

Mintlify documentation for Bridger, published at `docs.bridger.kr`.

> Private internal documentation repository. Served via Mintlify hosting.

## Layout

| Path | Purpose |
| --- | --- |
| `<section>/` | Mintlify pages |
| `docs.json` | navigation and theme configuration |
| `logo/` | brand assets |
| `scripts/` | content generation helpers |

## Local dev

```bash
npm install
npm run dev
```

## License

Private. © Bridger.

## MCP example verification

Run `npm run test:examples` for the checker regression tests and
`npm run verify:live-tools` to compare published example tool names and flat
JSON/JavaScript/Python call argument keys with the deployed `tools/list`
contract. The check only reads metadata; it never executes a tool or needs a
provider key. Fictional BYOAPI examples are separate from the public catalog.

The live check requests `activation=all`, follows pagination, and fails on
unavailable/empty/error responses as well as contract drift. To verify another
deployment, set `MCP_EXAMPLES_ENDPOINT` to its MCP URL. An outage is a failed
verification, not evidence that examples are valid; retry after recovery.
