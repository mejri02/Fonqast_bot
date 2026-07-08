const fs = require('fs');
const path = require('path');
const axios = require('axios');
const HttpsProxyAgent = require('https-proxy-agent');
const SocksProxyAgent = require('socks-proxy-agent');
const chalk = require('chalk');
const readline = require('readline');

const CONFIG = {
    API_BASE: 'https://app.fintoq.ai/api',
    BOT_USERNAME: 'fonqastbot',
    DEFAULT_REFERRAL: 'ref_5028815150',
    MAX_RETRIES: 1,
    RETRY_DELAY: 1000,
    MIN_ACCOUNT_DELAY: 30000,
    MAX_ACCOUNT_DELAY: 120000,
    MIN_ACTION_DELAY: 2000,
    MAX_ACTION_DELAY: 5000,
    NOVA_MESSAGES_TO_SEND: 5,
    REQUEST_TIMEOUT: 8000,
};

const USER_AGENTS = [
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1_1 like Mac OS X) Version/17.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_1_1 like Mac OS X) Version/17.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Android 13; Mobile; rv:109.0) Gecko/121.0 Firefox/121.0',
];

const CHAT_MESSAGES = [
    "What's the latest crypto trend?",
    "Can you analyze Bitcoin price?",
    "Tell me about Web3 innovations",
    "What are the best crypto strategies?",
    "Explain DeFi to me",
    "What's your take on Ethereum right now?",
    "How do airdrops actually work?",
    "What is a Layer 2 and why does it matter?",
    "Is now a good time to DCA into crypto?",
    "Explain how staking rewards work",
    "What's the difference between CEX and DEX?",
    "How do I spot a crypto scam project?",
    "What are gas fees and why do they change?",
    "Explain NFTs in simple terms",
    "What is a stablecoin and how is it pegged?",
    "How does proof of stake differ from proof of work?",
    "What's a good way to diversify a crypto portfolio?",
    "Explain how liquidity pools work",
    "What is impermanent loss?",
    "How do I evaluate a new token's tokenomics?",
    "What's the role of a blockchain oracle?",
    "Explain rollups and why they help scaling",
    "What should I look for before joining an airdrop?",
    "How do multisig wallets improve security?",
    "What's the difference between a hot and cold wallet?",
];

const BOOST_SKIP_REASONS = {
    disabled: 'Boost is disabled',
    already_active: 'Boost already active',
    limit_reached: 'Daily limit reached',
    cooldown: 'Cooldown active',
};

const BANNER = `
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║  ███████╗██╗███╗   ██╗████████╗ ██████╗  ██████╗    ║
║  ██╔════╝██║████╗  ██║╚══██╔══╝██╔═══██╗██╔═══██╗   ║
║  █████╗  ██║██╔██╗ ██║   ██║   ██║   ██║██║   ██║   ║
║  ██╔══╝  ██║██║╚██╗██║   ██║   ██║   ██║██║   ██║   ║
║  ██║     ██║██║ ╚████║   ██║   ╚██████╔╝╚██████╔╝   ║
║  ╚═╝     ╚═╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝  ╚═════╝    ║
║                                                       ║
║         🚀 Automated FINTOQ Bot v2.1                  ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
`;

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
        this.logFile = path.join(this.logDir, `fintoq_${new Date().toISOString().split('T')[0]}.log`);
        this._buffer = [];
        this._flushTimer = null;
    }

    log(level, msg) {
        const timestamp = new Date().toISOString();
        const cleanMsg = msg.replace(/\x1b\[[0-9;]*m/g, '');
        console.log(msg);
        this._buffer.push(`[${timestamp}] [${level}] ${cleanMsg}`);
        if (!this._flushTimer) {
            this._flushTimer = setTimeout(() => this._flush(), 1000);
        }
    }

    _flush() {
        this._flushTimer = null;
        if (this._buffer.length === 0) return;
        const chunk = this._buffer.join('\n') + '\n';
        this._buffer = [];
        fs.appendFile(this.logFile, chunk, () => {});
    }

    info(msg) { this.log('INFO', chalk.cyan(`ℹ️ ${msg}`)); }
    success(msg) { this.log('SUCCESS', chalk.green(`✅ ${msg}`)); }
    warn(msg) { this.log('WARN', chalk.yellow(`⚠️ ${msg}`)); }
    error(msg) { this.log('ERROR', chalk.red(`❌ ${msg}`)); }
    debug(msg) { this.log('DEBUG', chalk.magenta(`🔍 ${msg}`)); }
    account(msg, user) { this.log('ACCOUNT', chalk.blue(`👤 [${user}] ${msg}`)); }
    reward(msg) { this.log('REWARD', chalk.yellow(`💰 ${msg}`)); }
    skip(msg, user) { this.log('SKIP', chalk.gray(`⏭️ [${user}] ${msg}`)); }
    banner() { console.log(chalk.cyan(BANNER)); }
}

