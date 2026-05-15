// ============================================
// STATSNAP - Professional Creative Editor
// Complete Layer-Based Editing System
// ============================================

class StatsnapEditor {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.brushCanvas = document.getElementById('brushCanvas');
        this.layers = [];
        this.selectedLayer = null;
        this.currentMode = 'design';
        this.layerIdCounter = 0;
        this.isDragging = false;
        this.isResizing = false;
        this.isBrushing = false;
        this.currentBrushType = null; // 'paint' or 'blur'
        this.brushColor = '#000000';
        this.brushSize = 30;
        this.dragStartPos = { x: 0, y: 0 };
        this.initialLayerState = null;
        
        // Undo/Redo
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50;
        this.saveTimeout = null;
        
        // Auto-save
        this.autoSaveInterval = null;
        this.db = null;
        
        // Color palette
        this.colorPalette = [
            '#000000', '#ffffff', '#ef4444', '#f97316', '#f59e0b', '#eab308',
            '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
            '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
            '#f43f5e', '#78716c', '#6b7280', '#374151', '#1f2937', '#111827',
            '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706',
            '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a',
            '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb'
        ];
        
        this.init();
    }
    
    async init() {
        this.setupTheme();
        this.setupEventListeners();
        this.setupBrushCanvas();
        this.setupColorPalette();
        await this.initDatabase();
        await this.loadProject();
        this.startAutoSave();
        this.updateUndoRedoButtons();
    }
    
    setupTheme() {
        const savedTheme = localStorage.getItem('statsnap-theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }
    
    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('statsnap-theme', next);
    }
    
    setupBrushCanvas() {
        this.brushCanvas.width = this.canvas.offsetWidth;
        this.brushCanvas.height = this.canvas.offsetHeight;
        this.brushCanvas.style.position = 'absolute';
        this.brushCanvas.style.top = '0';
        this.brushCanvas.style.left = '0';
        this.brushCanvas.style.pointerEvents = 'none';
        this.brushCanvas.style.zIndex = '998';
        this.canvas.appendChild(this.brushCanvas);
    }
    
    setupColorPalette() {
        const colorGrid = document.getElementById('colorGrid');
        if (!colorGrid) return;
        
        colorGrid.innerHTML = '';
        this.colorPalette.forEach(color => {
            const swatch = document.createElement('div');
            swatch.classList.add('color-swatch');
            swatch.style.backgroundColor = color;
            swatch.addEventListener('click', () => {
                this.brushColor = color;
                document.getElementById('customColorInput').value = color;
                document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
                swatch.classList.add('selected');
            });
            colorGrid.appendChild(swatch);
        });
    }
    
    setupEventListeners() {
        // Mode switching
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchMode(e.target.dataset.mode);
            });
        });
        
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        
        // Undo/Redo buttons
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
        
        // Close panel
        document.getElementById('closePanel').addEventListener('click', () => this.closeSlidePanel());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                this.redo();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.selectedLayer && document.activeElement === document.body) {
                    this.deleteSelectedLayer();
                }
            } else if (e.key === 'Escape') {
                this.stopBrushing();
                this.closeSlidePanel();
                this.deselectAllLayers();
            }
        });
        
        // Tool actions
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.dataset.action;
                this.handleToolAction(action, btn);
            });
        });
        
        // Canvas click to deselect
        this.canvas.addEventListener('pointerdown', (e) => {
            if (e.target === this.canvas) {
                this.stopBrushing();
                this.deselectAllLayers();
            }
        });
        
        // Brush events on canvas
        this.canvas.addEventListener('pointerdown', (e) => this.handleBrushStart(e));
        this.canvas.addEventListener('pointermove', (e) => this.handleBrushMove(e));
        this.canvas.addEventListener('pointerup', () => this.handleBrushEnd());
        this.canvas.addEventListener('pointerleave', () => this.handleBrushEnd());
        
        // Custom color input
        const customColorInput = document.getElementById('customColorInput');
        if (customColorInput) {
            customColorInput.addEventListener('input', (e) => {
                this.brushColor = e.target.value;
            });
        }
    }
    
    switchMode(mode) {
        if (this.currentMode === mode) return;
        this.stopBrushing();
        this.currentMode = mode;
        
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        this.deselectAllLayers();
        this.updateContextualTools();
        this.showToast(`${mode.charAt(0).toUpperCase() + mode.slice(1)} mode`);
    }
    
    // =============== TOOL HANDLING ===============
    
    handleToolAction(action, btn) {
        // Toggle brush tools
        if (action === 'paintBrush') {
            this.toggleBrushTool('paint', btn);
            return;
        }
        if (action === 'blurBrush') {
            this.toggleBrushTool('blur', btn);
            return;
        }
        
        this.stopBrushing();
        
        switch(action) {
            case 'addText': this.addTextLayer(); break;
            case 'addImage': this.addImageLayer(); break;
            case 'addShape': this.addShapeLayer(); break;
            case 'changeBackground': this.changeBackground(); break;
            case 'exportImage': this.exportCanvas(); break;
            case 'deleteLayer': this.deleteSelectedLayer(); break;
            case 'textColor': this.openColorPicker('text'); break;
            case 'textBold': this.openBoldnessSlider(); break;
            case 'textAlign': this.openTextAlignPanel(); break;
            case 'dropShadow': this.openDropShadowPanel(); break;
            case 'imageAdjust': this.openImageAdjustPanel(); break;
            case 'imageFilter': this.openImageFilterPanel(); break;
            case 'shapeColor': this.openColorPicker('shape'); break;
            case 'shapeBorder': this.openShapeBorderPanel(); break;
        }
    }
    
    toggleBrushTool(type, btn) {
        if (this.currentBrushType === type) {
            this.stopBrushing();
            return;
        }
        
        this.stopBrushing();
        this.currentBrushType = type;
        btn.classList.add('active-tool');
        
        if (type === 'paint') {
            this.showColorPickerPopup();
        }
        
        this.showBrushSizeSlider();
        this.brushCanvas.style.pointerEvents = 'auto';
        this.showToast(`${type === 'paint' ? 'Paint' : 'Blur'} brush activated`);
    }
    
    stopBrushing() {
        this.currentBrushType = null;
        this.isBrushing = false;
        this.brushCanvas.style.pointerEvents = 'none';
        this.hideBrushIndicator();
        this.hideColorPickerPopup();
        
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active-tool'));
        this.closeSlidePanel();
    }
    
    // =============== BRUSH SYSTEM ===============
    
    handleBrushStart(e) {
        if (!this.currentBrushType) return;
        if (e.target === this.canvas || e.target === this.brushCanvas || e.target.closest('.layer')) {
            this.isBrushing = true;
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.lastBrushPos = { x, y };
            this.brushPoints = [{ x, y }];
            this.showBrushIndicator(e.clientX, e.clientY);
        }
    }
    
    handleBrushMove(e) {
        if (!this.isBrushing || !this.currentBrushType) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.showBrushIndicator(e.clientX, e.clientY);
        this.brushPoints.push({ x, y });
        
        // Draw on brush canvas
        const ctx = this.brushCanvas.getContext('2d');
        ctx.globalCompositeOperation = this.currentBrushType === 'paint' ? 'source-over' : 'destination-over';
        
        if (this.currentBrushType === 'paint') {
            this.drawPaintStroke(ctx, this.lastBrushPos, { x, y });
        } else if (this.currentBrushType === 'blur') {
            this.drawBlurStroke(ctx, this.lastBrushPos, { x, y });
        }
        
        this.lastBrushPos = { x, y };
    }
    
    handleBrushEnd() {
        if (!this.isBrushing) return;
        this.isBrushing = false;
        this.hideBrushIndicator();
        
        // Apply brush effect to selected layer or canvas
        if (this.brushPoints && this.brushPoints.length > 0) {
            this.applyBrushEffect();
        }
        
        this.brushPoints = [];
        
        // Clear brush canvas
        const ctx = this.brushCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.brushCanvas.width, this.brushCanvas.height);
    }
    
    drawPaintStroke(ctx, from, to) {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = this.brushColor;
        ctx.lineWidth = this.brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }
    
    drawBlurStroke(ctx, from, to) {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = this.brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.filter = `blur(${this.brushSize / 4}px)`;
        ctx.stroke();
        ctx.filter = 'none';
    }
    
    applyBrushEffect() {
        if (!this.selectedLayer || this.selectedLayer.dataset.type !== 'image') return;
        
        const img = this.selectedLayer.querySelector('img');
        if (!img) return;
        
        // Create a canvas to apply the effect
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.selectedLayer.offsetWidth;
        tempCanvas.height = this.selectedLayer.offsetHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw the image
        tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
        
        if (this.currentBrushType === 'paint') {
            // Apply paint strokes
            const brushCtx = this.brushCanvas.getContext('2d');
            tempCtx.drawImage(this.brushCanvas, 0, 0);
        } else if (this.currentBrushType === 'blur') {
            // Apply blur to brushed areas using a mask
            const blurCanvas = document.createElement('canvas');
            blurCanvas.width = tempCanvas.width;
            blurCanvas.height = tempCanvas.height;
            const blurCtx = blurCanvas.getContext('2d');
            blurCtx.filter = `blur(${this.brushSize / 2}px)`;
            blurCtx.drawImage(img, 0, 0, blurCanvas.width, blurCanvas.height);
            
            // Create mask from brush strokes
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = tempCanvas.width;
            maskCanvas.height = tempCanvas.height;
            const maskCtx = maskCanvas.getContext('2d');
            maskCtx.drawImage(this.brushCanvas, 0, 0);
            
            // Composite: blurred image where mask is, original elsewhere
            tempCtx.globalCompositeOperation = 'destination-out';
            tempCtx.drawImage(maskCanvas, 0, 0);
            tempCtx.globalCompositeOperation = 'destination-over';
            tempCtx.drawImage(blurCanvas, 0, 0);
        }
        
        // Update the image
        img.src = tempCanvas.toDataURL();
        this.saveState();
        this.scheduleAutoSave();
    }
    
    showBrushIndicator(x, y) {
        let indicator = document.querySelector('.brush-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.classList.add('brush-indicator');
            document.body.appendChild(indicator);
        }
        indicator.style.display = 'block';
        indicator.style.left = x + 'px';
        indicator.style.top = y + 'px';
        indicator.style.width = this.brushSize + 'px';
        indicator.style.height = this.brushSize + 'px';
    }
    
    hideBrushIndicator() {
        const indicator = document.querySelector('.brush-indicator');
        if (indicator) indicator.style.display = 'none';
    }
    
    showBrushSizeSlider() {
        const content = document.getElementById('panelContent');
        document.getElementById('panelTitle').textContent = 'Brush Size';
        
        content.innerHTML = `
            <div class="control-group">
                <div class="control-label">
                    <span>Size</span>
                    <span class="control-value" id="brushSizeValue">${this.brushSize}px</span>
                </div>
                <input type="range" id="brushSizeSlider" min="5" max="100" value="${this.brushSize}">
            </div>
        `;
        
        this.openSlidePanel();
        
        document.getElementById('brushSizeSlider').addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            document.getElementById('brushSizeValue').textContent = this.brushSize + 'px';
        });
    }
    
    // =============== LAYER MANAGEMENT ===============
    
    addTextLayer(text = 'Double tap to edit') {
        const layer = this.createLayer('text');
        layer.innerHTML = text;
        layer.setAttribute('contenteditable', 'true');
        layer.setAttribute('data-placeholder', 'Type here...');
        layer.classList.add('text-layer');
        
        this.centerLayer(layer);
        
        layer.addEventListener('dblclick', () => layer.focus());
        layer.addEventListener('input', () => this.scheduleAutoSave());
        
        this.addLayerToCanvas(layer);
        this.selectLayer(layer);
        this.saveState();
    }
    
    addImageLayer(imageUrl = null) {
        if (imageUrl) {
            this.createImageLayerFromUrl(imageUrl);
        } else {
            this.promptImageUpload();
        }
    }
    
    promptImageUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        
        input.addEventListener('change', (e) => {
            Array.from(e.target.files).forEach(file => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.createImageLayerFromUrl(event.target.result);
                };
                reader.readAsDataURL(file);
            });
        });
        
        input.click();
    }
    
    createImageLayerFromUrl(url) {
        const layer = this.createLayer('image');
        layer.classList.add('image-layer');
        
        const img = document.createElement('img');
        img.src = url;
        img.draggable = false;
        img.style.filter = 'none';
        img.dataset.originalSrc = url;
        layer.appendChild(img);
        
        // Set initial size based on image
        img.onload = () => {
            const maxDim = 300;
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            if (w > maxDim) {
                h = (maxDim / w) * h;
                w = maxDim;
            }
            layer.style.width = w + 'px';
            layer.style.height = h + 'px';
        };
        
        this.centerLayer(layer);
        this.addLayerToCanvas(layer);
        this.selectLayer(layer);
        this.saveState();
    }
    
    addShapeLayer(shape = 'rectangle') {
        const layer = this.createLayer('shape');
        layer.classList.add('shape-layer');
        layer.style.background = '#6366f1';
        layer.style.width = '120px';
        layer.style.height = '120px';
        layer.style.borderRadius = shape === 'circle' ? '50%' : '8px';
        
        this.centerLayer(layer);
        this.addLayerToCanvas(layer);
        this.selectLayer(layer);
        this.saveState();
    }
    
    createLayer(type) {
        const layer = document.createElement('div');
        const id = `layer-${++this.layerIdCounter}`;
        layer.id = id;
        layer.classList.add('layer');
        layer.dataset.type = type;
        layer.dataset.zIndex = this.layers.length + 1;
        layer.style.zIndex = this.layers.length + 1;
        
        this.addResizeHandles(layer);
        this.addRotateHandle(layer);
        this.setupDragHandlers(layer);
        
        layer.addEventListener('pointerdown', (e) => {
            if (this.isBrushing) return;
            e.stopPropagation();
            this.selectLayer(layer);
        });
        
        return layer;
    }
    
    addResizeHandles(layer) {
        const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'left-center', 'right-center'];
        positions.forEach(pos => {
            const handle = document.createElement('div');
            handle.classList.add('resize-handle', pos);
            handle.dataset.position = pos;
            this.setupResizeHandlers(handle, layer);
            layer.appendChild(handle);
        });
    }
    
    addRotateHandle(layer) {
        const handle = document.createElement('div');
        handle.classList.add('rotate-handle');
        handle.innerHTML = '↻';
        this.setupRotateHandlers(handle, layer);
        layer.appendChild(handle);
    }
    
    setupDragHandlers(layer) {
        let startX, startY, initialLeft, initialTop;
        
        layer.addEventListener('pointerdown', (e) => {
            if (this.isBrushing) return;
            if (e.target === layer || e.target.classList.contains('text-layer') || e.target.tagName === 'IMG') {
                this.isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                initialLeft = parseInt(layer.style.left) || 0;
                initialTop = parseInt(layer.style.top) || 0;
                
                layer.setPointerCapture(e.pointerId);
                layer.classList.add('dragging');
                this.dragStartPos = { left: initialLeft, top: initialTop };
            }
        });
        
        layer.addEventListener('pointermove', (e) => {
            if (!this.isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            layer.style.left = `${initialLeft + dx}px`;
            layer.style.top = `${initialTop + dy}px`;
        });
        
        layer.addEventListener('pointerup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                layer.classList.remove('dragging');
                
                const currentLeft = parseInt(layer.style.left) || 0;
                const currentTop = parseInt(layer.style.top) || 0;
                
                if (currentLeft !== this.dragStartPos.left || currentTop !== this.dragStartPos.top) {
                    this.saveState();
                    this.scheduleAutoSave();
                }
            }
        });
    }
    
    setupResizeHandlers(handle, layer) {
        handle.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.isResizing = true;
            handle.setPointerCapture(e.pointerId);
            
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = layer.offsetWidth;
            const startHeight = layer.offsetHeight;
            const startLeft = parseInt(layer.style.left) || 0;
            const startTop = parseInt(layer.style.top) || 0;
            const position = handle.dataset.position;
            
            const onMove = (e) => {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                let newWidth = startWidth, newHeight = startHeight;
                let newLeft = startLeft, newTop = startTop;
                
                switch(position) {
                    case 'bottom-right':
                        newWidth = Math.max(30, startWidth + dx);
                        newHeight = Math.max(30, startHeight + dy);
                        break;
                    case 'bottom-left':
                        newWidth = Math.max(30, startWidth - dx);
                        newHeight = Math.max(30, startHeight + dy);
                        newLeft = startLeft + dx;
                        break;
                    case 'top-right':
                        newWidth = Math.max(30, startWidth + dx);
                        newHeight = Math.max(30, startHeight - dy);
                        newTop = startTop + dy;
                        break;
                    case 'top-left':
                        newWidth = Math.max(30, startWidth - dx);
                        newHeight = Math.max(30, startHeight - dy);
                        newLeft = startLeft + dx;
                        newTop = startTop + dy;
                        break;
                    case 'bottom-center':
                        newHeight = Math.max(30, startHeight + dy);
                        break;
                    case 'top-center':
                        newHeight = Math.max(30, startHeight - dy);
                        newTop = startTop + dy;
                        break;
                    case 'right-center':
                        newWidth = Math.max(30, startWidth + dx);
                        break;
                    case 'left-center':
                        newWidth = Math.max(30, startWidth - dx);
                        newLeft = startLeft + dx;
                        break;
                }
                
                layer.style.width = `${newWidth}px`;
                layer.style.height = `${newHeight}px`;
                layer.style.left = `${newLeft}px`;
                layer.style.top = `${newTop}px`;
            };
            
            const onUp = () => {
                this.isResizing = false;
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                this.saveState();
                this.scheduleAutoSave();
            };
            
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });
    }
    
    setupRotateHandlers(handle, layer) {
        handle.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            handle.setPointerCapture(e.pointerId);
            
            const rect = layer.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            let startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
            const currentRotation = parseFloat(layer.dataset.rotation || 0);
            
            const onMove = (e) => {
                const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
                const rotation = currentRotation + (currentAngle - startAngle) * (180 / Math.PI);
                layer.style.transform = `rotate(${rotation}deg)`;
                layer.dataset.rotation = rotation;
            };
            
            const onUp = () => {
                document.removeEventListener('pointermove', onMove);
                document.removeEventListener('pointerup', onUp);
                this.saveState();
                this.scheduleAutoSave();
            };
            
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', onUp);
        });
    }
    
    addLayerToCanvas(layer) {
        this.canvas.appendChild(layer);
        this.layers.push(layer);
        this.updateEmptyState();
        this.updateContextualTools();
    }
    
    selectLayer(layer) {
        this.deselectAllLayers();
        layer.classList.add('selected');
        this.selectedLayer = layer;
        this.updateContextualTools();
    }
    
    deselectAllLayers() {
        this.layers.forEach(l => l.classList.remove('selected'));
        this.selectedLayer = null;
        this.updateContextualTools();
    }
    
    deleteSelectedLayer() {
        if (!this.selectedLayer) return;
        const layer = this.selectedLayer;
        layer.remove();
        this.layers = this.layers.filter(l => l !== layer);
        this.selectedLayer = null;
        this.updateEmptyState();
        this.updateContextualTools();
        this.saveState();
        this.scheduleAutoSave();
        this.showToast('Layer deleted');
    }
    
    centerLayer(layer) {
        const canvasW = this.canvas.offsetWidth;
        const canvasH = this.canvas.offsetHeight;
        const layerW = parseInt(layer.style.width) || 120;
        const layerH = parseInt(layer.style.height) || 120;
        layer.style.left = `${(canvasW - layerW) / 2}px`;
        layer.style.top = `${(canvasH - layerH) / 2}px`;
    }
    
    updateEmptyState() {
        document.getElementById('emptyState').style.display = this.layers.length === 0 ? 'block' : 'none';
    }
    
    updateContextualTools() {
        document.querySelectorAll('.tool-group').forEach(g => g.classList.remove('active'));
        
        if (!this.selectedLayer) {
            document.getElementById('defaultTools').classList.add('active');
        } else {
            const type = this.selectedLayer.dataset.type;
            switch(type) {
                case 'text': document.getElementById('textTools').classList.add('active'); break;
                case 'image': document.getElementById('imageTools').classList.add('active'); break;
                case 'shape': document.getElementById('shapeTools').classList.add('active'); break;
            }
        }
    }
    
    // =============== SLIDE PANEL ===============
    
    openSlidePanel() {
        document.getElementById('slidePanel').classList.add('open');
    }
    
    closeSlidePanel() {
        document.getElementById('slidePanel').classList.remove('open');
    }
    
    // =============== COLOR PICKER ===============
    
    openColorPicker(target) {
        const content = document.getElementById('panelContent');
        document.getElementById('panelTitle').textContent = 'Choose Color';
        
        content.innerHTML = `
            <div class="color-grid" id="panelColorGrid"></div>
            <input type="color" id="panelColorInput" value="${this.brushColor}" style="width:100%;height:40px;margin-top:8px;">
        `;
        
        this.openSlidePanel();
        
        const grid = document.getElementById('panelColorGrid');
        this.colorPalette.forEach(color => {
            const swatch = document.createElement('div');
            swatch.classList.add('color-swatch');
            swatch.style.backgroundColor = color;
            swatch.addEventListener('click', () => {
                const colorValue = color;
                document.getElementById('panelColorInput').value = colorValue;
                if (target === 'text' && this.selectedLayer) {
                    this.selectedLayer.style.color = colorValue;
                } else if (target === 'shape' && this.selectedLayer) {
                    this.selectedLayer.style.background = colorValue;
                }
                this.scheduleAutoSave();
            });
            grid.appendChild(swatch);
        });
        
        document.getElementById('panelColorInput').addEventListener('input', (e) => {
            if (target === 'text' && this.selectedLayer) {
                this.selectedLayer.style.color = e.target.value;
            } else if (target === 'shape' && this.selectedLayer) {
                this.selectedLayer.style.background = e.target.value;
            }
            this.scheduleAutoSave();
        });
    }
    
    showColorPickerPopup() {
        const popup = document.getElementById('colorPickerPopup');
        popup.style.display = 'block';
        popup.style.top = '50%';
        popup.style.left = '50%';
        popup.style.transform = 'translate(-50%, -50%)';
        
        document.getElementById('customColorInput').addEventListener('input', (e) => {
            this.brushColor = e.target.value;
        });
    }
    
    hideColorPickerPopup() {
        document.getElementById('colorPickerPopup').style.display = 'none';
    }
    
    // =============== TEXT TOOLS ===============
    
    openBoldnessSlider() {
        if (!this.selectedLayer) return;
        const content = document.getElementById('panelContent');
        document.getElementById('panelTitle').textContent = 'Text Boldness';
        
        const currentWeight = parseInt(this.selectedLayer.style.fontWeight) || 400;
        
        content.innerHTML = `
            <div class="control-group">
                <div class="control-label">
                    <span>Weight</span>
                    <span class="control-value" id="boldValue">${currentWeight}</span>
                </div>
                <input type="range" id="boldSlider" min="100" max="900" step="100" value="${currentWeight}">
            </div>
        `;
        
        this.openSlidePanel();
        
        document.getElementById('boldSlider').addEventListener('input', (e) => {
            const val = e.target.value;
            this.selectedLayer.style.fontWeight = val;
            document.getElementById('boldValue').textContent = val;
            this.scheduleAutoSave();
        });
    }
    
    openTextAlignPanel() {
        if (!this.selectedLayer) return;
        const content = document.getElementById('panelContent');
        document.getElementById('panelTitle').textContent = 'Text Alignment';
        
        const aligns = ['left', 'center', 'right', 'justify'];
        content.innerHTML = `
            <div style="display:flex;gap:8px;">
                ${aligns.map(a => `
                    <button class="panel-btn" data-align="${a}" style="flex:1;">
                        ${a.charAt(0).toUpperCase() + a.slice(1)}
                    </button>
                `).join('')}
            </div>
        `;
        
        this.openSlidePanel();
        
        content.querySelectorAll('.panel-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedLayer.style.textAlign = btn.dataset.align;
                this.closeSlidePanel();
                this.scheduleAutoSave();
            });
        });
    }
    
    openDropShadowPanel() {
        if (!this.selectedLayer) return;
        const content = document.getElementById('panelContent');
        document.getElementById('panelTitle').textContent = 'Drop Shadow';
        
        content.innerHTML = `
            <div class="control-group">
                <div class="control-label"><span>Offset X</span><span class="control-value" id="shadowXVal">2px</span></div>
                <input type="range" id="shadowX" min="0" max="20" value="2">
            </div>
            <div class="control-group">
                <div class="control-label"><span>Offset Y</span><span class="control-value" id="shadowYVal">2px</span></div>
                <input type="range" id="shadowY" min="0" max="20" value="2">
            </div>
            <div class="control-group">
                <div class="control-label"><span>Blur</span><span class="control-value" id="shadowBlurVal">4px</span></div>
                <input type="range" id="shadowBlur" min="0" max="30" value="4">
            </div>
            <div class="control-group">
                <label>Shadow Color</label>
                <input type="color" id="shadowColor" value="#000000" style="width:100%;height:40px;">
            </div>
            <button class="panel-btn primary" id="applyShadow" style="width:100%;margin-top:8px;">Apply Shadow</button>
            <button class="panel-btn" id="removeShadow" style="width:100%;margin-top:4px;">Remove Shadow</button>
        `;
        
        this.openSlidePanel();
        
        const updateShadow = () => {
            const x = document.getElementById('shadowX').value;
            const y = document.getElementById('shadowY').value;
            const blur = document.getElementById('shadowBlur').value;
            const color = document.getElementById('shadowColor').value;
            this.selectedLayer.style.filter = `drop-shadow(${x}px ${y}px ${blur}px ${color})`;
            document.getElementById('shadowXVal').textContent = x + 'px';
            document.getElementById('shadowYVal').textContent = y + 'px';
            document.getElementById('shadowBlurVal').textContent = blur + 'px';
        };
        
        ['shadowX', 'shadowY', 'shadowBlur', 'shadowColor'].forEach(id => {
            document.getElementById(id).addEventListener('input', updateShadow);
        });
        
        document.getElementById('applyShadow').addEventListener('click', () => {
            updateShadow();
            this.saveState();
            this.scheduleAutoSave();
            this.closeSlidePanel();
        });
        
        document.getElementById('removeShadow').addEventListener('click', () => {
            this.selectedLayer.style.filter = 'none';
            this.saveState();
            this.scheduleAutoSave();
            this.closeSlidePanel();
        });
    }
    
    // =============== IMAGE ADJUSTMENTS ===============
    
    openImageAdjustPanel() {
        if (!this.selectedLayer || this.selectedLayer.dataset.type !== 'image') return;
        
        const img = this.selectedLayer.querySelector('img');
        if (!img) return;
        
        const content = document.getElementById('panelContent');
        document.getElementById('panelTitle').textContent = 'Image Adjustments';
        
        const adjustments = [
            { id: 'brightness', name: 'Brightness', min: 0, max: 200, value: 100, unit: '%' },
            { id: 'contrast', name: 'Contrast', min: 0, max: 200, value: 100, unit: '%' },
            { id: 'saturation', name: 'Saturation', min: 0, max: 200, value: 100, unit: '%' },
            { id: 'hue', name: 'Hue Rotate', min: 0, max: 360, value: 0, unit: '°' },
            { id: 'opacity', name: 'Opacity', min: 0, max: 100, value: 100, unit: '%' }
        ];
        
        content.innerHTML = adjustments.map(adj => `
            <div class="control-group">
                <div class="control-label">
                    <span>${adj.name}</span>
                    <span class="control-value" id="${adj.id}Val">${adj.value}${adj.unit}</span>
                </div>
                <input type="range" id="${adj.id}Slider" min="${adj.min}" max="${adj.max}" value="${adj.value}">
            </div>
        `).join('') + `
            <button class="panel-btn primary" id="applyAdjustments" style="width:100%;margin-top:8px;">Apply</button>
            <button class="panel-btn" id="resetAdjustments" style="width:100%;margin-top:4px;">Reset</button>
        `;
        
        this.openSlidePanel();
        
        const applyFilters = () => {
            const brightness = document.getElementById('brightnessSlider').value;
            const contrast = document.getElementById('contrastSlider').value;
            const saturation = document.getElementById('saturationSlider').value;
            const hue = document.getElementById('hueSlider').value;
            const opacity = document.getElementById('opacitySlider').value;
            
            img.style.filter = `
                brightness(${brightness}%)
                contrast(${contrast}%)
                saturate(${saturation}%)
                hue-rotate(${hue}deg)
            `;
            this.selectedLayer.style.opacity = opacity / 100;
            
            document.getElementById('brightnessVal').textContent = brightness + '%';
            document.getElementById('contrastVal').textContent = contrast + '%';
            document.getElementById('saturationVal').textContent = saturation + '%';
            document.getElementById('hueVal').textContent = hue + '°';
            document.getElementById('opacityVal').textContent = opacity + '%';
        };
        
        // Live preview
        ['brightness', 'contrast', 'saturation', 'hue', 'opacity'].forEach(id => {
            document.getElementById(id + 'Slider').addEventListener('input', applyFilters);
        });
        
        document.getElementById('applyAdjustments').addEventListener('click', () => {
            this.saveState();
            this.scheduleAutoSave();
            this.closeSlidePanel();
        });
        
        document.getElementById('resetAdjustments').addEventListener('click', () => {
            img.style.filter = 'none';
            this.selectedLayer.style.opacity = '1';
            this.saveState();
            this.scheduleAutoSave();
            this.closeSlidePanel();
        });
    }
    
    openImageFilterPanel() {
        if (!this.selectedLayer || this.selectedLayer.dataset.type !== 'image') return;
        
        const img = this.selectedLayer.querySelector('img');
        if (!img) return;
        
        const content = document.getElementById('panelContent');
        document.getElementById('panelTitle').textContent = 'Filters';
        
        const filters = [
            { name: 'Original', filter: 'none' },
            { name: 'Grayscale', filter: 'grayscale(100%)' },
            { name: 'Sepia', filter: 'sepia(100%)' },
            { name: 'Vintage', filter: 'sepia(50%) contrast(80%) brightness(90%)' },
            { name: 'Cool', filter: 'hue-rotate(180deg) saturate(80%)' },
            { name: 'Warm', filter: 'saturate(150%) hue-rotate(-20deg)' },
            { name: 'Dramatic', filter: 'contrast(150%) brightness(80%)' },
            { name: 'Fade', filter: 'brightness(120%) saturate(70%) contrast(90%)' }
        ];
        
        content.innerHTML = `
            <div class="filter-grid">
                ${filters.map((f, i) => `
                    <div class="filter-item" data-filter="${f.filter}">
                        <div style="background:#6366f1;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;text-align:center;padding:4px;">
                            ${f.name}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        this.openSlidePanel();
        
        content.querySelectorAll('.filter-item').forEach(item => {
            item.addEventListener('click', () => {
                img.style.filter = item.dataset.filter === 'none' ? '' : item.dataset.filter;
                img.dataset.currentFilter = item.dataset.filter;
                this.saveState();
                this.scheduleAutoSave();
                this.closeSlidePanel();
            });
        });
    }
    
    // =============== SHAPE TOOLS ===============
    
    openShapeBorderPanel() {
        if (!this.selectedLayer) return;
        const content = document.getElementById('panelContent');
        document.getElementById('panelTitle').textContent = 'Border';
        
        content.innerHTML = `
            <div class="control-group">
                <div class="control-label"><span>Width</span><span class="control-value" id="borderWidthVal">0px</span></div>
                <input type="range" id="borderWidth" min="0" max="20" value="0">
            </div>
            <label>Border Color</label>
            <input type="color" id="borderColor" value="#000000" style="width:100%;height:40px;">
            <button class="panel-btn primary" id="applyBorder" style="width:100%;margin-top:8px;">Apply</button>
        `;
        
        this.openSlidePanel();
        
        document.getElementById('borderWidth').addEventListener('input', (e) => {
            document.getElementById('borderWidthVal').textContent = e.target.value + 'px';
        });
        
        document.getElementById('applyBorder').addEventListener('click', () => {
            const width = document.getElementById('borderWidth').value;
            const color = document.getElementById('borderColor').value;
            this.selectedLayer.style.border = `${width}px solid ${color}`;
            this.saveState();
            this.scheduleAutoSave();
            this.closeSlidePanel();
        });
    }
    
    // =============== BACKGROUND ===============
    
    changeBackground() {
        const content = document.getElementById('panelContent');
        document.getElementById('panelTitle').textContent = 'Canvas Background';
        
        content.innerHTML = `
            <div class="color-grid" id="bgColorGrid"></div>
            <input type="color" id="bgColorInput" value="#ffffff" style="width:100%;height:40px;margin-top:8px;">
            <button class="panel-btn" id="bgImageBtn" style="width:100%;margin-top:8px;">📷 Set Background Image</button>
        `;
        
        this.openSlidePanel();
        
        const grid = document.getElementById('bgColorGrid');
        this.colorPalette.forEach(color => {
            const swatch = document.createElement('div');
            swatch.classList.add('color-swatch');
            swatch.style.backgroundColor = color;
            swatch.addEventListener('click', () => {
                this.canvas.style.background = color;
                this.canvas.style.backgroundImage = 'none';
                document.getElementById('bgColorInput').value = color;
                this.scheduleAutoSave();
            });
            grid.appendChild(swatch);
        });
        
        document.getElementById('bgColorInput').addEventListener('input', (e) => {
            this.canvas.style.background = e.target.value;
            this.canvas.style.backgroundImage = 'none';
            this.scheduleAutoSave();
        });
        
        document.getElementById('bgImageBtn').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        this.canvas.style.background = `url(${ev.target.result})`;
                        this.canvas.style.backgroundSize = 'cover';
                        this.canvas.style.backgroundPosition = 'center';
                        this.scheduleAutoSave();
                    };
                    reader.readAsDataURL(file);
                }
            });
            input.click();
        });
    }
    
    // =============== EXPORT ===============
    
    async exportCanvas() {
        this.stopBrushing();
        this.deselectAllLayers();
        
        try {
            if (typeof domtoimage !== 'undefined') {
                const dataUrl = await domtoimage.toJpeg(this.canvas, {
                    quality: 0.95,
                    bgcolor: this.canvas.style.background || '#ffffff'
                });
                this.downloadImage(dataUrl);
            } else {
                this.showToast('Add dom-to-image library for export');
            }
        } catch (error) {
            console.error('Export failed:', error);
            this.showToast('Export failed');
        }
    }
    
    downloadImage(dataUrl) {
        const link = document.createElement('a');
        link.download = `statsnap-${Date.now()}.jpg`;
        link.href = dataUrl;
        link.click();
        this.showToast('✅ Downloaded!');
    }
    
    // =============== UNDO/REDO ===============
    
    saveState() {
        const state = this.serializeProject();
        this.undoStack.push(state);
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }
        this.redoStack = [];
        this.updateUndoRedoButtons();
    }
    
    undo() {
        if (this.undoStack.length === 0) return;
        const currentState = this.serializeProject();
        this.redoStack.push(currentState);
        const previousState = this.undoStack.pop();
        this.restoreProject(previousState);
        this.updateUndoRedoButtons();
        this.scheduleAutoSave();
        this.showToast('Undo');
    }
    
    redo() {
        if (this.redoStack.length === 0) return;
        const currentState = this.serializeProject();
        this.undoStack.push(currentState);
        const nextState = this.redoStack.pop();
        this.restoreProject(nextState);
        this.updateUndoRedoButtons();
        this.scheduleAutoSave();
        this.showToast('Redo');
    }
    
    updateUndoRedoButtons() {
        document.getElementById('undoBtn').disabled = this.undoStack.length === 0;
        document.getElementById('redoBtn').disabled = this.redoStack.length === 0;
    }
    
    // =============== PERSISTENCE ===============
    
    async initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('statsnap-projects', 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => { this.db = request.result; resolve(); };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('projects')) {
                    db.createObjectStore('projects', { keyPath: 'id' });
                }
            };
        });
    }
    
    async saveProject() {
        if (!this.db) return;
        const project = this.serializeProject();
        const transaction = this.db.transaction(['projects'], 'readwrite');
        const store = transaction.objectStore('projects');
        await store.put({ id: 'current-project', data: project, timestamp: Date.now() });
    }
    
    scheduleAutoSave() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => this.saveProject(), 3000);
    }
    
    startAutoSave() {
        this.autoSaveInterval = setInterval(() => this.saveProject(), 30000);
    }
    
    async loadProject() {
        if (!this.db) return;
        const transaction = this.db.transaction(['projects'], 'readonly');
        const store = transaction.objectStore('projects');
        const request = store.get('current-project');
        request.onsuccess = () => {
            if (request.result) this.restoreProject(request.result.data);
        };
    }
    
    serializeProject() {
        return {
            layers: this.layers.map(layer => ({
                id: layer.id,
                type: layer.dataset.type,
                html: layer.innerHTML,
                style: layer.getAttribute('style') || '',
                rotation: layer.dataset.rotation || '0',
                zIndex: layer.style.zIndex
            })),
            canvasStyle: this.canvas.getAttribute('style') || '',
            mode: this.currentMode,
            version: '2.0'
        };
    }
    
    restoreProject(data) {
        this.canvas.innerHTML = '';
        this.layers = [];
        
        if (data.canvasStyle) this.canvas.setAttribute('style', data.canvasStyle);
        if (data.mode) this.switchMode(data.mode);
        
        if (data.layers) {
            data.layers.forEach(ld => {
                const layer = document.createElement('div');
                layer.id = ld.id;
                layer.classList.add('layer');
                layer.dataset.type = ld.type;
                layer.dataset.rotation = ld.rotation;
                layer.innerHTML = ld.html;
                layer.setAttribute('style', ld.style);
                
                this.addResizeHandles(layer);
                this.addRotateHandle(layer);
                this.setupDragHandlers(layer);
                
                layer.addEventListener('pointerdown', (e) => {
                    if (this.isBrushing) return;
                    e.stopPropagation();
                    this.selectLayer(layer);
                });
                
                if (ld.type === 'text') {
                    layer.setAttribute('contenteditable', 'true');
                    layer.addEventListener('dblclick', () => layer.focus());
                    layer.addEventListener('input', () => this.scheduleAutoSave());
                }
                
                this.canvas.appendChild(layer);
                this.layers.push(layer);
                this.layerIdCounter = Math.max(this.layerIdCounter, parseInt(ld.id.split('-')[1]) || 0);
            });
        }
        
        this.updateEmptyState();
        this.updateContextualTools();
    }
    
    // =============== UTILITIES ===============
    
    showToast(message) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.classList.add('toast');
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 2500);
    }
    
    destroy() {
        clearInterval(this.autoSaveInterval);
        clearTimeout(this.saveTimeout);
        if (this.db) this.db.close();
    }
}

// Initialize
let editor;
document.addEventListener('DOMContentLoaded', () => {
    editor = new StatsnapEditor();
});

window.addEventListener('beforeunload', () => {
    if (editor) {
        editor.saveProject();
        editor.destroy();
    }
});
