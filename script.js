const STORAGE_KEY = 'color_cards_data';
const TEMPLATE_KEY = 'color_card_template';
const MATERIALS_KEY = 'color_card_materials';
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
                    image: card.image,
                    chineseName: card.chineseName,
                    config: card.config,
                    quantity: card.quantity
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
                    image: card.image,
                    chineseName: card.chineseName,
                    config: card.config,
                    quantity: card.quantity
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
                    image: card.image,
                    chineseName: card.chineseName,
                    config: card.config,
                    quantity: card.quantity
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
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('addCardBtn').addEventListener('click', () => this.modalManager.open('addCard'));
        document.getElementById('templateBtn').addEventListener('click', () => this.showEditTemplate());
        document.getElementById('adminBtn').addEventListener('click', () => this.showAdmin());
        
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

        // Search input
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.currentSearch = e.target.value.trim();
            document.getElementById('searchClear').style.display = this.currentSearch ? 'flex' : 'none';
            this.applyFilters();
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
        document.getElementById('scanProgressText').textContent = '正在初始化 OCR 引擎...';
        document.getElementById('scanProgressFill').style.width = '10%';

        try {
            // 使用 Tesseract.js 进行 OCR 识别
            const result = await Tesseract.recognize(
                this.scanImageData,
                'chi_sim+eng', // 中文简体 + 英文
                {
                    logger: (m) => {
                        if (m.status === 'recognizing text') {
                            const progress = Math.round(m.progress * 100);
                            document.getElementById('scanProgressFill').style.width = `${progress}%`;
                            document.getElementById('scanProgressText').textContent = `正在识别文字... ${progress}%`;
                        }
                    }
                }
            );

            document.getElementById('scanProgressFill').style.width = '100%';
            document.getElementById('scanProgressText').textContent = '识别完成！';

            // 存储识别结果
            this.scanOCRResult = result.data.text;

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
        if (parsedInfo.category) {
            document.getElementById('scanCategory').value = parsedInfo.category;
        }

        // 尝试匹配现有色卡
        this.matchCard(parsedInfo);
    }

    parseOCRText(text) {
        const result = {
            chineseName: '',
            englishName: '',
            manufacturer: '',
            material: '',
            category: ''
        };

        // 按行分割
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);

        // 简单的解析逻辑（可以根据实际情况调整）
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // 尝试识别中文名（通常包含中文）
            if (!result.chineseName && /[\u4e00-\u9fa5]/.test(line) && line.length <= 10) {
                result.chineseName = line;
            }
            
            // 尝试识别英文名（通常全是大写字母或首字母大写）
            if (!result.englishName && /^[A-Z][A-Za-z\s\-]+$/.test(line) && line.length <= 20) {
                result.englishName = line;
            }
            
            // 尝试识别产商（包含"厂"、"公司"、"科技"等关键词）
            if (!result.manufacturer && /厂|公司|科技|集团|有限/.test(line)) {
                result.manufacturer = line;
            }
            
            // 尝试识别材料（包含"料"、"纸"、"布"、"革"等关键词）
            if (!result.material && /料|纸|布|革|皮|金属|塑料/.test(line)) {
                result.material = line;
            }
        }

        // 如果上面没识别到，使用一些启发式规则
        if (lines.length >= 1 && !result.chineseName) {
            result.chineseName = lines[0]; // 假设第一行是名称
        }
        if (lines.length >= 2 && !result.englishName) {
            result.englishName = lines[1]; // 假设第二行是英文名
        }

        return result;
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
        const category = document.getElementById('scanCategory').value;

        if (!chineseName) {
            alert('请输入中文名！');
            return;
        }

        if (this.matchedCardId) {
            // 更新现有色卡（增加库存）
            const card = this.cards.find(c => c.id === this.matchedCardId);
            if (card) {
                card.quantity = (card.quantity || 0) + 1;
                
                // 更新其他信息（如果用户修改了）
                card.englishName = englishName || card.englishName;
                card.manufacturer = manufacturer || card.manufacturer;
                card.material = material || card.material;
                if (category) card.category = category;

                Storage.saveCards(this.cards);
                CloudStorage.updateCard(keysToSnake(card));
                
                alert(`✅ 已更新色卡「${card.chineseName}」的库存，当前库存：${card.quantity} 件`);
            }
        } else {
            // 创建新色卡
            const newCard = {
                id: Date.now().toString(),
                chineseName,
                englishName: englishName || '',
                manufacturer: manufacturer || '',
                material: material || '',
                category: category || 'gray',
                quantity: 1,
                config: [],
                image: ''
            };

            this.cards.push(newCard);
            Storage.saveCards(this.cards);
            CloudStorage.addCard(keysToSnake(newCard));

            alert(`✅ 已创建新色卡「${chineseName}」`);
        }

        // 刷新显示
        this.renderCards();
        this.checkLowStock();
        
        // 关闭模态框
        this.closeScanModal();
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
            return;
        }

        cards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            cardElement.setAttribute('role', 'listitem');
            
            const color = card.color || Utils.getColorForCategory(card.category);
            const imageHtml = card.image 
                ? `<div class="card-image"><img src="${card.image}" alt="${card.chineseName}"></div>`
                : `<div class="card-color-preview" style="background-color: ${color};"></div>`;
            const configText = Utils.configToText(card.config);
            
            cardElement.innerHTML = `
                ${imageHtml}
                <div class="card-content">
                    <h3 class="card-title">${card.chineseName}</h3>
                    <p class="card-subtitle">${card.englishName}</p>
                    <div class="card-info">
                        <div class="info-item">
                            <div class="info-label">产商</div>
                            <div class="info-value">${card.manufacturer}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">材料</div>
                            <div class="info-value">${card.material}</div>
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
                    <div class="card-actions">
                        <button class="card-action-btn view" data-id="${card.id}" type="button">查看</button>
                        <button class="card-action-btn edit" data-id="${card.id}" type="button">编辑</button>
                    </div>
                </div>
            `;
            this.cardsContainer.appendChild(cardElement);
        });

        document.querySelectorAll('.card-action-btn.view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cardId = parseInt(e.target.getAttribute('data-id'));
                this.showDetail(cardId);
            });
        });

        document.querySelectorAll('.card-action-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cardId = parseInt(e.target.getAttribute('data-id'));
                this.showEdit(cardId);
            });
        });

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
        document.getElementById('detailCategory').textContent = categoryNames[card.category] || card.category;
        document.getElementById('detailQuantity').textContent = (card.quantity || 0) + ' 件';

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
        document.getElementById('editCategory').value = card.category;
        document.getElementById('editQuantity').value = card.quantity || 0;

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
            const category = document.getElementById('category').value;
            const manufacturer = document.getElementById('manufacturer').value;
            const material = document.getElementById('material').value;
            const quantity = parseInt(document.getElementById('quantity').value, 10) || 0;
            const config = Utils.getConfigFromContainer(this.modalManager.configContainers.add);

            const newCard = {
                id: Date.now(),
                category: category,
                manufacturer: manufacturer,
                englishName: document.getElementById('englishName').value,
                material: material,
                image: this.modalManager.previews.image.innerHTML 
                    ? this.modalManager.previews.image.querySelector('img').src 
                    : '',
                chineseName: document.getElementById('chineseName').value,
                config: config,
                quantity: quantity
            };

            this.cards.push(newCard);
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

            let newImage = this.currentEditingCard.image;
            if (this.modalManager.previews.editImage.innerHTML) {
                newImage = this.modalManager.previews.editImage.querySelector('img').src;
            }

            const material = document.getElementById('editMaterial').value;
            const config = Utils.getConfigFromContainer(this.modalManager.configContainers.edit);

            this.cards[cardIndex] = {
                ...this.cards[cardIndex],
                category: document.getElementById('editCategory').value,
                manufacturer: document.getElementById('editManufacturer').value,
                englishName: document.getElementById('editEnglishName').value,
                material: material,
                image: newImage,
                chineseName: document.getElementById('editChineseName').value,
                config: config,
                quantity: parseInt(document.getElementById('editQuantity').value, 10) || 0
            };

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
            this.cards = this.cards.filter(c => c.id !== this.currentEditingCard.id);
            Storage.saveCards(this.cards);
            CloudStorage.deleteCard(this.currentEditingCard.id);
            this.renderCards();
            this.modalManager.close('editCard');
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

            if (confirm('确定要将模板配置应用到所有色卡吗？')) {
                this.applyTemplateToAllCards();
            }

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
                       (card.material && card.material.toLowerCase().includes(kw));
            });
        }

        // 排序
        if (this.currentSort === 'name-asc') {
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

    init() {
        this.clearOldData();
        this.materialManager.updateSelects();
        this.currentCategory = 'all';
        this.applyFilters();
        this.loadFromCloud();
    }

    async loadFromCloud() {
        CloudStorage.setStatus('syncing', '正在同步云端数据...');

        if (!CloudStorage.isAvailable()) {
            CloudStorage.setStatus('disconnected', '未连接云端，使用本地存储');
            this.cloudSyncCompleted = true;
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
            this.renderCards();
            CloudStorage.setStatus('connected', '已连接云端');
            console.log('云端数据同步完成');
        } catch (e) {
            this.cloudSyncCompleted = true;
            CloudStorage.setStatus('disconnected', '云端同步失败，使用本地存储');
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