const logger = new Logger();

function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getRandomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function showMenu() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log(chalk.yellow('\n╔═══════════════════════════════════════╗'));
        console.log(chalk.yellow('║         SELECT OPTION                ║'));
        console.log(chalk.yellow('╠═══════════════════════════════════════╣'));
        console.log(chalk.yellow('║                                       ║'));
        console.log(chalk.green('║  [1] Run WITHOUT Proxy              ║'));
        console.log(chalk.green('║  [2] Run WITH Proxy (proxy.txt)     ║'));
        console.log(chalk.yellow('║                                       ║'));
        console.log(chalk.yellow('╚═══════════════════════════════════════╝'));
        console.log(chalk.white('\nEnter your choice (1 or 2): '));

        rl.on('line', (input) => {
            rl.close();
            resolve(input.trim());
        });
    });
}

class ProxyManager {
    constructor() {
        this.proxies = [];
        this.currentIndex = 0;
        this.loadProxies();
    }

    loadProxies() {
        try {
            if (fs.existsSync('proxy.txt')) {
                const content = fs.readFileSync('proxy.txt', 'utf8');
                this.proxies = content.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0 && !line.startsWith('#'));
            }
        } catch (e) {}
    }

    getRandomProxy() {
        if (this.proxies.length === 0) return null;
        return this.proxies[Math.floor(Math.random() * this.proxies.length)];
    }

    getProxyAgent(proxyUrl) {
        if (!proxyUrl) return null;
        try {
            if (proxyUrl.startsWith('socks')) {
                return new SocksProxyAgent(proxyUrl);
            }
            return new HttpsProxyAgent(proxyUrl);
        } catch (e) {
            return null;
        }
    }
}

class AccountManager {
    constructor() {
        this.accounts = [];
        this.currentIndex = 0;
        this.loadAccounts();
    }

    loadAccounts() {
        try {
            if (!fs.existsSync('query.txt')) {
                logger.error('query.txt not found!');
                return;
            }
            const content = fs.readFileSync('query.txt', 'utf8');
            const lines = content.split('\n').filter(line => line.trim());

            for (const line of lines) {
                const parts = line.split('|').map(s => s.trim());
                const initData = parts[0];
                if (initData) {
                    let userId = parts[1] || 'unknown';
                    let username = 'unknown';

                    try {
                        const decoded = decodeURIComponent(initData);
                        const usernameMatch = decoded.match(/"username":"([^"]+)"/);
                        if (usernameMatch) username = usernameMatch[1];
                        if (userId === 'unknown') {
                            const idMatch = decoded.match(/"id":(\d+)/);
                            if (idMatch) userId = idMatch[1];
                        }
                    } catch (e) {}

                    this.accounts.push({
                        username: username,
                        initData: initData,
                        userId: userId,
                        token: null,
                        stats: {},
                        proxy: null,
                        userAgent: null,
                        dailyDone: false,
                        lastAction: null,
                        dailyChatCount: 0,
                        dailyChatLimit: 10,
                    });
                }
            }
            logger.info(`Loaded ${this.accounts.length} accounts`);
        } catch (e) {
            logger.error(`Failed to load accounts: ${e.message}`);
        }
    }

    getNextAccount() {
        if (this.accounts.length === 0) return null;
        for (let i = 0; i < this.accounts.length; i++) {
            const idx = (this.currentIndex + i) % this.accounts.length;
            const account = this.accounts[idx];
            if (!account.dailyDone) {
                this.currentIndex = idx;
                return account;
            }
        }
        return null;
    }

    markDone(account) {
        account.dailyDone = true;
        account.lastAction = new Date();
    }

    resetAll() {
        for (const account of this.accounts) {
            account.dailyDone = false;
            account.token = null;
            account.stats = {};
            account.dailyChatCount = 0;
        }
        this.currentIndex = 0;
    }

    getDoneCount() {
        return this.accounts.filter(a => a.dailyDone).length;
    }

    getTotalCount() {
        return this.accounts.length;
    }
}

