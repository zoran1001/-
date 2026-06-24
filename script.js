const SUPABASE_URL = 'https://xgalutaglwryurdmwbpl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnYWx1dGFnbHdyeXVyZG13YnBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNTM3MTksImV4cCI6MjA5NzgyOTcxOX0.CfJ5kjGHI2_np7nUfl8O12-xBC2T8mj_xsEl-fG_NJc';

let supabase = null;

try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase 初始化成功');
    }
} catch (e) {
    console.warn('Supabase 初始化失败，将使用本地存储模式:', e);
}

const STORAGE_KEY = 'color_cards_data';
const TEMPLATE_KEY = 'color_card_template';
const MATERIALS_KEY = 'color_card_materials';
const MANUFACTURERS_KEY = 'color_card_manufacturers';
const VERSION_KEY = 'color_cards_version';
const SIZE_KEY = 'color_cards_size';
const CURRENT_VERSION = '2.0';

const defaultMaterials = ['PLA', 'PETG', '乳胶漆', '外墙漆', '木器漆', '金属漆', '艺术漆', '内墙漆', '水性漆'];
const defaultManufacturers = ['立邦', '多乐士', '三棵树', '嘉宝莉', '华润漆', '紫荆花', '美涂士', '大宝漆', '长颈鹿'];

