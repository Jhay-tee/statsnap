// ============================================
// STATSNAP - Working Production Editor
// ============================================

(function() {
    'use strict';
    
    // =============== DOM ELEMENTS ===============
    const canvas = document.getElementById('mainCanvas');
    const canvasContainer = document.getElementById('canvasContainer');
    const brushCanvas = document.getElementById('brushCanvas');
    const emptyState = document.getElementById('emptyState');
    const slidePanel = document.getElementById('slidePanel');
    const panelTitle = document.getElementById('panelTitle');
    const panelContent = document.getElementById('panelContent');
    const colorPickerPopup = document.getElementById('colorPickerPopup');
    const hamburgerMenu = document.getElementById('hamburgerMenu');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    // =============== STATE ===============
    let layers = [];
    let selectedLayer = null;
    let currentMode = 'design';
    let layerIdCounter = 0;
    
    // Interaction flags
    let isDragging = false;
    let isResizing = false;
    let isRotating = false;
    let isPanning = false;
    let isPinching = false;
    let isBrushing = false;
    let currentBrushType = null;
    
    // Transform state
    let scale = 1;
    let panX = 0;
    let panY = 0;
    const MIN_SCALE = 0.3;
    const MAX_SCALE = 3;
    
    // Drag state
    let dragStartX = 0;
    let dragStartY = 0;
    let dragLayerStartX = 0;
    let dragLayerStartY = 0;
    let dragCanvasStartX = 0;
    let dragCanvasStartY = 0;
    
    // Resize state
    let resizeHandle = null;
    let resizeLayer = null;
    let resizeStart = {};
    
    // Rotate state
    let rotateLayer = null;
    let rotateCenter = {};
    let rotateStartAngle = 0;
    let rotateStartDeg = 0;
    
    // Pinch state
    let lastPinchDist = 0;
    let pinchStartScale = 1;
    
    // Brush state
    let brushColor = '#000000';
    let brushSize = 30;
    let brushOpacity = 1;
    let lastBrushPos = null;
    let brushPoints = [];
    
    // Undo/Redo
    let undoStack = [];
    let redoStack = [];
    const MAX_HISTORY = 50;
    
    // Save
    let saveTimeout = null;
    let autoSaveInterval = null;
    let db = null;
    
    // Menu
    let isMenuOpen = false;
    
    // Color palette
    const colorPalette = [
        '#000000', '#ffffff', '#ef4444', '#f97316', '#f59e0b', '#eab308',
        '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
        '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
        '#f43f5e', '#78716c', '#6b7280', '#374151', '#1f2937', '#111827',
        '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706',
        '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a',
        '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb'
    ];
    
    // =============== INIT ===============
    function init() {
        console.log('Statsnap initializing...');
        setupTheme();
        setupBrushCanvas();
        setupColorPalette();
        bindEvents();
        initDatabase().then(() => {
            loadProject();
        });
        startAutoSave();
        updateUndoRedoButtons();
        updateEmptyState();
        updateContextualTools();
        console.log('Statsnap ready!');
    }
    
    // =============== THEME ===============
    function setupTheme() {
        const saved = localStorage.getItem('statsnap-theme');
        if (saved) {
            document.documentElement.setAttribute('data-theme', saved);
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }
    
    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('statsnap-theme', next);
        showToast(next === 'dark' ? '🌙 Dark mode' : '☀️ Light mode');
    }
    
    // =============== BRUSH CANVAS ===============
    function setupBrushCanvas() {
        brushCanvas.width = canvas.offsetWidth;
        brushCanvas.height = canvas.offsetHeight;
        brushCanvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            pointer-events: none;
            z-index: 998;
            display: none;
        `;
        canvas.appendChild(brushCanvas);
    }
    
    function setupColorPalette() {
        const grid = document.getElementById('colorGrid');
        if (!grid) return;
        grid.innerHTML = '';
        colorPalette.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                brushColor = color;
                document.getElementById('customColorInput').value = color;
                grid.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
                swatch.classList.add('selected');
            });
            grid.appendChild(swatch);
        });
    }
    
    // =============== EVENT BINDING ===============
    function bindEvents() {
        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', toggleTheme);
        
        // Undo/Redo
        undoBtn.addEventListener('click', undo);
        redoBtn.addEventListener('click', redo);
        
        // Close panel
        document.getElementById('closePanel').addEventListener('click', closePanel);
        
        // Menu button
        document.getElementById('menuBtn').addEventListener('click', toggleMenu);
        
        // Menu items
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', function() {
                handleMenuAction(this.dataset.action);
                hideMenu();
            });
        });
        
        // Mode switching
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                switchMode(this.dataset.mode);
            });
        });
        
        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                handleToolAction(this.dataset.action, this);
            });
        });
        
        // Canvas container events
        canvasContainer.addEventListener('pointerdown', handlePointerDown);
        canvasContainer.addEventListener('pointermove', handlePointerMove);
        canvasContainer.addEventListener('pointerup', handlePointerUp);
        canvasContainer.addEventListener('pointerleave', handlePointerUp);
        canvasContainer.addEventListener('pointercancel', handlePointerUp);
        
        // Wheel zoom
        canvasContainer.addEventListener('wheel', handleWheel, { passive: false });
        
        // Touch events for pinch
        canvasContainer.addEventListener('touchstart', function(e) {
            if (e.touches.length === 2) e.preventDefault();
        }, { passive: false });
        
        canvasContainer.addEventListener('touchmove', function(e) {
            if (e.touches.length === 2) e.preventDefault();
        }, { passive: false });
        
        // Keyboard
        document.addEventListener('keydown', handleKeyboard);
        
        // Custom color input
        document.getElementById('customColorInput').addEventListener('input', function(e) {
            brushColor = e.target.value;
        });
        
        // Close menu on outside click
        document.addEventListener('pointerdown', function(e) {
            if (isMenuOpen && !hamburgerMenu.contains(e.target) && e.target !== document.getElementById('menuBtn')) {
                hideMenu();
            }
        });
    }
    
    // =============== POINTER HANDLERS ===============
    function handlePointerDown(e) {
        // Pinch detection
        if (e.pointerType === 'touch') {
            const touches = getTouches(e);
            if (touches && touches.length === 2) {
                startPinch(touches);
                return;
            }
        }
        
        const target = e.target;
        
        // Resize handle
        if (target.classList.contains('resize-handle')) {
            startResize(target, e);
            return;
        }
        
        // Rotate handle
        if (target.classList.contains('rotate-handle')) {
            startRotate(target, e);
            return;
        }
        
        // Layer
        const layer = target.closest('.layer');
        if (layer && !isBrushing) {
            startDragLayer(layer, e);
            return;
        }
        
        // Brush
        if (isBrushing && (target === canvas || target === brushCanvas)) {
            startBrush(e);
            return;
        }
        
        // Pan canvas
        if (target === canvas || target === canvasContainer || target.closest('#canvasContainer') || target.closest('#canvasOverlay')) {
            startPan(e);
            deselectAllLayers();
            closePanel();
        }
    }
    
    function handlePointerMove(e) {
        if (isPinching) {
            const touches = getTouches(e);
            if (touches && touches.length === 2) {
                updatePinch(touches);
                return;
            }
        }
        
        if (isDragging) { updateDragLayer(e); return; }
        if (isResizing) { updateResize(e); return; }
        if (isRotating) { updateRotate(e); return; }
        if (isPanning) { updatePan(e); return; }
        if (isBrushing) { updateBrush(e); return; }
    }
    
    function handlePointerUp(e) {
        if (isDragging) endDragLayer();
        if (isResizing) endResize();
        if (isRotating) endRotate();
        if (isPanning) endPan();
        if (isPinching) endPinch();
        if (isBrushing) endBrush();
    }
    
    function getTouches(e) {
        if (e.touches && e.touches.length >= 2) {
            return Array.from(e.touches);
        }
        return null;
    }
    
    // =============== PAN ===============
    function startPan(e) {
        isPanning = true;
        dragCanvasStartX = e.clientX - panX;
        dragCanvasStartY = e.clientY - panY;
        canvas.style.transition = 'none';
        canvas.style.cursor = 'grabbing';
    }
    
    function updatePan(e) {
        if (!isPanning) return;
        panX = e.clientX - dragCanvasStartX;
        panY = e.clientY - dragCanvasStartY;
        applyTransform();
    }
    
    function endPan() {
        isPanning = false;
        canvas.style.transition = 'transform 0.1s ease-out';
        canvas.style.cursor = '';
    }
    
    // =============== PINCH ZOOM ===============
    function startPinch(touches) {
        isPinching = true;
        pinchStartScale = scale;
        lastPinchDist = getPinchDistance(touches);
        canvas.style.transition = 'none';
    }
    
    function updatePinch(touches) {
        if (!isPinching || touches.length < 2) return;
        
        const currentDist = getPinchDistance(touches);
        const midpoint = getPinchMidpoint(touches);
        const scaleFactor = currentDist / lastPinchDist;
        
        let newScale = pinchStartScale * scaleFactor;
        newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
        
        const canvasRect = canvas.getBoundingClientRect();
        const cx = canvasRect.left + canvasRect.width / 2;
        const cy = canvasRect.top + canvasRect.height / 2;
        
        const scaleDiff = newScale - scale;
        panX -= (midpoint.x - cx) * scaleDiff / scale;
        panY -= (midpoint.y - cy) * scaleDiff / scale;
        
        scale = newScale;
        applyTransform();
        
        lastPinchDist = currentDist;
        pinchStartScale = scale;
    }
    
    function endPinch() {
        isPinching = false;
        canvas.style.transition = 'transform 0.1s ease-out';
    }
    
    function getPinchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    function getPinchMidpoint(touches) {
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2
        };
    }
    
    // =============== WHEEL ZOOM ===============
    function handleWheel(e) {
        e.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        let newScale = scale * zoomFactor;
        newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
        
        const scaleDiff = newScale - scale;
        panX -= (mouseX - rect.width / 2) * scaleDiff / scale;
        panY -= (mouseY - rect.height / 2) * scaleDiff / scale;
        
        scale = newScale;
        applyTransform();
    }
    
    function applyTransform() {
        canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    }
    
    // =============== LAYER DRAG ===============
    function startDragLayer(layer, e) {
        if (isBrushing) return;
        if (e.target.isContentEditable) return;
        
        selectLayer(layer);
        isDragging = true;
        
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragLayerStartX = parseFloat(layer.style.left) || 0;
        dragLayerStartY = parseFloat(layer.style.top) || 0;
        
        layer.classList.add('dragging');
        layer.style.transition = 'none';
        layer.setPointerCapture(e.pointerId);
    }
    
    function updateDragLayer(e) {
        if (!isDragging || !selectedLayer) return;
        
        const dx = (e.clientX - dragStartX) / scale;
        const dy = (e.clientY - dragStartY) / scale;
        
        selectedLayer.style.left = `${dragLayerStartX + dx}px`;
        selectedLayer.style.top = `${dragLayerStartY + dy}px`;
    }
    
    function endDragLayer() {
        if (!isDragging) return;
        isDragging = false;
        
        if (selectedLayer) {
            selectedLayer.classList.remove('dragging');
            selectedLayer.style.transition = '';
            
            const cl = parseFloat(selectedLayer.style.left) || 0;
            const ct = parseFloat(selectedLayer.style.top) || 0;
            
            if (Math.abs(cl - dragLayerStartX) > 1 || Math.abs(ct - dragLayerStartY) > 1) {
                saveState();
                scheduleAutoSave();
            }
        }
    }
    
    // =============== RESIZE ===============
    function startResize(handle, e) {
        e.stopPropagation();
        e.preventDefault();
        
        const layer = handle.closest('.layer');
        if (!layer) return;
        
        selectLayer(layer);
        isResizing = true;
        resizeHandle = handle;
        resizeLayer = layer;
        
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        resizeStart = {
            width: layer.offsetWidth,
            height: layer.offsetHeight,
            left: parseFloat(layer.style.left) || 0,
            top: parseFloat(layer.style.top) || 0,
            position: handle.dataset.position
        };
        
        handle.setPointerCapture(e.pointerId);
    }
    
    function updateResize(e) {
        if (!isResizing || !resizeLayer) return;
        
        const dx = (e.clientX - dragStartX) / scale;
        const dy = (e.clientY - dragStartY) / scale;
        const pos = resizeStart.position;
        
        let w = resizeStart.width;
        let h = resizeStart.height;
        let l = resizeStart.left;
        let t = resizeStart.top;
        
        switch(pos) {
            case 'bottom-right': w = Math.max(30, resizeStart.width + dx); h = Math.max(30, resizeStart.height + dy); break;
            case 'bottom-left': w = Math.max(30, resizeStart.width - dx); h = Math.max(30, resizeStart.height + dy); l = resizeStart.left + dx; break;
            case 'top-right': w = Math.max(30, resizeStart.width + dx); h = Math.max(30, resizeStart.height - dy); t = resizeStart.top + dy; break;
            case 'top-left': w = Math.max(30, resizeStart.width - dx); h = Math.max(30, resizeStart.height - dy); l = resizeStart.left + dx; t = resizeStart.top + dy; break;
            case 'bottom-center': h = Math.max(30, resizeStart.height + dy); break;
            case 'top-center': h = Math.max(30, resizeStart.height - dy); t = resizeStart.top + dy; break;
            case 'right-center': w = Math.max(30, resizeStart.width + dx); break;
            case 'left-center': w = Math.max(30, resizeStart.width - dx); l = resizeStart.left + dx; break;
        }
        
        resizeLayer.style.width = `${w}px`;
        resizeLayer.style.height = `${h}px`;
        resizeLayer.style.left = `${l}px`;
        resizeLayer.style.top = `${t}px`;
    }
    
    function endResize() {
        if (isResizing) {
            saveState();
            scheduleAutoSave();
        }
        isResizing = false;
        resizeHandle = null;
        resizeLayer = null;
    }
    
    // =============== ROTATE ===============
    function startRotate(handle, e) {
        e.stopPropagation();
        e.preventDefault();
        
        const layer = handle.closest('.layer');
        if (!layer) return;
        
        selectLayer(layer);
        isRotating = true;
        rotateLayer = layer;
        
        const rect = layer.getBoundingClientRect();
        rotateCenter = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        rotateStartAngle = Math.atan2(e.clientY - rotateCenter.y, e.clientX - rotateCenter.x);
        rotateStartDeg = parseFloat(layer.dataset.rotation || 0);
        
        handle.setPointerCapture(e.pointerId);
    }
    
    function updateRotate(e) {
        if (!isRotating || !rotateLayer) return;
        
        const angle = Math.atan2(e.clientY - rotateCenter.y, e.clientX - rotateCenter.x);
        const diff = (angle - rotateStartAngle) * (180 / Math.PI);
        const rotation = rotateStartDeg + diff;
        
        rotateLayer.style.transform = `rotate(${rotation}deg)`;
        rotateLayer.dataset.rotation = rotation;
    }
    
    function endRotate() {
        if (isRotating) {
            saveState();
            scheduleAutoSave();
        }
        isRotating = false;
        rotateLayer = null;
    }
    
    // =============== BRUSH ===============
    function startBrush(e) {
        isBrushing = true;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
        lastBrushPos = { x, y };
        brushPoints = [{ x, y }];
        showBrushIndicator(e.clientX, e.clientY);
    }
    
    function updateBrush(e) {
        if (!isBrushing || !currentBrushType) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
        
        showBrushIndicator(e.clientX, e.clientY);
        brushPoints.push({ x, y });
        
        const ctx = brushCanvas.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(lastBrushPos.x, lastBrushPos.y);
        ctx.lineTo(x, y);
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if (currentBrushType === 'paint') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = brushColor;
            ctx.globalAlpha = brushOpacity;
        } else if (currentBrushType === 'blur') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = 'rgba(128,128,128,0.5)';
            ctx.filter = `blur(${brushSize / 3}px)`;
        }
        
        ctx.stroke();
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
        
        lastBrushPos = { x, y };
    }
    
    function endBrush() {
        if (!isBrushing) return;
        isBrushing = false;
        hideBrushIndicator();
        
        if (brushPoints.length > 0 && selectedLayer && selectedLayer.dataset.type === 'image') {
            applyBrushToLayer();
        }
        
        brushPoints = [];
        brushCanvas.getContext('2d').clearRect(0, 0, brushCanvas.width, brushCanvas.height);
    }
    
    function applyBrushToLayer() {
        const img = selectedLayer.querySelector('img');
        if (!img) return;
        
        const tempCanvas = document.createElement('canvas');
        const w = selectedLayer.offsetWidth;
        const h = selectedLayer.offsetHeight;
        tempCanvas.width = w;
        tempCanvas.height = h;
        const ctx = tempCanvas.getContext('2d');
        
        ctx.drawImage(img, 0, 0, w, h);
        
        if (currentBrushType === 'paint') {
            ctx.drawImage(brushCanvas, 0, 0);
        } else if (currentBrushType === 'blur') {
            const blurCanvas = document.createElement('canvas');
            blurCanvas.width = w;
            blurCanvas.height = h;
            const blurCtx = blurCanvas.getContext('2d');
            blurCtx.filter = `blur(${brushSize / 2}px)`;
            blurCtx.drawImage(img, 0, 0, w, h);
            
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = w;
            maskCanvas.height = h;
            const maskCtx = maskCanvas.getContext('2d');
            maskCtx.drawImage(brushCanvas, 0, 0);
            
            ctx.globalCompositeOperation = 'destination-out';
            ctx.drawImage(maskCanvas, 0, 0);
            ctx.globalCompositeOperation = 'destination-over';
            ctx.drawImage(blurCanvas, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
        }
        
        img.src = tempCanvas.toDataURL('image/png');
        saveState();
        scheduleAutoSave();
    }
    
    function showBrushIndicator(x, y) {
        let indicator = document.querySelector('.brush-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'brush-indicator';
            document.body.appendChild(indicator);
        }
        indicator.style.display = 'block';
        indicator.style.left = x + 'px';
        indicator.style.top = y + 'px';
        indicator.style.width = (brushSize * scale) + 'px';
        indicator.style.height = (brushSize * scale) + 'px';
    }
    
    function hideBrushIndicator() {
        const indicator = document.querySelector('.brush-indicator');
        if (indicator) indicator.style.display = 'none';
    }
    
    // =============== TOOL HANDLING ===============
    function handleToolAction(action, btn) {
        if (action === 'paintBrush') {
            toggleBrush('paint', btn);
            return;
        }
        if (action === 'blurBrush') {
            toggleBrush('blur', btn);
            return;
        }
        
        stopBrushing();
        
        switch(action) {
            case 'addText': addTextLayer(); break;
            case 'addImage': addImageLayer(); break;
            case 'addShape': addShapeLayer(); break;
            case 'changeBackground': changeBackground(); break;
            case 'exportImage': exportCanvas(); break;
            case 'deleteLayer': deleteSelectedLayer(); break;
            case 'textColor': openColorPicker('text'); break;
            case 'textBold': openBoldnessPanel(); break;
            case 'textAlign': openTextAlignPanel(); break;
            case 'dropShadow': openDropShadowPanel(); break;
            case 'imageAdjust': openImageAdjustPanel(); break;
            case 'imageFilter': openImageFilterPanel(); break;
            case 'shapeColor': openColorPicker('shape'); break;
            case 'shapeBorder': openShapeBorderPanel(); break;
        }
    }
    
    function toggleBrush(type, btn) {
        if (currentBrushType === type) {
            stopBrushing();
            return;
        }
        
        stopBrushing();
        currentBrushType = type;
        isBrushing = false;
        btn.classList.add('active-tool');
        brushCanvas.style.display = 'block';
        
        if (type === 'paint') {
            colorPickerPopup.style.display = 'block';
        }
        
        openBrushSizePanel();
        showToast(`${type === 'paint' ? 'Paint' : 'Blur'} brush ready`);
    }
    
    function stopBrushing() {
        currentBrushType = null;
        isBrushing = false;
        brushCanvas.style.display = 'none';
        brushCanvas.getContext('2d').clearRect(0, 0, brushCanvas.width, brushCanvas.height);
        hideBrushIndicator();
        colorPickerPopup.style.display = 'none';
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active-tool'));
        closePanel();
    }
    
    // =============== LAYER MANAGEMENT ===============
    function addTextLayer() {
        stopBrushing();
        const layer = createLayerElement('text');
        layer.textContent = 'Double tap to edit';
        layer.setAttribute('contenteditable', 'true');
        layer.classList.add('text-layer');
        
        layer.addEventListener('focus', function() {
            if (this.textContent === 'Double tap to edit') {
                this.textContent = '';
            }
        });
        
        layer.addEventListener('blur', function() {
            if (!this.textContent.trim()) {
                this.textContent = 'Double tap to edit';
            }
            scheduleAutoSave();
        });
        
        layer.addEventListener('input', scheduleAutoSave);
        
        positionLayerCenter(layer);
        addLayerToCanvas(layer);
        selectLayer(layer);
        saveState();
        
        setTimeout(() => layer.focus(), 100);
    }
    
    function addImageLayer() {
        stopBrushing();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.addEventListener('change', function(e) {
            Array.from(e.target.files).forEach(file => {
                const reader = new FileReader();
                reader.onload = function(ev) {
                    createImageLayer(ev.target.result);
                };
                reader.readAsDataURL(file);
            });
        });
        input.click();
    }
    
    function createImageLayer(url) {
        const layer = createLayerElement('image');
        layer.classList.add('image-layer');
        
        const img = document.createElement('img');
        img.src = url;
        img.draggable = false;
        layer.appendChild(img);
        
        img.onload = function() {
            const maxDim = 250;
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            const ratio = w / h;
            
            if (w > maxDim) { w = maxDim; h = w / ratio; }
            if (h > maxDim) { h = maxDim; w = h * ratio; }
            
            layer.style.width = `${Math.round(w)}px`;
            layer.style.height = `${Math.round(h)}px`;
        };
        
        if (img.complete && img.naturalWidth) img.onload();
        
        positionLayerCenter(layer);
        addLayerToCanvas(layer);
        selectLayer(layer);
        saveState();
    }
    
    function addShapeLayer() {
        stopBrushing();
        const layer = createLayerElement('shape');
        layer.classList.add('shape-layer');
        layer.style.background = '#6366f1';
        layer.style.width = '120px';
        layer.style.height = '120px';
        layer.style.borderRadius = '8px';
        
        positionLayerCenter(layer);
        addLayerToCanvas(layer);
        selectLayer(layer);
        saveState();
    }
    
    function createLayerElement(type) {
        const layer = document.createElement('div');
        layer.id = `layer-${++layerIdCounter}`;
        layer.className = 'layer';
        layer.dataset.type = type;
        layer.style.zIndex = layers.length + 1;
        layer.style.position = 'absolute';
        
        addHandles(layer);
        
        layer.addEventListener('pointerdown', function(e) {
            if (isBrushing) return;
            if (!e.target.classList.contains('resize-handle') && !e.target.classList.contains('rotate-handle')) {
                e.stopPropagation();
                selectLayer(layer);
            }
        });
        
        return layer;
    }
    
    function addHandles(layer) {
        const positions = ['top-left', 'top-center', 'top-right', 'left-center', 'right-center', 'bottom-left', 'bottom-center', 'bottom-right'];
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
    
    function addLayerToCanvas(layer) {
        canvas.appendChild(layer);
        layers.push(layer);
        updateEmptyState();
        updateContextualTools();
    }
    
    function selectLayer(layer) {
        deselectAllLayers();
        layer.classList.add('selected');
        selectedLayer = layer;
        updateContextualTools();
    }
    
    function deselectAllLayers() {
        layers.forEach(l => l.classList.remove('selected'));
        selectedLayer = null;
        updateContextualTools();
    }
    
    function deleteSelectedLayer() {
        if (!selectedLayer) return;
        const layer = selectedLayer;
        layer.style.opacity = '0';
        layer.style.transform = (layer.dataset.rotation ? `rotate(${layer.dataset.rotation}deg) ` : '') + 'scale(0.8)';
        layer.style.transition = 'opacity 0.2s, transform 0.2s';
        
        setTimeout(() => {
            layer.remove();
            layers = layers.filter(l => l !== layer);
            selectedLayer = null;
            updateEmptyState();
            updateContextualTools();
            saveState();
            scheduleAutoSave();
        }, 200);
        
        showToast('Layer deleted');
    }
    
    function positionLayerCenter(layer) {
        const cw = canvas.offsetWidth;
        const ch = canvas.offsetHeight;
        const lw = parseInt(layer.style.width) || 120;
        const lh = parseInt(layer.style.height) || 120;
        layer.style.left = `${Math.round((cw - lw) / 2)}px`;
        layer.style.top = `${Math.round((ch - lh) / 2)}px`;
    }
    
    function updateEmptyState() {
        emptyState.style.display = layers.length === 0 ? 'block' : 'none';
    }
    
    function updateContextualTools() {
        document.querySelectorAll('.tool-group').forEach(g => g.classList.remove('active'));
        
        if (!selectedLayer) {
            document.getElementById('defaultTools').classList.add('active');
        } else {
            const type = selectedLayer.dataset.type;
            const map = { 'text': 'textTools', 'image': 'imageTools', 'shape': 'shapeTools' };
            const id = map[type];
            if (id) document.getElementById(id).classList.add('active');
        }
    }
    
    // =============== MODE ===============
    function switchMode(mode) {
        if (currentMode === mode) return;
        stopBrushing();
        currentMode = mode;
        
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        
        deselectAllLayers();
        updateContextualTools();
        showToast(`${mode.charAt(0).toUpperCase() + mode.slice(1)} mode`);
    }
    
    // =============== PANELS ===============
    function openPanel(title) {
        panelTitle.textContent = title;
        slidePanel.classList.add('open');
    }
    
    function closePanel() {
        slidePanel.classList.remove('open');
    }
    
    // =============== COLOR PICKER ===============
    function openColorPicker(target) {
        openPanel('Choose Color');
        
        panelContent.innerHTML = `
            <div class="color-grid" id="panelColorGrid"></div>
            <input type="color" id="panelColorInput" value="${brushColor}" style="width:100%;height:40px;margin-top:12px;border:none;border-radius:8px;cursor:pointer;">
        `;
        
        const grid = document.getElementById('panelColorGrid');
        colorPalette.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.addEventListener('pointerdown', function(e) {
                e.stopPropagation();
                const val = color;
                document.getElementById('panelColorInput').value = val;
                if (target === 'text' && selectedLayer) selectedLayer.style.color = val;
                if (target === 'shape' && selectedLayer) selectedLayer.style.background = val;
                scheduleAutoSave();
            });
            grid.appendChild(swatch);
        });
        
        document.getElementById('panelColorInput').addEventListener('input', function(e) {
            if (target === 'text' && selectedLayer) selectedLayer.style.color = e.target.value;
            if (target === 'shape' && selectedLayer) selectedLayer.style.background = e.target.value;
            scheduleAutoSave();
        });
    }
    
    // =============== BOLDNESS ===============
    function openBoldnessPanel() {
        if (!selectedLayer) return;
        openPanel('Text Boldness');
        
        const current = parseInt(selectedLayer.style.fontWeight) || 400;
        
        panelContent.innerHTML = `
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
        
        const update = (val) => {
            selectedLayer.style.fontWeight = val;
            document.getElementById('boldVal').textContent = val;
            const slider = document.getElementById('boldSlider');
            if (slider) slider.value = val;
            scheduleAutoSave();
        };
        
        document.getElementById('boldSlider').addEventListener('input', function(e) { update(e.target.value); });
        
        panelContent.querySelectorAll('.panel-btn').forEach(btn => {
            btn.addEventListener('click', function() { update(this.dataset.weight); });
        });
    }
    
    // =============== TEXT ALIGN ===============
    function openTextAlignPanel() {
        if (!selectedLayer) return;
        openPanel('Text Alignment');
        
        panelContent.innerHTML = `
            <div style="display:flex;gap:8px;">
                ${['left', 'center', 'right', 'justify'].map(a => `
                    <button class="panel-btn" data-align="${a}" style="flex:1;font-size:18px;">
                        ${a === 'left' ? '⬅' : a === 'center' ? '↔' : a === 'right' ? '➡' : '☰'} ${a}
                    </button>
                `).join('')}
            </div>
        `;
        
        panelContent.querySelectorAll('.panel-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                selectedLayer.style.textAlign = this.dataset.align;
                closePanel();
                scheduleAutoSave();
            });
        });
    }
    
    // =============== DROP SHADOW ===============
    function openDropShadowPanel() {
        if (!selectedLayer) return;
        openPanel('Drop Shadow');
        
        panelContent.innerHTML = `
            <div class="control-group">
                <div class="control-label"><span>Offset X</span><span class="control-value" id="sxVal">2px</span></div>
                <input type="range" id="sx" min="0" max="30" value="2">
            </div>
            <div class="control-group">
                <div class="control-label"><span>Offset Y</span><span class="control-value" id="syVal">2px</span></div>
                <input type="range" id="sy" min="0" max="30" value="2">
            </div>
            <div class="control-group">
                <div class="control-label"><span>Blur</span><span class="control-value" id="sbVal">4px</span></div>
                <input type="range" id="sb" min="0" max="50" value="4">
            </div>
            <div class="control-group">
                <label style="font-size:12px;color:var(--text-secondary);">Color</label>
                <input type="color" id="sc" value="#000000" style="width:100%;height:40px;border:none;border-radius:8px;">
            </div>
            <button class="panel-btn primary" id="applyShadow" style="width:100%;margin-top:8px;padding:12px;">Apply</button>
            <button class="panel-btn" id="removeShadow" style="width:100%;margin-top:4px;padding:12px;">Remove</button>
        `;
        
        const update = () => {
            const x = document.getElementById('sx').value;
            const y = document.getElementById('sy').value;
            const b = document.getElementById('sb').value;
            const c = document.getElementById('sc').value;
            selectedLayer.style.filter = `drop-shadow(${x}px ${y}px ${b}px ${c})`;
            document.getElementById('sxVal').textContent = x + 'px';
            document.getElementById('syVal').textContent = y + 'px';
            document.getElementById('sbVal').textContent = b + 'px';
        };
        
        ['sx', 'sy', 'sb', 'sc'].forEach(id => {
            document.getElementById(id).addEventListener('input', update);
        });
        
        document.getElementById('applyShadow').addEventListener('click', () => {
            saveState();
            scheduleAutoSave();
            closePanel();
        });
        
        document.getElementById('removeShadow').addEventListener('click', () => {
            selectedLayer.style.filter = 'none';
            saveState();
            scheduleAutoSave();
            closePanel();
        });
    }
    
    // =============== IMAGE ADJUST ===============
    function openImageAdjustPanel() {
        if (!selectedLayer || selectedLayer.dataset.type !== 'image') return;
        const img = selectedLayer.querySelector('img');
        if (!img) return;
        
        openPanel('Image Adjustments');
        
        const adjustments = [
            { id: 'brightness', name: 'Brightness', min: 0, max: 200, val: 100, unit: '%' },
            { id: 'contrast', name: 'Contrast', min: 0, max: 200, val: 100, unit: '%' },
            { id: 'saturation', name: 'Saturation', min: 0, max: 200, val: 100, unit: '%' },
            { id: 'hue', name: 'Hue', min: 0, max: 360, val: 0, unit: '°' },
            { id: 'opacity', name: 'Opacity', min: 10, max: 100, val: 100, unit: '%' }
        ];
        
        panelContent.innerHTML = adjustments.map(a => `
            <div class="control-group">
                <div class="control-label"><span>${a.name}</span><span class="control-value" id="${a.id}Val">${a.val}${a.unit}</span></div>
                <input type="range" id="${a.id}Slider" min="${a.min}" max="${a.max}" value="${a.val}">
            </div>
        `).join('') + `
            <button class="panel-btn primary" id="applyAdj" style="width:100%;margin-top:8px;padding:12px;">Apply</button>
            <button class="panel-btn" id="resetAdj" style="width:100%;margin-top:4px;padding:12px;">Reset</button>
        `;
        
        const apply = () => {
            const b = document.getElementById('brightnessSlider').value;
            const c = document.getElementById('contrastSlider').value;
            const s = document.getElementById('saturationSlider').value;
            const h = document.getElementById('hueSlider').value;
            const o = document.getElementById('opacitySlider').value;
            
            img.style.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) hue-rotate(${h}deg)`;
            selectedLayer.style.opacity = o / 100;
            
            document.getElementById('brightnessVal').textContent = b + '%';
            document.getElementById('contrastVal').textContent = c + '%';
            document.getElementById('saturationVal').textContent = s + '%';
            document.getElementById('hueVal').textContent = h + '°';
            document.getElementById('opacityVal').textContent = o + '%';
        };
        
        ['brightness', 'contrast', 'saturation', 'hue', 'opacity'].forEach(id => {
            document.getElementById(id + 'Slider').addEventListener('input', apply);
        });
        
        document.getElementById('applyAdj').addEventListener('click', () => {
            saveState();
            scheduleAutoSave();
            closePanel();
        });
        
        document.getElementById('resetAdj').addEventListener('click', () => {
            img.style.filter = 'none';
            selectedLayer.style.opacity = '1';
            saveState();
            scheduleAutoSave();
            closePanel();
        });
    }
    
    // =============== IMAGE FILTERS ===============
    function openImageFilterPanel() {
        if (!selectedLayer || selectedLayer.dataset.type !== 'image') return;
        const img = selectedLayer.querySelector('img');
        if (!img) return;
        
        openPanel('Filters');
        
        const filters = [
            { name: 'Original', filter: 'none' },
            { name: 'Grayscale', filter: 'grayscale(100%)' },
            { name: 'Sepia', filter: 'sepia(100%)' },
            { name: 'Vintage', filter: 'sepia(50%) contrast(80%) brightness(90%)' },
            { name: 'Cool', filter: 'hue-rotate(180deg) saturate(80%)' },
            { name: 'Warm', filter: 'saturate(150%) hue-rotate(-20deg)' },
            { name: 'Dramatic', filter: 'contrast(150%) brightness(80%)' },
            { name: 'Fade', filter: 'brightness(120%) saturate(50%) contrast(90%)' },
            { name: 'Blur BG', filter: 'blur(3px)' }
        ];
        
        panelContent.innerHTML = `
            <div class="filter-grid">
                ${filters.map(f => `
                    <div class="filter-item" data-filter="${f.filter}">
                        <div style="background:linear-gradient(135deg, #6366f1, #8b5cf6);width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:white;font-size:10px;text-align:center;padding:4px;font-weight:500;">
                            ${f.name}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        panelContent.querySelectorAll('.filter-item').forEach(item => {
            item.addEventListener('click', function() {
                img.style.filter = this.dataset.filter === 'none' ? '' : this.dataset.filter;
                saveState();
                scheduleAutoSave();
                closePanel();
            });
        });
    }
    
    // =============== SHAPE BORDER ===============
    function openShapeBorderPanel() {
        if (!selectedLayer) return;
        openPanel('Border');
        
        panelContent.innerHTML = `
            <div class="control-group">
                <div class="control-label"><span>Width</span><span class="control-value" id="bwVal">0px</span></div>
                <input type="range" id="bw" min="0" max="20" value="0">
            </div>
            <label style="font-size:12px;color:var(--text-secondary);">Color</label>
            <input type="color" id="bc" value="#000000" style="width:100%;height:40px;border:none;border-radius:8px;">
            <button class="panel-btn primary" id="applyBorder" style="width:100%;margin-top:8px;padding:12px;">Apply</button>
        `;
        
        document.getElementById('bw').addEventListener('input', function(e) {
            document.getElementById('bwVal').textContent = e.target.value + 'px';
        });
        
        document.getElementById('applyBorder').addEventListener('click', () => {
            const w = document.getElementById('bw').value;
            const c = document.getElementById('bc').value;
            selectedLayer.style.border = `${w}px solid ${c}`;
            saveState();
            scheduleAutoSave();
            closePanel();
        });
    }
    
    // =============== BRUSH SIZE ===============
    function openBrushSizePanel() {
        openPanel('Brush Settings');
        
        panelContent.innerHTML = `
            <div class="control-group">
                <div class="control-label"><span>Size</span><span class="control-value" id="bsVal">${brushSize}px</span></div>
                <input type="range" id="bsSlider" min="5" max="150" value="${brushSize}">
            </div>
            ${currentBrushType === 'paint' ? `
            <div class="control-group">
                <div class="control-label"><span>Opacity</span><span class="control-value" id="boVal">${brushOpacity * 100}%</span></div>
                <input type="range" id="boSlider" min="10" max="100" value="${brushOpacity * 100}">
            </div>
            ` : ''}
        `;
        
        document.getElementById('bsSlider').addEventListener('input', function(e) {
            brushSize = parseInt(e.target.value);
            document.getElementById('bsVal').textContent = brushSize + 'px';
        });
        
        if (currentBrushType === 'paint') {
            document.getElementById('boSlider').addEventListener('input', function(e) {
                brushOpacity = parseInt(e.target.value) / 100;
                document.getElementById('boVal').textContent = e.target.value + '%';
            });
        }
    }
    
    // =============== BACKGROUND ===============
    function changeBackground() {
        openPanel('Canvas Background');
        
        panelContent.innerHTML = `
            <div class="color-grid" id="bgColorGrid"></div>
            <input type="color" id="bgColorInput" value="#ffffff" style="width:100%;height:40px;margin-top:12px;border:none;border-radius:8px;">
            <button class="panel-btn" id="bgImageBtn" style="width:100%;margin-top:8px;padding:12px;">📷 Background Image</button>
            <button class="panel-btn" id="bgResetBtn" style="width:100%;margin-top:4px;padding:12px;">Reset</button>
        `;
        
        const grid = document.getElementById('bgColorGrid');
        colorPalette.slice(0, 24).forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            swatch.addEventListener('pointerdown', function(e) {
                e.stopPropagation();
                canvas.style.background = color;
                canvas.style.backgroundImage = 'none';
                scheduleAutoSave();
            });
            grid.appendChild(swatch);
        });
        
        document.getElementById('bgColorInput').addEventListener('input', function(e) {
            canvas.style.background = e.target.value;
            canvas.style.backgroundImage = 'none';
            scheduleAutoSave();
        });
        
        document.getElementById('bgImageBtn').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(ev) {
                        canvas.style.background = `url(${ev.target.result})`;
                        canvas.style.backgroundSize = 'cover';
                        canvas.style.backgroundPosition = 'center';
                        scheduleAutoSave();
                    };
                    reader.readAsDataURL(file);
                }
            });
            input.click();
        });
        
        document.getElementById('bgResetBtn').addEventListener('click', () => {
            canvas.style.background = '#ffffff';
            canvas.style.backgroundImage = 'none';
            scheduleAutoSave();
            closePanel();
        });
    }
    
    // =============== EXPORT ===============
    async function exportCanvas() {
        stopBrushing();
        deselectAllLayers();
        closePanel();
        
        if (typeof domtoimage === 'undefined') {
            showToast('Export library not loaded');
            return;
        }
        
        try {
            showToast('Exporting...');
            
            const dataUrl = await domtoimage.toJpeg(canvas, {
                quality: 0.95,
                bgcolor: '#ffffff'
            });
            
            const link = document.createElement('a');
            link.download = `statsnap-${Date.now()}.jpg`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showToast('✅ Downloaded!');
        } catch (error) {
            console.error('Export failed:', error);
            showToast('Export failed');
        }
    }
    
    // =============== UNDO/REDO ===============
    function saveState() {
        const state = serializeProject();
        undoStack.push(state);
        if (undoStack.length > MAX_HISTORY) undoStack.shift();
        redoStack = [];
        updateUndoRedoButtons();
    }
    
    function undo() {
        if (undoStack.length === 0) return;
        const current = serializeProject();
        redoStack.push(current);
        const prev = undoStack.pop();
        restoreProject(prev);
        updateUndoRedoButtons();
        scheduleAutoSave();
        showToast('Undo ↩️');
    }
    
    function redo() {
        if (redoStack.length === 0) return;
        const current = serializeProject();
        undoStack.push(current);
        const next = redoStack.pop();
        restoreProject(next);
        updateUndoRedoButtons();
        scheduleAutoSave();
        showToast('Redo ↪️');
    }
    
    function updateUndoRedoButtons() {
        undoBtn.disabled = undoStack.length === 0;
        redoBtn.disabled = redoStack.length === 0;
    }
    
    // =============== PERSISTENCE ===============
    async function initDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('statsnap-editor', 1);
            request.onerror = () => {
                console.warn('IndexedDB not available, running without persistence');
                resolve();
            };
            request.onsuccess = () => {
                db = request.result;
                resolve();
            };
            request.onupgradeneeded = function(e) {
                const database = e.target.result;
                if (!database.objectStoreNames.contains('projects')) {
                    database.createObjectStore('projects', { keyPath: 'id' });
                }
            };
        });
    }
    
    function saveProject() {
        if (!db) return;
        try {
            const project = serializeProject();
            const tx = db.transaction('projects', 'readwrite');
            const store = tx.objectStore('projects');
            store.put({ id: 'current', data: project, timestamp: Date.now() });
        } catch (e) {
            console.warn('Save failed:', e);
        }
    }
    
    function scheduleAutoSave() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveProject, 2000);
    }
    
    function startAutoSave() {
        autoSaveInterval = setInterval(saveProject, 30000);
    }
    
    function loadProject() {
        if (!db) return;
        try {
            const tx = db.transaction('projects', 'readonly');
            const store = tx.objectStore('projects');
            const request = store.get('current');
            
            request.onsuccess = function() {
                if (request.result && request.result.data) {
                    restoreProject(request.result.data);
                }
            };
        } catch (e) {
            console.warn('Load failed:', e);
        }
    }
    
    function serializeProject() {
        return {
            layers: layers.map(l => ({
                id: l.id,
                type: l.dataset.type,
                html: l.innerHTML,
                style: l.getAttribute('style') || '',
                rotation: l.dataset.rotation || '0'
            })),
            canvasStyle: canvas.getAttribute('style') || '',
            scale: scale,
            panX: panX,
            panY: panY,
            mode: currentMode,
            version: '3.0'
        };
    }
    
    function restoreProject(data) {
        canvas.querySelectorAll('.layer').forEach(l => l.remove());
        layers = [];
        selectedLayer = null;
        
        if (data.canvasStyle) canvas.setAttribute('style', data.canvasStyle);
        if (data.scale) scale = data.scale;
        if (data.panX !== undefined) panX = data.panX;
        if (data.panY !== undefined) panY = data.panY;
        if (data.mode) {
            currentMode = data.mode;
            document.querySelectorAll('.mode-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === data.mode);
            });
        }
        
        applyTransform();
        
        if (data.layers) {
            data.layers.forEach(ld => {
                const layer = document.createElement('div');
                layer.id = ld.id;
                layer.className = 'layer';
                layer.dataset.type = ld.type;
                layer.dataset.rotation = ld.rotation;
                layer.innerHTML = ld.html;
                layer.setAttribute('style', ld.style);
                
                addHandles(layer);
                
                layer.addEventListener('pointerdown', function(e) {
                    if (isBrushing) return;
                    if (!e.target.classList.contains('resize-handle') && !e.target.classList.contains('rotate-handle')) {
                        e.stopPropagation();
                        selectLayer(layer);
                    }
                });
                
                if (ld.type === 'text') {
                    layer.setAttribute('contenteditable', 'true');
                    layer.addEventListener('input', scheduleAutoSave);
                }
                
                canvas.appendChild(layer);
                layers.push(layer);
                
                const idNum = parseInt(ld.id.split('-')[1]);
                if (!isNaN(idNum)) layerIdCounter = Math.max(layerIdCounter, idNum);
            });
        }
        
        updateEmptyState();
        updateContextualTools();
    }
    
    // =============== KEYBOARD ===============
    function handleKeyboard(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault();
            redo();
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedLayer && document.activeElement === document.body) {
                e.preventDefault();
                deleteSelectedLayer();
            }
        } else if (e.key === 'Escape') {
            stopBrushing();
            closePanel();
            deselectAllLayers();
            hideMenu();
        } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
            e.preventDefault();
            scale = 1;
            panX = 0;
            panY = 0;
            applyTransform();
            showToast('Zoom reset');
        } else if ((e.ctrlKey || e.metaKey) && e.key === '=') {
            e.preventDefault();
            scale = Math.min(MAX_SCALE, scale + 0.1);
            applyTransform();
        } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
            e.preventDefault();
            scale = Math.max(MIN_SCALE, scale - 0.1);
            applyTransform();
        }
    }
    
    // =============== MENU ===============
    function toggleMenu() {
        if (isMenuOpen) {
            hideMenu();
        } else {
            showMenu();
        }
    }
    
    function showMenu() {
        hamburgerMenu.style.display = 'block';
        isMenuOpen = true;
    }
    
    function hideMenu() {
        hamburgerMenu.style.display = 'none';
        isMenuOpen = false;
    }
    
    function handleMenuAction(action) {
        switch(action) {
            case 'newProject':
                if (confirm('Start new project? Unsaved changes will be lost.')) {
                    clearCanvas();
                }
                break;
            case 'saveProject':
                saveProject();
                showToast('✅ Project saved');
                break;
            case 'exportImage':
                exportCanvas();
                break;
            case 'resetZoom':
                scale = 1;
                panX = 0;
                panY = 0;
                applyTransform();
                showToast('Zoom reset');
                break;
            case 'clearCanvas':
                if (confirm('Clear all layers?')) {
                    clearCanvas();
                }
                break;
        }
    }
    
    function clearCanvas() {
        layers.forEach(l => l.remove());
        layers = [];
        selectedLayer = null;
        canvas.style.background = '#ffffff';
        canvas.style.backgroundImage = 'none';
        undoStack = [];
        redoStack = [];
        updateEmptyState();
        updateContextualTools();
        updateUndoRedoButtons();
        saveState();
        scheduleAutoSave();
    }
    
    // =============== UTILITIES ===============
    function showToast(message) {
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
    
    // =============== START ===============
    document.addEventListener('DOMContentLoaded', init);
    
    window.addEventListener('beforeunload', () => {
        saveProject();
        clearInterval(autoSaveInterval);
        clearTimeout(saveTimeout);
    });
})();
