const STORAGE_KEY = 'color_cards_data';
const TEMPLATE_KEY = 'color_card_template';
const MATERIALS_KEY = 'color_card_materials';
const STOCK_LOG_KEY = 'color_card_stock_logs';
const MANUFACTURERS_KEY = 'color_card_manufacturers';
const LOCAL_DELETE_KEY = 'color_cards_local_delete_time';
const VERSION_KEY = 'color_cards_version';
const CURRENT_VERSION = '2.0';

// Debug mode - set to false in production
const DEBUG = false;
const log = (...args) => DEBUG ? console.log(...args) : undefined;
const warn = (...args) => DEBUG ? console.warn(...args) : undefined;
const error = (...args) => DEBUG ? console.error(...args) : undefined;

// Common error handler to reduce repetitive try-catch blocks
const handleError = (context, err, showAlert = true) => {
    error(`${context}:`, err);
    if (showAlert) alert(`${context}失败，请重试`);
};

// Utility: bind click-outside-to-close for modals
function bindModalClose(modalId, closeFn) {
    window.addEventListener('click', (e) => {
        if (e.target === document.getElementById(modalId)) {
            closeFn();
        }
    });
}

// DOM Cache - frequently accessed elements
const DOM = {};
function cacheDOMElements() {
    const ids = [
        'cardsContainer', 'searchInput', 'searchClear', 'sortSelect',
        'addCardBtn', 'templateBtn', 'adminBtn', 'refreshBtn',
        'batchModeBtn', 'batchCancelBtn', 'batchSelectAll', 'batchDeleteBtn',
        'batchExportBtn', 'batchApplyBtn', 'batchStockOp', 'batchStockVal',
        'batchManufacturer', 'batchMaterial', 'batchCount',
        'lowStockWarning', 'lowStockText', 'lowStockDismiss',
        'stockSettingsBtn', 'stockLogBtn', 'statsBtn',
        'toastContainer', 'scanModal', 'exportModal', 'stockSettingsModal',
        'stockLogModal', 'statsModal', 'adminModal',
        'addCardModal', 'editCardModal', 'detailCardModal', 'editTemplateModal'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) DOM[id] = el;
    });
}

// Constants
const OCR_MAX_SIZE = 1200;
const OCR_QUALITY = 0.8;
const CARD_IMAGE_MAX_SIZE = 800;
const CARD_IMAGE_QUALITY = 0.85;
const SEARCH_DEBOUNCE_MS = 300;
const SYNC_INTERVAL_MS = 10000;
const DELETE_KEY_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_SEARCH_HISTORY = 10;
const STOCK_WARNING_DEFAULT_THRESHOLD = 1;
const SIMILAR_COLORS_COUNT = 8;
const QR_CODE_SIZE = 200;
const QR_CODE_COLS = 3;

// PWA IndexedDB 离线存储
const DB_NAME = 'ColorCardsDB';
const DB_VERSION = 1;
let offlineDB = null;

// 初始化 IndexedDB
async function initOfflineDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            offlineDB = request.result;
            log('[PWA] IndexedDB initialized');
            resolve(offlineDB);
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('cards')) {
                db.createObjectStore('cards', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('materials')) {
                db.createObjectStore('materials', { keyPath: 'name' });
            }
            if (!db.objectStoreNames.contains('manufacturers')) {
                db.createObjectStore('manufacturers', { keyPath: 'name' });
            }
            if (!db.objectStoreNames.contains('pendingSyncs')) {
                db.createObjectStore('pendingSyncs', { keyPath: 'id', autoIncrement: true });
            }
            log('[PWA] IndexedDB stores created');
        };
    });
}

