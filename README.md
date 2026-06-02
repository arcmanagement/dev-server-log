# dev-server-log

AI-shareable dev server logging CLI.

`dev-server-log` wraps a dev server command and writes the same output to:

- the terminal
- a stable plain text log file
- a stable JSONL log file for agents and scripts

This makes `tail -F` and `jq` useful while the command is still running.

## Install

```sh
pnpm add -D dev-server-log
```

## Usage

Wrap any command after `--`.

```sh
devlog --name start-dev --log .log/start-dev.log -- pnpm start:dev
devlog --name storybook --log .log/storybook.log -- storybook dev --port 6006 --no-open
```

`--jsonl` is optional. When omitted, it is derived from the plain log path.

```text
.log/start-dev.log   -> .log/start-dev.jsonl
.log/storybook.log   -> .log/storybook.jsonl
```

## package.json examples

```json
{
  "scripts": {
    "dev": "devlog --name dev --log .log/dev.log -- vite dev",
    "storybook": "devlog --name storybook --log .log/storybook.log -- storybook dev --port 6006 --no-open"
  }
}
```

For a NestJS app:

```json
{
  "scripts": {
    "start:dev": "devlog --name start-dev --log .log/start-dev.log -- nest start --watch"
  }
}
```

## Reading logs

Humans can follow the plain text log:

```sh
tail -F .log/start-dev.log
```

Agents and scripts can query JSONL:

```sh
jq 'select(.event == "output" and (.messagePlain | test("error|failed"; "i")))' .log/start-dev.jsonl
jq 'select(.event == "output" and .stream == "stderr")' .log/storybook.jsonl
```

Output entries keep both the original ANSI-colored message and a searchable plain message.

```json
{
  "timestamp": "2026-06-02T12:00:00.000Z",
  "label": "start-dev",
  "event": "output",
  "stream": "stderr",
  "message": "\u001b[31mfailed\u001b[39m",
  "messagePlain": "failed"
}
```

## Rotation

Defaults:

- max size: `10MB`
- rotated files kept: `2`

Configure with CLI options:

```sh
devlog --name dev --log .log/dev.log --max-bytes 20MB --max-rotated-files 4 -- pnpm dev
```

Or environment variables:

```sh
DEV_SERVER_LOG_MAX_BYTES=20MB DEV_SERVER_LOG_MAX_ROTATED_FILES=4 pnpm dev
```

JSONL rotates only between entries, so JSON lines are not split.

## Library API

```ts
import { runLoggedProcess } from 'dev-server-log'

const result = await runLoggedProcess({
  label: 'start-dev',
  command: 'pnpm',
  args: ['start:dev'],
  logPath: '.log/start-dev.log',
})

process.exitCode = result.exitCode
```

## Publishing

Publishing is handled by GitHub Actions on `v*` tags.

The repository needs a GitHub Actions secret named `NPM_TOKEN` that can publish to npmjs.com.
