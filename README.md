# mcp-19hz

19hz.info MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 899+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `regions` | List the regions 19hz covers (slug + label). Pass a slug to the events tool. Note: electronic/dance music focus (house, techno, bass, etc.). |

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

Or connect to the full Pipeworx gateway for access to all 899+ data sources:

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

- [All tools and guides](https://github.com/pipeworx-io/examples)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