// IndexedDB 辅助函数
async function dbGetAll(storeName) {
    if (!offlineDB) await initOfflineDB();
    return new Promise((resolve, reject) => {
        const transaction = offlineDB.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function dbPut(storeName, data) {
    if (!offlineDB) await initOfflineDB();
    return new Promise((resolve, reject) => {
        const transaction = offlineDB.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = Array.isArray(data) 
            ? data.forEach(item => store.put(item))
            : store.put(data);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

async function dbDelete(storeName, key) {
    if (!offlineDB) await initOfflineDB();
    return new Promise((resolve, reject) => {
        const transaction = offlineDB.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

async function dbClear(storeName) {
    if (!offlineDB) await initOfflineDB();
    return new Promise((resolve, reject) => {
        const transaction = offlineDB.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

// Supabase 云端配置
const SUPABASE_URL = 'https://xgalutaglwryurdmwbpl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnYWx1dGFnbHdyeXVyZG13YnBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNTM3MTksImV4cCI6MjA5NzgyOTcxOX0.CfJ5kjGHI2_np7nUfl8O12-xBC2T8mj_xsEl-fG_NJc';

let supabaseClient = null;

try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        log('Supabase 初始化成功');
    }
} catch (e) {
    warn('Supabase 初始化失败，将使用本地存储模式', e);
}

// camelCase -> snake_case: chineseName -> chinese_name, englishName -> english_name
function camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => '_' + letter.toLowerCase());
}

// snake_case -> camelCase: chinese_name -> chineseName
function snakeToCamel(str) {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// 转换整个对象的 key
function keysToSnake(obj) {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(keysToSnake);
    if (typeof obj !== 'object') return obj;
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        result[camelToSnake(key)] = keysToSnake(value);
    }
    return result;
}

function keysToCamel(obj) {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(keysToCamel);
    if (typeof obj !== 'object') return obj;
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        result[snakeToCamel(key)] = keysToCamel(value);
    }
    return result;
}

const CloudStorage = {
    isAvailable() {
        return supabaseClient !== null;
    },

    setStatus(status, text) {
        const icon = document.getElementById('cloudIcon');
        const textEl = document.getElementById('cloudText');
        const statusEl = document.getElementById('cloudStatus');
        if (!icon || !textEl || !statusEl) return;

        statusEl.className = 'cloud-status ' + status;
        if (status === 'connected') {
            icon.textContent = '☁️';
        } else if (status === 'disconnected') {
            icon.textContent = '⚠️';
        } else if (status === 'syncing') {
            icon.textContent = '🔄';
        }
        textEl.textContent = text;
    },

    async loadCards() {
        if (!this.isAvailable()) return null;
        try {
            const { data, error } = await supabaseClient
                .from('cards')
                .select('*')
                .order('id');
            if (error) throw error;
            return data ? data.map(keysToCamel) : [];
        } catch (e) {
            warn('从云端加载色卡失败', e);
            return null;
        }
    },

    async saveCards(cards) {
        if (!this.isAvailable()) return false;
        try {
            const { error } = await supabaseClient
                .from('cards')
                .upsert(cards.map(card => keysToSnake({
                    id: card.id,
                    category: card.category,
                    manufacturer: card.manufacturer,
                    englishName: card.englishName,
                    material: card.material,
                    variant: card.variant || '',
                    image: card.image,
                    chineseName: card.chineseName,
                    config: card.config,
                    quantity: card.quantity,
                    color: card.color,
                    notes: card.notes || '',
                    sortOrder: card.sortOrder || 0
                })));
            if (error) throw error;
            return true;
        } catch (e) {
            warn('保存色卡到云端失败', e);
            return false;
        }
    },

    async addCard(card) {
        if (!this.isAvailable()) return false;
        try {
            const { error } = await supabaseClient
                .from('cards')
                .insert(keysToSnake({
                    id: card.id,
                    category: card.category,
                    manufacturer: card.manufacturer,
                    englishName: card.englishName,
                    material: card.material,
                    variant: card.variant || '',
                    image: card.image,
                    chineseName: card.chineseName,
                    config: card.config,
                    quantity: card.quantity,
                    color: card.color,
                    notes: card.notes || '',
                    sortOrder: card.sortOrder || 0
                }));
            if (error) throw error;
            return true;
        } catch (e) {
            warn('添加色卡到云端失败', e);
            return false;
        }
    },

    async updateCard(card) {
        if (!this.isAvailable()) return false;
        try {
            const { error } = await supabaseClient
                .from('cards')
                .update(keysToSnake({
                    category: card.category,
                    manufacturer: card.manufacturer,
                    englishName: card.englishName,
                    material: card.material,
                    variant: card.variant || '',
                    image: card.image,
                    chineseName: card.chineseName,
                    config: card.config,
                    quantity: card.quantity,
                    color: card.color,
                    notes: card.notes || '',
                    sortOrder: card.sortOrder || 0
                }))
                .eq('id', card.id);
            if (error) throw error;
            return true;
        } catch (e) {
            warn('更新云端色卡失败', e);
            return false;
        }
    },

    async deleteCard(cardId) {
        if (!this.isAvailable()) return false;
        try {
            const { error } = await supabaseClient
                .from('cards')
                .delete()
                .eq('id', cardId);
            if (error) throw error;
            return true;
        } catch (e) {
            warn('删除云端色卡失败', e);
            return false;
        }
    },

    async loadMaterials() {
        if (!this.isAvailable()) return null;
        try {
            const { data, error } = await supabaseClient
                .from('materials')
                .select('name')
                .order('name');
            if (error) throw error;
            return data ? data.map(item => item.name) : [];
        } catch (e) {
            warn('从云端加载材料失败', e);
            return null;
        }
    },

    async addMaterial(name) {
        if (!this.isAvailable()) return false;
        try {
            const { error } = await supabaseClient
                .from('materials')
                .insert({ name });
            if (error) throw error;
            return true;
        } catch (e) {
            warn('添加材料到云端失败', e);
            return false;
        }
    },

    async deleteMaterial(name) {
        if (!this.isAvailable()) return false;
        try {
            const { error } = await supabaseClient
                .from('materials')
                .delete()
                .eq('name', name);
            if (error) throw error;
            return true;
        } catch (e) {
            warn('删除云端材料失败', e);
            return false;
        }
    },

    async loadManufacturers() {
        if (!this.isAvailable()) return null;
        try {
            const { data, error } = await supabaseClient
                .from('manufacturers')
                .select('name')
                .order('name');
            if (error) throw error;
            return data ? data.map(item => item.name) : [];
        } catch (e) {
            warn('从云端加载产商失败', e);
            return null;
        }
    },

    async addManufacturer(name) {
        if (!this.isAvailable()) return false;
        try {
            const { error } = await supabaseClient
                .from('manufacturers')
                .insert({ name });
            if (error) throw error;
            return true;
        } catch (e) {
            warn('添加产商到云端失败', e);
            return false;
        }
    },

    async deleteManufacturer(name) {
        if (!this.isAvailable()) return false;
        try {
            const { error } = await supabaseClient
                .from('manufacturers')
                .delete()
                .eq('name', name);
            if (error) throw error;
            return true;
        } catch (e) {
            warn('删除云端产商失败', e);
            return false;
        }
    },

    async saveMaterials(materials) {
        if (!this.isAvailable()) return false;
        try {
            await supabaseClient.from('materials').delete().neq('name', '');
            const rows = materials.map(name => ({ name }));
            const { error } = await supabaseClient.from('materials').insert(rows);
            if (error) throw error;
            return true;
        } catch (e) {
            warn('同步材料到云端失败', e);
            return false;
        }
    },

    async saveManufacturers(manufacturers) {
        if (!this.isAvailable()) return false;
        try {
            await supabaseClient.from('manufacturers').delete().neq('name', '');
            const rows = manufacturers.map(name => ({ name }));
            const { error } = await supabaseClient.from('manufacturers').insert(rows);
            if (error) throw error;
            return true;
        } catch (e) {
            warn('同步产商到云端失败', e);
            return false;
        }
    },

    async loadTemplate() {
        if (!this.isAvailable()) return null;
        try {
            const { data, error } = await supabaseClient
                .from('template')
                .select('*')
                .single();
            if (error) {
                // PGRST116 = no rows found, 406 = not acceptable (table empty or query issue)
                if (error.code === 'PGRST116' || error.status === 406) return null;
                throw error;
            }
            return data;
        } catch (e) {
            warn('从云端加载模板失败', e);
            return null;
        }
    },

    async saveTemplate(template) {
        if (!this.isAvailable()) return false;
        try {
            const existing = await this.loadTemplate();
            if (existing && existing.id) {
                const { error } = await supabaseClient
                    .from('template')
                    .update({
                        manufacturer: template.manufacturer,
                        material: template.material,
                        config: template.config
                    })
                    .eq('id', existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabaseClient
                    .from('template')
                    .insert({
                        manufacturer: template.manufacturer,
                        material: template.material,
                        config: template.config
                    });
                if (error) throw error;
            }
            return true;
        } catch (e) {
            warn('保存模板到云端失败', e);
            return false;
        }
    }
};

const defaultMaterials = [];
const defaultManufacturers = [];

const categoryColors = {
    red: '#ef4444',
    orange: '#f97316',
    yellow: '#eab308',
    green: '#22c55e',
    cyan: '#06b6d4',
    blue: '#3b82f6',
    purple: '#a855f7',
    black: '#1a1a1a',
    white: '#f0f0f0',
    gray: '#888888',
    pink: '#ec4899',
    brown: '#92400e',
    rainbow: 'linear-gradient(135deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#a855f7)'
};

const categoryNames = {
    red: '赤色',
    orange: '橙色',
    yellow: '黄色',
    green: '绿色',
    cyan: '青色',
    blue: '蓝色',
    purple: '紫色',
    black: '黑色',
    white: '白色',
    gray: '灰色',
    pink: '粉色',
    brown: '棕色',
    rainbow: '彩虹'
};

const defaultCards = [];

const defaultTemplate = {
    manufacturer: '',
    material: '',
    config: []
};

const Storage = {
    async loadCards() {
        // 优先从 IndexedDB 加载（离线支持）
        if (navigator.onLine === false || offlineDB) {
            try {
                const dbCards = await dbGetAll('cards');
                if (dbCards && dbCards.length > 0) {
                    log('[PWA] Loaded cards from IndexedDB');
                    return dbCards.map(card => {
                        if (typeof card.config === 'string') {
                            return { ...card, config: Utils.parseConfig(card.config) };
                        }
                        if (!card.config || !Array.isArray(card.config)) {
                            return { ...card, config: [{ key: '流量比', value: '' }] };
                        }
                        return card;
                    });
                }
            } catch (e) {
                warn('[PWA] Failed to load from IndexedDB:', e);
            }
        }

        // 回退到 localStorage
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const cards = JSON.parse(saved);
                return cards.map(card => {
                    if (typeof card.config === 'string') {
                        return { ...card, config: Utils.parseConfig(card.config) };
                    }
                    if (!card.config || !Array.isArray(card.config)) {
                        return { ...card, config: [{ key: '流量比', value: '' }] };
                    }
                    return card;
                });
            } catch {
                return [...defaultCards];
            }
        }
        return [...defaultCards];
    },

    async saveCards(cards) {
        // 同时保存到 localStorage 和 IndexedDB
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
        
        // 离线时记录待同步操作
        if (navigator.onLine === false) {
            try {
                await dbPut('pendingSyncs', {
                    type: 'sync-all',
                    data: cards,
                    timestamp: Date.now()
                });
                log('[PWA] Saved to IndexedDB (offline mode)');
            } catch (e) {
                warn('[PWA] Failed to save to IndexedDB:', e);
            }
        } else {
            // 在线时直接同步到 IndexedDB
            try {
                await dbClear('cards');
                await dbPut('cards', cards);
                log('[PWA] Synced cards to IndexedDB');
            } catch (e) {
                warn('[PWA] Failed to sync to IndexedDB:', e);
            }
        }
    },

    async loadTemplate() {
        const saved = localStorage.getItem(TEMPLATE_KEY);
        if (saved) {
            try {
                const template = JSON.parse(saved);
                if (!template.config || !Array.isArray(template.config)) {
                    template.config = defaultTemplate.config;
                }
                return template;
            } catch {
                return { ...defaultTemplate };
            }
        }
        return { ...defaultTemplate };
    },

    saveTemplate(template) {
        localStorage.setItem(TEMPLATE_KEY, JSON.stringify(template));
    },

    async loadMaterials() {
        // 优先从 IndexedDB 加载
        if (offlineDB) {
            try {
                const dbMaterials = await dbGetAll('materials');
                if (dbMaterials && dbMaterials.length > 0) {
                    return dbMaterials.map(m => m.name);
                }
            } catch (e) {
                warn('[PWA] Failed to load materials from IndexedDB:', e);
            }
        }

        const saved = localStorage.getItem(MATERIALS_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                return [...defaultMaterials];
            }
        }
        return [...defaultMaterials];
    },

    async saveMaterials(materials) {
        localStorage.setItem(MATERIALS_KEY, JSON.stringify(materials));
        
        // 同步到 IndexedDB
        if (offlineDB) {
            try {
                await dbClear('materials');
                const rows = materials.map(name => ({ name }));
                await dbPut('materials', rows);
            } catch (e) {
                warn('[PWA] Failed to sync materials to IndexedDB:', e);
            }
        }
    },
    
    async loadManufacturers() {
        // 优先从 IndexedDB 加载
        if (offlineDB) {
            try {
                const dbManufacturers = await dbGetAll('manufacturers');
                if (dbManufacturers && dbManufacturers.length > 0) {
                    return dbManufacturers.map(m => m.name);
                }
            } catch (e) {
                warn('[PWA] Failed to load manufacturers from IndexedDB:', e);
            }
        }

        const saved = localStorage.getItem(MANUFACTURERS_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                return [...defaultManufacturers];
            }
        }
        return [...defaultManufacturers];
    },

    async saveManufacturers(manufacturers) {
        localStorage.setItem(MANUFACTURERS_KEY, JSON.stringify(manufacturers));
        
        // 同步到 IndexedDB
        if (offlineDB) {
            try {
                await dbClear('manufacturers');
                const rows = manufacturers.map(name => ({ name }));
                await dbPut('manufacturers', rows);
            } catch (e) {
                warn('[PWA] Failed to sync manufacturers to IndexedDB:', e);
            }
        }
    }
};

const Utils = {
    debounce(fn, delay = 300) {
        let timer = null;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    getColorForCategory(category) {
        return categoryColors[category] || '#888888';
    },

    configToText(config) {
        if (!config || config.length === 0) return '暂无配置信息';
        return config.map(item => `${item.key}: ${item.value || '-'}`).join('; ');
    },

    parseConfig(text) {
        if (!text || text === '暂无配置信息') return [];
        return text.split(';').map(item => {
            const [key, value] = item.split(':').map(s => s.trim());
            return { key: key || '', value: value || '' };
        }).filter(item => item.key);
    },

    getConfigFromContainer(container) {
        const configItems = container.querySelectorAll('.config-item');
        const config = [];
        configItems.forEach(item => {
            const key = item.querySelector('.config-key').value.trim();
            const value = item.querySelector('.config-value').value.trim();
            if (key) {
                config.push({ key, value });
            }
        });
        return config;
    },

    setupConfigRemoveButtons(container) {
        container.querySelectorAll('.remove-config-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemCount = container.querySelectorAll('.config-item').length;
                if (itemCount > 1) {
                    e.target.parentElement.remove();
                }
            });
        });
    },

    addConfigItem(container) {
        const configItem = document.createElement('div');
        configItem.className = 'config-item';
        configItem.innerHTML = `
            <input type="text" class="config-key" placeholder="配置项名称">
            <input type="text" class="config-value" placeholder="配置值">
            <button type="button" class="remove-config-btn">×</button>
        `;
        container.appendChild(configItem);
        Utils.setupConfigRemoveButtons(container);
    },

    resetConfigContainer(container) {
        container.innerHTML = `
            <div class="config-item">
                <input type="text" class="config-key" placeholder="配置项名称">
                <input type="text" class="config-value" placeholder="配置值">
                <button type="button" class="remove-config-btn">×</button>
            </div>
        `;
    }
};

class MaterialManager {
    constructor() {
        this.materials = [];
        this.manufacturers = [];
        this._initialized = false;
    }

    async init() {
        this.materials = await Storage.loadMaterials();
        this.manufacturers = await Storage.loadManufacturers();
        // 去重，清理历史重复数据
        this.materials = [...new Set(this.materials)];
        this.manufacturers = [...new Set(this.manufacturers)];
        this._initialized = true;
        this.updateSelects();
    }

    addMaterial(material) {
        const trimmed = material.trim();
        if (!trimmed) return false;
        if (this.materials.includes(trimmed)) return false;
        this.materials.push(trimmed);
        Storage.saveMaterials(this.materials);
        CloudStorage.addMaterial(trimmed);
        this.updateSelects();
        return true;
    }
    
    addManufacturer(manufacturer) {
        const trimmed = manufacturer.trim();
        if (!trimmed) return false;
        if (this.manufacturers.includes(trimmed)) return false;
        this.manufacturers.push(trimmed);
        Storage.saveManufacturers(this.manufacturers);
        CloudStorage.addManufacturer(trimmed);
        this.updateSelects();
        return true;
    }

    updateSelects() {
        // Update material selects
        const materialSelects = [
            document.getElementById('material'),
            document.getElementById('editMaterial')
        ];
        materialSelects.forEach(select => {
            if (!select) return;
            const currentValue = select.value;
            select.innerHTML = '<option value="">请选择材料</option>';
            (this.materials || []).forEach(material => {
                const option = document.createElement('option');
                option.value = material;
                option.textContent = material;
                if (material === currentValue) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        });

        // Update manufacturer selects
        const manufacturerSelects = [
            document.getElementById('manufacturer'),
            document.getElementById('editManufacturer')
        ];
        manufacturerSelects.forEach(select => {
            if (!select) return;
            const currentValue = select.value;
            select.innerHTML = '<option value="">请选择产商</option>';
            (this.manufacturers || []).forEach(manufacturer => {
                const option = document.createElement('option');
                option.value = manufacturer;
                option.textContent = manufacturer;
                if (manufacturer === currentValue) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        });
    }
}

class ModalManager {
    constructor() {
        this.modals = {
            addCard: document.getElementById('addCardModal'),
            editCard: document.getElementById('editCardModal'),
            detailCard: document.getElementById('detailCardModal'),
            editTemplate: document.getElementById('editTemplateModal'),
            admin: document.getElementById('adminModal')
        };

        this.forms = {
            addCard: document.getElementById('addCardForm'),
            editCard: document.getElementById('editCardForm'),
            editTemplate: document.getElementById('editTemplateForm')
        };

        this.previews = {
            image: document.getElementById('imagePreview'),
            editImage: document.getElementById('editImagePreview'),
            editCurrentImage: document.getElementById('editCurrentImage')
        };

        this.configContainers = {
            add: document.getElementById('addConfigContainer'),
            edit: document.getElementById('editConfigContainer'),
            template: document.getElementById('templateConfigContainer')
        };

        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('closeModalBtn').addEventListener('click', () => this.close('addCard'));
        document.getElementById('closeEditModalBtn').addEventListener('click', () => this.close('editCard'));
        document.getElementById('closeDetailModalBtn').addEventListener('click', () => this.close('detailCard'));
        document.getElementById('closeTemplateModalBtn').addEventListener('click', () => this.close('editTemplate'));
        document.getElementById('closeAdminModalBtn').addEventListener('click', () => this.close('admin'));

        window.addEventListener('click', (e) => {
            Object.entries(this.modals).forEach(([key, modal]) => {
                if (e.target === modal) {
                    this.close(key);
                }
            });
        });
    }

    open(modalName) {
        this.modals[modalName].style.display = 'block';
        
        if (modalName === 'addCard') {
            // 重置取色器
            const colorInput = document.getElementById('color');
            if (colorInput) {
                colorInput.value = '#888888';
                const hexLabel = document.querySelector('#color + .color-hex-label');
                if (hexLabel) hexLabel.textContent = '#888888';
            }
        }
    }

    close(modalName) {
        this.modals[modalName].style.display = 'none';
        
        if (this.forms[modalName]) {
            this.forms[modalName].reset();
        }

        if (modalName === 'addCard') {
            this.previews.image.innerHTML = '';
            Utils.resetConfigContainer(this.configContainers.add);
        } else if (modalName === 'editCard') {
            this.previews.editImage.innerHTML = '';
            this.previews.editCurrentImage.innerHTML = '';
            CardManager.currentEditingCard = null;
        } else if (modalName === 'detailCard') {
            CardManager.currentDetailCard = null;
        } else if (modalName === 'editTemplate') {
            this.forms.editTemplate.reset();
        }
    }
}

// ===== 库存变动日志管理器 =====
class StockLogManager {
    constructor() {
        this.logs = this.load();
    }

    load() {
        try {
            const saved = localStorage.getItem(STOCK_LOG_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    }

    save() {
        try {
            if (this.logs.length > 500) {
                this.logs = this.logs.slice(0, 500);
            }
            localStorage.setItem(STOCK_LOG_KEY, JSON.stringify(this.logs));
        } catch { /* localStorage full */ }
    }

    add(cardId, cardName, before, after, type = 'manual') {
        const change = after - before;
        const entry = {
            id: Date.now().toString() + '_' + Math.random().toString(36).slice(2, 6),
            cardId,
            cardName,
            change,
            before,
            after,
            type, // 'manual' | 'scan' | 'batch' | 'add'
            timestamp: new Date().toISOString()
        };
        this.logs.unshift(entry);
        this.save();
        return entry;
    }

    getFiltered(type = 'all', query = '') {
        let list = [...this.logs];
        if (type !== 'all') {
            list = list.filter(l => l.type === type);
        }
        if (query) {
            const q = query.toLowerCase();
            list = list.filter(l => l.cardName.toLowerCase().includes(q));
        }
        return list;
    }

    clearAll() {
        this.logs = [];
        this.save();
    }
}

// ===== Toast 通知系统 =====
const Toast = {
    show(message, actionLabel, actionFn, duration = 5000) {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        let html = `<span>${message}</span>`;
        if (actionLabel && actionFn) {
            html += `<button class="toast-action">${actionLabel}</button>`;
        }
        toast.innerHTML = html;
        container.appendChild(toast);

        if (actionLabel && actionFn) {
            toast.querySelector('.toast-action').addEventListener('click', () => {
                actionFn();
                this._remove(toast);
            });
        }

        setTimeout(() => this._remove(toast), duration);
    },

    _remove(toast) {
        if (!toast.parentNode) return;
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 250);
    }
};

// ===== 撤销管理器 =====
class UndoManager {
    constructor(cardManager) {
        this.cardManager = cardManager;
        this.stack = [];
        this.maxSize = 20;
    }

    push(action) {
        // action: { type, data, description }
        this.stack.unshift(action);
        if (this.stack.length > this.maxSize) this.stack.pop();
    }

    canUndo() {
        return this.stack.length > 0;
    }

    async undo() {
        const action = this.stack.shift();
        if (!action) return false;

        const cm = this.cardManager;

        switch (action.type) {
            case 'delete': {
                // Restore deleted cards
                const cards = action.data.cards;
                cards.forEach(c => {
                    if (!cm.cards.find(x => x.id === c.id)) {
                        cm.cards.push(c);
                    }
                });
                Storage.saveCards(cm.cards);
                localStorage.removeItem(LOCAL_DELETE_KEY);
                if (CloudStorage.isAvailable()) CloudStorage.saveCards(cm.cards);
                cm.applyFilters();
                return `已恢复 ${cards.length} 张色卡`;
            }
            case 'edit': {
                // Restore previous card state
                const { cardId, previousState } = action.data;
                const idx = cm.cards.findIndex(c => c.id === cardId);
                if (idx !== -1) {
                    cm.cards[idx] = { ...cm.cards[idx], ...previousState };
                    Storage.saveCards(cm.cards);
                    CloudStorage.updateCard(cm.cards[idx]);
                    cm.applyFilters();
                }
                return `已撤销编辑`;
            }
            case 'batch': {
                // Restore batch operation
                const { previousStates } = action.data;
                previousStates.forEach(({ cardId, state }) => {
                    const idx = cm.cards.findIndex(c => c.id === cardId);
                    if (idx !== -1) {
                        cm.cards[idx] = { ...cm.cards[idx], ...state };
                    }
                });
                Storage.saveCards(cm.cards);
                if (CloudStorage.isAvailable()) CloudStorage.saveCards(cm.cards);
                cm.applyFilters();
                return `已撤销批量操作`;
            }
            case 'reorder': {
                // Restore previous order
                cm.cards = action.data.previousOrder;
                Storage.saveCards(cm.cards);
                if (CloudStorage.isAvailable()) CloudStorage.saveCards(cm.cards);
                cm.applyFilters();
                return `已撤销排序`;
            }
        }
        return false;
    }

    showUndoToast(description) {
        // 已关闭撤销弹窗
    }
}

// ===== 图片预处理工具（提升 OCR 准确率）=====
const ImagePreprocessor = {
    async preprocess(dataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                // 放大 3 倍（Tesseract 对 300dpi+ 效果最好）
                const scale = Math.max(3, 2400 / Math.max(img.width, img.height));
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');

                // 高质量缩放
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);

                const imageData = ctx.getImageData(0, 0, w, h);
                const data = imageData.data;

                // 1. 灰度化 + 轻度对比度增强
                const sorted = new Uint32Array(256);
                for (let i = 0, j = 0; i < data.length; i += 4, j++) {
                    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    sorted[Math.round(gray)]++;
                    data[i] = data[i + 1] = data[i + 2] = gray;
                }

                // 2. 温和对比度拉伸（1%-99% 百分位）
                let count = 0;
                let low = 0, high = 255;
                for (let i = 0; i < 256; i++) {
                    count += sorted[i];
                    if (count < w * h * 0.01 && i < 255) low = i;
                    if (count >= w * h * 0.99 && high === 255) high = i;
                }
                const range = high - low || 1;
                const factor = 1.2; // 轻微增强

                for (let i = 0; i < data.length; i += 4) {
                    let val = ((data[i] - low) / range) * 255;
                    val = Math.max(0, Math.min(255, val));
                    // 轻度锐化：向黑白两端拉伸
                    val = (val - 128) * factor + 128;
                    val = Math.max(0, Math.min(255, val));
                    data[i] = data[i + 1] = data[i + 2] = val;
                }

                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        });
    },

    // 高对比度预处理（捕捉小字：只放大+灰度，不做对比度拉伸）
    async preprocessHighContrast(dataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                // 放大 5 倍（比标准模式更大，专门捕捉小字）
                const scale = Math.max(5, 4000 / Math.max(img.width, img.height));
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);

                const imageData = ctx.getImageData(0, 0, w, h);
                const data = imageData.data;

                // 只转灰度，不做对比度拉伸（避免破坏小字）
                for (let i = 0; i < data.length; i += 4) {
                    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    data[i] = data[i + 1] = data[i + 2] = gray;
                }

                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        });
    },

    // 压缩图片用于 API 发送（最大边 1024px，JPEG 0.8 质量）
    async compressForAPI(dataUrl, maxSize = 1024) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                let w = img.width, h = img.height;
                if (w > maxSize || h > maxSize) {
                    if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
                    else { w = Math.round(w * maxSize / h); h = maxSize; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        });
    }
};

// ===== OCR.Space 模块（浏览器直接调用，无需代理）=====
const OCRSpace = {
    apiKey: 'helloworld', // 免费 key，25000次/月，https://ocr.space/ 注册可获取更高额度

    async recognize(imageDataUrl) {
        const base64Image = imageDataUrl.split(',')[1];
        const url = 'https://api.ocr.space/parse/image';
        
        const formData = new URLSearchParams();
        formData.append('base64Image', `data:image/png;base64,${base64Image}`);
        formData.append('language', 'chs');
        formData.append('isOverlayRequired', 'false');
        formData.append('apikey', this.apiKey);
        formData.append('OCREngine', '2'); // 引擎2精度更高
        
        // 添加超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString(),
                signal: controller.signal
            });
            
            const data = await response.json();
            
            if (data.IsErroredOnProcessing) {
                throw new Error(`OCR 失败：${data.ErrorMessage || '未知错误'}`);
            }
            
            if (data.ParsedResults && data.ParsedResults.length > 0) {
                const text = data.ParsedResults.map(r => r.ParsedText).join('\n');
                log('[OCRSpace] 识别成功');
                return {
                    text: text,
                    confidence: 90,
                    wordsCount: text.split(/\s+/).length
                };
            } else {
                throw new Error('OCR 未识别到文字');
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('OCR 请求超时，请检查网络连接');
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }
};

// ===== LLM 智能解析模块 =====
const LLMParser = {
    apiKey: 'sk-aed250fd87924d5f9a70a75f1c2283c5',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',

    async parse(ocrText, onProgress, imageDataUrl) {
        const systemPrompt = `你是色卡信息提取助手，从产品标签 OCR 文字中提取结构化信息。

规则：
- OCR 可能有错别字，请根据上下文推断
- 忽略温度、重量、日期等无用信息
- 只返回 JSON：{"chineseName":"","englishName":"","manufacturer":"","material":"","variant":"","category":""}
- 颜色分类：red/orange/yellow/green/cyan/blue/purple/black/white/gray，或其他颜色英文名
- 材料是基础材质（PLA/PETG/ABS 等），材质是变体（Matte/Lite/M/Silk 等）
- 英文名是颜色名，中文名是英文的中文翻译
- 产商是品牌名（Jucoole/kexcelled/Bambu Lab 等）`;

        // 构建消息内容（纯文字模式，API 不支持图片）
        const userContent = `请从以下产品标签 OCR 文字中提取色卡信息：\n\n${ocrText}`;

        try {
            const requestBody = {
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent }
                ],
                temperature: 0.1,
                max_tokens: 500,
                stream: true
            };
            log('[LLM] 请求参数:', { model: this.model, hasImage: !!imageDataUrl, systemPromptLength: systemPrompt.length });

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                error('[LLM] API 错误:', response.status, errorBody);
                throw new Error(`API 请求失败: ${response.status} - ${errorBody}`);
            }

            return await this._parseStreamResponse(response, onProgress);
        } catch (e) {
            warn('LLM 解析失败，回退到关键词方案:', e);
            return null; // 返回 null 表示失败，调用方回退到关键词方案
        }
    },

    // 流式解析 API 响应
    async _parseStreamResponse(response, onProgress) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '));

            for (const line of lines) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices[0]?.delta?.content || '';
                    fullContent += delta;
                    if (onProgress) onProgress(fullContent);
                } catch (e) {}
            }
        }

        const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('LLM 返回格式异常');
        
        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
            chineseName: parsed.chineseName || '',
            englishName: parsed.englishName || '',
            manufacturer: parsed.manufacturer || '',
            material: parsed.material || '',
            variant: parsed.variant || '',
            category: this._normalizeCategory(parsed.category || '')
        };
    },

    _normalizeCategory(cat) {
        if (!LLMParser._validCategories) {
            LLMParser._validCategories = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'black', 'white', 'gray', 'pink', 'brown'];
        }
        const lower = (cat || '').toLowerCase().trim();
        // 未知分类也保留，后续由动态创建逻辑处理
        return lower || '';
    }
};