class FINTOQClient {
    constructor(account) {
        this.account = account;
        this.baseURL = CONFIG.API_BASE;
        this.proxyManager = new ProxyManager();
        this.useProxy = false;
    }

    setUseProxy(use) {
        this.useProxy = use;
    }

    getHeaders() {
        const headers = {
            'Accept': '*/*',
            'Accept-Language': 'en-GB,en;q=0.9,fr;q=0.8,ar;q=0.7,en-US;q=0.6,zh-CN;q=0.5,zh;q=0.4',
            'Content-Type': 'application/json',
            'User-Agent': this.account.userAgent || getRandomUserAgent(),
            'Referer': 'https://app.fintoq.ai/',
            'Origin': 'https://app.fintoq.ai',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
        };
        if (this.account.token) {
            headers['Authorization'] = `Bearer ${this.account.token}`;
        }
        return headers;
    }

    getProxyConfig() {
        if (!this.useProxy) return null;
        const proxy = this.account.proxy || this.proxyManager.getRandomProxy();
        if (!proxy) return null;
        const agent = this.proxyManager.getProxyAgent(proxy);
        return { proxy, agent };
    }

    async request(method, endpoint, data = null) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = this.getHeaders();
        const proxyConfig = this.getProxyConfig();

        const config = {
            method,
            url,
            headers,
            timeout: CONFIG.REQUEST_TIMEOUT,
            validateStatus: null,
        };

        if (data) config.data = data;
        if (proxyConfig?.agent) config.httpsAgent = proxyConfig.agent;

