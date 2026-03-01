# Agent Runtime Integration Notes

Last updated: 2026-03-01

This note summarizes whether `codex`, `opencode`, and `claude` (Claude Code) support a programmable integration mode comparable to `codex app-server`.

## TL;DR

| Runtime | App-server style protocol endpoint | Model list capability | Recommended integration path |
| --- | --- | --- | --- |
| Codex | Yes (`codex app-server`) | Yes (`model/list` via app-server protocol) | Use app-server JSON-RPC as primary path |
| OpenCode | Yes (`opencode acp` + `opencode serve`) | Yes (`opencode models`, `/config/providers`, `/provider`) | Use `serve` (HTTP/OpenAPI) or `acp` (JSON-RPC stdio) |
| Claude Code | Not as a CLI app-server command | No dedicated `models` command in CLI help; model is selected via `--model`/interactive | Use `claude -p` (`json`/`stream-json`) or Agent SDK |

## 1) Codex

### What it provides

- `codex app-server` runs Codex as a local protocol server.
- It supports request/response plus event-style interaction over JSON-RPC transport.
- Model enumeration is available through protocol method `model/list`.

### Local verification

- `codex --version` -> `codex-cli 0.106.0`
- `codex help models` -> `unrecognized subcommand 'models'`
- `codex app-server --help` is available.
- A local initialize + `model/list` JSON-RPC handshake returned model data successfully.

## 2) OpenCode

### What it provides

- `opencode acp` starts an ACP (Agent Client Protocol) server over JSON-RPC stdio.
- `opencode serve` starts a headless HTTP server with OpenAPI spec at `/doc`.
- Model/provider related APIs are documented on the server surface:
  - `GET /config/providers` (providers + default models)
  - `GET /provider` (all providers, defaults, connected status)
- CLI also has `opencode models [provider]`.

### Local verification

- `opencode --version` -> `1.1.50`
- `opencode --help` includes: `acp`, `serve`, `models`.
- `opencode serve --help` and `opencode acp --help` both available.

## 3) Claude Code

### What it provides

- No CLI command equivalent to `app-server` or `serve` in current `claude --help`.
- Programmatic use is provided by:
  - Headless CLI mode: `claude -p`
  - Structured outputs: `--output-format json`
  - Streaming events: `--output-format stream-json`
  - Official Agent SDK (TypeScript/Python), positioned as library-first integration.

### Local verification

- `claude --version` -> `2.1.12 (Claude Code)`
- `claude --help` lists commands like `doctor`, `install`, `mcp`, `plugin`, `setup-token`, `update`; no app-server command.
- `claude --help` and official CLI docs both show `-p/--print` and `--output-format stream-json`.

## 4) Practical guidance for Harbor

If the goal is "native-client-like orchestration", prioritize integration tiers as:

1. Protocol server mode when available:
   - Codex: `app-server`
   - OpenCode: `serve` or `acp`
2. Headless stream mode when protocol server is not available:
   - Claude Code: `claude -p --output-format stream-json`
3. SDK mode for deeper host-language control:
   - Claude Agent SDK (TS/Python)

For capability APIs, model the shape by integration mode, not by brand:

- `protocol`: server-based JSON-RPC/HTTP orchestration support
- `headless`: non-interactive command automation support
- `sdk`: in-process library support

## Sources

- OpenCode ACP docs: https://opencode.ai/docs/acp/
- OpenCode Server docs: https://opencode.ai/docs/server/
- Claude Code CLI reference: https://code.claude.com/docs/en/cli-usage
- Claude Agent SDK overview: https://platform.claude.com/docs/en/agent-sdk/overview