const categoryColors = {
    red: '#ef4444',
    orange: '#f97316',
    yellow: '#eab308',
    green: '#22c55e',
    cyan: '#06b6d4',
    blue: '#3b82f6',
    purple: '#a855f7',
    black: '#111827',
    white: '#f9fafb',
    gray: '#6b7280'
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

const CloudStorage = {
    isAvailable() {
        return supabase !== null;
    },

    async loadCards() {
        if (!this.isAvailable()) return null;
        try {
            const { data, error } = await supabase
                .from('cards')
                .select('*')
                .order('id', { ascending: true });
            
            if (error) throw error;
            
            return data.map(item => ({
                id: item.id,
                category: item.category,
                manufacturer: item.manufacturer || '',
                englishName: item.english_name || '',
                material: item.material || '',
                image: item.image || '',
                chineseName: item.chinese_name || '',
                config: item.config || [{ key: '流量比', value: '' }]
            }));
        } catch (e) {
            console.warn('从云端加载色卡失败:', e);
            return null;
        }
    },

    async saveCards(cards) {
        if (!this.isAvailable()) return false;
        try {
            const { error } = await supabase
                .from('cards')
                .upsert(cards.map(card => ({
                    id: card.id,
                    category: card.category,
                    manufacturer: card.manufacturer,
                    english_name: card.englishName,
                    material: card.material,
                    image: card.image,
                    chinese_name: card.chineseName,
                    config: card.config
                })), { onConflict: 'id' });
            
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('保存色卡到云端失败:', e);
            return false;
        }
    },

    async addCard(card) {
        if (!this.isAvailable()) return false;
        try {
            const { error } = await supabase
                .from('cards')
                .insert({
                    id: card.id,
                    category: card.category,
                    manufacturer: card.manufacturer,
                    english_name: card.englishName,
                    material: card.material,
                    image: card.image,
                    chinese_name: card.chineseName,
                    config: card.config
                });
            
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('添加色卡到云端失败:', e);
            return false;
        }
    },

    async updateCard(card) {
        if (!this.isAvailable()) return false;
        try {
            const { error } = await supabase
                .from('cards')
                .update({
                    category: card.category,
                    manufacturer: card.manufacturer,
                    english_name: card.englishName,
                    material: card.material,
                    image: card.image,
                    chinese_name: card.chineseName,
                    config: card.config
                })
                .eq('id', card.id);
            
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('更新色卡到云端失败:', e);
            return false;
        }
    },

    async deleteCard(cardId) {
        if (!this.isAvailable()) return false;
        try {
            const { error } = await supabase
                .from('cards')
                .delete()
                .eq('id', cardId);
            
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('从云端删除色卡失败:', e);
            return false;
        }
    },

    async loadMaterials() {
        if (!this.isAvailable()) return null;
        try {
            const { data, error } = await supabase
                .from('materials')
                .select('name')
                .order('id', { ascending: true });
            
            if (error) throw error;
            return data.map(item => item.name);
        } catch (e) {
            console.warn('从云端加载材料失败:', e);
            return null;
        }
    },

    async addMaterial(name) {
        if (!this.isAvailable()) return false;
        try {
            const { error } = await supabase
                .from('materials')
                .insert({ name });
            
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('添加材料到云端失败:', e);
            return false;
        }
    },

    async deleteMaterial(name) {
        if (!this.isAvailable()) return false;
        try {
            const { error } = await supabase
                .from('materials')
                .delete()
                .eq('name', name);
            
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('从云端删除材料失败:', e);
            return false;
        }
    },

    async loadManufacturers() {
        if (!this.isAvailable()) return null;
        try {
            const { data, error } = await supabase
                .from('manufacturers')
                .select('name')
                .order('id', { ascending: true });
            
            if (error) throw error;
            return data.map(item => item.name);
        } catch (e) {
            console.warn('从云端加载厂商失败:', e);
            return null;
        }
    },

    async addManufacturer(name) {
        if (!this.isAvailable()) return false;
        try {
            const { error } = await supabase
                .from('manufacturers')
                .insert({ name });
            
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('添加厂商到云端失败:', e);
            return false;
        }
    },

    async deleteManufacturer(name) {
        if (!this.isAvailable()) return false;
        try {
            const { error } = await supabase
                .from('manufacturers')
                .delete()
                .eq('name', name);
            
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('从云端删除厂商失败:', e);
            return false;
        }
    },

    async loadTemplate() {
        if (!this.isAvailable()) return null;
        try {
            const { data, error } = await supabase
                .from('template')
                .select('*')
                .order('id', { ascending: true })
                .limit(1);
            
            if (error) throw error;
            
            if (data && data.length > 0) {
                const item = data[0];
                return {
                    id: item.id,
                    manufacturer: item.manufacturer || '',
                    material: item.material || '',
                    config: item.config || defaultTemplate.config
                };
            }
            return null;
        } catch (e) {
            console.warn('从云端加载模板失败:', e);
            return null;
        }
    },

    async saveTemplate(template) {
        if (!this.isAvailable()) return false;
        try {
            const existing = await this.loadTemplate();
            
            if (existing && existing.id) {
                const { error } = await supabase
                    .from('template')
                    .update({
                        manufacturer: template.manufacturer,
                        material: template.material,
                        config: template.config
                    })
                    .eq('id', existing.id);
                
                if (error) throw error;
            } else {
                const { error } = await supabase
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
            console.warn('保存模板到云端失败:', e);
            return false;
        }
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
        this.comboboxes = {
            add: {
                input: null,
                list: null,
                combobox: null,
                value: ''
            },
            edit: {
                input: null,
                list: null,
                combobox: null,
                value: ''
            }
        };
        this.initComboboxes();
    }

    initComboboxes() {
        const addCombobox = document.getElementById('materialCombobox');
        const editCombobox = document.getElementById('editMaterialCombobox');
        
        if (addCombobox) {
            this.comboboxes.add = {
                input: document.getElementById('material'),
                list: document.getElementById('materialList'),
                combobox: addCombobox,
                toggle: document.getElementById('materialToggle'),
                value: ''
            };
            this.setupCombobox('add');
        }
        
        if (editCombobox) {
            this.comboboxes.edit = {
                input: document.getElementById('editMaterial'),
                list: document.getElementById('editMaterialList'),
                combobox: editCombobox,
                toggle: document.getElementById('editMaterialToggle'),
                value: ''
            };
            this.setupCombobox('edit');
        }
    }

    setupCombobox(type) {
        const cb = this.comboboxes[type];
        
        cb.toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown(type);
        });
        
        cb.input.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openDropdown(type);
        });
        
        cb.input.addEventListener('focus', () => {
            this.openDropdown(type);
        });
        
        document.addEventListener('click', (e) => {
            if (!cb.combobox.contains(e.target)) {
                this.closeDropdown(type);
            }
        });
    }

    toggleDropdown(type) {
        const cb = this.comboboxes[type];
        if (cb.combobox.classList.contains('open')) {
            this.closeDropdown(type);
        } else {
            this.openDropdown(type);
        }
    }

    openDropdown(type) {
        const cb = this.comboboxes[type];
        this.renderList(type);
        cb.combobox.classList.add('open');
    }

    closeDropdown(type) {
        this.comboboxes[type].combobox.classList.remove('open');
    }

    closeAllDropdowns() {
        Object.keys(this.comboboxes).forEach(type => {
            this.closeDropdown(type);
        });
    }

    renderList(type) {
        const cb = this.comboboxes[type];
        
        cb.list.innerHTML = '';
        
        if (this.materials.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'combobox-empty';
            empty.textContent = '暂无材料，请在后台管理添加';
            cb.list.appendChild(empty);
            return;
        }
        
        this.materials.forEach(material => {
            const item = document.createElement('div');
            item.className = 'combobox-item';
            if (material === cb.value) {
                item.classList.add('selected');
            }
            
            item.textContent = material;
            
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.select(type, material);
            });
            
            cb.list.appendChild(item);
        });
    }

    select(type, material) {
        const cb = this.comboboxes[type];
        cb.value = material;
        cb.input.value = material;
        this.closeDropdown(type);
    }

    add(material) {
        const trimmed = material.trim();
        if (!trimmed) return false;
        if (this.materials.includes(trimmed)) return false;
        this.materials.push(trimmed);
        Storage.saveMaterials(this.materials);
        this.refreshAllLists();
        
        CloudStorage.addMaterial(trimmed);
        
        return true;
    }

    remove(material) {
        const index = this.materials.indexOf(material);
        if (index > -1) {
            this.materials.splice(index, 1);
            Storage.saveMaterials(this.materials);
            
            Object.keys(this.comboboxes).forEach(type => {
                const cb = this.comboboxes[type];
                if (cb.value === material) {
                    cb.value = '';
                    cb.input.value = '';
                }
            });
            
            this.refreshAllLists();
            
            CloudStorage.deleteMaterial(material);
        }
    }

    async loadFromCloud() {
        const cloudMaterials = await CloudStorage.loadMaterials();
        if (cloudMaterials && cloudMaterials.length > 0) {
            this.materials = cloudMaterials;
            Storage.saveMaterials(this.materials);
            this.refreshAllLists();
        }
    }

    refreshAllLists() {
        Object.keys(this.comboboxes).forEach(type => {
            this.renderList(type);
        });
    }

    getValue(type) {
        const cb = this.comboboxes[type];
        if (!cb) return '';
        return cb.value || '';
    }

    setValue(type, value) {
        const cb = this.comboboxes[type];
        if (cb) {
            cb.value = value || '';
            cb.input.value = value || '';
        }
    }

    updateSelects() {
        this.refreshAllLists();
    }
}