        try {
            const response = await axios(config);

            if (response.status === 429) {
                return {
                    success: false,
                    error: response.data?.error || 'Rate limited',
                    code: response.data?.code,
                    status: 429,
                };
            }

            if (response.status === 401) {
                if (await this.authenticate()) {
                    headers['Authorization'] = `Bearer ${this.account.token}`;
                    config.headers = headers;
                    return this.request(method, endpoint, data);
                }
                return { success: false, error: 'Auth failed', status: 401 };
            }

            if (response.status < 400) {
                return response.data;
            }

            return {
                success: false,
                error: response.data?.error || `HTTP ${response.status}`,
                code: response.data?.code,
                status: response.status,
            };

        } catch (e) {
            return { success: false, error: e.message || 'Timeout' };
        }
    }

    async authenticate() {
        try {
            if (this.account.token) {
                const result = await this.request('GET', '/user/me');
                if (result.success) return true;
            }

            const result = await this.request('POST', '/auth/telegram', {
                initData: this.account.initData,
                startParam: CONFIG.DEFAULT_REFERRAL,
            });

            if (result.success && result.data?.token) {
                this.account.token = result.data.token;
                return true;
            }

            return false;
        } catch (e) {
            return false;
        }
    }

    async getUserStats() {
        const result = await this.request('GET', '/user/me');
        if (result.success) {
            this.account.stats = result.data;
            this.account.dailyChatCount = result.data.dailyChatCount || 0;
            this.account.dailyChatLimit = result.data.dailyChatLimit || 10;
            return result.data;
        }
        return null;
    }

    async getDailyBonusStatus() {
        const result = await this.request('GET', '/bonus/daily/status');
        if (result.success) return result.data;
        return null;
    }

    async claimDailyBonus(status = null) {
        if (!status) status = await this.getDailyBonusStatus();
        if (!status || status.claimedToday) return null;
        const result = await this.request('POST', '/bonus/daily/claim');
        if (result.success) {
            const data = result.data;
            logger.reward(`Daily: +${data.amountFxp || 0} FXP`);
            return data;
        }
        return null;
    }

    async getQuests() {
        const result = await this.request('GET', '/quests');
        if (result.success) return result.data || {};
        return {};
    }

    async claimQuest(questId) {
        const result = await this.request('POST', `/quests/${questId}/claim`);
        if (result.success) {
            const data = result.data;
            logger.reward(`Quest: +${data.rewardFxp || 0} FXP`);
            return data;
        }
        return null;
    }

    async startSocialQuest(questKey) {
        const result = await this.request('POST', `/quests/${questKey}/start`);
        return result.success;
    }

    async verifySocialQuest(questKey) {
        const result = await this.request('POST', `/quests/${questKey}/verify`);
        if (result.success) return result.data;
        return null;
    }

    async getPredictions() {
        const result = await this.request('GET', '/predictions');
        if (result.success) return result.data || [];
        return [];
    }

    async placePredictionStake(predictionId, outcome, stake) {
        const result = await this.request('POST', `/predictions/${predictionId}/stake`, {
            outcome,
            stakeFXP: stake,
        });
        if (result.success) {
            logger.reward(`Prediction: ${stake} FXP on ${outcome}`);
            return result.data;
        }
        return null;
    }

    async getBoostStatus() {
        const result = await this.request('GET', '/nova/boost/status');
        if (result.success) return result.data;
        return null;
    }

    async activateBoost(status = null) {
        if (!status) status = await this.getBoostStatus();
        if (!status || !status.canActivate) {
            const reason = status?.reason;
            if (reason) {
                logger.skip(`Boost: ${BOOST_SKIP_REASONS[reason] || reason}`, this.account.username);
            }
            return null;
        }
        const result = await this.request('POST', '/nova/boost/activate');
        if (result.success) {
            const data = result.data;
            logger.success(`Boost: ${data.multiplier || 1}x`);
            return data;
        } else if (result.data?.reason) {
            logger.skip(`Boost: ${BOOST_SKIP_REASONS[result.data.reason] || result.data.reason}`, this.account.username);
        }
        return null;
    }

    async claimSearchReward() {
        const result = await this.request('POST', '/fxp/search/reward');
        if (result.success) {
            const data = result.data;
            logger.reward(`Search: +${data.reward || 0} FXP`);
            return data;
        }
        return null;
    }

    async getNovaSession() {
        const result = await this.request('GET', '/nova/session');
        if (result.success) return result.data;
        return null;
    }

    async sendNovaMessage(content, sessionId = null) {
        if (this.account.dailyChatCount >= this.account.dailyChatLimit) {
            return 'LIMIT_REACHED';
        }

        const result = await this.request('POST', '/nova/message', {
            content,
            sessionId,
        });

        if (result.success) {
            const data = result.data;
            const reward = data.fxpReward || 0;
            this.account.dailyChatCount = data.dailyChatCount || this.account.dailyChatCount + 1;

            if (reward > 0) {
                logger.account(`Nova ${this.account.dailyChatCount}/${this.account.dailyChatLimit} +${reward} FXP`, this.account.username);
            }
            return data;
        }

        if (result.code === 'NOVA_LIMIT_REACHED' || (result.status === 429 && !result.code)) {
            this.account.dailyChatCount = this.account.dailyChatLimit;
            return 'LIMIT_REACHED';
        }

        return null;
    }
}

class BotTasks {
    constructor(client) {
        this.client = client;
        this.account = client.account;
    }

    async randomDelay() {
        const delay = getRandomDelay(CONFIG.MIN_ACTION_DELAY, CONFIG.MAX_ACTION_DELAY);
        await sleep(delay);
    }

    pendingQuests(list = []) {
        return list.filter(q => q.status !== 'REWARDED' && q.status !== 'CLAIMED');
    }

