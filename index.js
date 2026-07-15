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
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    RETRY_BACKOFF: 2,
    MIN_ACCOUNT_DELAY: 8000,
    MAX_ACCOUNT_DELAY: 15000,
    MIN_ACTION_DELAY: 400,
    MAX_ACTION_DELAY: 800,
    MIN_MESSAGE_DELAY: 200,
    MAX_MESSAGE_DELAY: 500,
    NOVA_MESSAGES_TO_SEND: 15,
    REQUEST_TIMEOUT: 12000,
    MAX_PREDICTION_STAKE: 50,
    MIN_PREDICTION_STAKE: 5,
    DAILY_BONUS_PRIORITY: true,
    CLAIM_ALL_REWARDS: true,
    AGGRESSIVE_MODE: true,
    BOOST_BEFORE_MESSAGES: true,
    PARALLEL_QUESTS: false,
    SMART_PREDICTION: true,
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
];

const BOOST_SKIP_REASONS = {
    disabled: 'Boost is disabled',
    already_active: 'Boost already active',
    limit_reached: 'Daily limit reached',
    cooldown: 'Cooldown active',
};

const BANNER = `
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║  ███████╗██╗███╗   ██╗████████╗ ██████╗  ██████╗             ║
║  ██╔════╝██║████╗  ██║╚══██╔══╝██╔═══██╗██╔═══██╗            ║
║  █████╗  ██║██╔██╗ ██║   ██║   ██║   ██║██║   ██║            ║
║  ██╔══╝  ██║██║╚██╗██║   ██║   ██║   ██║██║   ██║            ║
║  ██║     ██║██║ ╚████║   ██║   ╚██████╔╝╚██████╔╝            ║
║  ╚═╝     ╚═╝╚═╝  ╚═══╝   ╚═╝    ╚═════╝  ╚═════╝             ║
║                                                               ║
║  🚀 FINTOQ Professional Bot v3.2 - OPTIMIZED for MAX FXP      ║
║  🔥 Aggressive Mode | Fast Message Flooding | Smart Stakes    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
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
    task(msg, user) { this.log('TASK', chalk.magenta(`⚙️ [${user}] ${msg}`)); }
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
        } catch (e) {
            logger.warn(`Proxy load error: ${e.message}`);
        }
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
            logger.warn(`Proxy agent error: ${e.message}`);
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
                        totalRewardsEarned: 0,
                        tasksCompleted: 0,
                    });
                }
            }
            logger.info(`✅ Loaded ${this.accounts.length} accounts`);
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
            account.tasksCompleted = 0;
        }
        this.currentIndex = 0;
    }

    getDoneCount() {
        return this.accounts.filter(a => a.dailyDone).length;
    }

    getTotalCount() {
        return this.accounts.length;
    }

    getTotalRewards() {
        return this.accounts.reduce((sum, a) => sum + a.totalRewardsEarned, 0);
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

    async request(method, endpoint, data = null, retryCount = 0) {
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
                if (endpoint === '/nova/message') {
                    logger.warn(`⛔ Chat limit enforced by API`);
                    return {
                        success: false,
                        error: 'Chat limit reached',
                        code: 'NOVA_LIMIT_REACHED',
                        status: 429,
                    };
                }

                if (retryCount < CONFIG.MAX_RETRIES) {
                    const delay = CONFIG.RETRY_DELAY * Math.pow(CONFIG.RETRY_BACKOFF, retryCount);
                    logger.warn(`Rate limited on ${endpoint}, retrying in ${delay}ms...`);
                    await sleep(delay);
                    return this.request(method, endpoint, data, retryCount + 1);
                }
                return {
                    success: false,
                    error: 'Rate limited (max retries)',
                    code: 'RATE_LIMIT',
                    status: 429,
                };
            }

            if (response.status === 401) {
                if (await this.authenticate()) {
                    return this.request(method, endpoint, data, retryCount);
                }
                return { success: false, error: 'Auth failed', status: 401 };
            }

            if (response.status < 400) {
                return response.data;
            }

            if (response.status >= 500 && retryCount < CONFIG.MAX_RETRIES) {
                const delay = CONFIG.RETRY_DELAY * Math.pow(CONFIG.RETRY_BACKOFF, retryCount);
                logger.warn(`Server error (${response.status}), retrying in ${delay}ms...`);
                await sleep(delay);
                return this.request(method, endpoint, data, retryCount + 1);
            }

            return {
                success: false,
                error: response.data?.error || `HTTP ${response.status}`,
                code: response.data?.code,
                status: response.status,
            };

        } catch (e) {
            if (retryCount < CONFIG.MAX_RETRIES && (e.code === 'ECONNABORTED' || e.code === 'ECONNREFUSED')) {
                const delay = CONFIG.RETRY_DELAY * Math.pow(CONFIG.RETRY_BACKOFF, retryCount);
                logger.warn(`Connection error, retrying in ${delay}ms...`);
                await sleep(delay);
                return this.request(method, endpoint, data, retryCount + 1);
            }
            return { success: false, error: e.message || 'Request failed' };
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
                logger.account('✓ Authenticated', this.account.username);
                return true;
            }

            logger.error(`Auth failed: ${result.error}`);
            return false;
        } catch (e) {
            logger.error(`Auth exception: ${e.message}`);
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
            const reward = data.amountFxp || 0;
            this.account.totalRewardsEarned += reward;
            logger.reward(`Daily Bonus: +${reward} FXP`);
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
            const reward = data.rewardFxp || 0;
            this.account.totalRewardsEarned += reward;
            logger.reward(`Quest Claimed: +${reward} FXP`);
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
            logger.reward(`Prediction Stake: ${stake} FXP on ${outcome}`);
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
            logger.success(`✅ Boost Activated: ${data.multiplier || 1}x`);
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
            const reward = data.reward || 0;
            this.account.totalRewardsEarned += reward;
            logger.reward(`Search Reward: +${reward} FXP`);
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
            this.account.totalRewardsEarned += reward;

            if (reward > 0) {
                logger.account(`Nova: ${this.account.dailyChatCount}/${this.account.dailyChatLimit} +${reward} FXP`, this.account.username);
            }
            return data;
        }

        if (result.code === 'NOVA_LIMIT_REACHED') {
            logger.warn(`🔄 Syncing chat state with API...`);
            const freshStats = await this.request('GET', '/user/me');
            if (freshStats && freshStats.success) {
                this.account.dailyChatCount = freshStats.data.dailyChatCount || this.account.dailyChatLimit;
                this.account.dailyChatLimit = freshStats.data.dailyChatLimit || 10;
                logger.warn(`📊 Synced: ${this.account.dailyChatCount}/${this.account.dailyChatLimit}`);
            }
            return 'LIMIT_REACHED';
        }

        return null;
    }
}

class BotTasks {
    constructor(client) {
        this.client = client;
        this.account = client.account;
        this.taskStats = {
            bonusClaimed: false,
            searchClaimed: 0,
            messagesSent: 0,
            totalMessageReward: 0,
            questsClaimed: 0,
            totalQuestReward: 0,
            predictionsPlaced: 0,
            boostActivated: false,
        };
    }

    async randomDelay(min = CONFIG.MIN_ACTION_DELAY, max = CONFIG.MAX_ACTION_DELAY) {
        const delay = getRandomDelay(min, max);
        await sleep(delay);
    }

    pendingQuests(list = []) {
        return list.filter(q => q.status !== 'REWARDED' && q.status !== 'CLAIMED');
    }

    completedQuests(list = []) {
        return list.filter(q => q.status === 'COMPLETED');
    }

    sortQuestsByReward(quests) {
        return [...quests].sort((a, b) => (b.rewardFxp || 0) - (a.rewardFxp || 0));
    }

    async runQuestGroup(quests, isSocial, groupName) {
        let acted = false;
        const sortedQuests = isSocial ? quests : this.sortQuestsByReward(quests);

        for (const quest of sortedQuests) {
            try {
                if (isSocial) {
                    if (quest.status === 'STARTED' || quest.status === 'ACTIVE') {
                        const result = await this.client.verifySocialQuest(quest.key);
                        if (result) {
                            logger.account(`[${groupName}] Verified: ${quest.title}`, this.account.username);
                            acted = true;
                            await this.randomDelay();
                        }
                    } else if (quest.status === 'NOT_STARTED') {
                        if (await this.client.startSocialQuest(quest.key)) {
                            logger.account(`[${groupName}] Started: ${quest.title}`, this.account.username);
                            acted = true;
                            await this.randomDelay();
                            const verifyResult = await this.client.verifySocialQuest(quest.key);
                            if (verifyResult) {
                                logger.account(`[${groupName}] Verified: ${quest.title}`, this.account.username);
                                await this.randomDelay();
                            }
                        }
                    }
                } else if (quest.status === 'COMPLETED') {
                    const result = await this.client.claimQuest(quest.id);
                    if (result) {
                        const reward = result.rewardFxp || 0;
                        this.taskStats.questsClaimed++;
                        this.taskStats.totalQuestReward += reward;
                        logger.account(`[${groupName}] Claimed: ${quest.title} (+${reward})`, this.account.username);
                        acted = true;
                        await this.randomDelay();
                    }
                }
            } catch (e) {
                logger.warn(`Error processing quest ${quest.id}: ${e.message}`);
            }
        }

        return acted;
    }

    async executeAllTasks() {
        try {
            logger.task('Starting task execution cycle', this.account.username);

            if (!await this.client.authenticate()) {
                logger.error(`Authentication failed for ${this.account.username}`);
                return false;
            }
            await this.randomDelay();

            const stats = await this.client.getUserStats();
            if (stats) {
                const fxp = stats.fxpBalance || 0;
                const level = stats.level || 0;
                const chatCount = stats.dailyChatCount || 0;
                const chatLimit = stats.dailyChatLimit || 10;
                logger.account(`📊 Initial - FXP: ${fxp} | Level: ${level} | Chat: ${chatCount}/${chatLimit}`, this.account.username);
            }
            await this.randomDelay();

            if (CONFIG.DAILY_BONUS_PRIORITY) {
                const bonusStatus = await this.client.getDailyBonusStatus();
                await this.randomDelay();

                if (bonusStatus && !bonusStatus.claimedToday) {
                    await this.client.claimDailyBonus(bonusStatus);
                    await this.randomDelay();
                    this.taskStats.bonusClaimed = true;
                } else if (bonusStatus?.claimedToday) {
                    logger.task('Daily bonus already claimed today', this.account.username);
                }
            }

            for (let i = 0; i < 3; i++) {
                const searchResult = await this.client.claimSearchReward();
                if (searchResult) {
                    this.taskStats.searchClaimed++;
                    await this.randomDelay();
                } else {
                    break;
                }
            }

            if (CONFIG.BOOST_BEFORE_MESSAGES) {
                const boostStatus = await this.client.getBoostStatus();
                await this.randomDelay();

                if (boostStatus && boostStatus.canActivate) {
                    await this.client.activateBoost(boostStatus);
                    await this.randomDelay();
                    this.taskStats.boostActivated = true;
                }
            }

            let freshStats = await this.client.getUserStats();
            const chatLimitReached = freshStats && freshStats.dailyChatCount >= freshStats.dailyChatLimit;

            if (!chatLimitReached) {
                const session = await this.client.getNovaSession();
                const sessionId = session?._id || null;
                await this.randomDelay();

                const shuffledMessages = [...CHAT_MESSAGES].sort(() => Math.random() - 0.5);
                const messagesToSend = CONFIG.AGGRESSIVE_MODE 
                    ? Math.min(CONFIG.NOVA_MESSAGES_TO_SEND, shuffledMessages.length, this.account.dailyChatLimit - this.account.dailyChatCount)
                    : Math.min(Math.ceil(CONFIG.NOVA_MESSAGES_TO_SEND / 2), shuffledMessages.length, this.account.dailyChatLimit - this.account.dailyChatCount);

                logger.task(`Preparing to send ${messagesToSend} Nova messages (${this.account.dailyChatCount}/${this.account.dailyChatLimit})`, this.account.username);

                for (let i = 0; i < messagesToSend && i < shuffledMessages.length; i++) {
                    if (this.account.dailyChatCount >= this.account.dailyChatLimit) {
                        logger.task(`Chat limit reached (${this.account.dailyChatCount}/${this.account.dailyChatLimit})`, this.account.username);
                        break;
                    }

                    const msg = shuffledMessages[i];
                    const result = await this.client.sendNovaMessage(msg, sessionId);

                    if (result === 'LIMIT_REACHED') {
                        logger.warn(`⛔ Chat limit hit - stopping message loop`);
                        break;
                    }

                    if (result) {
                        this.taskStats.messagesSent++;
                        this.taskStats.totalMessageReward += result.fxpReward || 0;
                    }

                    await this.randomDelay(CONFIG.MIN_MESSAGE_DELAY, CONFIG.MAX_MESSAGE_DELAY);
                }

                if (this.taskStats.messagesSent > 0) {
                    logger.account(`📝 Nova messages: ${this.taskStats.messagesSent} sent (+${this.taskStats.totalMessageReward} FXP)`, this.account.username);
                }
            } else {
                logger.skip(`Chat limit already reached (${this.account.dailyChatCount}/${this.account.dailyChatLimit})`, this.account.username);
            }

            await this.randomDelay();

            const quests = await this.client.getQuests();
            const socialQuests = this.pendingQuests(quests.SOCIAL || []);
            const dailyQuests = this.completedQuests(quests.DAILY || []);
            const growthQuests = this.completedQuests(quests.GROWTH || []);

            logger.task(`Found ${socialQuests.length} social, ${dailyQuests.length} daily, ${growthQuests.length} growth quests to process`, this.account.username);
            await this.randomDelay();

            if (socialQuests.length > 0) {
                await this.runQuestGroup(socialQuests, true, 'Social Quests');
                await this.randomDelay();
            }

            if (dailyQuests.length > 0) {
                await this.runQuestGroup(dailyQuests, false, 'Daily Quests');
                await this.randomDelay();
            }

            if (growthQuests.length > 0) {
                await this.runQuestGroup(growthQuests, false, 'Growth Quests');
                await this.randomDelay();
            }

            const predictions = await this.client.getPredictions();
            const stakeable = predictions.filter(p => p.status === 'OPEN' && !p.userStake);

            if (stakeable.length > 0) {
                logger.task(`Found ${stakeable.length} open predictions to stake on`, this.account.username);

                for (const pred of stakeable) {
                    try {
                        const maxStake = pred.maxStakeFXP || CONFIG.MAX_PREDICTION_STAKE;
                        const stake = getRandomDelay(CONFIG.MIN_PREDICTION_STAKE, Math.min(maxStake, CONFIG.MAX_PREDICTION_STAKE));
                        
                        let outcome = 'YES';
                        if (CONFIG.SMART_PREDICTION && pred.predictedOutcome) {
                            outcome = pred.predictedOutcome === 'YES' ? 'YES' : 'NO';
                        } else {
                            outcome = Math.random() > 0.5 ? 'YES' : 'NO';
                        }
                        
                        await this.client.placePredictionStake(pred.id, outcome, stake);
                        this.taskStats.predictionsPlaced++;
                        await this.randomDelay();
                    } catch (e) {
                        logger.warn(`Error placing prediction stake: ${e.message}`);
                    }
                }
            } else {
                logger.task('No open predictions available', this.account.username);
            }

            await this.randomDelay();

            const finalStats = await this.client.getUserStats();
            if (finalStats) {
                const fxp = finalStats.fxpBalance || 0;
                const level = finalStats.level || 0;
                logger.success(`✅ Account Complete: FXP ${fxp} | Level ${level} | Rewards Earned: ${this.account.totalRewardsEarned}`);
                this.account.tasksCompleted = 6;
            }

            logger.account(`📈 Session Summary:`, this.account.username);
            logger.account(`   • Daily Bonus: ${this.taskStats.bonusClaimed ? '✓' : '✗'}`, this.account.username);
            logger.account(`   • Search Rewards: ${this.taskStats.searchClaimed}x claimed`, this.account.username);
            logger.account(`   • Messages Sent: ${this.taskStats.messagesSent} (+${this.taskStats.totalMessageReward} FXP)`, this.account.username);
            logger.account(`   • Quests Claimed: ${this.taskStats.questsClaimed} (+${this.taskStats.totalQuestReward} FXP)`, this.account.username);
            logger.account(`   • Predictions Placed: ${this.taskStats.predictionsPlaced}`, this.account.username);
            logger.account(`   • Boost Activated: ${this.taskStats.boostActivated ? '✓' : '✗'}`, this.account.username);
            logger.account(`   • 💎 Total Earned: ${this.account.totalRewardsEarned} FXP`, this.account.username);

            return true;
        } catch (e) {
            logger.error(`Task execution error: ${e.message}`);
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
                fs.writeFileSync('proxy.txt', '# Add your proxies here\n# Format: http://user:pass@ip:port or socks5://user:pass@ip:port\n');
            }
            logger.info('Proxy mode enabled');
        } else {
            logger.info('Direct mode enabled');
        }

        this.isRunning = true;

        while (this.isRunning) {
            try {
                const currentDate = new Date().toISOString().split('T')[0];
                if (this.lastRunDate !== currentDate) {
                    this.accountManager.resetAll();
                    this.lastRunDate = currentDate;
                    logger.info('📅 Daily reset completed');
                }

                const account = this.accountManager.getNextAccount();

                if (!account) {
                    logger.success(`🎉 All ${this.accountManager.getTotalCount()} accounts completed!`);
                    logger.info(`📊 Session Total Rewards: ${this.accountManager.getTotalRewards()} FXP`);
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
                logger.info(`\n🔄 Processing Account ${idx}/${total} - ${account.username}`);

                const client = new FINTOQClient(account);
                client.setUseProxy(this.useProxy);
                const tasks = new BotTasks(client);
                const success = await tasks.executeAllTasks();

                if (success) {
                    this.accountManager.markDone(account);
                    const done = this.accountManager.getDoneCount();
                    const totalCount = this.accountManager.getTotalCount();
                    const totalRewards = this.accountManager.getTotalRewards();
                    logger.info(`✅ Progress: ${done}/${totalCount} | Session Rewards: ${totalRewards} FXP`);
                } else {
                    logger.warn(`Account ${account.username} task execution failed, marking as done to continue`);
                    this.accountManager.markDone(account);
                }

                const delay = getRandomDelay(CONFIG.MIN_ACCOUNT_DELAY, CONFIG.MAX_ACCOUNT_DELAY);
                logger.debug(`Waiting ${delay}ms before next account...`);
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
        logger.info('Bot stopped by user');
    }
}

const bot = new FINTOQBot();

process.on('SIGINT', () => {
    logger.warn('Received SIGINT, stopping bot...');
    bot.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.warn('Received SIGTERM, stopping bot...');
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
