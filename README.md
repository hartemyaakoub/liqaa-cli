<div align="center">

# LIQAA CLI

**A terminal for your video infrastructure.**

[![npm version](https://img.shields.io/npm/v/@liqaa/cli.svg?style=flat-square&color=1d4ed8)](https://www.npmjs.com/package/@liqaa/cli)
[![node](https://img.shields.io/badge/node-%3E%3D18-5fa04e?style=flat-square)](https://nodejs.org)
[![license](https://img.shields.io/badge/license-MIT-475569.svg?style=flat-square)](./LICENSE)

```bash
npx @liqaa/cli rooms list
```

[Website](https://liqaa.io) · [Docs](https://liqaa.io/docs) · [JS SDK](https://github.com/hartemyaakoub/liqaa-js)

</div>

---

## Install

```bash
npm install -g @liqaa/cli
# or use directly without installing
npx @liqaa/cli <command>
```

## Configure

The CLI reads `LIQAA_PK` and `LIQAA_SK` from env, or from `~/.liqaa/config.json`:

```bash
liqaa login           # interactive — paste pk/sk, stored in ~/.liqaa/config.json (chmod 600)
liqaa whoami          # show current account + plan
```

## Commands

### Rooms

```bash
liqaa rooms list                              # all active conversations
liqaa rooms create alice@a.com bob@b.com      # create persistent room
liqaa rooms get conv_2f9aBcDe                 # fetch room state
liqaa rooms end conv_2f9aBcDe                 # end an active call
liqaa rooms tail                              # follow new rooms in real-time
```

### Tokens

```bash
liqaa token issue user@example.com --name "User"
# → outputs the 1-hour SDK token (use in browser)
```

### Webhooks

```bash
liqaa webhooks list
liqaa webhooks create https://you.com/hooks call.started call.ended
liqaa webhooks deliveries 17 --tail
liqaa webhooks delete 17
```

### Diagnostics

```bash
liqaa ping                  # check API + signaling latency from your machine
liqaa status                # current LIQAA service health
liqaa logs                  # recent webhook deliveries (tail -f style)
```

### Project bootstrap

```bash
liqaa init nextjs my-app    # → npx create-next-app + LIQAA wired in
liqaa init react my-app
liqaa init vanilla my-site
```

## Output formats

```bash
liqaa rooms list                  # human-readable table
liqaa rooms list --json           # raw JSON for piping
liqaa rooms list --quiet          # IDs only — for scripts
liqaa webhooks list | jq '.[].url'
```

## Shell completion

```bash
liqaa completion bash >> ~/.bashrc
liqaa completion zsh >> ~/.zshrc
liqaa completion fish > ~/.config/fish/completions/liqaa.fish
```

## Why a CLI?

For backend engineers, the terminal is home. With this CLI you can:

- 🔍 **Debug a customer issue** — `liqaa rooms get conv_X` shows you exactly when it started, who joined, when it ended
- 🚀 **Script bulk operations** — Bash + `--json | jq` covers any one-off
- 🔁 **Replay webhooks** — `liqaa webhooks deliveries 17 --replay 1234` re-fires a delivery for testing
- ⚡ **Quick smoke tests** — `liqaa ping` in CI to verify API health before deploys

## License

[MIT](./LICENSE) © TKAWEN — LIQAA Cloud.