class ManufacturerManager {
    constructor() {
        this.manufacturers = Storage.loadManufacturers();
        this.comboboxes = {
            add: {
                input: null,
                list: null,
                combobox: null,
                value: ''
            },
            edit: {
                input: null,
                list: null,
                combobox: null,
                value: ''
            }
        };
        this.initComboboxes();
    }

    initComboboxes() {
        const addCombobox = document.getElementById('manufacturerCombobox');
        const editCombobox = document.getElementById('editManufacturerCombobox');
        
        if (addCombobox) {
            this.comboboxes.add = {
                input: document.getElementById('manufacturer'),
                list: document.getElementById('manufacturerList'),
                combobox: addCombobox,
                toggle: document.getElementById('manufacturerToggle'),
                value: ''
            };
            this.setupCombobox('add');
        }
        
        if (editCombobox) {
            this.comboboxes.edit = {
                input: document.getElementById('editManufacturer'),
                list: document.getElementById('editManufacturerList'),
                combobox: editCombobox,
                toggle: document.getElementById('editManufacturerToggle'),
                value: ''
            };
            this.setupCombobox('edit');
        }
    }

    setupCombobox(type) {
        const cb = this.comboboxes[type];
        
        cb.toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown(type);
        });
        
        cb.input.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openDropdown(type);
        });
        
        cb.input.addEventListener('focus', () => {
            this.openDropdown(type);
        });
        
        document.addEventListener('click', (e) => {
            if (!cb.combobox.contains(e.target)) {
                this.closeDropdown(type);
            }
        });
    }

    toggleDropdown(type) {
        const cb = this.comboboxes[type];
        if (cb.combobox.classList.contains('open')) {
            this.closeDropdown(type);
        } else {
            this.openDropdown(type);
        }
    }

    openDropdown(type) {
        const cb = this.comboboxes[type];
        this.renderList(type);
        cb.combobox.classList.add('open');
    }

    closeDropdown(type) {
        this.comboboxes[type].combobox.classList.remove('open');
    }

    closeAllDropdowns() {
        Object.keys(this.comboboxes).forEach(type => {
            this.closeDropdown(type);
        });
    }

    renderList(type) {
        const cb = this.comboboxes[type];
        
        cb.list.innerHTML = '';
        
        if (this.manufacturers.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'combobox-empty';
            empty.textContent = '暂无厂商，请在后台管理添加';
            cb.list.appendChild(empty);
            return;
        }
        
        this.manufacturers.forEach(manufacturer => {
            const item = document.createElement('div');
            item.className = 'combobox-item';
            if (manufacturer === cb.value) {
                item.classList.add('selected');
            }
            
            item.textContent = manufacturer;
            
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.select(type, manufacturer);
            });
            
            cb.list.appendChild(item);
        });
    }

    select(type, manufacturer) {
        const cb = this.comboboxes[type];
        cb.value = manufacturer;
        cb.input.value = manufacturer;
        this.closeDropdown(type);
    }

    add(manufacturer) {
        const trimmed = manufacturer.trim();
        if (!trimmed) return false;
        if (this.manufacturers.includes(trimmed)) return false;
        this.manufacturers.push(trimmed);
        Storage.saveManufacturers(this.manufacturers);
        this.refreshAllLists();
        return true;
    }

    remove(manufacturer) {
        const index = this.manufacturers.indexOf(manufacturer);
        if (index > -1) {
            this.manufacturers.splice(index, 1);
            Storage.saveManufacturers(this.manufacturers);
            
            Object.keys(this.comboboxes).forEach(type => {
                const cb = this.comboboxes[type];
                if (cb.value === manufacturer) {
                    cb.value = '';
                    cb.input.value = '';
                }
            });
            
            this.refreshAllLists();
        }
    }

    refreshAllLists() {
        Object.keys(this.comboboxes).forEach(type => {
            this.renderList(type);
        });
    }

    getValue(type) {
        const cb = this.comboboxes[type];
        if (!cb) return '';
        return cb.value || '';
    }

    setValue(type, value) {
        const cb = this.comboboxes[type];
        if (cb) {
            cb.value = value || '';
            cb.input.value = value || '';
        }
    }

    updateSelects() {
        this.refreshAllLists();
    }
}