// 动态添加新颜色分类
function addNewCategory(catKey, catNameCN, colorHex) {
    // 1. 添加到 categoryNames（直接写 const 对象）
    categoryNames[catKey] = catNameCN;
    
    // 2. 添加到 categoryColors
    categoryColors[catKey] = colorHex || '#888888';
    
    // 3. 添加到 _normalizeCategory 的 valid 数组（通过修改 LLMParser）
    if (LLMParser._validCategories && !LLMParser._validCategories.includes(catKey)) {
        LLMParser._validCategories.push(catKey);
    }
    
    // 4. 添加到所有下拉框
    const dropdowns = ['category', 'editCategory', 'scanCategory'];
    for (const id of dropdowns) {
        const select = document.getElementById(id);
        if (select) {
            // 检查是否已存在
            const exists = Array.from(select.options).some(opt => opt.value === catKey);
            if (!exists) {
                const option = document.createElement('option');
                option.value = catKey;
                option.textContent = catNameCN;
                select.appendChild(option);
            }
        }
    }
    
    // 5. 添加到侧边栏
    const sidebarNav = document.querySelector('.sidebar-nav');
    if (sidebarNav) {
        const exists = sidebarNav.querySelector(`[data-category="${catKey}"]`);
        if (!exists) {
            const btn = document.createElement('button');
            btn.className = 'category-btn';
            btn.setAttribute('data-category', catKey);
            btn.type = 'button';
            btn.innerHTML = `<span class="cat-dot" style="background:${colorHex || '#888888'}"></span>${catNameCN}`;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                cardManager.currentCategory = catKey;
                cardManager.applyFilters();
            });
            sidebarNav.appendChild(btn);
        }
    }
    
    log(`[Category] 新建分类: ${catKey} (${catNameCN})`);
}

class CardManager {
    constructor() {
        this.cards = Storage.loadCards();
        this.template = Storage.loadTemplate();
        this.currentEditingCard = null;
        this.currentDetailCard = null;
        this.cardsContainer = DOM.cardsContainer || document.getElementById('cardsContainer');
        this.modalManager = new ModalManager();
        this.materialManager = new MaterialManager();
        this.lowStockDismissed = false;  // 用户是否已手动关闭警告
        this.cloudSyncCompleted = false; // 云端同步是否已完成
        this.currentCategory = 'all';    // 当前分类筛选
        this.currentSearch = '';         // 当前搜索词
        this.currentSort = 'default';    // 当前排序方式
        this.batchMode = false;          // 批量操作模式
        this.selectedCards = new Set();  // 批量选中的卡片 ID
        this.stockLogManager = new StockLogManager();
        this.undoManager = new UndoManager(this);
        this.draggedCardId = null;
        this._lastRenderedKey = null;    // Cache for avoiding unnecessary re-renders
        this.bindEvents();
        this.setupDelegatedEvents();
    }

