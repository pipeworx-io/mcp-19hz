# mcp-19hz

19hz.info MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `regions` | List the regions 19hz covers (slug + label). Pass a slug to the events tool. Note: electronic/dance music focus (house, techno, bass, etc.). |
| `events` | List upcoming electronic/dance music events for a 19hz region. Optionally filter by keyword (matches title, venue, genre, or artist) and a date window. Returns normalized events sorted by date. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "19hz": {
      "url": "https://gateway.pipeworx.io/19hz/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about 19hz data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
