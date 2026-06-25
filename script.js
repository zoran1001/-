const STORAGE_KEY = 'color_cards_data';
const TEMPLATE_KEY = 'color_card_template';
const MATERIALS_KEY = 'color_card_materials';
const STOCK_LOG_KEY = 'color_card_stock_logs';
const MANUFACTURERS_KEY = 'color_card_manufacturers';
const VERSION_KEY = 'color_cards_version';
const CURRENT_VERSION = '2.0';

// Supabase 云端配置
const SUPABASE_URL = 'https://xgalutaglwryurdmwbpl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnYWx1dGFnbHdyeXVyZG13YnBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNTM3MTksImV4cCI6MjA5NzgyOTcxOX0.CfJ5kjGHI2_np7nUfl8O12-xBC2T8mj_xsEl-fG_NJc';

let supabaseClient = null;

try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase 初始化成功');
    }
} catch (e) {
    console.warn('Supabase 初始化失败，将使用本地存储模式', e);
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
            console.warn('从云端加载色卡失败', e);
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
            console.warn('保存色卡到云端失败', e);
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
            console.warn('添加色卡到云端失败', e);
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
            console.warn('更新云端色卡失败', e);
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
            console.warn('删除云端色卡失败', e);
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
            console.warn('从云端加载材料失败', e);
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
            console.warn('添加材料到云端失败', e);
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
            console.warn('删除云端材料失败', e);
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
            console.warn('从云端加载产商失败', e);
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
            console.warn('添加产商到云端失败', e);
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
            console.warn('删除云端产商失败', e);
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
                if (error.code === 'PGRST116') return null;
                throw error;
            }
            return data;
        } catch (e) {
            console.warn('从云端加载模板失败', e);
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
            console.warn('保存模板到云端失败', e);
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
    purple: '#a855f7'
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
    gray: '灰色'
};

const defaultCards = [];

const defaultTemplate = {
    manufacturer: '',
    material: '',
    config: []
};

