# Fintoq Telegram Bot

Multi-account automation bot for the [Fintoq Telegram Mini App](https://t.me/fonqastbot?startapp=ref_5028815150) — handles auth, daily bonus, quests, Nova chat rewards, boosts, and prediction staking. Runs continuously on a 24h cycle.

🔗 Join Fintoq: [https://t.me/fonqastbot?startapp=ref_5028815150](https://t.me/fonqastbot?startapp=ref_5028815150)

## Features

- **Multi-account support** — processes accounts sequentially from `querry.txt`, one cycle per day
- **Telegram Mini App auth** — authenticates via `initData` + referral start param, with automatic re-auth on token expiry (401)
- **Proxy support** — HTTP and SOCKS proxies, randomized per account (`proxy.txt`)
- **User-Agent rotation** — 9 realistic desktop/mobile UAs, randomized per account
- **Daily bonus claim** — checks status first and skips the claim call entirely if already claimed today
- **Search reward claim** — claims the FXP search reward task
- **Daily chat limit tracking** — reads `dailyChatCount`/`dailyChatLimit` from account stats, skips Nova messaging up front if the cap is already hit, and stops mid-session if the API reports the limit was reached
- **Nova chat rewards** — sends up to 5 randomized crypto/Web3 questions (now 25 in the rotation) per account to the Nova chat session, collecting FXP per message
- **Quest automation** — starts and verifies SOCIAL quests, claims completed DAILY/GROWTH quests, and skips the whole quest pass if nothing is pending (not `REWARDED`/`CLAIMED`)
- **Boost activation** — checks boost status up front and only calls activate if `canActivate` is true; logs a human-readable skip reason (disabled, already active, limit reached, cooldown) otherwise
- **Prediction staking** — filters out predictions the account has already staked on (`userStake`) before picking a random open one to stake 5–20 FXP
- **Smart full-skip** — if the daily bonus is claimed, chat limit is hit, no quests are pending, and boost isn't available, the whole account is marked done immediately without wasted calls
- **Buffered logging** — console + log output is batched and flushed to disk every ~1s instead of writing on every line
- **Retry & rate-limit handling** — automatic retries with backoff, honors `Retry-After` on HTTP 429
- **File logging** — logs every run to `logs/fintoq_<date>.log` alongside colored console output
- **24h loop mode** — resets and re-runs all accounts daily, sleeping until midnight once all are done

## Requirements

- Node.js 16+
- Dependencies: `axios`, `https-proxy-agent`, `socks-proxy-agent`, `chalk`

## Installation

```bash
git clone https://github.com/mejri02/Fonqast_bot.git
cd Fonqast_bot
npm install
```

## Setup

### 1. Accounts

Create `query.txt` in the root directory (one account per line). The `userId` is optional — if omitted, it's extracted automatically from the `id` field inside `initData`:

```
# initData|userId (userId optional)
query_id%3D...%26user%3D...%26...|123456789
user_id%3D...%26user%3D...%26...
```

- **`initData`** — the raw Telegram WebApp `initData` string for the account (URL-encoded)
- **`userId`** — the account's Telegram user ID

Username is auto-extracted from the decoded `initData` for logging, and the user ID falls back to the `id` field in `initData` if not provided. The bot exits with an error if `query.txt` is missing.

> New accounts should join via referral so the bot's default `startParam` is honored: [https://t.me/fonqastbot?startapp=ref_5028815150](https://t.me/fonqastbot?startapp=ref_5028815150)

### 2. Proxies (optional)

Create `proxy.txt` (one proxy per line, HTTP or SOCKS):

```
# ip:port or full proxy URL
http://ip:port
http://user:pass@ip:port
socks5://ip:port
```

## Usage

```bash
node index.js
```

You'll be prompted to choose:

```
[1] Run WITHOUT Proxy
[2] Run WITH Proxy (proxy.txt)
```

The bot then loops forever:
1. Processes every account in `querry.txt`, one at a time, with a random 30–120s delay between accounts
2. Once all accounts are marked done for the day, sleeps until 00:00 local time
3. Resets all account states and repeats

## Per-Account Flow

For each account, the bot:

1. Authenticates via Telegram `initData` (re-uses a cached token if still valid, otherwise re-authenticates with the referral start param)
2. Fetches current FXP balance, level, and chat count/limit
3. Checks daily bonus status, pending quests, and boost status up front
4. If everything is already done for the day (bonus claimed, chat limit hit, no pending quests, boost unavailable), marks the account done immediately and moves on
5. Otherwise, claims the daily bonus (skipped if already claimed)
6. Claims the search reward
7. Opens/resumes a Nova chat session and sends up to 5 randomized crypto/Web3 questions, stopping early if the daily chat limit is hit
8. Runs pending SOCIAL quests (start/verify) and claims completed DAILY/GROWTH quests
9. Activates the FXP boost if available, otherwise logs why it isn't (disabled, already active, limit reached, cooldown)
10. Picks a random open prediction the account hasn't already staked on and places a stake
11. Logs final FXP balance and marks the account done for the day

## Output

| Location | Description |
|----------|--------------|
| `logs/fintoq_<YYYY-MM-DD>.log` | Full run log (info, success, warnings, errors, per-account actions and rewards) |

## Notes

- Random delays are used throughout: 2–5s between actions within an account, 30–120s between accounts.
- Requests use a single attempt with an 8s timeout (no automatic retry loop) — a failed request is logged and the bot moves on.
- On HTTP 401, the client automatically re-authenticates and retries the request once.
- On HTTP 429, the request returns immediately as rate-limited rather than waiting/retrying.
- Nova messaging stops early if the API signals the daily chat limit was reached mid-session, even if the local counter hadn't caught up yet.
- The bot checks bonus/quest/boost status before doing any work, so an account with nothing left to do for the day is skipped in one pass instead of making redundant claim calls.
- Log lines are buffered in memory and flushed to `logs/fintoq_<date>.log` roughly once per second.
- Proxy mode assigns a random proxy per account from `proxy.txt`.

## Disclaimer

This tool interacts with Fintoq's Telegram Mini App API in an automated fashion. Use at your own risk and in accordance with Fintoq's Terms of Service.

## Links

- **GitHub:** [mejri02/Fonqast_bot](https://github.com/mejri02/Fonqast_bot)
- **Referral:** [https://t.me/fonqastbot?startapp=ref_5028815150](https://t.me/fonqastbot?startapp=ref_5028815150)
- **Telegram:** [@AirDropXDevs](https://t.me/AirDropXDevs)
