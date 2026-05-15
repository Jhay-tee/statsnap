// ============================================
// STATSNAP - Production Ready v2
// Fixed: canvas size, image import, collage mode
// ============================================

class StatsnapEditor {
    constructor() {
        // Core elements
        this.canvas = document.getElementById('mainCanvas');
        this.canvasContainer = document.getElementById('canvasContainer');
        this.brushCanvas = document.getElementById('brushCanvas');
        
        // Canvas dimensions (9:16 ratio default)
        this.canvasWidth = 360;
        this.canvasHeight = 640;
        this.aspectRatio = 9/16; // width/height
        
        // State
        this.layers = [];
        this.selectedLayer = null;
        this.currentMode = 'design';
        this.layerIdCounter = 0;
        
        // Collage state
        this.collageImages = [];
        this.collageSlots = [];
        this.maxCollageImages = 4;
        this.minCollageImages = 2;
        
        // Interaction state
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.isPanning = false;
        this.isPinching = false;
        this.isBrushing = false;
        this.currentBrushType = null;
        
        // Transform state
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.minScale = 0.3;
        this.maxScale = 3;
        
        // Pinch state
        this.lastPinchDistance = 0;
        this.lastPinchMidpoint = { x: 0, y: 0 };
        this.pinchStartScale = 1;
        
        // Drag state
        this.dragStart = { x: 0, y: 0 };
        this.dragLayerStart = { x: 0, y: 0 };
        this.dragCanvasStart = { x: 0, y: 0 };
        
        // Brush state
        this.brushColor = '#000000';
        this.brushSize = 30;
        this.brushOpacity = 1;
        this.lastBrushPos = null;
        this.brushPoints = [];
        
        // Undo/Redo
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 50;
        
        // Auto-save
        this.saveTimeout = null;
        this.autoSaveInterval = null;
        this.db = null;
        
        // Menu state
        this.isMenuOpen = false;
        this.isPanelOpen = false;
        
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
        this.setupCanvasSize();
        this.setupBrushCanvas();
        this.setupColorPalette();
        this.bindEvents();
        this.handleResize();
        await this.initDatabase();
        await this.loadProject();
        this.startAutoSave();
        this.updateUndoRedoButtons();
        this.updateEmptyState();
        this.updateContextualTools();
        
        // Listen for resize
        window.addEventListener('resize', () => this.handleResize());
    }
    
