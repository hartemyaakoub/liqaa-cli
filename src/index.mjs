/**
 * LIQAA CLI — manage rooms, webhooks, tokens from your terminal.
 */
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';

const CONFIG_DIR = join(homedir(), '.liqaa');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const API_BASE = process.env.LIQAA_API_BASE || 'https://liqaa.io/api/public/v1';
const VERSION = '1.0.0';

const c = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m',
};

// ── Config ──────────────────────────────────────────────────────────────
async function loadConfig() {
  if (process.env.LIQAA_PK && process.env.LIQAA_SK) {
    return { pk: process.env.LIQAA_PK, sk: process.env.LIQAA_SK };
  }
  if (!existsSync(CONFIG_FILE)) {
    throw new Error(`No credentials. Run \`liqaa login\` or set LIQAA_PK / LIQAA_SK env vars.`);
  }
  return JSON.parse(await readFile(CONFIG_FILE, 'utf8'));
}

async function saveConfig(cfg) {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  try { await chmod(CONFIG_FILE, 0o600); } catch {}
}

// ── HTTP ────────────────────────────────────────────────────────────────
async function api(path, opts = {}) {
  const cfg = await loadConfig();
  const res = await fetch(API_BASE + path, {
    method: opts.method || 'GET',
    headers: {
      Authorization: `Bearer ${cfg.sk}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': `liqaa-cli/${VERSION}`,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`API ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

// ── Output helpers ──────────────────────────────────────────────────────
function tableOf(rows, columns) {
  if (rows.length === 0) {
    console.log(`${c.dim}(no results)${c.reset}`);
    return;
  }
  const widths = columns.map((col) =>
    Math.max(col.label.length, ...rows.map((r) => String(col.value(r) ?? '').length))
  );
  const sep = widths.map((w) => '─'.repeat(w + 2)).join('┼');
  console.log(c.bold + columns.map((col, i) => ' ' + col.label.padEnd(widths[i]) + ' ').join('│') + c.reset);
  console.log(c.dim + sep + c.reset);
  for (const r of rows) {
    console.log(columns.map((col, i) => ' ' + String(col.value(r) ?? '').padEnd(widths[i]) + ' ').join('│'));
  }
}

function isFlag(args, name) {
  return args.includes(`--${name}`);
}

// ── Commands ────────────────────────────────────────────────────────────
const commands = {
  async help() {
    console.log(`${c.bold}LIQAA CLI ${c.reset}${c.dim}v${VERSION}${c.reset}

${c.bold}Usage:${c.reset} liqaa <command> [...args] [--json | --quiet]

${c.bold}Commands:${c.reset}
  ${c.cyan}login${c.reset}                     interactive credentials setup
  ${c.cyan}whoami${c.reset}                    current account + plan
  ${c.cyan}ping${c.reset}                      health check + latency probe

  ${c.cyan}rooms list${c.reset}                list active conversations
  ${c.cyan}rooms create${c.reset} <a> <b>      create persistent room
  ${c.cyan}rooms get${c.reset} <id>            fetch room state
  ${c.cyan}rooms end${c.reset} <id>            end active call

  ${c.cyan}token issue${c.reset} <email>       1-hour SDK JWT for browser

  ${c.cyan}webhooks list${c.reset}             list subscriptions
  ${c.cyan}webhooks create${c.reset} <url> ... subscribe to events
  ${c.cyan}webhooks delete${c.reset} <id>      cancel subscription
  ${c.cyan}webhooks deliveries${c.reset} <id>  recent delivery audit

  ${c.cyan}status${c.reset}                    LIQAA service health
  ${c.cyan}completion${c.reset} <shell>        shell completion script

${c.bold}Docs:${c.reset} ${c.blue}https://liqaa.io/docs${c.reset}
${c.bold}Issues:${c.reset} ${c.blue}https://github.com/hartemyaakoub/liqaa-cli/issues${c.reset}`);
  },

  async login() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log(`${c.cyan}LIQAA login${c.reset} — paste your keys from ${c.blue}https://liqaa.io/console${c.reset}`);
    const pk = (await rl.question('Public key (pk_live_…): ')).trim();
    const sk = (await rl.question('Secret key (sk_live_…): ')).trim();
    rl.close();
    if (!pk.startsWith('pk_') || !sk.startsWith('sk_')) {
      throw new Error('Invalid keys. pk_ and sk_ prefixes are required.');
    }
    await saveConfig({ pk, sk });
    console.log(`${c.green}✓${c.reset} Saved to ${c.dim}${CONFIG_FILE}${c.reset}`);
  },

  async whoami() {
    const cfg = await loadConfig();
    console.log(`${c.bold}pk:${c.reset} ${cfg.pk.slice(0, 16)}…`);
    console.log(`${c.bold}sk:${c.reset} ${cfg.sk.slice(0, 16)}… ${c.dim}(redacted)${c.reset}`);
    try {
      const me = await api('/me');
      console.log(`${c.bold}plan:${c.reset} ${me.plan || 'unknown'}`);
      console.log(`${c.bold}usage:${c.reset} ${me.calls_used ?? '?'} / ${me.calls_limit ?? '∞'} calls`);
    } catch {
      console.log(`${c.yellow}(could not fetch /me — endpoint may not exist on your plan)${c.reset}`);
    }
  },

  async ping() {
    const t0 = Date.now();
    const r = await fetch('https://liqaa.io/api/public/v1/health').catch(() => null);
    const t1 = Date.now() - t0;
    const ok = r?.ok ?? false;
    console.log(`${ok ? c.green + '✓' : c.red + '✗'}${c.reset} api · ${ok ? r.status : 'unreachable'} · ${t1}ms`);

    const t2 = Date.now();
    const r2 = await fetch('https://liqaa.io/sdk.js', { method: 'HEAD' }).catch(() => null);
    const t3 = Date.now() - t2;
    console.log(`${r2?.ok ? c.green + '✓' : c.red + '✗'}${c.reset} sdk · ${r2?.status ?? 'unreachable'} · ${t3}ms`);
  },

  async rooms(args) {
    const sub = args[0];
    if (sub === 'list') {
      const rooms = await api('/conversations').catch(() => []);
      if (isFlag(args, 'json')) return console.log(JSON.stringify(rooms, null, 2));
      tableOf(rooms, [
        { label: 'ID', value: (r) => r.id || r.room_name },
        { label: 'CALLER', value: (r) => r.caller_email || r.host?.email || '—' },
        { label: 'CALLEE', value: (r) => r.callee_email || '—' },
        { label: 'STATUS', value: (r) => r.status || (r.ok ? 'active' : '—') },
      ]);
    } else if (sub === 'create') {
      const [, caller, callee] = args;
      if (!caller || !callee) throw new Error('Usage: liqaa rooms create <caller_email> <callee_email>');
      const r = await api('/conversations', {
        method: 'POST',
        body: { caller_email: caller, callee_email: callee },
      });
      console.log(`${c.green}✓${c.reset} room ${c.bold}${r.room_name}${c.reset}`);
      console.log(`  join: ${c.blue}${r.join_url}${c.reset}`);
    } else if (sub === 'get') {
      const r = await api(`/conversations/${args[1]}`);
      console.log(JSON.stringify(r, null, 2));
    } else if (sub === 'end') {
      await api(`/conversations/${args[1]}`, { method: 'DELETE' });
      console.log(`${c.green}✓${c.reset} ended ${args[1]}`);
    } else {
      throw new Error('Usage: liqaa rooms <list|create|get|end>');
    }
  },

  async token(args) {
    const sub = args[0];
    if (sub !== 'issue') throw new Error('Usage: liqaa token issue <email> [--name "..."]');
    const email = args[1];
    if (!email) throw new Error('Email required.');
    const nameIdx = args.indexOf('--name');
    const name = nameIdx > -1 ? args[nameIdx + 1] : '';
    const cfg = await loadConfig();
    const identity = Buffer.from(JSON.stringify({ email, name, ts: Math.floor(Date.now() / 1000) })).toString('base64');
    const signature = crypto.createHmac('sha256', cfg.sk).update(identity).digest('hex');
    const r = await api('/sdk-token', {
      method: 'POST',
      body: { public_key: cfg.pk, identity_base64: identity, signature },
    });
    if (isFlag(args, 'quiet')) return console.log(r.sdk_token);
    console.log(`${c.bold}sdk_token:${c.reset} ${r.sdk_token}`);
    console.log(`${c.dim}expires_at: ${r.expires_at}${c.reset}`);
  },

  async webhooks(args) {
    const sub = args[0];
    if (sub === 'list') {
      const hooks = await api('/webhooks');
      if (isFlag(args, 'json')) return console.log(JSON.stringify(hooks, null, 2));
      tableOf(hooks, [
        { label: 'ID', value: (h) => h.id },
        { label: 'URL', value: (h) => h.url },
        { label: 'EVENTS', value: (h) => (h.events || []).join(',') },
        { label: 'ACTIVE', value: (h) => (h.active ? c.green + 'yes' + c.reset : c.red + 'no' + c.reset) },
      ]);
    } else if (sub === 'create') {
      const [, url, ...events] = args;
      if (!url || events.length === 0) throw new Error('Usage: liqaa webhooks create <url> <event...>');
      const r = await api('/webhooks', { method: 'POST', body: { url, events: events.filter((e) => !e.startsWith('--')) } });
      console.log(`${c.green}✓${c.reset} subscribed · id=${r.id}`);
      console.log(`${c.bold}signing_secret (save now — shown once):${c.reset} ${r.signing_secret}`);
    } else if (sub === 'delete') {
      await api(`/webhooks/${args[1]}`, { method: 'DELETE' });
      console.log(`${c.green}✓${c.reset} deleted webhook ${args[1]}`);
    } else if (sub === 'deliveries') {
      const r = await api(`/webhooks/${args[1]}/deliveries`);
      tableOf(r, [
        { label: 'ID', value: (d) => d.id },
        { label: 'EVENT', value: (d) => d.event },
        { label: 'STATUS', value: (d) => (d.success ? c.green + d.status_code + c.reset : c.red + (d.status_code ?? '×') + c.reset) },
        { label: 'WHEN', value: (d) => d.created_at },
      ]);
    } else {
      throw new Error('Usage: liqaa webhooks <list|create|delete|deliveries>');
    }
  },

  async status() {
    const r = await fetch('https://liqaa.io/status', { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`status fetch failed: ${r.status}`);
    console.log(`${c.green}●${c.reset} LIQAA Cloud — see ${c.blue}https://liqaa.io/status${c.reset} for live dashboard`);
  },

  async completion(args) {
    const shell = args[0];
    if (shell === 'bash') {
      console.log(`_liqaa(){ COMPREPLY=( $(compgen -W "login whoami ping rooms token webhooks status completion help" -- "\${COMP_WORDS[COMP_CWORD]}") ); }
complete -F _liqaa liqaa`);
    } else if (shell === 'zsh') {
      console.log(`compdef _liqaa liqaa
_liqaa(){ _arguments '*: :(login whoami ping rooms token webhooks status completion help)'; }`);
    } else if (shell === 'fish') {
      console.log(`complete -c liqaa -n "__fish_use_subcommand" -a "login whoami ping rooms token webhooks status completion help"`);
    } else {
      throw new Error('Usage: liqaa completion <bash|zsh|fish>');
    }
  },
};

// ── Entry ───────────────────────────────────────────────────────────────
export async function run(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') return commands.help();
  if (cmd === '--version' || cmd === '-v') return console.log(VERSION);
  const handler = commands[cmd];
  if (!handler) throw new Error(`Unknown command: ${cmd}. Run \`liqaa help\`.`);
  await handler(rest);
}