    async runQuestGroup(quests, isSocial) {
        let acted = false;
        for (const quest of quests) {
            if (isSocial) {
                if (quest.status === 'STARTED' || quest.status === 'ACTIVE') {
                    const result = await this.client.verifySocialQuest(quest.key);
                    if (result) {
                        logger.account(`Verified: ${quest.title}`, this.account.username);
                        acted = true;
                        await this.randomDelay();
                    }
                } else if (quest.status === 'NOT_STARTED') {
                    if (await this.client.startSocialQuest(quest.key)) {
                        acted = true;
                        await this.randomDelay();
                        await this.client.verifySocialQuest(quest.key);
                        await this.randomDelay();
                    }
                }
            } else if (quest.status === 'COMPLETED') {
                const result = await this.client.claimQuest(quest.id);
                if (result) {
                    logger.account(`Claimed: ${quest.title}`, this.account.username);
                    acted = true;
                    await this.randomDelay();
                }
            }
        }
        return acted;
    }

    async executeAllTasks() {
        try {
            if (!await this.client.authenticate()) {
                return false;
            }
            await this.randomDelay();

            const stats = await this.client.getUserStats();
            if (stats) {
                const fxp = stats.fxpBalance || 0;
                const level = stats.level || 0;
                const chatCount = stats.dailyChatCount || 0;
                const chatLimit = stats.dailyChatLimit || 10;
                logger.account(`FXP: ${fxp} | Level: ${level} | Chat: ${chatCount}/${chatLimit}`, this.account.username);
            }
            await this.randomDelay();

            const bonusStatus = await this.client.getDailyBonusStatus();
            await this.randomDelay();

            const quests = await this.client.getQuests();
            const socialQuests = this.pendingQuests(quests.SOCIAL || []);
            const dailyQuests = this.pendingQuests(quests.DAILY || []);
            const growthQuests = this.pendingQuests(quests.GROWTH || []);
            const hasPendingQuests = socialQuests.length + dailyQuests.length + growthQuests.length > 0;
            await this.randomDelay();

            const boostStatus = await this.client.getBoostStatus();
            await this.randomDelay();

            const chatLimitReached = this.account.dailyChatCount >= this.account.dailyChatLimit;
            const bonusAlreadyClaimed = !!bonusStatus?.claimedToday;
            const boostAvailable = !!boostStatus?.canActivate;

            if (bonusAlreadyClaimed && chatLimitReached && !hasPendingQuests && !boostAvailable) {
                logger.skip('All tasks already completed for today', this.account.username);
                return true;
            }

            if (bonusAlreadyClaimed) {
                logger.skip('Daily bonus already claimed', this.account.username);
            } else {
                await this.client.claimDailyBonus(bonusStatus);
                await this.randomDelay();
            }

            await this.client.claimSearchReward();
            await this.randomDelay();

            if (chatLimitReached) {
                logger.skip(`Chat limit reached (${this.account.dailyChatCount}/${this.account.dailyChatLimit})`, this.account.username);
            } else {
                const session = await this.client.getNovaSession();
                const sessionId = session?._id || null;
                await this.randomDelay();

                const shuffledMessages = [...CHAT_MESSAGES].sort(() => Math.random() - 0.5);
                let totalReward = 0;
                let messagesSent = 0;

                for (let i = 0; i < CONFIG.NOVA_MESSAGES_TO_SEND && i < shuffledMessages.length; i++) {
                    const msg = shuffledMessages[i];
                    const result = await this.client.sendNovaMessage(msg, sessionId);

                    if (result === 'LIMIT_REACHED') {
                        logger.skip('Chat limit reached mid-session, stopping Nova', this.account.username);
                        break;
                    }
                    if (result) {
                        totalReward += result.fxpReward || 0;
                        messagesSent++;
                    }
                    await this.randomDelay();
                }

                if (messagesSent > 0) {
                    logger.account(`Nova: ${messagesSent} msgs, +${totalReward} FXP`, this.account.username);
                }
            }
            await this.randomDelay();

            if (!hasPendingQuests) {
                logger.skip('All quests already completed/claimed', this.account.username);
            } else {
                await this.runQuestGroup(socialQuests, true);
                await this.runQuestGroup(dailyQuests, false);
                await this.runQuestGroup(growthQuests, false);
            }

            if (!boostAvailable) {
                if (boostStatus?.reason) {
                    logger.skip(`Boost: ${BOOST_SKIP_REASONS[boostStatus.reason] || boostStatus.reason}`, this.account.username);
                }
            } else {
                await this.client.activateBoost(boostStatus);
                await this.randomDelay();
            }

            const predictions = await this.client.getPredictions();
            const stakeable = predictions.filter(p => p.status === 'OPEN' && !p.userStake);
            if (stakeable.length === 0) {
                logger.skip('No stakeable predictions (none open or already staked)', this.account.username);
            } else {
                const pred = stakeable[Math.floor(Math.random() * stakeable.length)];
                const maxStake = pred.maxStakeFXP || 10;
                const stake = getRandomDelay(5, Math.min(maxStake, 20));
                const outcome = Math.random() > 0.5 ? 'YES' : 'NO';
                await this.client.placePredictionStake(pred.id, outcome, stake);
                await this.randomDelay();
            }

            const finalStats = await this.client.getUserStats();
            if (finalStats) {
                const fxp = finalStats.fxpBalance || 0;
                logger.account(`Final FXP: ${fxp}`, this.account.username);
            }

            logger.success(`Done: ${this.account.username}`);
            return true;
        } catch (e) {
            logger.error(`Error: ${e.message}`);
            return false;
        }
    }
}