    // =============== THEME ===============
    setupTheme() {
        const saved = localStorage.getItem('statsnap-theme');
        if (saved) {
            document.documentElement.setAttribute('data-theme', saved);
        } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }
    
    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('statsnap-theme', next);
        this.showToast(next === 'dark' ? '🌙 Dark mode' : '☀️ Light mode');
    }
    
    // =============== CANVAS SIZE ===============
    setupCanvasSize() {
        this.updateCanvasSize();
        this.applyCanvasTransform();
    }
    
    updateCanvasSize() {
        const containerWidth = this.canvasContainer.clientWidth;
        const containerHeight = this.canvasContainer.clientHeight;
        
        // Calculate max size while maintaining aspect ratio
        let newWidth, newHeight;
        
        if (containerWidth / containerHeight > this.aspectRatio) {
            // Container is wider than ratio - fit to height
            newHeight = Math.min(containerHeight * 0.85, 800);
            newWidth = newHeight * this.aspectRatio;
        } else {
            // Container is taller than ratio - fit to width
            newWidth = Math.min(containerWidth * 0.85, 450);
            newHeight = newWidth / this.aspectRatio;
        }
        
        // Minimum sizes
        newWidth = Math.max(newWidth, 280);
        newHeight = Math.max(newHeight, 498);
        
        this.canvasWidth = Math.round(newWidth);
        this.canvasHeight = Math.round(newHeight);
        
        this.canvas.style.width = this.canvasWidth + 'px';
        this.canvas.style.height = this.canvasHeight + 'px';
        
        // Update brush canvas size
        this.setupBrushCanvas();
    }
    
    handleResize() {
        this.updateCanvasSize();
        this.applyCanvasTransform();
    }
    
    applyCanvasTransform() {
        this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
        this.canvas.style.transformOrigin = 'center center';
        this.canvas.style.transition = this.isPanning || this.isPinching ? 'none' : 'transform 0.15s ease-out';
    }
    
    // =============== BRUSH CANVAS ===============
    setupBrushCanvas() {
        this.brushCanvas.width = this.canvasWidth;
        this.brushCanvas.height = this.canvasHeight;
        this.brushCanvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: ${this.canvasWidth}px;
            height: ${this.canvasHeight}px;
            pointer-events: none;
            z-index: 998;
            display: none;
        `;
    }
    
    setupColorPalette() {
        const grid = document.getElementById('colorGrid');
        if (!grid) return;
        grid.innerHTML = '';
        this.colorPalette.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                this.brushColor = color;
                const customInput = document.getElementById('customColorInput');
                if (customInput) customInput.value = color;
                grid.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
                swatch.classList.add('selected');
            });
            grid.appendChild(swatch);
        });
    }
    
    // =============== EVENT BINDING ===============
    bindEvents() {
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
        document.getElementById('closePanel').addEventListener('click', () => this.closePanel());
        document.getElementById('menuBtn').addEventListener('click', () => this.toggleMenu());
        
        // Mode buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchMode(e.target.dataset.mode));
        });
        
        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.dataset.action;
                this.handleToolAction(action, btn);
            });
        });
        
        // Canvas container events
        this.canvasContainer.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        this.canvasContainer.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        this.canvasContainer.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        this.canvasContainer.addEventListener('pointerleave', (e) => this.handlePointerUp(e));
        this.canvasContainer.addEventListener('pointercancel', (e) => this.handlePointerUp(e));
        
        // Wheel zoom
        this.canvasContainer.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        
        // Touch for pinch
        this.canvasContainer.addEventListener('touchstart', (e) => {
            if (e.touches.length >= 2) e.preventDefault();
        }, { passive: false });
        
        this.canvasContainer.addEventListener('touchmove', (e) => {
            if (e.touches.length >= 2) e.preventDefault();
        }, { passive: false });
        
        // Keyboard
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Custom color
        const customColor = document.getElementById('customColorInput');
        if (customColor) {
            customColor.addEventListener('input', (e) => {
                this.brushColor = e.target.value;
            });
        }
    }
    
    // =============== POINTER HANDLERS ===============
    handlePointerDown(e) {
        // Pinch detection
        if (e.pointerType === 'touch') {
            const activePointers = this.getActivePointers();
            if (activePointers.length >= 2) {
                this.startPinch(activePointers);
                return;
            }
        }
        
        const target = e.target;
        
        // Handle resize
        if (target.classList.contains('resize-handle')) {
            this.startResize(target, e);
            return;
        }
        
        // Handle rotate
        if (target.classList.contains('rotate-handle')) {
            this.startRotate(target, e);
            return;
        }
        
        // Handle layer drag
        const layer = target.closest('.layer');
        if (layer && !this.isBrushing && !target.isContentEditable) {
            this.startDragLayer(layer, e);
            return;
        }
        
        // Handle brushing
        if (this.isBrushing && (target === this.canvas || target === this.brushCanvas)) {
            this.startBrush(e);
            return;
        }
        
        // Pan canvas
        if (target === this.canvas || target === this.canvasContainer || target.closest('#canvasContainer')) {
            this.startPan(e);
            return;
        }
    }
    
    handlePointerMove(e) {
        // Pinch
        if (this.isPinching) {
            const activePointers = this.getActivePointers();
            if (activePointers.length >= 2) {
                this.updatePinch(activePointers);
                return;
            }
        }
        
        if (this.isDragging) { this.updateDragLayer(e); return; }
        if (this.isResizing) { this.updateResize(e); return; }
        if (this.isRotating) { this.updateRotate(e); return; }
        if (this.isPanning) { this.updatePan(e); return; }
        if (this.isBrushing) { this.updateBrush(e); return; }
    }
    
    handlePointerUp(e) {
        if (this.isDragging) this.endDragLayer();
        if (this.isResizing) this.endResize();
        if (this.isRotating) this.endRotate();
        if (this.isPanning) this.endPan();
        if (this.isPinching) this.endPinch();
        if (this.isBrushing) this.endBrush();
    }
    
    getActivePointers() {
        // Get all currently active pointer/touch positions
        const points = [];
        if (window.PointerEvent) {
            // We'll track pointers manually
            if (this._pointerCache) {
                return Object.values(this._pointerCache);
            }
        }
        return points;
    }
    
    // =============== PAN ===============
    startPan(e) {
        this.isPanning = true;
        this.dragCanvasStart = {
            x: e.clientX - this.panX,
            y: e.clientY - this.panY
        };
        this.canvas.style.transition = 'none';
        this.canvas.style.cursor = 'grabbing';
    }
    
    updatePan(e) {
        if (!this.isPanning) return;
        this.panX = e.clientX - this.dragCanvasStart.x;
        this.panY = e.clientY - this.dragCanvasStart.y;
        this.applyCanvasTransform();
    }
    
    endPan() {
        this.isPanning = false;
        this.canvas.style.transition = 'transform 0.15s ease-out';
        this.canvas.style.cursor = '';
    }
    
    // =============== PINCH ZOOM ===============
    startPinch(pointers) {
        if (pointers.length < 2) return;
        this.isPinching = true;
        this.pinchStartScale = this.scale;
        this.lastPinchDistance = this.getDistance(pointers[0], pointers[1]);
        this.lastPinchMidpoint = this.getMidpoint(pointers[0], pointers[1]);
        this.canvas.style.transition = 'none';
    }
    
    updatePinch(pointers) {
        if (!this.isPinching || pointers.length < 2) return;
        
        const currentDistance = this.getDistance(pointers[0], pointers[1]);
        const currentMidpoint = this.getMidpoint(pointers[0], pointers[1]);
        
        const scaleFactor = currentDistance / this.lastPinchDistance;
        let newScale = this.pinchStartScale * scaleFactor;
        newScale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
        
        const canvasRect = this.canvas.getBoundingClientRect();
        const canvasCenterX = canvasRect.left + canvasRect.width / 2;
        const canvasCenterY = canvasRect.top + canvasRect.height / 2;
        
        const midDx = currentMidpoint.x - canvasCenterX;
        const midDy = currentMidpoint.y - canvasCenterY;
        
        const scaleDiff = newScale - this.scale;
        this.panX -= midDx * scaleDiff / this.scale;
        this.panY -= midDy * scaleDiff / this.scale;
        
        this.scale = newScale;
        this.applyCanvasTransform();
        
        this.lastPinchDistance = currentDistance;
        this.lastPinchMidpoint = currentMidpoint;
        this.pinchStartScale = this.scale;
    }
    
    endPinch() {
        this.isPinching = false;
        this.canvas.style.transition = 'transform 0.15s ease-out';
    }
    
    getDistance(p1, p2) {
        const dx = p1.clientX - p2.clientX;
        const dy = p1.clientY - p2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    getMidpoint(p1, p2) {
        return {
            x: (p1.clientX + p2.clientX) / 2,
            y: (p1.clientY + p2.clientY) / 2
        };
    }
    
    // =============== WHEEL ZOOM ===============
    handleWheel(e) {
        e.preventDefault();
        
        const canvasRect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - canvasRect.left;
        const mouseY = e.clientY - canvasRect.top;
        
        const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
        let newScale = this.scale * zoomFactor;
        newScale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
        
        const scaleDiff = newScale - this.scale;
        this.panX -= (mouseX - canvasRect.width / 2) * scaleDiff / this.scale;
        this.panY -= (mouseY - canvasRect.height / 2) * scaleDiff / this.scale;
        
        this.scale = newScale;
        this.applyCanvasTransform();
    }
    
    // =============== LAYER DRAG ===============
    startDragLayer(layer, e) {
        if (this.isBrushing) return;
        
        this.selectLayer(layer);
        this.isDragging = true;
        
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.dragLayerStart = {
            x: parseFloat(layer.style.left) || 0,
            y: parseFloat(layer.style.top) || 0
        };
        
        layer.classList.add('dragging');
        layer.style.transition = 'none';
        layer.setPointerCapture(e.pointerId);
    }
    
    updateDragLayer(e) {
        if (!this.isDragging || !this.selectedLayer) return;
        
        const dx = (e.clientX - this.dragStart.x) / this.scale;
        const dy = (e.clientY - this.dragStart.y) / this.scale;
        
        this.selectedLayer.style.left = `${this.dragLayerStart.x + dx}px`;
        this.selectedLayer.style.top = `${this.dragLayerStart.y + dy}px`;
    }
    
    endDragLayer() {
        if (!this.isDragging) return;
        this.isDragging = false;
        
        if (this.selectedLayer) {
            this.selectedLayer.classList.remove('dragging');
            this.selectedLayer.style.transition = '';
            
            const currentLeft = parseFloat(this.selectedLayer.style.left) || 0;
            const currentTop = parseFloat(this.selectedLayer.style.top) || 0;
            
            if (Math.abs(currentLeft - this.dragLayerStart.x) > 2 || 
                Math.abs(currentTop - this.dragLayerStart.y) > 2) {
                this.saveState();
                this.scheduleAutoSave();
            }
        }
    }
    
    // =============== RESIZE ===============
    startResize(handle, e) {
        e.stopPropagation();
        e.preventDefault();
        
        const layer = handle.closest('.layer');
        if (!layer) return;
        
        this.selectLayer(layer);
        this.isResizing = true;
        this.resizeLayer = layer;
        
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.resizeStart = {
            width: layer.offsetWidth,
            height: layer.offsetHeight,
            left: parseFloat(layer.style.left) || 0,
            top: parseFloat(layer.style.top) || 0,
            position: handle.dataset.position
        };
        
        handle.setPointerCapture(e.pointerId);
    }
    
    updateResize(e) {
        if (!this.isResizing || !this.resizeLayer) return;
        
        const dx = (e.clientX - this.dragStart.x) / this.scale;
        const dy = (e.clientY - this.dragStart.y) / this.scale;
        const pos = this.resizeStart.position;
        
        let newWidth = this.resizeStart.width;
        let newHeight = this.resizeStart.height;
        let newLeft = this.resizeStart.left;
        let newTop = this.resizeStart.top;
        
        switch(pos) {
            case 'bottom-right':
                newWidth = Math.max(30, this.resizeStart.width + dx);
                newHeight = Math.max(30, this.resizeStart.height + dy);
                break;
            case 'bottom-left':
                newWidth = Math.max(30, this.resizeStart.width - dx);
                newHeight = Math.max(30, this.resizeStart.height + dy);
                newLeft = this.resizeStart.left + dx;
                break;
            case 'top-right':
                newWidth = Math.max(30, this.resizeStart.width + dx);
                newHeight = Math.max(30, this.resizeStart.height - dy);
                newTop = this.resizeStart.top + dy;
                break;
            case 'top-left':
                newWidth = Math.max(30, this.resizeStart.width - dx);
                newHeight = Math.max(30, this.resizeStart.height - dy);
                newLeft = this.resizeStart.left + dx;
                newTop = this.resizeStart.top + dy;
                break;
            case 'bottom-center':
                newHeight = Math.max(30, this.resizeStart.height + dy);
                break;
            case 'top-center':
                newHeight = Math.max(30, this.resizeStart.height - dy);
                newTop = this.resizeStart.top + dy;
                break;
            case 'right-center':
                newWidth = Math.max(30, this.resizeStart.width + dx);
                break;
            case 'left-center':
                newWidth = Math.max(30, this.resizeStart.width - dx);
                newLeft = this.resizeStart.left + dx;
                break;
        }
        
        this.resizeLayer.style.width = `${newWidth}px`;
        this.resizeLayer.style.height = `${newHeight}px`;
        this.resizeLayer.style.left = `${newLeft}px`;
        this.resizeLayer.style.top = `${newTop}px`;
    }
    
    endResize() {
        if (this.isResizing) {
            this.saveState();
            this.scheduleAutoSave();
        }
        this.isResizing = false;
        this.resizeLayer = null;
    }
    
    // =============== ROTATE ===============
    startRotate(handle, e) {
        e.stopPropagation();
        e.preventDefault();
        
        const layer = handle.closest('.layer');
        if (!layer) return;
        
        this.selectLayer(layer);
        this.isRotating = true;
        this.rotateLayer = layer;
        
        const rect = layer.getBoundingClientRect();
        this.rotateCenter = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        this.rotateStartAngle = Math.atan2(
            e.clientY - this.rotateCenter.y,
            e.clientX - this.rotateCenter.x
        );
        this.rotateStartDeg = parseFloat(layer.dataset.rotation || 0);
        
        handle.setPointerCapture(e.pointerId);
    }
    
    updateRotate(e) {
        if (!this.isRotating || !this.rotateLayer) return;
        
        const currentAngle = Math.atan2(
            e.clientY - this.rotateCenter.y,
            e.clientX - this.rotateCenter.x
        );
        const angleDiff = (currentAngle - this.rotateStartAngle) * (180 / Math.PI);
        const newRotation = this.rotateStartDeg + angleDiff;
        
        this.rotateLayer.style.transform = `rotate(${newRotation}deg)`;
        this.rotateLayer.dataset.rotation = newRotation;
    }
    
    endRotate() {
        if (this.isRotating) {
            this.saveState();
            this.scheduleAutoSave();
        }
        this.isRotating = false;
        this.rotateLayer = null;
    }
    
    // =============== BRUSH ===============
    startBrush(e) {
        this.isBrushing = true;
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.scale;
        const y = (e.clientY - rect.top) / this.scale;
        this.lastBrushPos = { x, y };
        this.brushPoints = [{ x, y }];
        this.showBrushIndicator(e.clientX, e.clientY);
    }
    
    updateBrush(e) {
        if (!this.isBrushing || !this.currentBrushType) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.scale;
        const y = (e.clientY - rect.top) / this.scale;
        
        this.showBrushIndicator(e.clientX, e.clientY);
        this.brushPoints.push({ x, y });
        
        const ctx = this.brushCanvas.getContext('2d');
        
        if (this.currentBrushType === 'paint') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.beginPath();
            ctx.moveTo(this.lastBrushPos.x, this.lastBrushPos.y);
            ctx.lineTo(x, y);
            ctx.strokeStyle = this.brushColor;
            ctx.lineWidth = this.brushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = this.brushOpacity;
            ctx.stroke();
        } else if (this.currentBrushType === 'blur') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.beginPath();
            ctx.moveTo(this.lastBrushPos.x, this.lastBrushPos.y);
            ctx.lineTo(x, y);
            ctx.strokeStyle = 'rgba(128,128,128,0.5)';
            ctx.lineWidth = this.brushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.filter = `blur(${this.brushSize / 3}px)`;
            ctx.stroke();
            ctx.filter = 'none';
        }
        
        this.lastBrushPos = { x, y };
    }
    
    endBrush() {
        if (!this.isBrushing) return;
        this.isBrushing = false;
        this.hideBrushIndicator();
        
        if (this.brushPoints.length > 0 && this.selectedLayer) {
            this.applyBrushToLayer();
        }
        
        this.brushPoints = [];
        const ctx = this.brushCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.brushCanvas.width, this.brushCanvas.height);
    }
    
    applyBrushToLayer() {
        if (!this.selectedLayer || this.selectedLayer.dataset.type !== 'image') return;
        
        const img = this.selectedLayer.querySelector('img');
        if (!img) return;
        
        const tempCanvas = document.createElement('canvas');
        const layerW = this.selectedLayer.offsetWidth;
        const layerH = this.selectedLayer.offsetHeight;
        tempCanvas.width = layerW;
        tempCanvas.height = layerH;
        const ctx = tempCanvas.getContext('2d');
        
        ctx.drawImage(img, 0, 0, layerW, layerH);
        
        if (this.currentBrushType === 'paint') {
            ctx.drawImage(this.brushCanvas, 0, 0);
        } else if (this.currentBrushType === 'blur') {
            const blurredCanvas = document.createElement('canvas');
            blurredCanvas.width = layerW;
            blurredCanvas.height = layerH;
            const blurCtx = blurredCanvas.getContext('2d');
            blurCtx.filter = `blur(${this.brushSize / 2}px)`;
            blurCtx.drawImage(img, 0, 0, layerW, layerH);
            
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = layerW;
            maskCanvas.height = layerH;
            const maskCtx = maskCanvas.getContext('2d');
            maskCtx.drawImage(this.brushCanvas, 0, 0);
            
            ctx.globalCompositeOperation = 'destination-out';
            ctx.drawImage(maskCanvas, 0, 0);
            ctx.globalCompositeOperation = 'destination-over';
            ctx.drawImage(blurredCanvas, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
        }
        
        img.src = tempCanvas.toDataURL('image/png');
        this.saveState();
        this.scheduleAutoSave();
    }
    
    showBrushIndicator(x, y) {
        let indicator = document.querySelector('.brush-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'brush-indicator';
            indicator.style.cssText = `
                position: fixed;
                pointer-events: none;
                border: 2px solid var(--accent-color);
                border-radius: 50%;
                z-index: 150;
                transform: translate(-50%, -50%);
                background: rgba(99, 102, 241, 0.1);
                display: none;
            `;
            document.body.appendChild(indicator);
        }
        indicator.style.display = 'block';
        indicator.style.left = x + 'px';
        indicator.style.top = y + 'px';
        indicator.style.width = (this.brushSize * this.scale) + 'px';
        indicator.style.height = (this.brushSize * this.scale) + 'px';
    }
    
    hideBrushIndicator() {
        const indicator = document.querySelector('.brush-indicator');
        if (indicator) indicator.style.display = 'none';
    }
    
    // =============== TOOL HANDLING ===============
    handleToolAction(action, btn) {
        if (action === 'paintBrush') {
            this.toggleBrush('paint', btn);
            return;
        }
        if (action === 'blurBrush') {
            this.toggleBrush('blur', btn);
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
            case 'textBold': this.openBoldnessPanel(); break;
            case 'textAlign': this.openTextAlignPanel(); break;
            case 'dropShadow': this.openDropShadowPanel(); break;
            case 'imageAdjust': this.openImageAdjustPanel(); break;
            case 'imageFilter': this.openImageFilterPanel(); break;
            case 'shapeColor': this.openColorPicker('shape'); break;
            case 'shapeBorder': this.openShapeBorderPanel(); break;
        }
    }
    
    toggleBrush(type, btn) {
        if (this.currentBrushType === type) {
            this.stopBrushing();
            return;
        }
        
        this.stopBrushing();
        this.currentBrushType = type;
        this.isBrushing = false;
        btn.classList.add('active-tool');
        this.brushCanvas.style.display = 'block';
        this.brushCanvas.style.pointerEvents = 'auto';
        
        if (type === 'paint') {
            const popup = document.getElementById('colorPickerPopup');
            if (popup) popup.style.display = 'block';
        }
        
        this.openBrushSizePanel();
        this.showToast(`${type === 'paint' ? 'Paint' : 'Blur'} brush ready`);
    }
    
    stopBrushing() {
        this.currentBrushType = null;
        this.isBrushing = false;
        this.brushCanvas.style.display = 'none';
        this.brushCanvas.style.pointerEvents = 'none';
        this.hideBrushIndicator();
        
        const popup = document.getElementById('colorPickerPopup');
        if (popup) popup.style.display = 'none';
        
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active-tool'));
        
        const ctx = this.brushCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.brushCanvas.width, this.brushCanvas.height);
        
        if (this.isPanelOpen) this.closePanel();
    }
    
    // =============== LAYER MANAGEMENT ===============
    
    addTextLayer(text = 'Double tap to edit') {
        this.stopBrushing();
        const layer = this.createLayerElement('text');
        layer.textContent = text;
        layer.setAttribute('contenteditable', 'true');
        layer.dataset.placeholder = 'Type here...';
        layer.classList.add('text-layer');
        
        layer.addEventListener('focus', () => {
            if (layer.textContent === 'Double tap to edit') {
                layer.textContent = '';
            }
        });
        
        layer.addEventListener('blur', () => {
            if (!layer.textContent.trim()) {
                layer.textContent = 'Double tap to edit';
            }
            this.scheduleAutoSave();
        });
        
        layer.addEventListener('input', () => this.scheduleAutoSave());
        
        this.positionLayerCenter(layer);
        this.addLayerToCanvas(layer);
        this.selectLayer(layer);
        this.saveState();
        
        setTimeout(() => layer.focus(), 100);
    }
    
    addImageLayer(imageUrl = null) {
        this.stopBrushing();
        
        if (this.currentMode === 'collage') {
            this.addCollageImage();
            return;
        }
        
        if (imageUrl) {
            this.createImageLayer(imageUrl);
        } else {
            this.promptImageUpload(false);
        }
    }
    
    promptImageUpload(multiple = false) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = multiple;
        
        input.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            
            if (this.currentMode === 'collage') {
                this.handleCollageImages(files);
            } else {
                files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = (ev) => this.createImageLayer(ev.target.result);
                    reader.readAsDataURL(file);
                });
            }
        });
        
        input.click();
    }
    
    createImageLayer(url) {
        const layer = this.createLayerElement('image');
        layer.classList.add('image-layer');
        
        const img = document.createElement('img');
        img.src = url;
        img.draggable = false;
        img.dataset.originalSrc = url;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        layer.appendChild(img);
        
        // Set initial size based on image
        const tempImg = new Image();
        tempImg.onload = () => {
            const maxDim = Math.min(this.canvasWidth, this.canvasHeight) * 0.6;
            let w = tempImg.naturalWidth;
            let h = tempImg.naturalHeight;
            const ratio = w / h;
            
            if (w > maxDim) {
                w = maxDim;
                h = w / ratio;
            }
            if (h > maxDim) {
                h = maxDim;
                w = h * ratio;
            }
            
            layer.style.width = `${Math.round(w)}px`;
            layer.style.height = `${Math.round(h)}px`;
            this.positionLayerCenter(layer);
        };
        tempImg.src = url;
        
        // If image is cached
        if (tempImg.complete && tempImg.naturalWidth) {
            tempImg.onload();
        }
        
        this.addLayerToCanvas(layer);
        this.selectLayer(layer);
        this.saveState();
        this.showToast('Image added');
    }
    
    // =============== COLLAGE MODE ===============
    addCollageImage() {
        if (this.collageImages.length >= this.maxCollageImages) {
            this.showToast(`Maximum ${this.maxCollageImages} images for collage`);
            return;
        }
        this.promptImageUpload(true);
    }
    
    handleCollageImages(files) {
        const remainingSlots = this.maxCollageImages - this.collageImages.length;
        const filesToAdd = files.slice(0, remainingSlots);
        
        if (files.length > remainingSlots) {
            this.showToast(`Only adding ${remainingSlots} more image(s)`);
        }
        
        filesToAdd.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                this.collageImages.push(ev.target.result);
                
                if (this.collageImages.length >= this.minCollageImages) {
                    this.createCollageLayout();
                } else {
                    this.showToast(`Add ${this.minCollageImages - this.collageImages.length} more image(s)`);
                }
            };
            reader.readAsDataURL(file);
        });
    }
    
    createCollageLayout() {
        // Clear existing collage layers
        this.layers.forEach(l => {
            if (l.dataset.collageSlot !== undefined) {
                l.remove();
            }
        });
        this.layers = this.layers.filter(l => l.dataset.collageSlot === undefined);
        
        const count = Math.min(this.collageImages.length, this.maxCollageImages);
        const canvasW = this.canvasWidth;
        const canvasH = this.canvasHeight;
        const padding = 8;
        
        let slots = [];
        
        if (count === 2) {
            // Vertical split
            const slotW = canvasW;
            const slotH = (canvasH - padding) / 2;
            slots = [
                { x: 0, y: 0, w: slotW, h: slotH },
                { x: 0, y: slotH + padding, w: slotW, h: slotH }
            ];
        } else if (count === 3) {
            // One top, two bottom
            const topH = canvasH * 0.55;
            const bottomH = canvasH - topH - padding;
            const halfW = (canvasW - padding) / 2;
            slots = [
                { x: 0, y: 0, w: canvasW, h: topH },
                { x: 0, y: topH + padding, w: halfW, h: bottomH },
                { x: halfW + padding, y: topH + padding, w: halfW, h: bottomH }
            ];
        } else if (count === 4) {
            // 2x2 grid
            const halfW = (canvasW - padding) / 2;
            const halfH = (canvasH - padding) / 2;
            slots = [
                { x: 0, y: 0, w: halfW, h: halfH },
                { x: halfW + padding, y: 0, w: halfW, h: halfH },
                { x: 0, y: halfH + padding, w: halfW, h: halfH },
                { x: halfW + padding, y: halfH + padding, w: halfW, h: halfH }
            ];
        }
        
        slots.forEach((slot, i) => {
            if (i < this.collageImages.length) {
                const layer = document.createElement('div');
                layer.id = `layer-${++this.layerIdCounter}`;
                layer.className = 'layer image-layer';
                layer.dataset.type = 'image';
                layer.dataset.collageSlot = i;
                layer.style.position = 'absolute';
                layer.style.left = slot.x + 'px';
                layer.style.top = slot.y + 'px';
                layer.style.width = slot.w + 'px';
                layer.style.height = slot.h + 'px';
                layer.style.zIndex = i + 1;
                layer.style.overflow = 'hidden';
                layer.style.borderRadius = '4px';
                
                const img = document.createElement('img');
                img.src = this.collageImages[i];
                img.draggable = false;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                layer.appendChild(img);
                
                this.addHandles(layer);
                
                layer.addEventListener('pointerdown', (e) => {
                    if (this.isBrushing) return;
                    if (!e.target.classList.contains('resize-handle') && 
                        !e.target.classList.contains('rotate-handle')) {
                        e.stopPropagation();
                        this.selectLayer(layer);
                    }
                });
                
                this.canvas.appendChild(layer);
                this.layers.push(layer);
            }
        });
        
        this.updateEmptyState();
        this.updateContextualTools();
        this.saveState();
        this.showToast(`Collage with ${count} images created`);
    }
    
    // =============== SHAPE ===============
    addShapeLayer() {
        this.stopBrushing();
        const layer = this.createLayerElement('shape');
        layer.classList.add('shape-layer');
        layer.style.background = '#6366f1';
        layer.style.width = '120px';
        layer.style.height = '120px';
        layer.style.borderRadius = '8px';
        
        this.positionLayerCenter(layer);
        this.addLayerToCanvas(layer);
        this.selectLayer(layer);
        this.saveState();
    }
    
    // =============== LAYER HELPERS ===============
    createLayerElement(type) {
        const layer = document.createElement('div');
        const id = `layer-${++this.layerIdCounter}`;
        layer.id = id;
        layer.className = 'layer';
        layer.dataset.type = type;
        layer.style.position = 'absolute';
        layer.style.zIndex = this.layers.length + 1;
        
        this.addHandles(layer);
        
        layer.addEventListener('pointerdown', (e) => {
            if (this.isBrushing) return;
            if (!e.target.classList.contains('resize-handle') && 
                !e.target.classList.contains('rotate-handle')) {
                e.stopPropagation();
                this.selectLayer(layer);
            }
        });
        
        return layer;
    }
    
    addHandles(layer) {
        const positions = [
            'top-left', 'top-center', 'top-right',
            'left-center', 'right-center',
            'bottom-left', 'bottom-center', 'bottom-right'
        ];
        
        positions.forEach(pos => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${pos}`;
            handle.dataset.position = pos;
            layer.appendChild(handle);
        });
        
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'rotate-handle';
        rotateHandle.textContent = '↻';
        layer.appendChild(rotateHandle);
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
        
        // If it's a collage slot, remove from collage images
        if (layer.dataset.collageSlot !== undefined) {
            const slotIndex = parseInt(layer.dataset.collageSlot);
            this.collageImages.splice(slotIndex, 1);
        }
        
        layer.style.transition = 'opacity 0.2s, transform 0.2s';
        layer.style.opacity = '0';
        layer.style.transform = 'scale(0.8)';
        
        setTimeout(() => {
            layer.remove();
            this.layers = this.layers.filter(l => l !== layer);
            this.selectedLayer = null;
            this.updateEmptyState();
            this.updateContextualTools();
            this.saveState();
            this.scheduleAutoSave();
        }, 200);
        
        this.showToast('Layer deleted');
    }
    
    positionLayerCenter(layer) {
        const layerW = parseInt(layer.style.width) || 120;
        const layerH = parseInt(layer.style.height) || 120;
        layer.style.left = `${Math.round((this.canvasWidth - layerW) / 2)}px`;
        layer.style.top = `${Math.round((this.canvasHeight - layerH) / 2)}px`;
    }
    
    updateEmptyState() {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = this.layers.length === 0 ? 'block' : 'none';
        }
    }
    
    updateContextualTools() {
        document.querySelectorAll('.tool-group').forEach(g => g.classList.remove('active'));
        
        if (this.currentMode === 'collage') {
            // In collage mode, show collage-specific tools
            if (this.collageImages.length < this.maxCollageImages) {
                document.getElementById('defaultTools').classList.add('active');
            } else {
                document.getElementById('imageTools').classList.add('active');
            }
            return;
        }
        
        if (!this.selectedLayer) {
            document.getElementById('defaultTools').classList.add('active');
        } else {
            const type = this.selectedLayer.dataset.type;
            const toolMap = {
                'text': 'textTools',
                'image': 'imageTools',
                'shape': 'shapeTools'
            };
            const toolId = toolMap[type];
            if (toolId) document.getElementById(toolId).classList.add('active');
        }
    }
    
    // =============== MODE SWITCHING ===============
    switchMode(mode) {
        if (this.currentMode === mode) return;
        this.stopBrushing();
        this.closePanel();
        
        this.currentMode = mode;
        
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        if (mode === 'collage') {
            this.collageImages = [];
            this.layers.forEach(l => {
                if (l.dataset.collageSlot !== undefined) l.remove();
            });
            this.layers = this.layers.filter(l => l.dataset.collageSlot === undefined);
            this.showToast('Collage mode: Add 2-4 images');
        }
        
        this.deselectAllLayers();
        this.updateEmptyState();
        this.updateContextualTools();
    }
    
    // =============== PANELS ===============
    openPanel(title) {
        document.getElementById('panelTitle').textContent = title;
        document.getElementById('slidePanel').classList.add('open');
        this.isPanelOpen = true;
    }
    
    closePanel() {
        document.getElementById('slidePanel').classList.remove('open');
        this.isPanelOpen = false;
    }
    
    getPanelContent() {
        return document.getElementById('panelContent');
    }
    
    // =============== COLOR PICKER ===============
    openColorPicker(target) {
        const content = this.getPanelContent();
        this.openPanel('Choose Color');
        
        content.innerHTML = `
            <div class="color-grid" id="panelColorGrid"></div>
            <input type="color" id="panelColorInput" value="${this.brushColor}" style="width:100%;height:40px;margin-top:12px;border:none;border-radius:8px;cursor:pointer;">
        `;
        
        const grid = document.getElementById('panelColorGrid');
        this.colorPalette.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                const val = color;
                document.getElementById('panelColorInput').value = val;
                if (target === 'text' && this.selectedLayer) {
                    this.selectedLayer.style.color = val;
                } else if (target === 'shape' && this.selectedLayer) {
                    this.selectedLayer.style.background = val;
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
    
    // =============== TEXT BOLDNESS ===============
    openBoldnessPanel() {
        if (!this.selectedLayer) return;
        const content = this.getPanelContent();
        this.openPanel('Text Boldness');
        
        const current = parseInt(this.selectedLayer.style.fontWeight) || 400;
        
        content.innerHTML = `
            <div class="control-group">
                <div class="control-label"><span>Weight</span><span class="control-value" id="boldVal">${current}</span></div>
                <input type="range" id="boldSlider" min="100" max="900" step="100" value="${current}">
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
                ${[100, 300, 400, 500, 600, 700, 900].map(w => `
                    <button class="panel-btn" data-weight="${w}" style="flex:1;font-weight:${w};">${w}</button>
                `).join('')}
            </div>
        `;
        
        const updateBold = (val) => {
            this.selectedLayer.style.fontWeight = val;
            document.getElementById('boldVal').textContent = val;
            const slider = document.getElementById('boldSlider');
            if (slider) slider.value = val;
            this.scheduleAutoSave();
        };
        
        document.getElementById('boldSlider').addEventListener('input', (e) => updateBold(e.target.value));
        
        content.querySelectorAll('.panel-btn').forEach(btn => {
            btn.addEventListener('click', () => updateBold(btn.dataset.weight));
        });
    }
    
    // =============== TEXT ALIGN ===============
    openTextAlignPanel() {
        if (!this.selectedLayer) return;
        const content = this.getPanelContent();
        this.openPanel('Text Alignment');
        
        const aligns = ['left', 'center', 'right', 'justify'];
        
        content.innerHTML = `
            <div style="display:flex;gap:8px;">
                ${aligns.map(a => `
                    <button class="panel-btn" data-align="${a}" style="flex:1;font-size:18px;">
                        ${a === 'left' ? '⬅' : a === 'center' ? '↔' : a === 'right' ? '➡' : '☰'} ${a}
                    </button>
                `).join('')}
            </div>
        `;
        
        content.querySelectorAll('.panel-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedLayer.style.textAlign = btn.dataset.align;
                this.closePanel();
                this.scheduleAutoSave();
            });
        });
    }
    
    // =============== DROP SHADOW ===============
    openDropShadowPanel() {
        if (!this.selectedLayer) return;
        const content = this.getPanelContent();
        this.openPanel('Drop Shadow');
        
        content.innerHTML = `
            <div class="control-group">
                <div class="control-label"><span>X Offset</span><span class="control-value" id="sxVal">2px</span></div>
                <input type="range" id="shadowX" min="0" max="30" value="2">
            </div>
            <div class="control-group">
                <div class="control-label"><span>Y Offset</span><span class="control-value" id="syVal">2px</span></div>
                <input type="range" id="shadowY" min="0" max="30" value="2">
            </div>
            <div class="control-group">
                <div class="control-label"><span>Blur</span><span class="control-value" id="sbVal">4px</span></div>
                <input type="range" id="shadowBlur" min="0" max="50" value="4">
            </div>
            <div class="control-group">
                <label style="font-size:12px;color:var(--text-secondary);">Color</label>
                <input type="color" id="shadowColor" value="#000000" style="width:100%;height:40px;border:none;border-radius:8px;">
            </div>
            <button class="panel-btn primary" id="applyShadowBtn" style="width:100%;margin-top:8px;padding:12px;">Apply</button>
            <button class="panel-btn" id="removeShadowBtn" style="width:100%;margin-top:4px;padding:12px;">Remove</button>
        `;
        
        const updateShadow = () => {
            const x = document.getElementById('shadowX').value;
            const y = document.getElementById('shadowY').value;
            const b = document.getElementById('shadowBlur').value;
            const c = document.getElementById('shadowColor').value;
            this.selectedLayer.style.filter = `drop-shadow(${x}px ${y}px ${b}px ${c})`;
            document.getElementById('sxVal').textContent = x + 'px';
            document.getElementById('syVal').textContent = y + 'px';
            document.getElementById('sbVal').textContent = b + 'px';
        };
        
        ['shadowX', 'shadowY', 'shadowBlur', 'shadowColor'].forEach(id => {
            document.getElementById(id).addEventListener('input', updateShadow);
        });
        
        document.getElementById('applyShadowBtn').addEventListener('click', () => {
            this.saveState();
            this.scheduleAutoSave();
            this.closePanel();
        });
        
        document.getElementById('removeShadowBtn').addEventListener('click', () => {
            this.selectedLayer.style.filter = 'none';
            this.saveState();
            this.scheduleAutoSave();
            this.closePanel();
        });
    }
    
    // =============== IMAGE ADJUST ===============
    openImageAdjustPanel() {
        if (!this.selectedLayer || this.selectedLayer.dataset.type !== 'image') return;
        const img = this.selectedLayer.querySelector('img');
        if (!img) return;
        
        const content = this.getPanelContent();
        this.openPanel('Image Adjustments');
        
        const adjustments = [
            { id: 'brightness', name: 'Brightness', min: 0, max: 200, val: 100, unit: '%' },
            { id: 'contrast', name: 'Contrast', min: 0, max: 200, val: 100, unit: '%' },
            { id: 'saturation', name: 'Saturation', min: 0, max: 200, val: 100, unit: '%' },
            { id: 'hue', name: 'Hue', min: 0, max: 360, val: 0, unit: '°' },
            { id: 'opacity', name: 'Opacity', min: 10, max: 100, val: 100, unit: '%' }
        ];
        
        content.innerHTML = adjustments.map(a => `
            <div class="control-group">
                <div class="control-label">
                    <span>${a.name}</span>
                    <span class="control-value" id="${a.id}Val">${a.val}${a.unit}</span>
                </div>
                <input type="range" id="${a.id}Slider" min="${a.min}" max="${a.max}" value="${a.val}">
            </div>
        `).join('') + `
            <button class="panel-btn primary" id="applyAdjBtn" style="width:100%;margin-top:8px;padding:12px;">Apply</button>
            <button class="panel-btn" id="resetAdjBtn" style="width:100%;margin-top:4px;padding:12px;">Reset All</button>
        `;
        
        const apply = () => {
            const b = document.getElementById('brightnessSlider').value;
            const c = document.getElementById('contrastSlider').value;
            const s = document.getElementById('saturationSlider').value;
            const h = document.getElementById('hueSlider').value;
            const o = document.getElementById('opacitySlider').value;
            
            img.style.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) hue-rotate(${h}deg)`;
            this.selectedLayer.style.opacity = o / 100;
            
            document.getElementById('brightnessVal').textContent = b + '%';
            document.getElementById('contrastVal').textContent = c + '%';
            document.getElementById('saturationVal').textContent = s + '%';
            document.getElementById('hueVal').textContent = h + '°';
            document.getElementById('opacityVal').textContent = o + '%';
        };
        
        ['brightness', 'contrast', 'saturation', 'hue', 'opacity'].forEach(id => {
            document.getElementById(id + 'Slider').addEventListener('input', apply);
        });
        
        document.getElementById('applyAdjBtn').addEventListener('click', () => {
            this.saveState();
            this.scheduleAutoSave();
            this.closePanel();
        });
        
        document.getElementById('resetAdjBtn').addEventListener('click', () => {
            img.style.filter = 'none';
            this.selectedLayer.style.opacity = '1';
            this.saveState();
            this.scheduleAutoSave();
            this.closePanel();
        });
    }
    
    // =============== IMAGE FILTERS ===============
    openImageFilterPanel() {
        if (!this.selectedLayer || this.selectedLayer.dataset.type !== 'image') return;
        const img = this.selectedLayer.querySelector('img');
        if (!img) return;
        
        const content = this.getPanelContent();
        this.openPanel('Filters');
        
        const filters = [
            { name: 'Original', filter: 'none' },
            { name: 'Grayscale', filter: 'grayscale(100%)' },
            { name: 'Sepia', filter: 'sepia(100%)' },
            { name: 'Vintage', filter: 'sepia(50%) contrast(80%) brightness(90%)' },
            { name: 'Cool', filter: 'hue-rotate(180deg) saturate(80%)' },
            { name: 'Warm', filter: 'saturate(150%) hue-rotate(-20deg)' },
            { name: 'Dramatic', filter: 'contrast(150%) brightness(80%)' },
            { name: 'Fade', filter: 'brightness(120%) saturate(50%) contrast(90%)' }
        ];
        
        content.innerHTML = `
            <div class="filter-grid">
                ${filters.map((f, i) => `
                    <div class="filter-item" data-filter="${f.filter}">
                        <div style="background:linear-gradient(135deg, #6366f1, #8b5cf6);width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:white;font-size:10px;text-align:center;padding:4px;font-weight:500;">
                            ${f.name}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        content.querySelectorAll('.filter-item').forEach(item => {
            item.addEventListener('click', () => {
                img.style.filter = item.dataset.filter === 'none' ? '' : item.dataset.filter;
                this.saveState();
                this.scheduleAutoSave();
                this.closePanel();
            });
        });
    }
    
    // =============== SHAPE BORDER ===============
    openShapeBorderPanel() {
        if (!this.selectedLayer) return;
        const content = this.getPanelContent();
        this.openPanel('Border');
        
        content.innerHTML = `
            <div class="control-group">
                <div class="control-label"><span>Width</span><span class="control-value" id="bwVal">0px</span></div>
                <input type="range" id="borderWidth" min="0" max="20" value="0">
            </div>
            <label style="font-size:12px;color:var(--text-secondary);">Color</label>
            <input type="color" id="borderColor" value="#000000" style="width:100%;height:40px;border:none;border-radius:8px;">
            <button class="panel-btn primary" id="applyBorderBtn" style="width:100%;margin-top:8px;padding:12px;">Apply</button>
        `;
        
        document.getElementById('borderWidth').addEventListener('input', (e) => {
            document.getElementById('bwVal').textContent = e.target.value + 'px';
        });
        
        document.getElementById('applyBorderBtn').addEventListener('click', () => {
            const w = document.getElementById('borderWidth').value;
            const c = document.getElementById('borderColor').value;
            this.selectedLayer.style.border = `${w}px solid ${c}`;
            this.saveState();
            this.scheduleAutoSave();
            this.closePanel();
        });
    }
    
    // =============== BRUSH SIZE PANEL ===============
    openBrushSizePanel() {
        const content = this.getPanelContent();
        this.openPanel('Brush Settings');
        
        content.innerHTML = `
            <div class="control-group">
                <div class="control-label"><span>Size</span><span class="control-value" id="bsVal">${this.brushSize}px</span></div>
                <input type="range" id="brushSizeSlider" min="5" max="150" value="${this.brushSize}">
            </div>
            ${this.currentBrushType === 'paint' ? `
            <div class="control-group">
                <div class="control-label"><span>Opacity</span><span class="control-value" id="boVal">${this.brushOpacity * 100}%</span></div>
                <input type="range" id="brushOpacitySlider" min="10" max="100" value="${this.brushOpacity * 100}">
            </div>
            ` : ''}
        `;
        
        document.getElementById('brushSizeSlider').addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            document.getElementById('bsVal').textContent = this.brushSize + 'px';
        });
        
        if (this.currentBrushType === 'paint') {
            document.getElementById('brushOpacitySlider').addEventListener('input', (e) => {
                this.brushOpacity = parseInt(e.target.value) / 100;
                document.getElementById('boVal').textContent = e.target.value + '%';
            });
        }
    }
    
    // =============== BACKGROUND ===============
    changeBackground() {
        const content = this.getPanelContent();
        this.openPanel('Canvas Background');
        
        content.innerHTML = `
            <div class="color-grid" id="bgColorGrid"></div>
            <input type="color" id="bgColorInput" value="#ffffff" style="width:100%;height:40px;margin-top:12px;border:none;border-radius:8px;">
            <button class="panel-btn" id="bgImageBtn" style="width:100%;margin-top:8px;padding:12px;">📷 Background Image</button>
            <button class="panel-btn" id="bgResetBtn" style="width:100%;margin-top:4px;padding:12px;">Reset to White</button>
        `;
        
        const grid = document.getElementById('bgColorGrid');
        this.colorPalette.slice(0, 24).forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
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
        
        document.getElementById('bgResetBtn').addEventListener('click', () => {
            this.canvas.style.background = '#ffffff';
            this.canvas.style.backgroundImage = 'none';
            this.scheduleAutoSave();
            this.closePanel();
        });
    }
    
    // =============== EXPORT ===============
    async exportCanvas() {
        this.stopBrushing();
        this.deselectAllLayers();
        this.closePanel();
        
        try {
            if (typeof domtoimage !== 'undefined') {
                this.showToast('Exporting...');
                
                const dataUrl = await domtoimage.toJpeg(this.canvas, {
                    quality: 0.95,
                    bgcolor: '#ffffff',
                    width: this.canvasWidth * 3,
                    height: this.canvasHeight * 3,
                    style: {
                        transform: 'none',
                        filter: 'none'
                    }
                });
                
                const link = document.createElement('a');
                link.download = `statsnap-${Date.now()}.jpg`;
                link.href = dataUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                this.showToast('✅ Downloaded!');
            } else {
                this.showToast('Export library not loaded');
            }
        } catch (error) {
            console.error('Export failed:', error);
            this.showToast('Export failed. Try again.');
        }
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
        const current = this.serializeProject();
        this.redoStack.push(current);
        const prev = this.undoStack.pop();
        this.restoreProject(prev);
        this.updateUndoRedoButtons();
        this.scheduleAutoSave();
        this.showToast('Undo ↩️');
    }
    
    redo() {
        if (this.redoStack.length === 0) return;
        const current = this.serializeProject();
        this.undoStack.push(current);
        const next = this.redoStack.pop();
        this.restoreProject(next);
        this.updateUndoRedoButtons();
        this.scheduleAutoSave();
        this.showToast('Redo ↪️');
    }
    
    updateUndoRedoButtons() {
        document.getElementById('undoBtn').disabled = this.undoStack.length === 0;
        document.getElementById('redoBtn').disabled = this.redoStack.length === 0;
    }
    
    // =============== PERSISTENCE ===============
    async initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('statsnap-editor', 2);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('projects')) {
                    db.createObjectStore('projects', { keyPath: 'id' });
                }
            };
        });
    }
    
    async saveProject() {
        if (!this.db) return;
        try {
            const project = this.serializeProject();
            const tx = this.db.transaction('projects', 'readwrite');
            const store = tx.objectStore('projects');
            store.put({ id: 'current', data: project, timestamp: Date.now() });
        } catch (e) {
            console.warn('Save failed:', e);
        }
    }
    
    scheduleAutoSave() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => this.saveProject(), 2000);
    }
    
    startAutoSave() {
        this.autoSaveInterval = setInterval(() => this.saveProject(), 30000);
    }
    
    async loadProject() {
        if (!this.db) return;
        try {
            const tx = this.db.transaction('projects', 'readonly');
            const store = tx.objectStore('projects');
            const request = store.get('current');
            
            request.onsuccess = () => {
                if (request.result && request.result.data) {
                    this.restoreProject(request.result.data);
                }
            };
        } catch (e) {
            console.warn('Load failed:', e);
        }
    }
    
    serializeProject() {
        return {
            layers: this.layers.map(l => ({
                id: l.id,
                type: l.dataset.type,
                html: l.innerHTML,
                style: l.getAttribute('style') || '',
                rotation: l.dataset.rotation || '0',
                collageSlot: l.dataset.collageSlot
            })),
            canvasStyle: this.canvas.getAttribute('style') || '',
            canvasWidth: this.canvasWidth,
            canvasHeight: this.canvasHeight,
            scale: this.scale,
            panX: this.panX,
            panY: this.panY,
            mode: this.currentMode,
            collageImages: this.collageImages,
            version: '4.0'
        };
    }
    
    restoreProject(data) {
        this.canvas.querySelectorAll('.layer').forEach(l => l.remove());
        this.layers = [];
        this.selectedLayer = null;
        
        if (data.canvasWidth) this.canvasWidth = data.canvasWidth;
        if (data.canvasHeight) this.canvasHeight = data.canvasHeight;
        if (data.canvasStyle) this.canvas.setAttribute('style', data.canvasStyle);
        if (data.scale) this.scale = data.scale;
        if (data.panX !== undefined) this.panX = data.panX;
        if (data.panY !== undefined) this.panY = data.panY;
        if (data.collageImages) this.collageImages = data.collageImages;
        
        this.updateCanvasSize();
        this.applyCanvasTransform();
        
        if (data.mode) {
            this.currentMode = data.mode;
            document.querySelectorAll('.mode-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === data.mode);
            });
        }
        
        if (data.layers) {
            data.layers.forEach(ld => {
                const layer = document.createElement('div');
                layer.id = ld.id;
                layer.className = 'layer';
                layer.dataset.type = ld.type;
                layer.dataset.rotation = ld.rotation;
                if (ld.collageSlot !== undefined) layer.dataset.collageSlot = ld.collageSlot;
                layer.innerHTML = ld.html;
                layer.setAttribute('style', ld.style);
                
                if (ld.type === 'image') {
                    layer.classList.add('image-layer');
                    const img = layer.querySelector('img');
                    if (img) {
                        img.draggable = false;
                        img.style.width = '100%';
                        img.style.height = '100%';
                        img.style.objectFit = 'cover';
                    }
                }
                
                this.addHandles(layer);
                
                layer.addEventListener('pointerdown', (e) => {
                    if (this.isBrushing) return;
                    if (!e.target.classList.contains('resize-handle') && 
                        !e.target.classList.contains('rotate-handle')) {
                        e.stopPropagation();
                        this.selectLayer(layer);
                    }
                });
                
                if (ld.type === 'text') {
                    layer.setAttribute('contenteditable', 'true');
                    layer.dataset.placeholder = 'Type here...';
                    layer.addEventListener('input', () => this.scheduleAutoSave());
                }
                
                this.canvas.appendChild(layer);
                this.layers.push(layer);
                
                const idNum = parseInt(ld.id.split('-')[1]);
                if (!isNaN(idNum)) {
                    this.layerIdCounter = Math.max(this.layerIdCounter, idNum);
                }
            });
        }
        
        this.updateEmptyState();
        this.updateContextualTools();
    }
    
    // =============== KEYBOARD ===============
    handleKeyboard(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undo();
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' && e.shiftKey || e.key === 'y')) {
            e.preventDefault();
            this.redo();
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.selectedLayer && document.activeElement === document.body) {
                e.preventDefault();
                this.deleteSelectedLayer();
            }
        } else if (e.key === 'Escape') {
            this.stopBrushing();
            this.closePanel();
            this.deselectAllLayers();
        } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
            e.preventDefault();
            this.scale = 1;
            this.panX = 0;
            this.panY = 0;
            this.applyCanvasTransform();
            this.showToast('Reset zoom');
        } else if ((e.ctrlKey || e.metaKey) && e.key === '=') {
            e.preventDefault();
            this.scale = Math.min(this.maxScale, this.scale + 0.1);
            this.applyCanvasTransform();
        } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
            e.preventDefault();
            this.scale = Math.max(this.minScale, this.scale - 0.1);
            this.applyCanvasTransform();
        }
    }
    
    // =============== MENU ===============
    toggleMenu() {
        this.isMenuOpen = !this.isMenuOpen;
        
        if (this.isMenuOpen) {
            this.showMenu();
        } else {
            this.hideMenu();
        }
    }
    
    showMenu() {
        let menu = document.getElementById('hamburgerMenu');
        if (!menu) {
            menu = document.createElement('div');
            menu.id = 'hamburgerMenu';
            menu.style.cssText = `
                position: fixed;
                top: 56px;
                left: 0;
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: 0 0 16px 0;
                box-shadow: var(--shadow-lg);
                z-index: 150;
                padding: 8px;
                min-width: 200px;
                animation: slideDown 0.2s ease;
            `;
            
            menu.innerHTML = `
                <button class="menu-item" data-action="newProject">📄 New Project</button>
                <button class="menu-item" data-action="saveProject">💾 Save Project</button>
                <button class="menu-item" data-action="exportImage">📤 Export Image</button>
                <button class="menu-item" data-action="resetZoom">🔍 Reset Zoom</button>
                <button class="menu-item" data-action="clearCanvas">🗑 Clear Canvas</button>
            `;
            
            document.body.appendChild(menu);
            
            const style = document.createElement('style');
            style.textContent = `
                .menu-item {
                    display: block;
                    width: 100%;
                    padding: 12px 16px;
                    border: none;
                    background: transparent;
                    color: var(--text-primary);
                    font-size: 14px;
                    text-align: left;
                    cursor: pointer;
                    border-radius: 8px;
                    font-family: var(--font-family);
                    transition: background 0.15s;
                }
                .menu-item:hover {
                    background: var(--bg-tertiary);
                }
                @keyframes slideDown {
                    from { transform: translateY(-10px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
            
            menu.querySelectorAll('.menu-item').forEach(item => {
                item.addEventListener('click', () => {
                    const action = item.dataset.action;
                    this.handleMenuAction(action);
                    this.hideMenu();
                });
            });
        }
        
        menu.style.display = 'block';
        
        const closeHandler = (e) => {
            if (!menu.contains(e.target) && e.target !== document.getElementById('menuBtn')) {
                this.hideMenu();
                document.removeEventListener('pointerdown', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('pointerdown', closeHandler), 100);
    }
    
    hideMenu() {
        this.isMenuOpen = false;
        const menu = document.getElementById('hamburgerMenu');
        if (menu) menu.style.display = 'none';
    }
    
    handleMenuAction(action) {
        switch(action) {
            case 'newProject':
                if (confirm('Start new project? Unsaved changes lost.')) {
                    this.clearCanvas();
                }
                break;
            case 'saveProject':
                this.saveProject();
                this.showToast('✅ Saved');
                break;
            case 'exportImage':
                this.exportCanvas();
                break;
            case 'resetZoom':
                this.scale = 1;
                this.panX = 0;
                this.panY = 0;
                this.applyCanvasTransform();
                this.showToast('Zoom reset');
                break;
            case 'clearCanvas':
                if (confirm('Clear all layers?')) {
                    this.clearCanvas();
                }
                break;
        }
    }
    
    clearCanvas() {
        this.layers.forEach(l => l.remove());
        this.layers = [];
        this.selectedLayer = null;
        this.collageImages = [];
        this.canvas.style.background = '#ffffff';
        this.canvas.style.backgroundImage = 'none';
        this.undoStack = [];
        this.redoStack = [];
        this.updateEmptyState();
        this.updateContextualTools();
        this.updateUndoRedoButtons();
        this.saveState();
        this.scheduleAutoSave();
    }
    
    // =============== UTILITIES ===============
    showToast(message) {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 2500);
    }
    
    destroy() {
        clearInterval(this.autoSaveInterval);
        clearTimeout(this.saveTimeout);
        this.stopBrushing();
        if (this.db) this.db.close();
    }
}

// =============== INITIALIZE ===============
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