class AdminManager {
    constructor(materialManager, manufacturerManager) {
        this.materialManager = materialManager;
        this.manufacturerManager = manufacturerManager;
        this.currentTab = 'materials';
        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('adminBtn').addEventListener('click', () => this.open());
        document.getElementById('closeAdminModalBtn').addEventListener('click', () => this.close());
        
        document.getElementById('adminModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('adminModal')) {
                this.close();
            }
        });
        
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.getAttribute('data-tab'));
            });
        });
        
        document.getElementById('addNewMaterialBtn').addEventListener('click', () => this.addMaterial());
        document.getElementById('newMaterialInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addMaterial();
            }
        });
        
        document.getElementById('addNewManufacturerBtn').addEventListener('click', () => this.addManufacturer());
        document.getElementById('newManufacturerInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addManufacturer();
            }
        });
    }

    open() {
        document.getElementById('adminModal').style.display = 'block';
        this.renderMaterialsList();
        this.renderManufacturersList();
    }

    close() {
        document.getElementById('adminModal').style.display = 'none';
        document.getElementById('newMaterialInput').value = '';
        document.getElementById('newManufacturerInput').value = '';
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        document.querySelectorAll('.admin-tab').forEach(t => {
            t.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        
        document.getElementById('adminMaterialsTab').classList.toggle('hidden', tab !== 'materials');
        document.getElementById('adminManufacturersTab').classList.toggle('hidden', tab !== 'manufacturers');
        
        if (tab === 'materials') {
            this.renderMaterialsList();
        } else {
            this.renderManufacturersList();
        }
    }

    renderMaterialsList() {
        const list = document.getElementById('materialsList');
        const materials = this.materialManager.materials;
        
        if (materials.length === 0) {
            list.innerHTML = '<div class="admin-empty">还没有添加材料</div>';
            return;
        }
        
        list.innerHTML = '';
        materials.forEach((material, index) => {
            const item = document.createElement('div');
            item.className = 'admin-list-item';
            item.innerHTML = `
                <span class="admin-item-index">${index + 1}</span>
                <span class="admin-item-name">${material}</span>
                <button type="button" class="admin-item-delete" title="删除">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            `;
            
            item.querySelector('.admin-item-delete').addEventListener('click', () => {
                if (confirm(`确定要删除材料「${material}」吗？`)) {
                    this.materialManager.remove(material);
                    this.renderMaterialsList();
                }
            });
            
            list.appendChild(item);
        });
    }

    addMaterial() {
        const input = document.getElementById('newMaterialInput');
        const value = input.value.trim();
        
        if (!value) {
            input.focus();
            return;
        }
        
        if (this.materialManager.materials.includes(value)) {
            alert('该材料已存在');
            return;
        }
        
        if (this.materialManager.add(value)) {
            input.value = '';
            input.focus();
            this.renderMaterialsList();
        }
    }

    renderManufacturersList() {
        const list = document.getElementById('manufacturersList');
        const manufacturers = this.manufacturerManager.manufacturers;
        
        if (manufacturers.length === 0) {
            list.innerHTML = '<div class="admin-empty">还没有添加工厂商</div>';
            return;
        }
        
        list.innerHTML = '';
        manufacturers.forEach((manufacturer, index) => {
            const item = document.createElement('div');
            item.className = 'admin-list-item';
            item.innerHTML = `
                <span class="admin-item-index">${index + 1}</span>
                <span class="admin-item-name">${manufacturer}</span>
                <button type="button" class="admin-item-delete" title="删除">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            `;
            
            item.querySelector('.admin-item-delete').addEventListener('click', () => {
                if (confirm(`确定要删除厂商「${manufacturer}」吗？`)) {
                    this.manufacturerManager.remove(manufacturer);
                    this.renderManufacturersList();
                }
            });
            
            list.appendChild(item);
        });
    }

    addManufacturer() {
        const input = document.getElementById('newManufacturerInput');
        const value = input.value.trim();
        
        if (!value) {
            input.focus();
            return;
        }
        
        if (this.manufacturerManager.manufacturers.includes(value)) {
            alert('该厂商已存在');
            return;
        }
        
        if (this.manufacturerManager.add(value)) {
            input.value = '';
            input.focus();
            this.renderManufacturersList();
        }
    }
}

class ModalManager {
    constructor() {
        this.modals = {
            addCard: document.getElementById('addCardModal'),
            editCard: document.getElementById('editCardModal'),
            detailCard: document.getElementById('detailCardModal'),
            editTemplate: document.getElementById('editTemplateModal')
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
        this.currentSize = this.loadSize();
        this.cardsContainer = document.getElementById('cardsContainer');
        this.modalManager = new ModalManager();
        this.materialManager = new MaterialManager();
        this.manufacturerManager = new ManufacturerManager();
        this.adminManager = new AdminManager(this.materialManager, this.manufacturerManager);
        this.bindEvents();
        this.applySize();
    }

    bindEvents() {
        document.getElementById('addCardBtn').addEventListener('click', () => this.modalManager.open('addCard'));
        document.getElementById('templateBtn').addEventListener('click', () => this.showEditTemplate());
        
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
                this.filterCards(category);
            });
        });

        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = btn.getAttribute('data-size');
                this.changeSize(size);
            });
        });
    }

    loadSize() {
        const saved = localStorage.getItem(SIZE_KEY);
        if (saved && ['small', 'medium', 'large'].includes(saved)) {
            return saved;
        }
        return 'small';
    }

    saveSize(size) {
        localStorage.setItem(SIZE_KEY, size);
    }

    applySize() {
        this.cardsContainer.className = 'cards-container';
        
        if (this.currentSize === 'medium') {
            this.cardsContainer.classList.add('size-medium');
        } else if (this.currentSize === 'large') {
            this.cardsContainer.classList.add('size-large');
        }

        document.querySelectorAll('.size-btn').forEach(btn => {
            const size = btn.getAttribute('data-size');
            if (size === this.currentSize) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    changeSize(size) {
        if (this.currentSize === size) return;
        this.currentSize = size;
        this.saveSize(size);
        this.applySize();
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
        this.manufacturerManager.setValue('edit', card.manufacturer);
        this.materialManager.setValue('edit', card.material);
        document.getElementById('editCategory').value = card.category;

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
            const config = Utils.getConfigFromContainer(this.modalManager.configContainers.add);

            const newCard = {
                id: Date.now(),
                category: category,
                manufacturer: this.manufacturerManager.getValue('add'),
                englishName: document.getElementById('englishName').value,
                material: this.materialManager.getValue('add'),
                image: this.modalManager.previews.image.innerHTML 
                    ? this.modalManager.previews.image.querySelector('img').src 
                    : '',
                chineseName: document.getElementById('chineseName').value,
                config: config
            };

            this.cards.push(newCard);
            Storage.saveCards(this.cards);
            this.renderCards();
            this.modalManager.close('addCard');
            
            CloudStorage.addCard(newCard);
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

            const config = Utils.getConfigFromContainer(this.modalManager.configContainers.edit);

            this.cards[cardIndex] = {
                ...this.cards[cardIndex],
                category: document.getElementById('editCategory').value,
                manufacturer: this.manufacturerManager.getValue('edit'),
                englishName: document.getElementById('editEnglishName').value,
                material: this.materialManager.getValue('edit'),
                image: newImage,
                chineseName: document.getElementById('editChineseName').value,
                config: config
            };

            Storage.saveCards(this.cards);
            this.renderCards();
            this.modalManager.close('editCard');
            
            CloudStorage.updateCard(this.cards[cardIndex]);
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
            this.renderCards();
            this.modalManager.close('editCard');
            
            CloudStorage.deleteCard(this.currentEditingCard.id);
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

            if (confirm('确定要将模板配置应用到所有色卡吗？')) {
                this.applyTemplateToAllCards();
            }

            this.modalManager.close('editTemplate');
            
            CloudStorage.saveTemplate(this.template);
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
        this.renderCards();
        
        CloudStorage.saveCards(this.cards);
    }

    filterCards(category) {
        document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));

        const activeBtn = document.querySelector(`[data-category="${category}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        if (category === 'all') {
            this.renderCards(this.cards);
        } else {
            const filteredCards = this.cards.filter(card => card.category === category);
            this.renderCards(filteredCards);
        }
    }

    init() {
        this.migrateData();
        this.materialManager.updateSelects();
        this.filterCards('all');
        
        this.loadFromCloud();
    }

    async loadFromCloud() {
        if (!CloudStorage.isAvailable()) return;
        
        try {
            const [cloudCards, cloudMaterials, cloudManufacturers, cloudTemplate] = await Promise.all([
                CloudStorage.loadCards(),
                CloudStorage.loadMaterials(),
                CloudStorage.loadManufacturers(),
                CloudStorage.loadTemplate()
            ]);
            
            if (cloudCards && cloudCards.length > 0) {
                this.cards = cloudCards;
                Storage.saveCards(this.cards);
                this.renderCards();
            }
            
            if (cloudMaterials && cloudMaterials.length > 0) {
                this.materialManager.materials = cloudMaterials;
                Storage.saveMaterials(cloudMaterials);
                this.materialManager.refreshAllLists();
            }
            
            if (cloudManufacturers && cloudManufacturers.length > 0) {
                this.manufacturerManager.manufacturers = cloudManufacturers;
                Storage.saveManufacturers(cloudManufacturers);
                this.manufacturerManager.refreshAllLists();
            }
            
            if (cloudTemplate) {
                this.template = {
                    manufacturer: cloudTemplate.manufacturer || '',
                    material: cloudTemplate.material || '',
                    config: cloudTemplate.config || defaultTemplate.config
                };
                Storage.saveTemplate(this.template);
            }
            
            console.log('云端数据同步完成');
        } catch (e) {
            console.warn('从云端加载数据失败:', e);
        }
    }

    migrateData() {
        const savedVersion = localStorage.getItem(VERSION_KEY);
        
        if (savedVersion === CURRENT_VERSION) {
            return;
        }
        
        this.cards = this.cards.map(card => {
            const newCard = { ...card };
            
            if (typeof newCard.config === 'string') {
                newCard.config = Utils.parseConfig(newCard.config);
            }
            
            if (!newCard.config || !Array.isArray(newCard.config)) {
                newCard.config = [{ key: '流量比', value: '' }];
            }
            
            if (!newCard.id) {
                newCard.id = Date.now() + Math.random();
            }
            
            if (!newCard.image) {
                newCard.image = '';
            }
            
            return newCard;
        });
        
        if (!this.template.config || !Array.isArray(this.template.config)) {
            this.template.config = [{ key: '流量比', value: '' }];
        }
        
        Storage.saveCards(this.cards);
        Storage.saveTemplate(this.template);
        Storage.saveMaterials(this.materialManager.materials);
        Storage.saveManufacturers(this.manufacturerManager.manufacturers);
        
        localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const cardManager = new CardManager();
    cardManager.init();
});