class FINTOQBot {
    constructor() {
        this.accountManager = new AccountManager();
        this.isRunning = false;
        this.lastRunDate = null;
        this.useProxy = false;
    }

    async run() {
        logger.banner();

        const choice = await showMenu();

        if (choice === '2') {
            this.useProxy = true;
            if (!fs.existsSync('proxy.txt')) {
                fs.writeFileSync('proxy.txt', '# Add your proxies here\n# Format: http://user:pass@ip:port\n');
            }
        }

        this.isRunning = true;

        while (this.isRunning) {
            try {
                const currentDate = new Date().toISOString().split('T')[0];
                if (this.lastRunDate !== currentDate) {
                    this.accountManager.resetAll();
                    this.lastRunDate = currentDate;
                }

                const account = this.accountManager.getNextAccount();

                if (!account) {
                    logger.info('💤 All done - sleeping until midnight');
                    const now = new Date();
                    const tomorrow = new Date(now);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    tomorrow.setHours(0, 0, 0, 0);
                    const sleepMs = tomorrow.getTime() - now.getTime();
                    await sleep(sleepMs);
                    continue;
                }

                account.userAgent = getRandomUserAgent();

                if (this.useProxy) {
                    const proxyManager = new ProxyManager();
                    account.proxy = proxyManager.getRandomProxy();
                }

                const idx = this.accountManager.currentIndex + 1;
                const total = this.accountManager.getTotalCount();
                logger.account(`Processing ${idx}/${total}`, account.username);

                const client = new FINTOQClient(account);
                client.setUseProxy(this.useProxy);
                const tasks = new BotTasks(client);
                const success = await tasks.executeAllTasks();

                if (success) {
                    this.accountManager.markDone(account);
                    const done = this.accountManager.getDoneCount();
                    const totalCount = this.accountManager.getTotalCount();
                    logger.info(`📊 ${done}/${totalCount} completed`);
                }

                const delay = getRandomDelay(CONFIG.MIN_ACCOUNT_DELAY, CONFIG.MAX_ACCOUNT_DELAY);
                await sleep(delay);

            } catch (e) {
                if (e.message === 'User stopped') {
                    break;
                }
                logger.error(`Bot error: ${e.message}`);
                await sleep(60000);
            }
        }
    }

    stop() {
        this.isRunning = false;
    }
}

const bot = new FINTOQBot();

process.on('SIGINT', () => {
    bot.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    bot.stop();
    process.exit(0);
});

if (require.main === module) {
    bot.run().catch(e => {
        logger.error(`Fatal error: ${e.message}`);
        process.exit(1);
    });
}

module.exports = { FINTOQBot, FINTOQClient, AccountManager, ProxyManager };