    bindEvents() {
        document.getElementById('addCardBtn').addEventListener('click', () => this.modalManager.open('addCard'));
        document.getElementById('templateBtn').addEventListener('click', () => {
            if (this.cards.length > 0 && !confirm('修改模板配置将应用到所有色卡，确定继续？')) return;
            this.showEditTemplate();
        });
        document.getElementById('adminBtn').addEventListener('click', () => this.showAdmin());
        
        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'n' || e.key === 'N') {
                    e.preventDefault();
                    this.modalManager.open('addCard');
                } else if (e.key === 'f' || e.key === 'F') {
                    e.preventDefault();
                    document.getElementById('searchInput').focus();
                } else if (e.key === 'z' || e.key === 'Z') {
                    e.preventDefault();
                    if (this.undoManager.canUndo()) {
                        this.undoManager.undo();
                    }
                }
            }
        });

        document.getElementById('addCardForm').addEventListener('submit', (e) => this.handleAddCard(e));
        document.getElementById('editCardForm').addEventListener('submit', (e) => this.handleEditCard(e));
        document.getElementById('editTemplateForm').addEventListener('submit', (e) => this.handleTemplateSubmit(e));
        
        document.getElementById('addConfigBtn').addEventListener('click', () => Utils.addConfigItem(this.modalManager.configContainers.add));
        document.getElementById('editAddConfigBtn').addEventListener('click', () => Utils.addConfigItem(this.modalManager.configContainers.edit));
        document.getElementById('templateAddConfigBtn').addEventListener('click', () => Utils.addConfigItem(this.modalManager.configContainers.template));
        
        document.getElementById('deleteCardBtn').addEventListener('click', () => this.handleDeleteCard());
        document.getElementById('editDetailBtn').addEventListener('click', () => this.handleEditFromDetail());
        
        document.getElementById('imageUpload').addEventListener('change', (e) => this.handleImageUpload(e, 'imagePreview'));
        document.getElementById('editImageUpload').addEventListener('change', (e) => this.handleImageUpload(e, 'editImagePreview'));

        Utils.setupConfigRemoveButtons(this.modalManager.configContainers.add);

        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.getAttribute('data-category');
                this.currentCategory = category;
                this.applyFilters();
            });
        });

        // Search input with debounce and history
        const SEARCH_HISTORY_KEY = 'color_cards_search_history';
        const maxHistory = 10;
        
        // Load search history
        let searchHistory = [];
        try {
            const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
            if (saved) searchHistory = JSON.parse(saved);
        } catch (e) {}

        const saveSearchHistory = (query) => {
            if (!query || query.length < 2) return;
            // Remove duplicate
            searchHistory = searchHistory.filter(h => h !== query);
            // Add to front
            searchHistory.unshift(query);
            // Keep only last 10
            if (searchHistory.length > maxHistory) searchHistory = searchHistory.slice(0, maxHistory);
            localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory));
        };

        const debouncedSearch = Utils.debounce(() => {
            saveSearchHistory(this.currentSearch);
            this.applyFilters();
        }, 300);
        
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.currentSearch = e.target.value.trim();
            document.getElementById('searchClear').style.display = this.currentSearch ? 'flex' : 'none';
            debouncedSearch();
        });
        document.getElementById('searchClear').addEventListener('click', () => {
            document.getElementById('searchInput').value = '';
            this.currentSearch = '';
            document.getElementById('searchClear').style.display = 'none';
            this.applyFilters();
            document.getElementById('searchInput').focus();
        });

        // Search history dropdown on focus
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('focus', () => {
            if (searchHistory.length > 0 && !this.currentSearch) {
                this.showSearchHistoryDropdown(searchHistory);
            }
        });
        
        // Hide history dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#searchInput') && !e.target.closest('.search-history-dropdown')) {
                this.hideSearchHistoryDropdown();
            }
        });

        // Sort select
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.applyFilters();
        });

        // Admin tab switching
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const tabName = tab.getAttribute('data-tab');
                document.getElementById('materialsPanel').style.display = tabName === 'materials' ? 'block' : 'none';
                document.getElementById('manufacturersPanel').style.display = tabName === 'manufacturers' ? 'block' : 'none';
            });
        });

        // Admin add buttons
        document.getElementById('addMaterialBtn').addEventListener('click', () => this.handleAddAdminItem('newMaterialInput', 'material'));
        document.getElementById('addManufacturerBtn').addEventListener('click', () => this.handleAddAdminItem('newManufacturerInput', 'manufacturer'));

        // Enter key support for admin inputs
        document.getElementById('newMaterialInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAddAdminItem('newMaterialInput', 'material');
        });
        document.getElementById('newManufacturerInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAddAdminItem('newManufacturerInput', 'manufacturer');
        });

        // Low stock warning dismiss
        document.getElementById('lowStockDismiss').addEventListener('click', () => {
            this.lowStockDismissed = true;
            document.getElementById('lowStockWarning').classList.remove('show');
        });

        // Scan modal events
        document.getElementById('scanBtn').addEventListener('click', () => this.openScanModal());
        document.getElementById('closeScanModalBtn').addEventListener('click', () => this.closeScanModal());
        document.getElementById('scanUploadArea').addEventListener('click', () => document.getElementById('scanImageUpload').click());
        document.getElementById('scanImageUpload').addEventListener('change', (e) => this.handleScanImageUpload(e));
        document.getElementById('scanStartBtn').addEventListener('click', () => this.startOCR());
        document.getElementById('scanConfirmBtn').addEventListener('click', () => this.confirmScanResult());
        document.getElementById('scanRetryBtn').addEventListener('click', () => this.resetScanModal());

        // 点击外部关闭扫描模态框
        bindModalClose('scanModal', () => this.closeScanModal());

        // 拖拽上传支持
        const uploadArea = document.getElementById('scanUploadArea');
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.match('image.*')) {
                document.getElementById('scanImageUpload').files = e.dataTransfer.files;
                this.handleScanImageUpload({ target: { files: [file] } });
            }
        });

        // 批量操作模式
        document.getElementById('batchModeBtn').addEventListener('click', () => this.toggleBatchMode());
        document.getElementById('batchCancelBtn').addEventListener('click', () => this.toggleBatchMode());
        document.getElementById('batchSelectAll').addEventListener('click', () => this.batchSelectAll());
        document.getElementById('batchDeleteBtn').addEventListener('click', () => this.batchDelete());
        document.getElementById('batchExportBtn').addEventListener('click', () => this.openExportModal());
        document.getElementById('batchApplyBtn').addEventListener('click', () => this.batchApply());
        document.getElementById('batchStockOp').addEventListener('change', (e) => {
            document.getElementById('batchStockVal').disabled = !e.target.value;
        });

        // 导出模态框
        document.getElementById('closeExportModalBtn').addEventListener('click', () => this.closeExportModal());
        bindModalClose('exportModal', () => this.closeExportModal());
        
        document.querySelectorAll('.export-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const format = btn.getAttribute('data-format');
                this.exportCards(format);
            });
        });

        // 颜色取色器联动
        document.getElementById('color').addEventListener('input', (e) => {
            document.querySelector('#color + .color-hex-label').textContent = e.target.value;
        });
        document.getElementById('editColor').addEventListener('input', (e) => {
            document.getElementById('editColorLabel').textContent = e.target.value;
        });
        document.getElementById('scanColor').addEventListener('input', (e) => {
            document.getElementById('scanColorLabel').textContent = e.target.value;
        });

        // 库存日志
        document.getElementById('stockLogBtn').addEventListener('click', () => this.openStockLog());
        document.getElementById('stockLogCloseBtn').addEventListener('click', () => this.closeStockLog());
        document.getElementById('stockLogClearBtn').addEventListener('click', () => {
            if (confirm('确定要清空所有库存日志吗？此操作不可撤销。')) {
                this.stockLogManager.clearAll();
                this.renderStockLog();
            }
        });
        document.getElementById('stockLogFilter').addEventListener('change', () => this.renderStockLog());
        document.getElementById('stockLogSearch').addEventListener('input', () => this.renderStockLog());

        // 点击外部关闭日志模态框
        bindModalClose('stockLogModal', () => this.closeStockLog());

        // 统计面板
        document.getElementById('statsBtn').addEventListener('click', () => this.showStats());
        document.getElementById('closeStatsModalBtn').addEventListener('click', () => {
            document.getElementById('statsModal').style.display = 'none';
        });
        bindModalClose('statsModal', () => {
            document.getElementById('statsModal').style.display = 'none';
        });

        // 库存预警设置
        document.getElementById('stockSettingsBtn').addEventListener('click', () => this.openStockSettings());
        document.getElementById('closeStockSettingsBtn').addEventListener('click', () => this.closeStockSettings());
        document.getElementById('saveStockSettingsBtn').addEventListener('click', () => this.saveStockSettings());
        
        // 阈值滑块实时更新显示值
        const thresholdSlider = document.getElementById('stockThresholdSlider');
        const thresholdValue = document.getElementById('stockThresholdValue');
        thresholdSlider.addEventListener('input', (e) => {
            thresholdValue.textContent = e.target.value;
        });
        
        bindModalClose('stockSettingsModal', () => this.closeStockSettings());

        // 刷新按钮
        document.getElementById('refreshBtn').addEventListener('click', () => {
            const btn = document.getElementById('refreshBtn');
            btn.disabled = true;
            btn.querySelector('svg').style.animation = 'spin 1s linear infinite';
            
            this.loadFromCloud().finally(() => {
                btn.disabled = false;
                btn.querySelector('svg').style.animation = '';
            });
        });
    }

    setupDelegatedEvents() {
        // 用事件委托处理卡片按钮点击，避免每次 renderCards 都重新绑定
        this.cardsContainer.addEventListener('click', (e) => {
            // 查看按钮
            const viewBtn = e.target.closest('.card-action-btn.view');
            if (viewBtn) {
                if (this.batchMode) { e.preventDefault(); return; }
                const cardId = parseInt(viewBtn.getAttribute('data-id'));
                this.showDetail(cardId);
                return;
            }
            // 编辑按钮
            const editBtn = e.target.closest('.card-action-btn.edit');
            if (editBtn) {
                if (this.batchMode) { e.preventDefault(); return; }
                const cardId = parseInt(editBtn.getAttribute('data-id'));
                this.showEdit(cardId);
                return;
            }
            // 批量复选框
            const checkDiv = e.target.closest('.card-check');
            if (checkDiv && this.batchMode) {
                e.stopPropagation();
                const cardId = parseInt(checkDiv.getAttribute('data-id'));
                this.toggleCardSelect(cardId);
                return;
            }
        });
    }

    async handleImageUpload(e, previewId) {
        const file = e.target.files[0];
        const preview = document.getElementById(previewId);
        
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                // 压缩图片到 800px
                const compressed = await this.compressImage(event.target.result, CARD_IMAGE_MAX_SIZE, CARD_IMAGE_QUALITY);
                preview.innerHTML = `<img src="${compressed}" alt="预览">`;
                // 将压缩后的图片存储到 input 的 dataset 中，供后续保存使用
                e.target.dataset.compressedImage = compressed;
            };
            reader.readAsDataURL(file);
        } else {
            preview.innerHTML = '';
            delete e.target.dataset.compressedImage;
        }
    }

    showAdmin() {
        this.renderAdminList('material');
        this.renderAdminList('manufacturer');
        this.modalManager.open('admin');
    }

    renderAdminList(type) {
        const listId = type === 'material' ? 'materialsList' : 'manufacturersList';
        const list = document.getElementById(listId);
        const items = type === 'material' ? this.materialManager.materials : this.materialManager.manufacturers;
        
        if (items.length === 0) {
            list.innerHTML = '<div class="admin-empty">暂无数据，请在上方添加</div>';
            return;
        }

        list.innerHTML = items.map((item, index) => `
            <div class="admin-list-item">
                <span>${item}</span>
                <button class="admin-delete-btn" data-type="${type}" data-index="${index}">×</button>
            </div>
        `).join('');

        list.querySelectorAll('.admin-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const btnType = btn.getAttribute('data-type');
                const btnIndex = parseInt(btn.getAttribute('data-index'));
                this.deleteAdminItem(btnType, btnIndex);
            });
        });
    }

    handleAddAdminItem(inputId, type) {
        const input = document.getElementById(inputId);
        const value = input.value.trim();
        if (!value) return;

        let success = false;
        if (type === 'material') {
            success = this.materialManager.addMaterial(value);
        } else {
            success = this.materialManager.addManufacturer(value);
        }

        if (success) {
            input.value = '';
            this.renderAdminList(type);
        } else {
            alert('请输入有效的名称，或该名称已存在');
        }
    }

    deleteAdminItem(type, index) {
        if (!confirm('确定要删除吗？')) return;

        if (type === 'material') {
            const name = this.materialManager.materials[index];
            this.materialManager.materials.splice(index, 1);
            Storage.saveMaterials(this.materialManager.materials);
            CloudStorage.deleteMaterial(name);
        } else {
            const name = this.materialManager.manufacturers[index];
            this.materialManager.manufacturers.splice(index, 1);
            Storage.saveManufacturers(this.materialManager.manufacturers);
            CloudStorage.deleteManufacturer(name);
        }

        this.materialManager.updateSelects();
        this.renderAdminList(type);
    }

    checkLowStock() {
        const warning = document.getElementById('lowStockWarning');
        const text = document.getElementById('lowStockText');
        if (!warning || !text) return;

        // 从 localStorage 读取自定义阈值，默认 1
        let threshold = 1;
        try {
            const saved = localStorage.getItem('stock_warning_threshold');
            if (saved) threshold = parseInt(saved, 10) || 1;
        } catch (e) {}

        // 检查低库存色卡
        const lowCards = this.cards.filter(c => {
            const qty = c.quantity;
            if (qty === undefined || qty === null) return false;
            return qty <= threshold;
        });

        if (lowCards.length === 0) {
            warning.classList.remove('show');
            this.lowStockDismissed = false;
            return;
        }

        // 如果用户已手动关闭，不再自动弹出（除非库存状态发生变化）
        if (this.lowStockDismissed) return;

        // 分析库存趋势（对比上次检查）
        const lastCheck = this.getLastStockCheck();
        const trends = this.analyzeStockTrends(lowCards, lastCheck);

        const names = lowCards.map(c => {
            const name = c.chineseName || '未命名';
            const qty = c.quantity || 0;
            const trend = trends[c.id] || '';
            const trendIcon = trend === 'down' ? '↓' : trend === 'up' ? '↑' : '→';
            return `「${name}」库存 ${qty} 件 ${trendIcon}`;
        }).join('；');

        text.innerHTML = `<strong>⚠ 库存预警（≤${threshold}）：</strong>${names}`;
        warning.classList.add('show');

        // 保存当前状态供下次对比
        this.saveCurrentStockState();

        // 发送通知（如果启用）
        if (this.isNotificationEnabled()) {
            this.sendStockNotification(lowCards, threshold);
        }
    }

    getLastStockCheck() {
        try {
            const saved = localStorage.getItem('last_stock_check_state');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            return {};
        }
    }

    saveCurrentStockState() {
        const state = {};
        this.cards.forEach(card => {
            state[card.id] = card.quantity || 0;
        });
        localStorage.setItem('last_stock_check_state', JSON.stringify(state));
    }

    analyzeStockTrends(lowCards, lastState) {
        const trends = {};
        lowCards.forEach(card => {
            const currentQty = card.quantity || 0;
            const lastQty = lastState[card.id];
            
            if (lastQty === undefined) {
                trends[card.id] = ''; // 首次检查，无趋势
            } else if (currentQty < lastQty) {
                trends[card.id] = 'down'; // 库存下降
            } else if (currentQty > lastQty) {
                trends[card.id] = 'up'; // 库存上升
            } else {
                trends[card.id] = 'stable'; // 库存稳定
            }
        });
        return trends;
    }

    isNotificationEnabled() {
        try {
            const saved = localStorage.getItem('stock_notification_enabled');
            return saved === 'true';
        } catch (e) {
            return false;
        }
    }

    sendStockNotification(lowCards, threshold) {
        if (!('Notification' in window)) return;
        
        if (Notification.permission === 'granted') {
            new Notification('库存预警', {
                body: `${lowCards.length} 个色卡库存低于 ${threshold}，请及时补充`,
                icon: '/icon-192.png',
                tag: 'stock-warning'
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.sendStockNotification(lowCards, threshold);
                }
            });
        }
    }

    // ===== 批量操作功能 =====
    toggleBatchMode() {
        this.batchMode = !this.batchMode;
        const toolbar = document.getElementById('batchToolbar');
        const btn = document.getElementById('batchModeBtn');

        if (this.batchMode) {
            this.selectedCards.clear();
            toolbar.classList.add('show');
            btn.classList.add('active');
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><span>批量中...</span>`;
            this.updateBatchSelects();
        } else {
            this.selectedCards.clear();
            toolbar.classList.remove('show');
            btn.classList.remove('active');
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><span>批量操作</span>`;
        }
        this.applyFilters();
    }

    updateBatchSelects() {
        const mfSelect = document.getElementById('batchManufacturer');
        const mtSelect = document.getElementById('batchMaterial');
        const manufacturers = this.materialManager.manufacturers || [];
        const materials = this.materialManager.materials || [];

        mfSelect.innerHTML = '<option value="">不修改</option>' + manufacturers.map(m => `<option value="${m}">${m}</option>`).join('');
        mtSelect.innerHTML = '<option value="">不修改</option>' + materials.map(m => `<option value="${m}">${m}</option>`).join('');
    }

    batchSelectAll() {
        const currentCards = this.getFilteredCards();
        const btn = document.getElementById('batchSelectAll');
        if (this.selectedCards.size === currentCards.length) {
            this.selectedCards.clear();
            btn.textContent = '全选';
            btn.classList.remove('active');
        } else {
            currentCards.forEach(c => this.selectedCards.add(c.id));
            btn.textContent = '取消全选';
            btn.classList.add('active');
        }
        this.updateBatchCount();
        this.applyFilters();
    }

    toggleCardSelect(cardId) {
        if (this.selectedCards.has(cardId)) {
            this.selectedCards.delete(cardId);
        } else {
            this.selectedCards.add(cardId);
        }
        this.updateBatchCount();
        this.updateSelectAllBtn();
        // 增量更新单个复选框样式，避免全量重渲染
        const checkEl = document.querySelector(`.card-check[data-id="${cardId}"]`);
        if (checkEl) {
            const checkbox = checkEl.querySelector('.card-checkbox');
            if (checkbox) checkbox.classList.toggle('checked', this.selectedCards.has(cardId));
        }
        // 更新卡片 selected 状态
        const cardEl = document.querySelector(`.card[data-id="${cardId}"]`);
        if (cardEl) cardEl.classList.toggle('selected', this.selectedCards.has(cardId));
    }

    updateBatchCount() {
        document.getElementById('batchCount').textContent = `已选 ${this.selectedCards.size} 张`;
    }

    updateSelectAllBtn() {
        const btn = document.getElementById('batchSelectAll');
        const currentCards = this.getFilteredCards();
        if (this.selectedCards.size === currentCards.length && currentCards.length > 0) {
            btn.textContent = '取消全选';
            btn.classList.add('active');
        } else {
            btn.textContent = '全选';
            btn.classList.remove('active');
        }
    }

    getFilteredCards() {
        let cards = this.cards;
        if (this.currentCategory !== 'all') {
            cards = cards.filter(c => c.category === this.currentCategory);
        }
        if (this.currentSearch) {
            const kw = this.currentSearch.toLowerCase().trim();
            cards = cards.filter(c => {
                // 原始字段匹配
                const matchOriginal = (c.chineseName || '').toLowerCase().includes(kw)
                    || (c.englishName || '').toLowerCase().includes(kw)
                    || (c.manufacturer || '').toLowerCase().includes(kw)
                    || (c.material || '').toLowerCase().includes(kw)
                    || (c.notes || '').toLowerCase().includes(kw);
                
                if (matchOriginal) return true;
                
                // 拼音首字母匹配（中文名）
                if (c.chineseName) {
                    const pinyinInitials = this._getPinyinInitials(c.chineseName);
                    if (pinyinInitials.toLowerCase().includes(kw)) return true;
                }
                
                // 模糊匹配（编辑距离 <= 2）
                const fuzzyMatch = (field, threshold = 2) => {
                    if (!field || field.length < 2) return false;
                    return this._levenshteinDistance(field.toLowerCase(), kw) <= threshold;
                };
                
                if (fuzzyMatch(c.chineseName) || fuzzyMatch(c.englishName) || fuzzyMatch(c.manufacturer)) {
                    return true;
                }
                
                return false;
            });
        }
        return cards;
    }

    // 获取中文拼音首字母
    _getPinyinInitials(chinese) {
        const pinyinMap = {
            '赤': 'C', '橙': 'C', '黄': 'H', '绿': 'L', '青': 'Q', '蓝': 'L', '紫': 'Z',
            '黑': 'H', '白': 'B', '灰': 'H', '粉': 'F', '棕': 'Z', '红': 'H'
        };
        
        let initials = '';
        for (const char of chinese) {
            // 如果是中文字符，尝试转换
            if (/[\u4e00-\u9fa5]/.test(char)) {
                initials += pinyinMap[char] || char;
            } else {
                initials += char;
            }
        }
        return initials;
    }

    // 计算 Levenshtein 编辑距离
    _levenshteinDistance(str1, str2) {
        const m = str1.length;
        const n = str2.length;
        const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
        
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = Math.min(
                        dp[i - 1][j] + 1,      // 删除
                        dp[i][j - 1] + 1,      // 插入
                        dp[i - 1][j - 1] + 1   // 替换
                    );
                }
            }
        }
        return dp[m][n];
    }

    async batchDelete() {
        if (this.selectedCards.size === 0) return;
        const count = this.selectedCards.size;
        if (!confirm(`确定要删除选中的 ${count} 张色卡吗？此操作不可撤销。`)) return;

        const deletedCards = this.cards.filter(c => this.selectedCards.has(c.id));
        this.cards = this.cards.filter(c => !this.selectedCards.has(c.id));
        Storage.saveCards(this.cards);
        localStorage.setItem(LOCAL_DELETE_KEY, Date.now().toString());
        if (CloudStorage.isAvailable()) {
            await CloudStorage.saveCards(this.cards);
        }
        this.selectedCards.clear();
        this.applyFilters();

        // Undo support
        this.undoManager.push({
            type: 'delete',
            data: { cards: deletedCards },
            description: `已批量删除 ${count} 张色卡`
        });
        this.undoManager.showUndoToast(`已批量删除 ${count} 张色卡`);
    }

    batchApply() {
        if (this.selectedCards.size === 0) {
            alert('请先选择色卡');
            return;
        }

        const manufacturer = document.getElementById('batchManufacturer').value;
        const material = document.getElementById('batchMaterial').value;
        const stockOp = document.getElementById('batchStockOp').value;
        const stockVal = parseInt(document.getElementById('batchStockVal').value);

        let changes = [];
        if (manufacturer) changes.push(`产商 → "${manufacturer}"`);
        if (material) changes.push(`材料 → "${material}"`);
        if (stockOp && !isNaN(stockVal)) {
            const opText = stockOp === '+' ? `库存 +${stockVal}` : stockOp === '-' ? `库存 -${stockVal}` : `库存 = ${stockVal}`;
            changes.push(opText);
        }

        if (changes.length === 0) {
            alert('请至少选择一项修改');
            return;
        }

        if (!confirm(`将对选中的 ${this.selectedCards.size} 张色卡执行以下修改：\n${changes.join('\n')}\n\n确认执行？`)) return;

        this.cards.forEach(card => {
            if (!this.selectedCards.has(card.id)) return;
            const oldQuantity = card.quantity || 0;
            if (manufacturer) card.manufacturer = manufacturer;
            if (material) card.material = material;
            if (stockOp && !isNaN(stockVal)) {
                if (stockOp === '+') card.quantity = oldQuantity + stockVal;
                else if (stockOp === '-') card.quantity = Math.max(0, oldQuantity - stockVal);
                else card.quantity = stockVal;
            }
            // 记录库存变动
            const newQuantity = card.quantity || 0;
            if (oldQuantity !== newQuantity) {
                this.stockLogManager.add(card.id, card.chineseName, oldQuantity, newQuantity, 'batch');
            }
        });

        Storage.saveCards(this.cards);
        if (CloudStorage.isAvailable()) {
            CloudStorage.saveCards(this.cards);
        }
        this.selectedCards.clear();
        this.applyFilters();
    }

    // ===== 批量导出功能 =====
    openExportModal() {
        if (this.selectedCards.size === 0) {
            alert('请先选择要导出的色卡');
            return;
        }
        document.getElementById('exportModal').style.display = 'block';
    }

    closeExportModal() {
        document.getElementById('exportModal').style.display = 'none';
    }

    async exportCards(format) {
        const selectedCards = this.cards.filter(c => this.selectedCards.has(c.id));
        if (selectedCards.length === 0) {
            alert('没有选中的色卡');
            return;
        }

        try {
            switch (format) {
                case 'csv':
                    this.exportCSV(selectedCards);
                    break;
                case 'excel':
                    await this.exportExcel(selectedCards);
                    break;
                case 'pdf':
                    await this.exportPDF(selectedCards);
                    break;
                case 'qr':
                    await this.exportQR(selectedCards);
                    break;
                default:
                    alert('不支持的导出格式');
            }
            this.closeExportModal();
        } catch (error) {
            error('导出失败:', error);
            alert('导出失败: ' + error.message);
        }
    }

    exportCSV(cards) {
        const headers = ['中文名', '英文名', '产商', '材料', '变体', '分类', '库存', '颜色', '备注'];
        const rows = cards.map(card => [
            card.chineseName || '',
            card.englishName || '',
            card.manufacturer || '',
            card.material || '',
            card.variant || '',
            categoryNames[card.category] || card.category || '',
            card.quantity || 0,
            card.color || '',
            card.notes || ''
        ]);

        // BOM for Excel UTF-8 support
        let csvContent = '\uFEFF';
        csvContent += headers.join(',') + '\n';
        rows.forEach(row => {
            csvContent += row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        this.downloadFile(blob, `色卡导出_${new Date().toISOString().slice(0, MAX_SEARCH_HISTORY)}.csv`);
    }

    async exportExcel(cards) {
        // Load SheetJS from CDN
        if (!window.XLSX) {
            await this.loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
        }

        const data = cards.map(card => ({
            '中文名': card.chineseName || '',
            '英文名': card.englishName || '',
            '产商': card.manufacturer || '',
            '材料': card.material || '',
            '变体': card.variant || '',
            '分类': categoryNames[card.category] || card.category || '',
            '库存': card.quantity || 0,
            '颜色': card.color || '',
            '备注': card.notes || ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '色卡');
        XLSX.writeFile(wb, `色卡导出_${new Date().toISOString().slice(0, MAX_SEARCH_HISTORY)}.xlsx`);
    }

    async exportPDF(cards) {
        // Load jsPDF from CDN
        if (!window.jspdf) {
            await this.loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
        }
        if (!window.jspdf.autoTable) {
            await this.loadScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js');
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Add Chinese font support (using built-in font fallback)
        doc.setFontSize(16);
        doc.text('Color Cards Export', 14, 20);

        const tableData = cards.map(card => [
            card.chineseName || '',
            card.englishName || '',
            card.manufacturer || '',
            card.material || '',
            card.quantity || 0
        ]);

        doc.autoTable({
            head: [['中文名', '英文名', '产商', '材料', '库存']],
            body: tableData,
            startY: 30,
            styles: { fontSize: 10 },
            headStyles: { fillColor: [99, 102, 241] }
        });

        doc.save(`色卡导出_${new Date().toISOString().slice(0, MAX_SEARCH_HISTORY)}.pdf`);
    }

    async exportQR(cards) {
        // Load QRCode.js from CDN
        if (!window.QRCode) {
            await this.loadScript('https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js');
        }

        // Create a canvas to combine all QR codes
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const qrSize = 200;
        const padding = 20;
        const cols = 3;
        const rows = Math.ceil(cards.length / cols);
        
        canvas.width = cols * (qrSize + padding) + padding;
        canvas.height = rows * (qrSize + padding * 3) + 40; // Extra space for text

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Generate QR code for each card
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = col * (qrSize + padding) + padding;
            const y = row * (qrSize + padding * 3) + 40;

            // Create temporary div for QR code
            const tempDiv = document.createElement('div');
            const qrData = JSON.stringify({
                name: card.chineseName,
                englishName: card.englishName,
                manufacturer: card.manufacturer,
                material: card.material
            });
            
            new QRCode(tempDiv, {
                text: qrData,
                width: qrSize,
                height: qrSize,
                colorDark: '#000000',
                colorLight: '#ffffff'
            });

            // Wait for QR code to render
            await new Promise(resolve => setTimeout(resolve, 100));

            // Draw QR code image to canvas
            const qrImg = tempDiv.querySelector('img');
            if (qrImg) {
                ctx.drawImage(qrImg, x, y, qrSize, qrSize);
            }

            // Draw card name below QR code
            ctx.fillStyle = '#000000';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(card.chineseName, x + qrSize / 2, y + qrSize + 20);
        }

        // Download as PNG
        canvas.toBlob(blob => {
            this.downloadFile(blob, `色卡二维码_${new Date().toISOString().slice(0, MAX_SEARCH_HISTORY)}.png`);
        });
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ===== 库存日志功能 =====
    openStockLog() {
        document.getElementById('stockLogModal').style.display = 'block';
        this.renderStockLog();
    }

    closeStockLog() {
        document.getElementById('stockLogModal').style.display = 'none';
    }

    renderStockLog() {
        const container = document.getElementById('stockLogList');
        const filter = document.getElementById('stockLogFilter').value;
        const search = document.getElementById('stockLogSearch').value;
        const logs = this.stockLogManager.getFiltered(filter, search);

        if (logs.length === 0) {
            container.innerHTML = `<div class="log-empty">暂无库存变动记录</div>`;
            return;
        }

        const typeLabels = { manual: '手动编辑', scan: '扫描识别', batch: '批量操作', add: '新增色卡' };
        const typeColors = { manual: '#8b5cf6', scan: '#06b6d4', batch: '#f59e0b', add: '#10b981' };

        container.innerHTML = logs.map(log => {
            const time = new Date(log.timestamp);
            const timeStr = `${time.getFullYear()}-${String(time.getMonth()+1).padStart(2,'0')}-${String(time.getDate()).padStart(2,'0')} ${String(time.getHours()).padStart(2,'0')}:${String(time.getMinutes()).padStart(2,'0')}`;
            const changeClass = log.change > 0 ? 'log-increase' : 'log-decrease';
            const changeSymbol = log.change > 0 ? '+' : '';
            const changeText = `${changeSymbol}${log.change}`;

            return `<div class="log-item">
                <div class="log-left">
                    <span class="log-type-badge" style="background:${typeColors[log.type]}20;color:${typeColors[log.type]}">${typeLabels[log.type] || log.type}</span>
                    <span class="log-name">${log.cardName}</span>
                </div>
                <div class="log-right">
                    <span class="${changeClass}">${changeText}</span>
                    <span class="log-quantity">${log.before} → ${log.after}</span>
                    <span class="log-time">${timeStr}</span>
                </div>
            </div>`;
        }).join('');
    }

    // ===== 库存预警设置 =====
    openStockSettings() {
        // 从 localStorage 加载当前设置
        let threshold = 1;
        let notificationEnabled = false;
        
        try {
            const savedThreshold = localStorage.getItem('stock_warning_threshold');
            if (savedThreshold) threshold = parseInt(savedThreshold, 10) || 1;
            
            const savedNotification = localStorage.getItem('stock_notification_enabled');
            if (savedNotification) notificationEnabled = savedNotification === 'true';
        } catch (e) {}
        
        // 更新 UI
        document.getElementById('stockThresholdSlider').value = threshold;
        document.getElementById('stockThresholdValue').textContent = threshold;
        document.getElementById('stockNotificationToggle').checked = notificationEnabled;
        
        document.getElementById('stockSettingsModal').style.display = 'block';
    }

    closeStockSettings() {
        document.getElementById('stockSettingsModal').style.display = 'none';
    }

    saveStockSettings() {
        const threshold = parseInt(document.getElementById('stockThresholdSlider').value, 10);
        const notificationEnabled = document.getElementById('stockNotificationToggle').checked;
        
        // 保存到 localStorage
        localStorage.setItem('stock_warning_threshold', threshold.toString());
        localStorage.setItem('stock_notification_enabled', notificationEnabled.toString());
        
        // 如果启用了通知，请求权限
        if (notificationEnabled && 'Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
        
        this.closeStockSettings();
        
        // 立即重新检查库存以应用新阈值
        this.checkLowStock();
        
        alert('设置已保存');
    }

    // ===== 扫描识别功能 =====
    openScanModal() {
        this.resetScanModal();
        document.getElementById('scanModal').style.display = 'block';
    }

    closeScanModal() {
        document.getElementById('scanModal').style.display = 'none';
        this.resetScanModal();
    }

    resetScanModal() {
        // 重置所有状态
        document.getElementById('scanUploadContent').style.display = 'block';
        document.getElementById('scanPreviewImg').style.display = 'none';
        document.getElementById('scanProgress').style.display = 'none';
        document.getElementById('scanResult').style.display = 'none';
        document.getElementById('scanInitialActions').style.display = 'block';
        document.getElementById('scanStartBtn').disabled = true;
        document.getElementById('scanImageUpload').value = '';
        this.scanImageData = null; // 存储图片数据
        this.scanOCRResult = null; // 存储 OCR 结果
    }

    handleScanImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        // 验证文件类型
        if (!file.type.match('image.*')) {
            alert('请选择图片文件！');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const imgData = event.target.result;
            // 压缩图片后再存储
            this.compressImage(imgData, 1200, 0.8).then(compressed => {
                this.scanImageData = compressed;

                // 显示预览
                const previewImg = document.getElementById('scanPreviewImg');
                previewImg.src = compressed;
                previewImg.style.display = 'block';
                document.getElementById('scanUploadContent').style.display = 'none';

                // 启用识别按钮
                document.getElementById('scanStartBtn').disabled = false;
            });
        };
        reader.readAsDataURL(file);
    }

    // 压缩图片：最大边长 maxSize，JPEG 质量 quality
    compressImage(dataUrl, maxSize = 1200, quality = 0.8) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > height && width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                } else if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = dataUrl;
        });
    }

    async startOCR() {
        if (!this.scanImageData) {
            alert('请先上传图片！');
            return;
        }

        // 显示进度条
        document.getElementById('scanProgress').style.display = 'block';
        document.getElementById('scanInitialActions').style.display = 'none';
        document.getElementById('scanProgressText').textContent = '正在识别文字...';
        document.getElementById('scanProgressFill').style.width = '10%';

        try {
            // 使用 OCR.Space 识别
            document.getElementById('scanProgressText').textContent = '正在识别文字（OCR.Space）...';
            document.getElementById('scanProgressFill').style.width = '30%';
            
            const ocrResult = await OCRSpace.recognize(this.scanImageData);
            const ocrText = ocrResult.text;
            const confidence = ocrResult.confidence;
            log('[OCRSpace] 识别结果：', { confidence, text: ocrText });
            document.getElementById('scanProgressFill').style.width = '85%';
            document.getElementById('scanProgressText').textContent = '识别完成！AI 解析中...';
            this.scanOCRResult = ocrText;
            this.scanOCRConfidence = confidence;
            await this.showScanResult(this.scanOCRResult);

        } catch (error) {
            error('OCR 识别失败：', error);
            alert('OCR 识别失败，请重试！');
            document.getElementById('scanProgress').style.display = 'none';
            document.getElementById('scanInitialActions').style.display = 'block';
        }
    }

    async callGoogleVision(imageDataUrl) {
        // Google Vision API key（需要替换为你的 key）
        const apiKey = 'AIzaSyCSpEOjy2_uV2KEYKjJSmjRR-d1MptRGms';
        
        // 从 data URL 提取 base64
        const base64Image = imageDataUrl.split(',')[1];
        
        const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requests: [{
                    image: {
                        content: base64Image
                    },
                    features: [{
                        type: 'TEXT_DETECTION',
                        maxResults: 1
                    }]
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`Google Vision API 失败: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.responses && data.responses[0] && data.responses[0].fullTextAnnotation) {
            return {
                text: data.responses[0].fullTextAnnotation.text,
                confidence: null // Google Vision 不返回整体置信度
            };
        }
        
        throw new Error('Google Vision 未返回文本');
    }

    async showScanResult(rawText) {
        // 隐藏进度条
        document.getElementById('scanProgress').style.display = 'none';
        
        // 显示识别结果区域
        document.getElementById('scanResult').style.display = 'block';
        
        // 显示原始识别文字
        document.getElementById('scanRawText').textContent = rawText;

        // 显示 AI 解析进度
        const parsingProgressEl = document.getElementById('scanParsingProgress');
        const parsingContentEl = document.getElementById('scanParsingContent');
        if (parsingProgressEl) {
            parsingProgressEl.style.display = 'block';
            if (parsingContentEl) parsingContentEl.textContent = '';
        }

        // 用 LLM 解析 OCR 文字（API 不支持图片，只发文字）
        let parsedInfo = await LLMParser.parse(rawText, (partialContent) => {
            // 实时更新进度提示
            if (parsingContentEl && partialContent.length > 10) {
                parsingContentEl.textContent = partialContent;
            }
        });

        // 隐藏解析进度
        if (parsingProgressEl) parsingProgressEl.style.display = 'none';

        if (!parsedInfo) {
            parsedInfo = this.parseOCRText(rawText);
        }

        // ===== 后处理：用关键词扫描修复 LLM 结果中的缺失/错误 =====
        parsedInfo = this._postProcessScanResult(parsedInfo, rawText);
        
        // 检查是否需要新建颜色分类
        if (parsedInfo.category && parsedInfo.englishName) {
            const validCats = LLMParser._validCategories || ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'black', 'white', 'gray', 'pink', 'brown'];
            if (!validCats.includes(parsedInfo.category)) {
                // 新颜色，自动创建分类
                const colorHex = parsedInfo.color || this._guessColorHex(parsedInfo.englishName);
                addNewCategory(parsedInfo.category, parsedInfo.chineseName || parsedInfo.englishName, colorHex);
                // 添加到 valid 数组
                validCats.push(parsedInfo.category);
            }
        }
        
        // 填充到表单（安全访问）
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        setVal('scanChineseName', parsedInfo.chineseName);
        setVal('scanEnglishName', parsedInfo.englishName);
        setVal('scanManufacturer', parsedInfo.manufacturer);
        setVal('scanMaterial', parsedInfo.material);
        setVal('scanVariant', parsedInfo.variant);
        if (parsedInfo.category) {
            const catEl = document.getElementById('scanCategory');
            if (catEl) catEl.value = parsedInfo.category;
        }

        // 尝试匹配现有色卡
        this.matchCard(parsedInfo);
    }

    // ---- 关键词库 ----
    _materialKeywords = ['PLA M', 'PLA', 'PETG', 'ABS', 'TPU', 'Nylon', 'PC', 'PVA', 'HIPS', 'ASA', 'PP', 'PE', 'PET', 'PLA+', 'PETG+', 'TPE', 'PC-ABS'];
    _manufacturerKeywords = ['Jucoole', 'kexcelled', 'eSUN', 'HATCHBOX', 'Overture', 'SUNLU', 'Inland', 'Polymaker', 'Prusament', 'Bambu', 'Creality', 'Anycubic', 'Elegoo'];
    _colorMap = {
        'red': 'red', '红色': 'red', '赤色': 'red', '大红': 'red', '中国红': 'red',
        'orange': 'orange', '橙色': 'orange', '橘色': 'orange',
        'yellow': 'yellow', '黄色': 'yellow', '金色': 'yellow', 'gold': 'yellow',
        'green': 'green', '绿色': 'green', '草绿': 'green', '深绿': 'green', '浅绿': 'green',
        'milk green': 'green', '奶绿': 'green',
        'cyan': 'cyan', '青色': 'cyan', '湖蓝': 'cyan', '天蓝': 'cyan', 'sky blue': 'cyan', 'ice blue': 'cyan', '冰蓝': 'cyan',
        'blue': 'blue', '蓝色': 'blue', '深蓝': 'blue', '宝蓝': 'blue', '藏青': 'blue', 'navy': 'blue',
        'purple': 'purple', '紫色': 'purple', '紫罗兰': 'purple', 'violet': 'purple',
        'pink': 'pink', '粉色': 'pink', '芭比粉': 'pink', 'barbie pink': 'pink', 'lollipop': 'pink', '棒棒糖': 'pink',
        'black': 'black', '黑色': 'black',
        'white': 'white', '白色': 'white',
        'gray': 'gray', '灰色': 'gray', 'grey': 'gray', '银灰': 'gray', '银色': 'gray', 'silver': 'gray',
        'brown': 'brown', '棕色': 'brown', '褐色': 'brown',
        'beige': 'yellow', '米色': 'yellow',
        'magenta': 'purple', '品红': 'purple',
        'coral': 'orange', '珊瑚': 'orange',
        'olive': 'green', '橄榄': 'green',
        'teal': 'cyan', '青绿': 'cyan',
        'maroon': 'red', '栗色': 'red', '酒红': 'red',
        'indigo': 'purple', '靛蓝': 'purple',
        'rainbow': 'rainbow', '彩虹': 'rainbow', '渐变': 'rainbow', 'gradient': 'rainbow', '多彩': 'rainbow', 'multi-color': 'rainbow', 'multicolor': 'rainbow'
    };
    _colorENtoCN = {
        'red': '红色', 'orange': '橙色', 'yellow': '黄色', 'green': '绿色',
        'milk green': '奶绿', 'cyan': '青色', 'blue': '蓝色', 'purple': '紫色',
        'black': '黑色', 'white': '白色', 'gray': '灰色',
        'pink': '粉色', 'brown': '棕色', 'gold': '金色', 'silver': '银色',
        'navy': '藏青', 'beige': '米色', 'magenta': '品红',
        'sky blue': '天蓝', 'ice blue': '冰蓝', 'barbie pink': '芭比粉',
        'lollipop': '棒棒糖', 'coral': '珊瑚', 'olive': '橄榄',
        'teal': '青绿', 'maroon': '酒红', 'indigo': '蓝', 'violet': '紫罗兰',
        'rainbow': '彩虹'
    };
    // SKU 颜色代码映射（常见缩写）
    _skuColorMap = {
        // 基础色
        'RD': { name: 'Red', category: 'red' },
        'RED': { name: 'Red', category: 'red' },
        'BL': { name: 'Blue', category: 'blue' },
        'BLUE': { name: 'Blue', category: 'blue' },
        'GN': { name: 'Green', category: 'green' },
        'GREEN': { name: 'Green', category: 'green' },
        'YL': { name: 'Yellow', category: 'yellow' },
        'YEL': { name: 'Yellow', category: 'yellow' },
        'BK': { name: 'Black', category: 'black' },
        'BLK': { name: 'Black', category: 'black' },
        'WH': { name: 'White', category: 'white' },
        'WHT': { name: 'White', category: 'white' },
        'GY': { name: 'Gray', category: 'gray' },
        'GRY': { name: 'Gray', category: 'gray' },
        'OR': { name: 'Orange', category: 'orange' },
        'ORG': { name: 'Orange', category: 'orange' },
        'PP': { name: 'Purple', category: 'purple' },
        'PUR': { name: 'Purple', category: 'purple' },
        'CY': { name: 'Cyan', category: 'cyan' },
        // 常见复合色
        'MKGN': { name: 'Milk Green', category: 'green' },
        'MGRN': { name: 'Milk Green', category: 'green' },
        'SKBL': { name: 'Sky Blue', category: 'blue' },
        'SBL': { name: 'Sky Blue', category: 'blue' },
        'DBLU': { name: 'Dark Blue', category: 'blue' },
        'LGRN': { name: 'Light Green', category: 'green' },
        'DGRN': { name: 'Dark Green', category: 'green' },
        'PK': { name: 'Pink', category: 'purple' },
        'PNK': { name: 'Pink', category: 'purple' },
        'BR': { name: 'Brown', category: 'orange' },
        'BRN': { name: 'Brown', category: 'orange' },
        'GD': { name: 'Gold', category: 'yellow' },
        'GLD': { name: 'Gold', category: 'yellow' },
        'SV': { name: 'Silver', category: 'gray' },
        'SLV': { name: 'Silver', category: 'gray' },
        'NV': { name: 'Navy', category: 'blue' },
        'NY': { name: 'Navy', category: 'blue' },
        'BG': { name: 'Beige', category: 'yellow' },
        'BE': { name: 'Beige', category: 'yellow' },
        'MG': { name: 'Magenta', category: 'purple' },
        'MGT': { name: 'Magenta', category: 'purple' },
        // 特殊色名缩写
        'ICE': { name: 'Ice Blue', category: 'blue' },
        'IBL': { name: 'Ice Blue', category: 'blue' },
        'BARBIE': { name: 'Barbie Pink', category: 'purple' },
        'BPINK': { name: 'Barbie Pink', category: 'purple' },
        'LOLLIPOP': { name: 'Lollipop', category: 'purple' },
        'LOLLI': { name: 'Lollipop', category: 'purple' },
        'CORAL': { name: 'Coral', category: 'orange' },
        'CRAL': { name: 'Coral', category: 'orange' },
        'OLIVE': { name: 'Olive', category: 'green' },
        'OLV': { name: 'Olive', category: 'green' },
        'TEAL': { name: 'Teal', category: 'cyan' },
        'MAROON': { name: 'Maroon', category: 'red' },
        'MRN': { name: 'Maroon', category: 'red' }
    };

    parseOCRText(text) {
        const result = {
            chineseName: '',
            englishName: '',
            manufacturer: '',
            material: '',
            variant: '',
            category: ''
        };

        if (!text || !text.trim()) return result;

        const lines = text.split('\n').map(l => l.trim()).filter(l => l && l.length > 0);
        const fullText = lines.join(' ');

        // ---- 1. Key:Value 模式解析 ----
        const kvPairs = {};
        for (const line of lines) {
            const kvMatch = line.match(/^([^:：]+)[:：]\s*(.+)$/);
            if (kvMatch) {
                const key = kvMatch[1].trim().toLowerCase();
                const val = kvMatch[2].trim();
                kvPairs[key] = val;
            }
        }

        // ---- 2. 从 Key:Value 提取字段 ----
        // 材料
        for (const [key, val] of Object.entries(kvPairs)) {
            if (/material|材质|材料/.test(key)) {
                const { material, variant } = this._splitMaterialVariant(val);
                result.material = material;
                result.variant = variant;
                break;
            }
        }
        // 颜色 — 英文名=颜色英文名，中文名=中文翻译
        for (const [key, val] of Object.entries(kvPairs)) {
            if (/color|颜色/.test(key)) {
                const cat = this._detectColor(val);
                if (cat) {
                    result.category = cat;
                    // 找到对应的英文颜色名
                    const enName = this._findColorEN(val);
                    if (enName) {
                        result.englishName = enName.charAt(0).toUpperCase() + enName.slice(1);
                        result.chineseName = this._colorENtoCN[cat] || enName;
                    } else {
                        result.englishName = val;
                        result.chineseName = this._colorENtoCN[cat] || val;
                    }
                }
                break;
            }
        }
        // 产商/品牌
        for (const [key, val] of Object.entries(kvPairs)) {
            if (/brand|manufacturer|产商|品牌|厂家/.test(key)) {
                result.manufacturer = this._detectManufacturer(val) || val;
                break;
            }
        }

        // ---- 3. 全文关键词扫描（补充未识别字段）----
        if (!result.material) {
            const { material, variant } = this._splitMaterialVariant(fullText);
            result.material = material;
            if (!result.variant) result.variant = variant;
        }
        if (!result.manufacturer) {
            result.manufacturer = this._detectManufacturer(fullText) || '';
        }
        if (!result.category) {
            result.category = this._detectColor(fullText) || '';
        }
        // 如果名字还是空的但检测到了颜色，用颜色名填充
        if ((!result.chineseName || !result.englishName) && result.category) {
            if (!result.englishName) {
                result.englishName = result.category.charAt(0).toUpperCase() + result.category.slice(1);
            }
            if (!result.chineseName) {
                result.chineseName = this._colorENtoCN[result.category] || result.englishName;
            }
        }

        // ---- 4. 从非 KV 行中提取名称 ----
        const skipPatterns = [
            /^[\d\s\-_.]+$/,           // 纯数字/条码
            /温度|temp|°C|℉/i,          // 温度信息
            /直径|diameter|Φ|mm/i,      // 直径信息
            /净重|weight|kg|g\b/i,      // 重量信息
            /bed|热床/i,                // 热床温度
            /print|打印|速度|speed/i,   // 打印参数
            /batch|批号|lot/i,          // 批号
            /[:：]/                      // 已处理的 KV 行
        ];

        const nameLines = lines.filter(line => {
            if (skipPatterns.some(p => p.test(line))) return false;
            if (/^([^:：]+)[:：]/.test(line)) return false; // KV 行
            return true;
        });

        for (const line of nameLines) {
            // 跳过厂商名
            if (this._manufacturerKeywords.some(b => line.toLowerCase() === b.toLowerCase())) continue;
            // 中文名
            if (!result.chineseName && /[\u4e00-\u9fa5]/.test(line) && line.length <= 20) {
                result.chineseName = line;
                continue;
            }
            // 英文名（产品名，允许含数字和特殊符号）
            if (!result.englishName && line.length <= 30 && /[A-Za-z]/.test(line)) {
                // 清理特殊符号但保留产品名格式
                const cleaned = line.replace(/[™®]/g, '').trim();
                if (cleaned.length > 0 && !this._manufacturerKeywords.some(b => cleaned.toLowerCase() === b.toLowerCase())) {
                    result.englishName = cleaned;
                }
            }
        }

        // 从 SKU 提取颜色代码（如 MKGN = Milk Green）
        if (!result.category || !result.englishName) {
            const skuMatch = fullText.match(/SKU[:\s]*([^\s]+)/i) || fullText.match(/([A-Z]{2,}-[A-Z0-9\-]+)/);
            if (skuMatch) {
                const sku = skuMatch[1];
                const parts = sku.split('-');
                // 扫描所有分段，找颜色代码（优先倒数第二段，然后逐段检查）
                const checkOrder = [parts.length - 2, parts.length - 3, ...Array.from({length: parts.length}, (_, i) => i)];
                for (const idx of checkOrder) {
                    if (idx < 0 || idx >= parts.length) continue;
                    const colorCode = parts[idx].toUpperCase();
                    const colorFromSKU = this._skuColorMap[colorCode];
                    if (colorFromSKU) {
                        if (!result.category) result.category = colorFromSKU.category;
                        if (!result.englishName) result.englishName = colorFromSKU.name;
                        break;
                    }
                }
            }
        }

        // ---- 5. 启发式兜底 ----
        if (!result.chineseName && !result.englishName) {
            if (result.category) {
                result.englishName = result.category.charAt(0).toUpperCase() + result.category.slice(1);
                result.chineseName = this._colorENtoCN[result.category] || result.englishName;
            } else if (result.material) {
                result.chineseName = result.material;
                result.englishName = result.material;
            }
        }

        return result;
    }

    _detectMaterial(text) {
        if (!text) return null;
        const upper = text.toUpperCase();
        // 按长度降序匹配，优先 "PLA M" 而非 "PLA"
        const sorted = [...this._materialKeywords].sort((a, b) => b.length - a.length);
        for (const mat of sorted) {
            if (upper.includes(mat.toUpperCase())) return mat;
        }
        // 正则兜底：匹配 "XX料" 或含 "料" 的短语
        const matMatch = text.match(/([\u4e00-\u9fa5A-Za-z+]+料)/);
        if (matMatch) return matMatch[1];
        return null;
    }

    _detectColor(text) {
        if (!text) return '';
        const lower = text.toLowerCase();
        // 按关键词长度降序匹配，优先匹配 "milk green" 而非 "green"
        const sorted = Object.entries(this._colorMap).sort((a, b) => b[0].length - a[0].length);
        for (const [keyword, category] of sorted) {
            if (lower.includes(keyword.toLowerCase())) return category;
        }
        // 启发式：扫描文本中像颜色的词（包含颜色基础词）
        const colorRoots = ['red', 'green', 'blue', 'yellow', 'orange', 'purple', 'black', 'white', 'gray', 'grey', 'cyan', 'pink', 'brown', 'rainbow'];
        const words = text.split(/[\s,;:()]+/).filter(w => w.length > 0);
        for (const word of words) {
            const w = word.toLowerCase().replace(/[^a-z]/g, '');
            for (const root of colorRoots) {
                if (w === root || w.includes(root)) {
                    // 找到包含颜色词的单词，尝试匹配分类
                    for (const [keyword, category] of sorted) {
                        if (w.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(w)) {
                            return category;
                        }
                    }
                    // 兜底：直接返回基础颜色
                    const rootMap = { red: 'red', green: 'green', blue: 'blue', yellow: 'yellow', orange: 'orange', purple: 'purple', black: 'black', white: 'white', gray: 'gray', grey: 'gray', cyan: 'cyan', pink: 'pink', brown: 'brown', rainbow: 'rainbow' };
                    return rootMap[root] || '';
                }
            }
        }
        // 模糊匹配：处理 OCR 错别字（如 Blxck→Black, whlte→white）
        for (const word of words) {
            const w = word.toLowerCase().replace(/[^a-z]/g, '');
            if (w.length < 3 || w.length > 10) continue;
            for (const root of colorRoots) {
                if (this._fuzzyMatch(w, root)) {
                    log('[ColorDetect] 模糊匹配:', w, '→', root);
                    const rootMap = { red: 'red', green: 'green', blue: 'blue', yellow: 'yellow', orange: 'orange', purple: 'purple', black: 'black', white: 'white', gray: 'gray', grey: 'gray', cyan: 'cyan', pink: 'pink', brown: 'brown', rainbow: 'rainbow' };
                    return rootMap[root] || '';
                }
            }
        }
        return '';
    }

    // 模糊字符串匹配（编辑距离 ≤ 1，且长度差 ≤ 1）
    _fuzzyMatch(a, b) {
        if (Math.abs(a.length - b.length) > 1) return false;
        if (a.length === b.length) {
            let diff = 0;
            for (let i = 0; i < a.length; i++) {
                if (a[i] !== b[i]) diff++;
                if (diff > 1) return false;
            }
            return diff === 1; // 恰好 1 个字符不同
        }
        // 长度差 1：检查是否只差一个插入/删除
        const shorter = a.length < b.length ? a : b;
        const longer = a.length < b.length ? b : a;
        for (let i = 0; i < shorter.length; i++) {
            if (shorter[i] !== longer[i]) {
                return shorter === longer.slice(i + 1); // 跳过 longer 的第 i 个字符后是否相等
            }
        }
        return true; // 只差最后一个字符
    }

    _detectManufacturer(text) {
        if (!text) return null;
        const lower = text.toLowerCase();
        for (const brand of this._manufacturerKeywords) {
            if (lower.includes(brand.toLowerCase())) return brand;
        }
        // 含公司/厂/集团等关键词
        const cnMatch = text.match(/([\u4e00-\u9fa5]{2,}(?:公司|集团|科技|厂|实业))/);
        if (cnMatch) return cnMatch[1];
        return null;
    }

    _findColorEN(text) {
        if (!text) return '';
        const lower = text.toLowerCase();
        // 按长度降序匹配，优先 "milk green" 而非 "green"
        const sorted = Object.keys(this._colorENtoCN).sort((a, b) => b.length - a.length);
        for (const enName of sorted) {
            if (lower === enName || lower.startsWith(enName + ' ') || lower.endsWith(' ' + enName)) {
                return enName;
            }
        }
        return '';
    }

    _splitMaterialVariant(text) {
        if (!text) return { material: '', variant: '' };
        // 尝试匹配已知材料+后缀（如 "PLA M", "PLA LITE", "PETG+"）
        const sorted = [...this._materialKeywords].sort((a, b) => b.length - a.length);
        const upper = text.toUpperCase();
        for (const mat of sorted) {
            const matUpper = mat.toUpperCase();
            if (upper === matUpper || upper.startsWith(matUpper + ' ') || upper.startsWith(matUpper + '+') || upper.startsWith(matUpper + '-')) {
                const variant = text.slice(mat.length).trim().replace(/^[+\-]/, '');
                return { material: mat, variant };
            }
        }
        // 兜底：直接用 _detectMaterial
        const detected = this._detectMaterial(text);
        if (detected) {
            const variant = text.slice(detected.length).trim().replace(/^[+\-]/, '');
            return { material: detected, variant };
        }
        return { material: text, variant: '' };
    }

    matchCard(parsedInfo) {
        // 根据中文名、英文名或颜色分类匹配现有色卡
        const matchResult = document.getElementById('scanMatchResult');
        const matchText = document.getElementById('scanMatchText');

        // 如果只有英文名且是颜色名，自动填充中文名
        if (parsedInfo.englishName && !parsedInfo.chineseName) {
            const enLower = parsedInfo.englishName.toLowerCase();
            for (const [enName, cnName] of Object.entries(this._colorENtoCN)) {
                if (enLower === enName || enLower.includes(enName)) {
                    parsedInfo.chineseName = cnName;
                    // 同步更新表单
                    const cnEl = document.getElementById('scanChineseName');
                    if (cnEl) cnEl.value = cnName;
                    break;
                }
            }
        }

        if (!parsedInfo.chineseName && !parsedInfo.englishName && !parsedInfo.category) {
            matchResult.style.display = 'none';
            return;
        }

        // 搜索匹配的色卡（支持名称包含 + 颜色分类匹配）
        const matchedCards = this.cards.filter(card => {
            const nameMatch = parsedInfo.chineseName && 
                (card.chineseName.includes(parsedInfo.chineseName) || 
                 parsedInfo.chineseName.includes(card.chineseName));
            const enNameMatch = parsedInfo.englishName && 
                (card.englishName.toLowerCase().includes(parsedInfo.englishName.toLowerCase()) || 
                 parsedInfo.englishName.toLowerCase().includes(card.englishName.toLowerCase()));
            const categoryMatch = parsedInfo.category && card.category === parsedInfo.category;
            
            return nameMatch || enNameMatch || categoryMatch;
        });

        if (matchedCards.length > 0) {
            // 找到匹配的色卡
            const card = matchedCards[0];
            matchResult.style.display = 'block';
            matchResult.className = 'scan-match-result match-found';
            matchText.innerHTML = `✅ 找到匹配的色卡：<strong>「${card.chineseName}」(${card.englishName})</strong><br>当前库存：${card.quantity || 0} 件<br>确认后将自动增加库存！`;
            
            // 存储匹配到的色卡 ID
            this.matchedCardId = card.id;
        } else {
            // 未找到匹配的色卡
            matchResult.style.display = 'block';
            matchResult.className = 'scan-match-result match-not-found';
            matchText.innerHTML = `⚠️ 未找到匹配的色卡，确认后将创建新的色卡。`;
            
            // 清除匹配 ID
            this.matchedCardId = null;
        }
    }

    // 后处理：用关键词扫描修复 LLM 结果中的缺失/错误
    _postProcessScanResult(parsedInfo, rawText) {
        if (!parsedInfo) return parsedInfo;
        const lower = rawText.toLowerCase();

        // 1. 修复英文名：如果包含明显 OCR 垃圾（太长、含管道符、含温度等），用关键词扫描
        if (parsedInfo.englishName) {
            const en = parsedInfo.englishName;
            const isGarbage = en.length > 25 || en.includes('|') || en.includes('°') || 
                            en.includes('Temp') || en.includes('Diameter') || en.includes('Code');
            if (isGarbage) {
                log('[PostProcess] 英文名含垃圾信息，重新扫描:', en);
                const colorEN = this._findColorEN(rawText);
                if (colorEN) {
                    parsedInfo.englishName = colorEN;
                    parsedInfo.chineseName = this._colorENtoCN[colorEN] || colorEN;
                }
            }
        }

        // 2. 修复颜色分类：如果为空，从原文扫描
        if (!parsedInfo.category) {
            const detectedColor = this._detectColor(rawText);
            if (detectedColor) {
                log('[PostProcess] 从原文扫描到颜色:', detectedColor);
                parsedInfo.category = detectedColor;
                // 同步修复英文名和中文名
                if (!parsedInfo.englishName) {
                    const colorEN = this._findColorEN(rawText);
                    if (colorEN) {
                        parsedInfo.englishName = colorEN;
                        parsedInfo.chineseName = this._colorENtoCN[colorEN] || colorEN;
                    } else {
                        // 用分类名作为英文名
                        parsedInfo.englishName = detectedColor.charAt(0).toUpperCase() + detectedColor.slice(1);
                        parsedInfo.chineseName = this._colorENtoCN[detectedColor] || parsedInfo.englishName;
                    }
                }
            }
        }

        // 3. 修复产商：补全 "Bambu" → "Bambu Lab"
        if (parsedInfo.manufacturer === 'Bambu' && lower.includes('lab')) {
            parsedInfo.manufacturer = 'Bambu Lab';
        }

        // 4. 修复材质：如果材质字段包含垃圾信息（如直径、温度等），清空
        if (parsedInfo.variant) {
            const isGarbage = parsedInfo.variant.includes('Diameter') || 
                            parsedInfo.variant.includes('Temp') || 
                            parsedInfo.variant.includes('mm') ||
                            parsedInfo.variant.length > 20;
            if (isGarbage) {
                log('[PostProcess] 材质字段含垃圾信息，清空:', parsedInfo.variant);
                // 尝试从原文找 Lite/Matte/Silk 等
                const variantMatch = rawText.match(/\b(Lite|Matte|Silk|Pro|Plus|\+|M|LITE)\b/i);
                parsedInfo.variant = variantMatch ? variantMatch[1] : '';
            }
        }

        // 5. 如果中文名和英文名都为空，但分类有值，补充默认名称
        if (!parsedInfo.chineseName && !parsedInfo.englishName && parsedInfo.category) {
            parsedInfo.englishName = parsedInfo.category.charAt(0).toUpperCase() + parsedInfo.category.slice(1);
            parsedInfo.chineseName = this._colorENtoCN[parsedInfo.category] || parsedInfo.englishName;
        }

        return parsedInfo;
    }

    // 合并两次 OCR 识别结果
    _mergeOCRResults(text1, text2, confidence1, confidence2) {
        // 如果某次置信度太低（<30），只用另一次的结果
        if (confidence1 < 30) return text2;
        if (confidence2 < 30) return text1;

        const lines1 = text1.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const lines2 = text2.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        // 收集所有行，去重（相似度 > 0.7 视为重复）
        const allLines = [...lines1];
        for (const line2 of lines2) {
            let isDuplicate = false;
            for (const line1 of lines1) {
                // 简单相似度：较短行在较长行中的包含关系
                const shorter = line1.length < line2.length ? line1 : line2;
                const longer = line1.length < line2.length ? line2 : line1;
                if (longer.includes(shorter) && shorter.length > 2) {
                    isDuplicate = true;
                    break;
                }
            }
            if (!isDuplicate) allLines.push(line2);
        }

        return allLines.join('\n');
    }

    // 根据颜色名猜测十六进制颜色
    _guessColorHex(name) {
        if (!name) return '#888888';
        const lower = name.toLowerCase();
        const colorMap = {
            'pink': '#ff69b4', '粉色': '#ff69b4', '芭比粉': '#ff69b4',
            'brown': '#8b4513', '棕色': '#8b4513', '褐色': '#8b4513',
            'gold': '#ffd700', '金色': '#ffd700',
            'silver': '#c0c0c0', '银色': '#c0c0c0',
            'navy': '#000080', '藏青': '#000080',
            'beige': '#f5f5dc', '米色': '#f5f5dc',
            'magenta': '#ff00ff', '品红': '#ff00ff',
            'coral': '#ff7f50', '珊瑚': '#ff7f50',
            'olive': '#808000', '橄榄': '#808000',
            'teal': '#008080', '青绿': '#008080',
            'maroon': '#800000', '栗色': '#800000',
            'indigo': '#4b0082', '蓝': '#4b0082',
            'rainbow': '#ff6b6b', '彩虹': '#ff6b6b', '渐变': '#ff6b6b', 'gradient': '#ff6b6b'
        };
        for (const [key, hex] of Object.entries(colorMap)) {
            if (lower.includes(key)) return hex;
        }
        return '#888888';
    }

    async confirmScanResult() {
        const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
        const chineseName = getVal('scanChineseName');
        const englishName = getVal('scanEnglishName');
        const manufacturer = getVal('scanManufacturer');
        const material = getVal('scanMaterial');
        const variant = getVal('scanVariant');
        const category = getVal('scanCategory');
        const scanColor = getVal('scanColor');

        if (!chineseName) {
            alert('请输入中文名！');
            return;
        }

        // 显示加载状态
        const confirmBtn = document.getElementById('scanConfirmBtn');
        const originalText = confirmBtn.textContent;
        confirmBtn.disabled = true;
        confirmBtn.textContent = '保存中...';

        try {
            if (this.matchedCardId) {
                // 更新现有色卡（增加库存）
                const card = this.cards.find(c => c.id === this.matchedCardId);
                if (card) {
                    const oldQuantity = card.quantity || 0;
                    card.quantity = oldQuantity + 1;
                    
                    // 更新其他信息（如果用户修改了）
                    card.englishName = englishName || card.englishName;
                    card.manufacturer = manufacturer || card.manufacturer;
                    card.material = material || card.material;
                    card.variant = variant || card.variant || '';
                    if (category) card.category = category;

                    Storage.saveCards(this.cards);
                    
                    // 后台同步到云端，不阻塞 UI
                    if (CloudStorage.isAvailable()) {
                        CloudStorage.updateCard(card).catch(e => warn('云端同步失败', e));
                    }
                    
                    // 自动添加新的厂商和材料到列表
                    if (manufacturer) this.materialManager.addManufacturer(manufacturer);
                    if (material) this.materialManager.addMaterial(material);
                    
                    // 记录扫描识别库存变动
                    this.stockLogManager.add(card.id, card.chineseName, oldQuantity, card.quantity, 'scan');
                    
                    alert(`✅ 已更新色卡「${card.chineseName}」的库存，当前库存：${card.quantity} 件`);
                }
            } else {
                // 创建新色卡
                const newCard = {
                    id: Date.now(),
                    chineseName,
                    englishName: englishName || '',
                    manufacturer: manufacturer || '',
                    material: material || '',
                    variant: variant || '',
                    category: category || 'gray',
                    quantity: 1,
                    config: [],
                    image: this.scanImageData || '', // 保存扫描图片
                    color: scanColor || Utils.getColorForCategory(category || 'gray'),
                    notes: '',
                    sortOrder: this.cards.length
                };

                this.cards.push(newCard);
                Storage.saveCards(this.cards);
                
                // 后台同步到云端，不阻塞 UI
                if (CloudStorage.isAvailable()) {
                    CloudStorage.addCard(newCard).catch(e => warn('云端同步失败', e));
                }

                // 自动添加新的厂商和材料到列表
                if (manufacturer) this.materialManager.addManufacturer(manufacturer);
                if (material) this.materialManager.addMaterial(material);

                // 记录扫描新增色卡
                this.stockLogManager.add(newCard.id, newCard.chineseName, 0, 1, 'scan');

                alert(`✅ 已创建新色卡「${chineseName}」`);
            }

            // 刷新显示
            this.renderCards();
            this.checkLowStock();
            
            // 关闭模态框
            this.closeScanModal();
        } catch (error) {
            error('确认扫描结果失败:', error);
            alert('保存失败，请重试');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = originalText;
        }
    }

    showLoadingSkeleton() {
        const skeletonHtml = Array(6).fill('').map(() => `
            <div class="card skeleton-card">
                <div class="card-color-preview" style="background:var(--bg-secondary);"></div>
                <div class="card-content">
                    <div class="card-title-row"><div class="skeleton-line" style="width:60%;"></div></div>
                    <div class="skeleton-line" style="width:40%;margin-top:8px;"></div>
                    <div class="card-info" style="margin-top:12px;">
                        <div class="skeleton-line" style="width:80%;"></div>
                        <div class="skeleton-line" style="width:70%;"></div>
                    </div>
                </div>
            </div>
        `).join('');
        this.cardsContainer.innerHTML = skeletonHtml;
    }

    hideLoadingSkeleton() {
        // Called before renderCards to clear skeleton
    }

    renderCards(cards = this.cards) {
        // Generate cache key to detect changes
        const cacheKey = `${cards.length}-${this.currentCategory}-${this.currentSearch}-${this.currentSort}-${this.batchMode}-${this.selectedCards.size}`;
        if (this._lastRenderedKey === cacheKey && cards.length > 0) {
            return; // Skip re-render if nothing changed
        }
        this._lastRenderedKey = cacheKey;

        this.cardsContainer.innerHTML = '';

        if (cards.length === 0) {
            this.cardsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎨</div>
                    <div class="empty-state-text">还没有色卡</div>
                    <div class="empty-state-hint">点击「+ 添加色卡」开始创建你的色卡库</div>
                </div>
            `;
            this.checkLowStock();
            return;
        }

        const fragment = document.createDocumentFragment();
        cards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            cardElement.setAttribute('data-id', card.id);
            if (this.batchMode && this.selectedCards.has(card.id)) {
                cardElement.classList.add('selected');
            }
            cardElement.setAttribute('role', 'listitem');

            // Drag-drop support (only when not in batch mode and sort is default)
            if (!this.batchMode && this.currentSort === 'default') {
                cardElement.setAttribute('draggable', 'true');
                cardElement.addEventListener('dragstart', (e) => {
                    this.draggedCardId = card.id;
                    cardElement.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                });
                cardElement.addEventListener('dragend', () => {
                    cardElement.classList.remove('dragging');
                    this.cardsContainer.querySelectorAll('.card').forEach(c => c.classList.remove('drag-over'));
                    this.draggedCardId = null;
                });
                cardElement.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (card.id !== this.draggedCardId) {
                        cardElement.classList.add('drag-over');
                    }
                });
                cardElement.addEventListener('dragleave', () => {
                    cardElement.classList.remove('drag-over');
                });
                cardElement.addEventListener('drop', (e) => {
                    e.preventDefault();
                    cardElement.classList.remove('drag-over');
                    if (!this.draggedCardId || this.draggedCardId === card.id) return;
                    this.handleCardDrop(this.draggedCardId, card.id);
                });
            }
            
            const color = card.color || Utils.getColorForCategory(card.category);
            const imageHtml = card.image 
                ? `<div class="card-image"><img src="${card.image}" alt="${card.chineseName}" loading="lazy"></div>`
                : `<div class="card-color-preview" style="background: ${color};"></div>`;

            const batchCheckHtml = this.batchMode
                ? `<div class="card-check" data-id="${card.id}"><div class="card-checkbox ${this.selectedCards.has(card.id) ? 'checked' : ''}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></div></div>`
                : '';
            
            const configText = Utils.configToText(card.config);
            const notesHtml = card.notes && card.notes.trim()
                ? `<div class="card-notes-preview">${card.notes}</div>`
                : '';
            
            cardElement.innerHTML = `
                ${batchCheckHtml}
                ${imageHtml}
                <div class="card-content">
                    <div class="card-title-row">
                        <span class="card-color-dot" style="background: ${color};" title="${color}"></span>
                        <h3 class="card-title">${card.chineseName}</h3>
                    </div>
                    <p class="card-subtitle">${card.englishName}</p>
                    <div class="card-info">
                        <div class="info-item">
                            <div class="info-label">产商</div>
                            <div class="info-value">${card.manufacturer}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">材料</div>
                            <div class="info-value">${card.material}${card.variant ? ' ' + card.variant : ''}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">库存</div>
                            <div class="info-value${(card.quantity || 0) <= 1 ? ' low-stock' : ''}">${card.quantity || 0} 件</div>
                        </div>
                    </div>
                    <div class="card-config">
                        <div class="config-title">配置信息</div>
                        <div class="config-content">${configText}</div>
                    </div>
                    ${notesHtml}
                    <div class="card-actions">
                        <button class="card-action-btn view" data-id="${card.id}" type="button">查看</button>
                        <button class="card-action-btn edit" data-id="${card.id}" type="button">编辑</button>
                    </div>
                </div>
            `;
            fragment.appendChild(cardElement);
        });
        this.cardsContainer.appendChild(fragment);

        this.checkLowStock();
    }

    showDetail(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        this.currentDetailCard = card;

        document.getElementById('detailChineseName').textContent = card.chineseName;
        document.getElementById('detailEnglishName').textContent = card.englishName;
        document.getElementById('detailManufacturer').textContent = card.manufacturer;
        document.getElementById('detailMaterial').textContent = card.material;
        
        // Variant
        const variantRow = document.getElementById('detailVariantRow');
        const variantEl = document.getElementById('detailVariant');
        if (card.variant && card.variant.trim()) {
            variantRow.style.display = 'flex';
            variantEl.textContent = card.variant;
        } else {
            variantRow.style.display = 'none';
        }
        
        document.getElementById('detailCategory').textContent = categoryNames[card.category] || card.category;
        document.getElementById('detailQuantity').textContent = (card.quantity || 0) + ' 件';

        // Notes
        const notesRow = document.getElementById('detailNotesRow');
        const notesEl = document.getElementById('detailNotes');
        if (card.notes && card.notes.trim()) {
            notesRow.style.display = 'flex';
            notesEl.textContent = card.notes;
        } else {
            notesRow.style.display = 'none';
        }

        const configText = Utils.configToText(card.config);
        document.getElementById('detailConfig').textContent = configText;

        const color = card.color || Utils.getColorForCategory(card.category);
        const preview = document.getElementById('detailColorPreview');
        if (card.image) {
            preview.innerHTML = `<img src="${card.image}" alt="${card.chineseName}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`;
        } else {
            preview.style.background = color;
            preview.innerHTML = '';
        }

        // 颜色可视化分析
        this.updateColorVisualization(color);

        this.modalManager.open('detailCard');
    }

    updateColorVisualization(color) {
        const solidColor = color.includes('gradient') ? '#ff6b6b' : color;
        
        // 大预览
        const largePreview = document.getElementById('colorPreviewLarge');
        largePreview.style.background = solidColor;
        
        // HEX 值
        document.getElementById('colorHexValue').textContent = solidColor.toUpperCase();
        
        // RGB 值
        const rgb = this.hexToRgb(solidColor);
        document.getElementById('colorRgbValue').textContent = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        
        // 对比度检查（与白色背景）
        const contrastWhite = this.getContrastRatio(solidColor, '#ffffff');
        const contrastBlack = this.getContrastRatio(solidColor, '#000000');
        const bestContrast = contrastWhite > contrastBlack ? contrastWhite : contrastBlack;
        const bgColor = contrastWhite > contrastBlack ? '#ffffff' : '#000000';
        
        document.getElementById('contrastRatio').textContent = bestContrast.toFixed(2) + ':1';
        
        // 可读性评分
        let readability = '较差';
        let readColor = '#ef4444';
        if (bestContrast >= 7) {
            readability = '优秀 (AAA)';
            readColor = '#10b981';
        } else if (bestContrast >= 4.5) {
            readability = '良好 (AA)';
            readColor = '#f59e0b';
        } else if (bestContrast >= 3) {
            readability = '一般';
            readColor = '#f97316';
        }
        
        const readabilityEl = document.getElementById('readabilityScore');
        readabilityEl.textContent = readability;
        readabilityEl.style.color = readColor;
        
        // 相似色推荐
        this.renderSimilarColors(solidColor);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    getLuminance(r, g, b) {
        const [rs, gs, bs] = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    getContrastRatio(color1, color2) {
        const rgb1 = this.hexToRgb(color1);
        const rgb2 = this.hexToRgb(color2);
        const lum1 = this.getLuminance(rgb1.r, rgb1.g, rgb1.b);
        const lum2 = this.getLuminance(rgb2.r, rgb2.g, rgb2.b);
        const brightest = Math.max(lum1, lum2);
        const darkest = Math.min(lum1, lum2);
        return (brightest + 0.05) / (darkest + 0.05);
    }

    renderSimilarColors(baseColor) {
        const container = document.getElementById('similarColorsList');
        const baseRgb = this.hexToRgb(baseColor);
        
        // 从当前色卡中找相似色（欧几里得距离）
        const similarCards = this.cards
            .filter(c => c.id !== this.currentDetailCard.id)
            .map(card => {
                const cardColor = card.color || Utils.getColorForCategory(card.category);
                const solidColor = cardColor.includes('gradient') ? '#ff6b6b' : cardColor;
                const rgb = this.hexToRgb(solidColor);
                const distance = Math.sqrt(
                    Math.pow(rgb.r - baseRgb.r, 2) +
                    Math.pow(rgb.g - baseRgb.g, 2) +
                    Math.pow(rgb.b - baseRgb.b, 2)
                );
                return { card, color: solidColor, distance };
            })
            .sort((a, b) => a.distance - b.distance)
            .slice(0, SIMILAR_COLORS_COUNT);
        
        if (similarCards.length === 0) {
            container.innerHTML = '<div class="empty-similar">暂无相似色卡</div>';
            return;
        }
        
        container.innerHTML = similarCards.map(item => `
            <div class="similar-color-item" 
                 style="background: ${item.color}" 
                 data-name="${item.card.chineseName}"
                 title="${item.card.chineseName} (${item.card.englishName})"
                 onclick="window.cardManager.showDetail(${item.card.id})">
            </div>
        `).join('');
    }

    showEdit(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        this.currentEditingCard = card;

        document.getElementById('editCardId').value = card.id;
        document.getElementById('editChineseName').value = card.chineseName;
        document.getElementById('editEnglishName').value = card.englishName;
        document.getElementById('editManufacturer').value = card.manufacturer;
        document.getElementById('editMaterial').value = card.material;
        if (document.getElementById('editVariant')) {
            document.getElementById('editVariant').value = card.variant || '';
        }
        document.getElementById('editCategory').value = card.category;
        document.getElementById('editQuantity').value = card.quantity || 0;
        document.getElementById('editNotes').value = card.notes || '';
        const color = card.color || Utils.getColorForCategory(card.category);
        const solidColor = color.includes('gradient') ? '#ff6b6b' : color;
        document.getElementById('editColor').value = solidColor;
        document.getElementById('editColorLabel').textContent = color;

        this.modalManager.previews.editImage.innerHTML = '';

        if (card.image) {
            this.modalManager.previews.editCurrentImage.innerHTML = `
                <img src="${card.image}" alt="${card.chineseName}">
                <div>当前图片</div>
                <button id="removeImageBtn" type="button">移除图片</button>
            `;
            document.getElementById('removeImageBtn').addEventListener('click', () => {
                card.image = '';
                this.modalManager.previews.editCurrentImage.innerHTML = '<div>已移除图片</div>';
            });
        } else {
            this.modalManager.previews.editCurrentImage.innerHTML = '<div>暂无图片</div>';
        }

        this.modalManager.configContainers.edit.innerHTML = '';
        const configItems = card.config && Array.isArray(card.config) ? card.config : [];
        if (configItems.length === 0) {
            Utils.resetConfigContainer(this.modalManager.configContainers.edit);
        } else {
            configItems.forEach((item) => {
                const configItem = document.createElement('div');
                configItem.className = 'config-item';
                configItem.innerHTML = `
                    <input type="text" class="config-key" placeholder="配置项名称" value="${item.key || ''}">
                    <input type="text" class="config-value" placeholder="配置值" value="${item.value || ''}">
                    <button type="button" class="remove-config-btn">×</button>
                `;
                this.modalManager.configContainers.edit.appendChild(configItem);
            });
        }
        Utils.setupConfigRemoveButtons(this.modalManager.configContainers.edit);

        this.modalManager.open('editCard');
    }

    showEditTemplate() {
        document.getElementById('templateManufacturer').value = this.template.manufacturer;
        document.getElementById('templateMaterial').value = this.template.material;

        this.modalManager.configContainers.template.innerHTML = '';
        this.template.config.forEach((item) => {
            const configItem = document.createElement('div');
            configItem.className = 'config-item';
            configItem.innerHTML = `
                <input type="text" class="config-key" placeholder="配置项名称" value="${item.key || ''}">
                <input type="text" class="config-value" placeholder="配置值" value="${item.value || ''}">
                <button type="button" class="remove-config-btn">×</button>
            `;
            this.modalManager.configContainers.template.appendChild(configItem);
        });
        Utils.setupConfigRemoveButtons(this.modalManager.configContainers.template);

        this.modalManager.open('editTemplate');
    }

    async handleAddCard(e) {
        e.preventDefault();

        try {
            const chineseName = document.getElementById('chineseName').value.trim();
            const englishName = document.getElementById('englishName').value.trim();
            const category = document.getElementById('category').value;
            const manufacturer = document.getElementById('manufacturer').value;
            const material = document.getElementById('material').value;
            const variant = document.getElementById('variant') ? document.getElementById('variant').value.trim() : '';

            if (!chineseName) { alert('请输入中文名'); return; }
            if (!englishName) { alert('请输入英文名'); return; }
            if (!category) { alert('请选择颜色分类'); return; }
            if (!manufacturer) { alert('请选择产商'); return; }
            if (!material) { alert('请选择材料'); return; }

            const quantity = parseInt(document.getElementById('quantity').value, 10) || 0;
            const color = document.getElementById('color').value;
            const notes = document.getElementById('notes').value.trim();
            const config = Utils.getConfigFromContainer(this.modalManager.configContainers.add);

            const imageInput = document.getElementById('imageUpload');
            const uploadedImage = imageInput && imageInput.dataset.compressedImage 
                ? imageInput.dataset.compressedImage 
                : (this.modalManager.previews.image.innerHTML 
                    ? this.modalManager.previews.image.querySelector('img').src 
                    : '');

            const newCard = {
                id: Date.now(),
                category,
                manufacturer,
                englishName,
                material,
                variant,
                image: uploadedImage,
                chineseName,
                config,
                quantity,
                color,
                notes,
                sortOrder: this.cards.length
            };

            this.cards.push(newCard);
            if (quantity > 0) {
                this.stockLogManager.add(newCard.id, newCard.chineseName, 0, quantity, 'add');
            }
            Storage.saveCards(this.cards);
            await CloudStorage.addCard(newCard);
            this.renderCards();
            this.modalManager.close('addCard');
        } catch (error) {
            handleError('添加色卡', error);
        }
    }

    async handleEditCard(e) {
        e.preventDefault();

        if (!this.currentEditingCard) return;

        try {
            const cardIndex = this.cards.findIndex(c => c.id === this.currentEditingCard.id);
            if (cardIndex === -1) return;

            const oldCard = this.cards[cardIndex];
            const oldQuantity = oldCard.quantity || 0;

            // Save previous state for undo
            const previousState = {
                category: oldCard.category,
                manufacturer: oldCard.manufacturer,
                englishName: oldCard.englishName,
                material: oldCard.material,
                variant: oldCard.variant || '',
                image: oldCard.image,
                chineseName: oldCard.chineseName,
                config: oldCard.config,
                quantity: oldCard.quantity,
                color: oldCard.color,
                notes: oldCard.notes || ''
            };

            const editImageInput = document.getElementById('editImageUpload');
            let newImage = this.currentEditingCard.image;
            if (editImageInput && editImageInput.dataset.compressedImage) {
                // 使用压缩后的图片
                newImage = editImageInput.dataset.compressedImage;
            } else if (this.modalManager.previews.editImage.innerHTML) {
                newImage = this.modalManager.previews.editImage.querySelector('img').src;
            }

            const material = document.getElementById('editMaterial').value;
            const variant = document.getElementById('editVariant') ? document.getElementById('editVariant').value.trim() : '';
            const config = Utils.getConfigFromContainer(this.modalManager.configContainers.edit);
            const newQuantity = parseInt(document.getElementById('editQuantity').value, 10) || 0;
            const newColor = document.getElementById('editColor').value;
            const newNotes = document.getElementById('editNotes').value.trim();

            this.cards[cardIndex] = {
                ...this.cards[cardIndex],
                category: document.getElementById('editCategory').value,
                manufacturer: document.getElementById('editManufacturer').value,
                englishName: document.getElementById('editEnglishName').value,
                material: material,
                variant: variant,
                image: newImage,
                chineseName: document.getElementById('editChineseName').value,
                config: config,
                quantity: newQuantity,
                color: newColor,
                notes: newNotes
            };

            // Record undo
            this.undoManager.push({
                type: 'edit',
                data: { cardId: oldCard.id, previousState },
                description: `已编辑「${oldCard.chineseName}」`
            });

            // 记录库存变动
            if (oldQuantity !== newQuantity) {
                this.stockLogManager.add(oldCard.id, oldCard.chineseName, oldQuantity, newQuantity, 'manual');
            }

            Storage.saveCards(this.cards);
            await CloudStorage.updateCard(this.cards[cardIndex]);
            this.renderCards();
            this.modalManager.close('editCard');
        } catch (error) {
            handleError('编辑色卡', error);
        }
    }

    showSearchHistoryDropdown(history) {
        // Remove existing dropdown if any
        this.hideSearchHistoryDropdown();
        
        const searchInput = document.getElementById('searchInput');
        const dropdown = document.createElement('div');
        dropdown.className = 'search-history-dropdown';
        dropdown.innerHTML = history.map(query => `
            <div class="search-history-item" data-query="${query}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>${query}</span>
            </div>
        `).join('');
        
        // Position below search input
        const rect = searchInput.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.left = rect.left + 'px';
        dropdown.style.top = (rect.bottom + 4) + 'px';
        dropdown.style.width = rect.width + 'px';
        
        document.body.appendChild(dropdown);
        
        // Handle clicks on history items
        dropdown.querySelectorAll('.search-history-item').forEach(item => {
            item.addEventListener('click', () => {
                const query = item.getAttribute('data-query');
                searchInput.value = query;
                this.currentSearch = query;
                document.getElementById('searchClear').style.display = 'flex';
                this.applyFilters();
                this.hideSearchHistoryDropdown();
                searchInput.focus();
            });
        });
    }

    hideSearchHistoryDropdown() {
        const existing = document.querySelector('.search-history-dropdown');
        if (existing) existing.remove();
    }

    async handleDeleteCard() {
        if (!this.currentEditingCard) return;

        if (!confirm(`确定要删除色卡「${this.currentEditingCard.chineseName}」吗？`)) {
            return;
        }

        try {
            const deletedCard = { ...this.currentEditingCard };
            this.cards = this.cards.filter(c => c.id !== this.currentEditingCard.id);
            Storage.saveCards(this.cards);
            localStorage.setItem(LOCAL_DELETE_KEY, Date.now().toString());
            await CloudStorage.deleteCard(this.currentEditingCard.id);
            this.renderCards();
            this.modalManager.close('editCard');

            // Undo support
            this.undoManager.push({
                type: 'delete',
                data: { cards: [deletedCard] },
                description: `已删除「${deletedCard.chineseName}」`
            });
            this.undoManager.showUndoToast(`已删除「${deletedCard.chineseName}」`);
        } catch (error) {
            handleError('删除色卡', error);
        }
    }

    handleEditFromDetail() {
        this.modalManager.close('detailCard');
        if (this.currentDetailCard) {
            this.showEdit(this.currentDetailCard.id);
        }
    }

    handleTemplateSubmit(e) {
        e.preventDefault();

        try {
            const config = Utils.getConfigFromContainer(this.modalManager.configContainers.template);

            this.template = {
                manufacturer: document.getElementById('templateManufacturer').value,
                material: document.getElementById('templateMaterial').value,
                config: config
            };

            Storage.saveTemplate(this.template);
            CloudStorage.saveTemplate(this.template);
            this.applyTemplateToAllCards();
            this.modalManager.close('editTemplate');
        } catch (error) {
            handleError('保存模板', error);
        }
    }

    applyTemplateToAllCards() {
        this.cards = this.cards.map(card => ({
            ...card,
            manufacturer: this.template.manufacturer || card.manufacturer,
            material: this.template.material || card.material,
            config: [...this.template.config]
        }));

        Storage.saveCards(this.cards);
        CloudStorage.saveCards(this.cards);
        this.renderCards();
    }

    filterCards(category) {
        this.currentCategory = category;
        this.applyFilters();
    }

    applyFilters() {
        // 更新分类按钮状态
        document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`[data-category="${this.currentCategory}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // 使用统一的筛选逻辑（包含智能搜索）
        let filtered = this.getFilteredCards();

        // 排序
        if (this.currentSort === 'default') {
            filtered.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        } else if (this.currentSort === 'name-asc') {
            filtered.sort((a, b) => (a.chineseName || '').localeCompare(b.chineseName || '', 'zh'));
        } else if (this.currentSort === 'name-desc') {
            filtered.sort((a, b) => (b.chineseName || '').localeCompare(a.chineseName || '', 'zh'));
        } else if (this.currentSort === 'stock-asc') {
            filtered.sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
        } else if (this.currentSort === 'stock-desc') {
            filtered.sort((a, b) => (b.quantity || 0) - (a.quantity || 0));
        }

        this.renderCards(filtered);
    }

    // ===== 拖拽排序 =====
    handleCardDrop(draggedId, targetId) {
        const previousOrder = [...this.cards];
        const draggedIdx = this.cards.findIndex(c => c.id === draggedId);
        const targetIdx = this.cards.findIndex(c => c.id === targetId);
        if (draggedIdx === -1 || targetIdx === -1) return;

        const [draggedCard] = this.cards.splice(draggedIdx, 1);
        this.cards.splice(targetIdx, 0, draggedCard);

        // Update sortOrder
        this.cards.forEach((c, i) => c.sortOrder = i);

        Storage.saveCards(this.cards);
        if (CloudStorage.isAvailable()) CloudStorage.saveCards(this.cards);
        this.applyFilters();

        this.undoManager.push({
            type: 'reorder',
            data: { previousOrder },
            description: '已调整色卡顺序'
        });
        this.undoManager.showUndoToast('已调整色卡顺序');
    }

    // ===== 统计面板 =====
    showStats() {
        const grid = document.getElementById('statsGrid');
        const total = this.cards.length;
        const totalStock = this.cards.reduce((sum, c) => sum + (c.quantity || 0), 0);
        const lowStockCount = this.cards.filter(c => (c.quantity || 0) <= 1).length;
        const categories = {};
        this.cards.forEach(c => {
            const cat = c.category || 'other';
            categories[cat] = (categories[cat] || 0) + 1;
        });

        const maxCatCount = Math.max(...Object.values(categories), 1);

        let categoryBarsHtml = '';
        const sortedCats = Object.entries(categories).sort((a, b) => b[1] - a[1]);
        sortedCats.forEach(([cat, count]) => {
            const pct = Math.round((count / maxCatCount) * 100);
            const color = categoryColors[cat] || '#888';
            const name = categoryNames[cat] || cat;
            categoryBarsHtml += `
                <div class="stat-bar-item">
                    <span class="stat-bar-name">${name}</span>
                    <div class="stat-bar-track">
                        <div class="stat-bar-fill" style="width:${pct}%;background:${color};"></div>
                    </div>
                    <span class="stat-bar-count">${count}</span>
                </div>
            `;
        });

        grid.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${total}</div>
                <div class="stat-label">色卡总数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalStock}</div>
                <div class="stat-label">库存总量</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color:${lowStockCount > 0 ? 'var(--accent-danger)' : 'var(--accent-success)'}">${lowStockCount}</div>
                <div class="stat-label">低库存预警</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Object.keys(categories).length}</div>
                <div class="stat-label">颜色分类</div>
            </div>
            <div class="stat-card full-width">
                <div class="stat-label" style="margin-bottom:4px;">分类分布</div>
                <div class="stat-bar-list">${categoryBarsHtml || '<div style="color:var(--text-muted);font-size:0.85rem;">暂无数据</div>'}</div>
            </div>
        `;

        document.getElementById('statsModal').style.display = 'block';
    }

    async init() {
        // Cache frequently accessed DOM elements
        cacheDOMElements();
        
        // 初始化 PWA IndexedDB 离线存储
        try {
            await initOfflineDB();
            log('[PWA] Offline storage ready');
        } catch (e) {
            warn('[PWA] Failed to initialize IndexedDB:', e);
        }

        this.clearOldData();
        await this.materialManager.init();
        this.currentCategory = 'all';
        this.showLoadingSkeleton();
        this.loadFromCloud();
    }

    async loadFromCloud() {
        CloudStorage.setStatus('syncing', '正在同步云端数据...');

        if (!CloudStorage.isAvailable()) {
            CloudStorage.setStatus('disconnected', '未连接云端，使用本地存储');
            this.cloudSyncCompleted = true;
            this.applyFilters();
            return;
        }

        try {
            // 第1步：加载色卡数据
            CloudStorage.setStatus('syncing', '正在同步色卡数据...');
            const cloudCards = await CloudStorage.loadCards();

            // 第2步：加载材料列表
            CloudStorage.setStatus('syncing', '正在同步材料列表...');
            const cloudMaterials = await CloudStorage.loadMaterials();

            // 第3步：加载产商列表
            CloudStorage.setStatus('syncing', '正在同步产商列表...');
            const cloudManufacturers = await CloudStorage.loadManufacturers();

            // 第4步：加载模板
            CloudStorage.setStatus('syncing', '正在同步模板配置...');
            const cloudTemplate = await CloudStorage.loadTemplate();

            // 云端为唯一数据源，直接覆盖本地
            if (cloudCards) {
                this.cards = cloudCards;
                Storage.saveCards(this.cards);
            } else if (this.cards.length > 0) {
                // 云端为空但本地有数据，推送到云端
                CloudStorage.saveCards(this.cards);
            }

            if (cloudMaterials) {
                CloudStorage.setStatus('syncing', '正在同步材料列表...');
                // 去重
                this.materialManager.materials = [...new Set(cloudMaterials)];
                Storage.saveMaterials(this.materialManager.materials);
                CloudStorage.saveMaterials(this.materialManager.materials);
                this.materialManager.updateSelects();
            }

            if (cloudManufacturers) {
                CloudStorage.setStatus('syncing', '正在同步产商列表...');
                // 去重
                this.materialManager.manufacturers = [...new Set(cloudManufacturers)];
                Storage.saveManufacturers(this.materialManager.manufacturers);
                CloudStorage.saveManufacturers(this.materialManager.manufacturers);
                this.materialManager.updateSelects();
            }

            if (cloudTemplate) {
                CloudStorage.setStatus('syncing', '正在同步模板配置...');
                this.template = {
                    manufacturer: cloudTemplate.manufacturer || '',
                    material: cloudTemplate.material || '',
                    config: cloudTemplate.config || []
                };
                Storage.saveTemplate(this.template);
            }

            this.cloudSyncCompleted = true;
            CloudStorage.setStatus('syncing', '同步完成，加载中...');
            this.applyFilters();
            CloudStorage.setStatus('connected', '已连接云端');
            log('云端数据同步完成');
        } catch (e) {
            this.cloudSyncCompleted = true;
            CloudStorage.setStatus('disconnected', '云端同步失败，使用本地存储');
            this.applyFilters();
            warn('从云端加载数据失败', e);
        }
    }

    clearOldData() {
        const savedVersion = localStorage.getItem(VERSION_KEY);
        if (savedVersion !== CURRENT_VERSION) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(TEMPLATE_KEY);
            localStorage.removeItem(MATERIALS_KEY);
            localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
            this.cards = [];
            this.template = { ...defaultTemplate };
            this.materialManager.materials = [];
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cardManager = new CardManager();
    window.cardManager.init();

    // 同浏览器多标签同步：监听 localStorage 变化
    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY && window.cardManager) {
            log('[Sync] 检测到其他标签页数据变化，重新加载');
            window.cardManager.cards = JSON.parse(e.newValue || '[]');
            window.cardManager.applyFilters();
        }
    });

    // 跨设备同步：每 30 秒从云端拉取最新数据
    if (CloudStorage.isAvailable()) {
        setInterval(async () => {
            if (!window.cardManager || window.cardManager._syncing) return;
            window.cardManager._syncing = true;
            try {
                const cloudCards = await CloudStorage.loadCards();
                if (!cloudCards) return;

                // 通过卡片 ID 集合比较，避免 JSON.stringify 属性顺序问题
                const localIds = new Set(window.cardManager.cards.map(c => c.id));
                const cloudIds = new Set(cloudCards.map(c => c.id));

                const idsMatch = localIds.size === cloudIds.size &&
                    [...localIds].every(id => cloudIds.has(id));

                if (!idsMatch) {
                    log('[Sync] 云端数据有变化，更新本地');
                    window.cardManager.cards = cloudCards;
                    Storage.saveCards(cloudCards);
                    window.cardManager.applyFilters();
                }
            } catch (e) {
                warn('[Sync] 定时同步失败', e);
            } finally {
                window.cardManager._syncing = false;
            }
        }, 10000); // 10 秒轮询一次
    }
});