const Storage = {
    loadCards() {
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

    saveCards(cards) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    },

    loadTemplate() {
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

    loadMaterials() {
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

    saveMaterials(materials) {
        localStorage.setItem(MATERIALS_KEY, JSON.stringify(materials));
    },
    
    loadManufacturers() {
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

    saveManufacturers(manufacturers) {
        localStorage.setItem(MANUFACTURERS_KEY, JSON.stringify(manufacturers));
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
        this.materials = Storage.loadMaterials();
        this.manufacturers = Storage.loadManufacturers();
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
            this.materials.forEach(material => {
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
            this.manufacturers.forEach(manufacturer => {
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
        Toast.show(description, '撤销', () => this.undo());
    }
}

// ===== 图片预处理工具（提升 OCR 准确率）=====
const ImagePreprocessor = {
    // 将 base64 图片预处理后返回新的 base64
    async preprocess(dataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                // 放大图片（Tesseract 对大尺寸图片识别更好）
                const scale = Math.max(1, 1200 / Math.max(img.width, img.height));
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');

                // 白色背景
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);

                // 绘制原图
                ctx.drawImage(img, 0, 0, w, h);

                // 获取像素数据进行灰度化 + 二值化
                const imageData = ctx.getImageData(0, 0, w, h);
                const data = imageData.data;

                for (let i = 0; i < data.length; i += 4) {
                    // 灰度化（加权平均）
                    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    // 二值化（阈值 128）
                    const val = gray > 128 ? 255 : 0;
                    data[i] = val;
                    data[i + 1] = val;
                    data[i + 2] = val;
                }

                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve(dataUrl); // 失败则返回原图
            img.src = dataUrl;
        });
    }
};

class CardManager {
    constructor() {
        this.cards = Storage.loadCards();
        this.template = Storage.loadTemplate();
        this.currentEditingCard = null;
        this.currentDetailCard = null;
        this.cardsContainer = document.getElementById('cardsContainer');
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

        // Search input with debounce
        const debouncedSearch = Utils.debounce(() => this.applyFilters(), 300);
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
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('scanModal')) {
                this.closeScanModal();
            }
        });

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
        document.getElementById('batchApplyBtn').addEventListener('click', () => this.batchApply());
        document.getElementById('batchStockOp').addEventListener('change', (e) => {
            document.getElementById('batchStockVal').disabled = !e.target.value;
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
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('stockLogModal')) {
                this.closeStockLog();
            }
        });

        // 统计面板
        document.getElementById('statsBtn').addEventListener('click', () => this.showStats());
        document.getElementById('closeStatsModalBtn').addEventListener('click', () => {
            document.getElementById('statsModal').style.display = 'none';
        });
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('statsModal')) {
                document.getElementById('statsModal').style.display = 'none';
            }
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

    handleImageUpload(e, previewId) {
        const file = e.target.files[0];
        const preview = document.getElementById(previewId);
        
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                preview.innerHTML = `<img src="${event.target.result}" alt="预览">`;
            };
            reader.readAsDataURL(file);
        } else {
            preview.innerHTML = '';
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

        // 只检查 quantity 字段明确存在的卡片（排除云端未同步该字段的情况）
        const lowCards = this.cards.filter(c => {
            const qty = c.quantity;
            // quantity 为 undefined/null 说明字段不存在，不触发警告
            if (qty === undefined || qty === null) return false;
            return qty <= 1;
        });

        if (lowCards.length === 0) {
            warning.classList.remove('show');
            this.lowStockDismissed = false;
            return;
        }

        // 如果用户已手动关闭，不再自动弹出（除非库存状态发生变化）
        if (this.lowStockDismissed) return;

        const names = lowCards.map(c => {
            const name = c.chineseName || '未命名';
            const qty = c.quantity || 0;
            return `「${name}」库存仅 ${qty} 件`;
        }).join('；');

        text.innerHTML = `<strong>⚠ 库存预警：</strong>${names}`;
        warning.classList.add('show');
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
            const kw = this.currentSearch.toLowerCase();
            cards = cards.filter(c => {
                return (c.chineseName || '').toLowerCase().includes(kw)
                    || (c.englishName || '').toLowerCase().includes(kw)
                    || (c.manufacturer || '').toLowerCase().includes(kw)
                    || (c.material || '').toLowerCase().includes(kw)
                    || (c.notes || '').toLowerCase().includes(kw);
            });
        }
        return cards;
    }

    batchDelete() {
        if (this.selectedCards.size === 0) return;
        const count = this.selectedCards.size;
        if (!confirm(`确定要删除选中的 ${count} 张色卡吗？此操作不可撤销。`)) return;

        const deletedCards = this.cards.filter(c => this.selectedCards.has(c.id));
        this.cards = this.cards.filter(c => !this.selectedCards.has(c.id));
        Storage.saveCards(this.cards);
        if (CloudStorage.isAvailable()) {
            CloudStorage.saveCards(this.cards);
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
            this.scanImageData = imgData;

            // 显示预览
            const previewImg = document.getElementById('scanPreviewImg');
            previewImg.src = imgData;
            previewImg.style.display = 'block';
            document.getElementById('scanUploadContent').style.display = 'none';

            // 启用识别按钮
            document.getElementById('scanStartBtn').disabled = false;
        };
        reader.readAsDataURL(file);
    }

    async startOCR() {
        if (!this.scanImageData) {
            alert('请先上传图片！');
            return;
        }

        // 显示进度条
        document.getElementById('scanProgress').style.display = 'block';
        document.getElementById('scanInitialActions').style.display = 'none';
        document.getElementById('scanProgressText').textContent = '正在预处理图片...';
        document.getElementById('scanProgressFill').style.width = '5%';

        try {
            // 1. 图片预处理（灰度化+二值化+放大）
            const processedImage = await ImagePreprocessor.preprocess(this.scanImageData);
            document.getElementById('scanProgressFill').style.width = '10%';
            document.getElementById('scanProgressText').textContent = '正在初始化 OCR 引擎...';

            // 2. 优先用英文识别（标签多为英文），置信度低时回退中文
            let result = await Tesseract.recognize(
                processedImage,
                'eng',
                {
                    logger: (m) => {
                        if (m.status === 'recognizing text') {
                            const progress = 10 + Math.round(m.progress * 80);
                            document.getElementById('scanProgressFill').style.width = `${progress}%`;
                            document.getElementById('scanProgressText').textContent = `正在识别文字(英文)... ${Math.round(m.progress * 100)}%`;
                        }
                    }
                }
            );

            // 3. 如果英文识别置信度太低（<50%），回退到中文识别
            const confidence = result.data.confidence;
            if (confidence < 50) {
                document.getElementById('scanProgressText').textContent = '英文识别率低，切换中文引擎...';
                const cnResult = await Tesseract.recognize(
                    processedImage,
                    'chi_sim+eng',
                    {
                        logger: (m) => {
                            if (m.status === 'recognizing text') {
                                const progress = 10 + Math.round(m.progress * 80);
                                document.getElementById('scanProgressFill').style.width = `${progress}%`;
                                document.getElementById('scanProgressText').textContent = `正在识别文字(中文)... ${Math.round(m.progress * 100)}%`;
                            }
                        }
                    }
                );
                // 取置信度更高的结果
                if (cnResult.data.confidence > confidence) {
                    result = cnResult;
                }
            }

            document.getElementById('scanProgressFill').style.width = '100%';
            document.getElementById('scanProgressText').textContent = `识别完成！置信度 ${Math.round(result.data.confidence)}%`;

            // 存储识别结果（含置信度）
            this.scanOCRResult = result.data.text;
            this.scanOCRConfidence = result.data.confidence;

            // 延迟一下让用户看到完成状态
            setTimeout(() => {
                this.showScanResult(this.scanOCRResult);
            }, 500);

        } catch (error) {
            console.error('OCR 识别失败：', error);
            alert('OCR 识别失败，请重试！');
            document.getElementById('scanProgress').style.display = 'none';
            document.getElementById('scanInitialActions').style.display = 'block';
        }
    }

    showScanResult(rawText) {
        // 隐藏进度条
        document.getElementById('scanProgress').style.display = 'none';
        
        // 显示识别结果区域
        document.getElementById('scanResult').style.display = 'block';
        
        // 显示原始识别文字
        document.getElementById('scanRawText').textContent = rawText;

        // 解析识别文字
        const parsedInfo = this.parseOCRText(rawText);
        
        // 填充到表单
        document.getElementById('scanChineseName').value = parsedInfo.chineseName || '';
        document.getElementById('scanEnglishName').value = parsedInfo.englishName || '';
        document.getElementById('scanManufacturer').value = parsedInfo.manufacturer || '';
        document.getElementById('scanMaterial').value = parsedInfo.material || '';
        if (document.getElementById('scanVariant')) {
            document.getElementById('scanVariant').value = parsedInfo.variant || '';
        }
        if (parsedInfo.category) {
            document.getElementById('scanCategory').value = parsedInfo.category;
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
        'cyan': 'cyan', '青色': 'cyan', '湖蓝': 'cyan', '天蓝': 'cyan',
        'blue': 'blue', '蓝色': 'blue', '深蓝': 'blue', '宝蓝': 'blue',
        'purple': 'purple', '紫色': 'purple', '紫罗兰': 'purple', 'violet': 'purple',
        'black': 'black', '黑色': 'black',
        'white': 'white', '白色': 'white',
        'gray': 'gray', '灰色': 'gray', 'grey': 'gray', '银灰': 'gray', '银色': 'gray', 'silver': 'gray'
    };
    _colorENtoCN = {
        'red': '红色', 'orange': '橙色', 'yellow': '黄色', 'green': '绿色',
        'milk green': '奶绿', 'cyan': '青色', 'blue': '蓝色', 'purple': '紫色',
        'black': '黑色', 'white': '白色', 'gray': '灰色'
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
            // 中文名
            if (!result.chineseName && /[\u4e00-\u9fa5]/.test(line) && line.length <= 20) {
                result.chineseName = line;
                continue;
            }
            // 英文名（品牌名、产品名等）
            if (!result.englishName && /^[A-Za-z][A-Za-z0-9\s\-™®+]*$/.test(line) && line.length <= 30) {
                result.englishName = line;
                continue;
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
        return '';
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
        // 根据中文名或英文名匹配现有色卡
        const matchResult = document.getElementById('scanMatchResult');
        const matchText = document.getElementById('scanMatchText');

        if (!parsedInfo.chineseName && !parsedInfo.englishName) {
            matchResult.style.display = 'none';
            return;
        }

        // 搜索匹配的色卡
        const matchedCards = this.cards.filter(card => {
            const nameMatch = parsedInfo.chineseName && 
                (card.chineseName.includes(parsedInfo.chineseName) || 
                 parsedInfo.chineseName.includes(card.chineseName));
            const enNameMatch = parsedInfo.englishName && 
                (card.englishName.includes(parsedInfo.englishName) || 
                 parsedInfo.englishName.includes(card.englishName));
            return nameMatch || enNameMatch;
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

    confirmScanResult() {
        const chineseName = document.getElementById('scanChineseName').value.trim();
        const englishName = document.getElementById('scanEnglishName').value.trim();
        const manufacturer = document.getElementById('scanManufacturer').value.trim();
        const material = document.getElementById('scanMaterial').value.trim();
        const variant = document.getElementById('scanVariant') ? document.getElementById('scanVariant').value.trim() : '';
        const category = document.getElementById('scanCategory').value;
        const scanColor = document.getElementById('scanColor').value;

        if (!chineseName) {
            alert('请输入中文名！');
            return;
        }

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
                CloudStorage.updateCard(card);
                
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
                image: '',
                color: scanColor || Utils.getColorForCategory(category || 'gray'),
                notes: '',
                sortOrder: this.cards.length
            };

            this.cards.push(newCard);
            Storage.saveCards(this.cards);
            CloudStorage.addCard(newCard);

            // 记录扫描新增色卡
            this.stockLogManager.add(newCard.id, newCard.chineseName, 0, 1, 'scan');

            alert(`✅ 已创建新色卡「${chineseName}」`);
        }

        // 刷新显示
        this.renderCards();
        this.checkLowStock();
        
        // 关闭模态框
        this.closeScanModal();
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
                ? `<div class="card-image"><img src="${card.image}" alt="${card.chineseName}"></div>`
                : `<div class="card-color-preview" style="background-color: ${color};"></div>`;

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
                        <span class="card-color-dot" style="background-color: ${color};" title="${color}"></span>
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
            preview.style.backgroundColor = color;
            preview.innerHTML = '';
        }

        this.modalManager.open('detailCard');
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
        document.getElementById('editColor').value = card.color || Utils.getColorForCategory(card.category);
        document.getElementById('editColorLabel').textContent = card.color || Utils.getColorForCategory(card.category);

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

    handleAddCard(e) {
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

            const newCard = {
                id: Date.now(),
                category,
                manufacturer,
                englishName,
                material,
                variant,
                image: this.modalManager.previews.image.innerHTML 
                    ? this.modalManager.previews.image.querySelector('img').src 
                    : '',
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
            CloudStorage.addCard(newCard);
            this.renderCards();
            this.modalManager.close('addCard');
        } catch (error) {
            console.error('添加色卡失败:', error);
            alert('添加色卡失败，请重试');
        }
    }

    handleEditCard(e) {
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

            let newImage = this.currentEditingCard.image;
            if (this.modalManager.previews.editImage.innerHTML) {
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
            CloudStorage.updateCard(this.cards[cardIndex]);
            this.renderCards();
            this.modalManager.close('editCard');
        } catch (error) {
            console.error('编辑色卡失败:', error);
            alert('编辑色卡失败，请重试');
        }
    }

    handleDeleteCard() {
        if (!this.currentEditingCard) return;

        if (!confirm(`确定要删除色卡「${this.currentEditingCard.chineseName}」吗？`)) {
            return;
        }

        try {
            const deletedCard = { ...this.currentEditingCard };
            this.cards = this.cards.filter(c => c.id !== this.currentEditingCard.id);
            Storage.saveCards(this.cards);
            CloudStorage.deleteCard(this.currentEditingCard.id);
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
            console.error('删除色卡失败:', error);
            alert('删除色卡失败，请重试');
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
            console.error('保存模板失败:', error);
            alert('保存模板失败，请重试');
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

        // 先用分类筛选
        let filtered = this.currentCategory === 'all' 
            ? [...this.cards] 
            : this.cards.filter(card => card.category === this.currentCategory);

        // 再用搜索词筛选
        if (this.currentSearch) {
            const kw = this.currentSearch.toLowerCase();
            filtered = filtered.filter(card => {
                return (card.chineseName && card.chineseName.toLowerCase().includes(kw)) ||
                       (card.englishName && card.englishName.toLowerCase().includes(kw)) ||
                       (card.manufacturer && card.manufacturer.toLowerCase().includes(kw)) ||
                       (card.material && card.material.toLowerCase().includes(kw)) ||
                       (card.notes && card.notes.toLowerCase().includes(kw));
            });
        }

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

    init() {
        this.clearOldData();
        this.materialManager.updateSelects();
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
            const [cloudCards, cloudMaterials, cloudManufacturers, cloudTemplate] = await Promise.all([
                CloudStorage.loadCards(),
                CloudStorage.loadMaterials(),
                CloudStorage.loadManufacturers(),
                CloudStorage.loadTemplate()
            ]);

            // 只在首次加载时用云端数据覆盖本地（避免覆盖用户正在编辑的数据）
            if (!this.cloudSyncCompleted && cloudCards && cloudCards.length > 0) {
                this.cards = cloudCards;
                Storage.saveCards(this.cards);
            } else if (cloudCards && cloudCards.length === 0 && this.cards.length > 0) {
                // 本地有数据但云端为空，推送到云端
                CloudStorage.saveCards(this.cards);
            }

            if (cloudMaterials && cloudMaterials.length > 0) {
                this.materialManager.materials = cloudMaterials;
                Storage.saveMaterials(cloudMaterials);
                this.materialManager.updateSelects();
            }

            if (cloudManufacturers && cloudManufacturers.length > 0) {
                this.materialManager.manufacturers = cloudManufacturers;
                Storage.saveManufacturers(cloudManufacturers);
                this.materialManager.updateSelects();
            }

            if (cloudTemplate) {
                this.template = {
                    manufacturer: cloudTemplate.manufacturer || '',
                    material: cloudTemplate.material || '',
                    config: cloudTemplate.config || []
                };
                Storage.saveTemplate(this.template);
            }

            this.cloudSyncCompleted = true;
            this.applyFilters();
            CloudStorage.setStatus('connected', '已连接云端');
            console.log('云端数据同步完成');
        } catch (e) {
            this.cloudSyncCompleted = true;
            CloudStorage.setStatus('disconnected', '云端同步失败，使用本地存储');
            this.applyFilters();
            console.warn('从云端加载数据失败', e);
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
    const cardManager = new CardManager();
    cardManager.init();
});