// ============================================
// STATSNAP - Production Creative Editor
// Professional Mode-Specific Tools
// ============================================

const Statsnap = (() => {
    'use strict';

    // =============== STATE ===============
    const state = {
        mode: 'design',
        layers: [],
        selectedLayer: null,
        layerIdCounter: 0,
        canvasWidth: 1080,
        canvasHeight: 1920,
        displayScale: 1,
        panX: 0,
        panY: 0,
        
        isDragging: false,
        isResizing: false,
        isRotating: false,
        isPanning: false,
        isPinching: false,
        isBrushing: false,
        brushType: null,
        
        dragStart: { x: 0, y: 0 },
        dragLayerStart: { x: 0, y: 0, w: 0, h: 0, rot: 0 },
        resizeStart: {},
        rotateStart: {},
        panStart: { x: 0, y: 0 },
        pinchStart: { dist: 0, scale: 1, midX: 0, midY: 0 },
        
        brushColor: '#000000',
        brushSize: 30,
        lastBrushPos: null,
        brushPoints: [],
        
        undoStack: [],
        redoStack: [],
        maxHistory: 50,
        
        saveTimeout: null,
        db: null,
        
        panelOpen: false,
        menuOpen: false,
        collageCells: [],
        activeCollageTemplate: null
    };

    // =============== DOM REFS ===============
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);
    
    const canvas = $('#mainCanvas');
    const canvasContainer = $('#canvasContainer');
    const canvasWrapper = $('#canvasWrapper');
    const brushOverlay = $('#brushOverlay');
    const emptyState = $('#emptyState');
    const panel = $('#settingsPanel');
    const panelContent = $('#panelContent');
    const panelTitle = $('#panelTitle');
    const hamburgerMenu = $('#hamburgerMenu');
    const colorPopup = $('#colorPopup');
    const canvasSizeModal = $('#canvasSizeModal');
    const bottomToolbar = $('#bottomToolbar');

    // Color palette
    const COLORS = [
        '#000000','#ffffff','#ef4444','#f97316','#f59e0b','#eab308',
        '#84cc16','#22c55e','#10b981','#14b8a6','#06b6d4','#0ea5e9',
        '#3b82f6','#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899',
        '#f43f5e','#78716c','#6b7280','#374151','#1f2937','#111827',
        '#fef3c7','#fde68a','#fcd34d','#fbbf24','#f59e0b','#d97706',
        '#dcfce7','#bbf7d0','#86efac','#4ade80','#22c55e','#16a34a',
        '#dbeafe','#bfdbfe','#93c5fd','#60a5fa','#3b82f6','#2563eb',
        '#fce7f3','#fbcfe8','#f9a8d4','#f472b6','#ec4899','#db2777'
    ];

    // =============== INIT ===============
    async function init() {
        setupTheme();
        setupCanvas();
        setupBrushOverlay();
        bindGlobalEvents();
        await initDB();
        await loadProject();
        startAutoSave();
        updateUI();
        applyCanvasSize();
    }

    function setupTheme() {
        const saved = localStorage.getItem('statsnap-theme');
        if (saved) document.documentElement.setAttribute('data-theme', saved);
        else if (window.matchMedia('(prefers-color-scheme: dark)').matches)
            document.documentElement.setAttribute('data-theme', 'dark');
    }

    function setupCanvas() {
        canvas.style.width = state.canvasWidth + 'px';
        canvas.style.height = state.canvasHeight + 'px';
        updateDisplayScale();
    }

    function setupBrushOverlay() {
        brushOverlay.width = state.canvasWidth;
        brushOverlay.height = state.canvasHeight;
        brushOverlay.style.cssText = `
            position: absolute; top: 0; left: 0;
            pointer-events: none; z-index: 50; display: none;
        `;
        canvas.appendChild(brushOverlay);
    }

    function updateDisplayScale() {
        const containerW = canvasContainer.clientWidth - 40;
        const containerH = canvasContainer.clientHeight - 40;
        const scaleX = containerW / state.canvasWidth;
        const scaleY = containerH / state.canvasHeight;
        state.displayScale = Math.min(scaleX, scaleY, 1);
        canvasWrapper.style.transform = `scale(${state.displayScale})`;
        canvasWrapper.style.transformOrigin = 'center center';
    }

    function applyCanvasSize() {
        canvas.style.width = state.canvasWidth + 'px';
        canvas.style.height = state.canvasHeight + 'px';
        brushOverlay.width = state.canvasWidth;
        brushOverlay.height = state.canvasHeight;
        updateDisplayScale();
        state.collageCells.forEach(c => c.remove());
        state.collageCells = [];
        if (state.mode === 'collage' && state.activeCollageTemplate) {
            applyCollageTemplate(state.activeCollageTemplate);
        }
    }

    // =============== EVENT BINDING ===============
    function bindGlobalEvents() {
        // Theme
        $('#themeToggle').addEventListener('click', toggleTheme);
        
        // Undo/Redo
        $('#undoBtn').addEventListener('click', undo);
        $('#redoBtn').addEventListener('click', redo);
        
        // Menu
        $('#menuBtn').addEventListener('click', toggleMenu);
        
        // Panel close
        $('#closePanelBtn').addEventListener('click', closePanel);
        
        // Mode buttons
        $$('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => switchMode(btn.dataset.mode));
        });
        
        // Tool buttons
        bottomToolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('.tool-btn');
            if (!btn) return;
            handleToolAction(btn.dataset.action, btn);
        });
        
        // Canvas pointer events
        canvasContainer.addEventListener('pointerdown', onPointerDown);
        canvasContainer.addEventListener('pointermove', onPointerMove);
        canvasContainer.addEventListener('pointerup', onPointerUp);
        canvasContainer.addEventListener('pointerleave', onPointerUp);
        canvasContainer.addEventListener('pointercancel', onPointerUp);
        
        // Wheel zoom
        canvasContainer.addEventListener('wheel', onWheel, { passive: false });
        
        // Touch pinch
        canvasContainer.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) e.preventDefault();
        }, { passive: false });
        canvasContainer.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) e.preventDefault();
        }, { passive: false });
        
        // Keyboard
        document.addEventListener('keydown', onKeyboard);
        
        // Resize
        window.addEventListener('resize', () => updateDisplayScale());
        
        // Click outside to close menus
        document.addEventListener('pointerdown', (e) => {
            if (state.menuOpen && !hamburgerMenu.contains(e.target) && e.target !== $('#menuBtn')) {
                closeMenu();
            }
            if (colorPopup.style.display === 'block' && !colorPopup.contains(e.target)) {
                colorPopup.style.display = 'none';
            }
        });
        
        // Canvas size modal
        $('#applyCanvasSize').addEventListener('click', () => {
            const w = parseInt($('#customWidth').value) || 1080;
            const h = parseInt($('#customHeight').value) || 1920;
            state.canvasWidth = Math.max(200, Math.min(4000, w));
            state.canvasHeight = Math.max(200, Math.min(4000, h));
            applyCanvasSize();
            closeCanvasSizeModal();
            scheduleSave();
            toast('Canvas resized');
        });
        $('#closeCanvasSize').addEventListener('click', closeCanvasSizeModal);
        
        $$('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.canvasWidth = parseInt(btn.dataset.w);
                state.canvasHeight = parseInt(btn.dataset.h);
                $('#customWidth').value = state.canvasWidth;
                $('#customHeight').value = state.canvasHeight;
            });
        });
        
        // Menu items
        hamburgerMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.menu-item');
            if (!item) return;
            handleMenuAction(item.dataset.action);
            closeMenu();
        });
        
        // Color popup
        $('#popupColorInput').addEventListener('input', (e) => {
            state.brushColor = e.target.value;
        });
    }

    // =============== POINTER HANDLERS ===============
    function getCanvasPos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / state.displayScale,
            y: (e.clientY - rect.top) / state.displayScale
        };
    }

    function onPointerDown(e) {
        if (e.pointerType === 'touch' && e.isPrimary && e.pointerType) {
            // Check for pinch
        }
        
        const target = e.target;
        
        // Resize handle
        if (target.classList.contains('resize-handle')) {
            startResize(target, e);
            return;
        }
        
        // Rotate handle
        if (target.classList.contains('rotate-handle')) {
            startRotate(target.closest('.layer'), e);
            return;
        }
        
        // Collage cell
        if (target.classList.contains('collage-cell') && !target.classList.contains('filled')) {
            addImageToCollageCell(target);
            return;
        }
        
        // Layer
        const layer = target.closest('.layer');
        if (layer && !state.isBrushing) {
            if (layer.classList.contains('locked')) return;
            if (target.isContentEditable && target.closest('.text-layer')) {
                selectLayer(layer);
                return;
            }
            startDragLayer(layer, e);
            return;
        }
        
        // Brush
        if (state.isBrushing && (target === canvas || target === brushOverlay)) {
            startBrush(e);
            return;
        }
        
        // Canvas pan
        if (target === canvas || target === canvasContainer || target.closest('#canvasContainer')) {
            startPan(e);
        }
    }

    function onPointerMove(e) {
        if (state.isDragging) { updateDragLayer(e); return; }
        if (state.isResizing) { updateResize(e); return; }
        if (state.isRotating) { updateRotate(e); return; }
        if (state.isPanning) { updatePan(e); return; }
        if (state.isBrushing) { updateBrush(e); return; }
    }

    function onPointerUp(e) {
        if (state.isDragging) endDragLayer();
        if (state.isResizing) endResize();
        if (state.isRotating) endRotate();
        if (state.isPanning) endPan();
        if (state.isBrushing) endBrush();
    }

    // =============== CANVAS PAN ===============
    function startPan(e) {
        if (state.mode === 'collage') return; // No panning in collage mode
        state.isPanning = true;
        state.panStart = { x: e.clientX, y: e.clientY };
    }

    function updatePan(e) {
        if (!state.isPanning) return;
        const dx = e.clientX - state.panStart.x;
        const dy = e.clientY - state.panStart.y;
        canvasWrapper.style.transform = `translate(${dx}px, ${dy}px) scale(${state.displayScale})`;
    }

    function endPan() {
        state.isPanning = false;
        canvasWrapper.style.transform = `scale(${state.displayScale})`;
        canvasWrapper.style.transition = 'transform 0.15s ease-out';
        setTimeout(() => { canvasWrapper.style.transition = ''; }, 150);
    }

    function onWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.95 : 1.05;
        state.displayScale = Math.max(0.1, Math.min(2, state.displayScale * delta));
        canvasWrapper.style.transform = `scale(${state.displayScale})`;
        canvasWrapper.style.transition = 'transform 0.1s ease-out';
        setTimeout(() => { canvasWrapper.style.transition = ''; }, 100);
    }

    // =============== LAYER DRAG ===============
    function startDragLayer(layer, e) {
        selectLayer(layer);
        state.isDragging = true;
        state.dragStart = { x: e.clientX, y: e.clientY };
        state.dragLayerStart = {
            x: parseFloat(layer.style.left) || 0,
            y: parseFloat(layer.style.top) || 0
        };
        layer.style.transition = 'none';
        layer.setPointerCapture(e.pointerId);
    }

    function updateDragLayer(e) {
        if (!state.isDragging || !state.selectedLayer) return;
        const dx = (e.clientX - state.dragStart.x) / state.displayScale;
        const dy = (e.clientY - state.dragStart.y) / state.displayScale;
        state.selectedLayer.style.left = (state.dragLayerStart.x + dx) + 'px';
        state.selectedLayer.style.top = (state.dragLayerStart.y + dy) + 'px';
    }

    function endDragLayer() {
        if (!state.isDragging) return;
        state.isDragging = false;
        if (state.selectedLayer) {
            state.selectedLayer.style.transition = '';
            const lx = parseFloat(state.selectedLayer.style.left) || 0;
            const ly = parseFloat(state.selectedLayer.style.top) || 0;
            if (Math.abs(lx - state.dragLayerStart.x) > 1 || Math.abs(ly - state.dragLayerStart.y) > 1) {
                saveState();
                scheduleSave();
            }
        }
    }

    // =============== RESIZE ===============
    function startResize(handle, e) {
        e.stopPropagation();
        e.preventDefault();
        const layer = handle.closest('.layer');
        if (!layer || layer.classList.contains('locked')) return;
        selectLayer(layer);
        state.isResizing = true;
        state.resizeLayer = layer;
        state.resizeStart = {
            x: e.clientX, y: e.clientY,
            w: layer.offsetWidth, h: layer.offsetHeight,
            l: parseFloat(layer.style.left) || 0,
            t: parseFloat(layer.style.top) || 0,
            pos: handle.dataset.pos
        };
        handle.setPointerCapture(e.pointerId);
    }

    function updateResize(e) {
        if (!state.isResizing) return;
        const dx = (e.clientX - state.resizeStart.x) / state.displayScale;
        const dy = (e.clientY - state.resizeStart.y) / state.displayScale;
        const rs = state.resizeStart;
        const layer = state.resizeLayer;
        let w = rs.w, h = rs.h, l = rs.l, t = rs.t;
        
        switch(rs.pos) {
            case 'br': w = Math.max(20, rs.w + dx); h = Math.max(20, rs.h + dy); break;
            case 'bl': w = Math.max(20, rs.w - dx); h = Math.max(20, rs.h + dy); l = rs.l + dx; break;
            case 'tr': w = Math.max(20, rs.w + dx); h = Math.max(20, rs.h - dy); t = rs.t + dy; break;
            case 'tl': w = Math.max(20, rs.w - dx); h = Math.max(20, rs.h - dy); l = rs.l + dx; t = rs.t + dy; break;
            case 'bc': h = Math.max(20, rs.h + dy); break;
            case 'tc': h = Math.max(20, rs.h - dy); t = rs.t + dy; break;
            case 'rc': w = Math.max(20, rs.w + dx); break;
            case 'lc': w = Math.max(20, rs.w - dx); l = rs.l + dx; break;
        }
        
        layer.style.width = w + 'px';
        layer.style.height = h + 'px';
        layer.style.left = l + 'px';
        layer.style.top = t + 'px';
    }

    function endResize() {
        if (state.isResizing) { saveState(); scheduleSave(); }
        state.isResizing = false;
        state.resizeLayer = null;
    }

    // =============== ROTATE ===============
    function startRotate(layer, e) {
        e.stopPropagation();
        e.preventDefault();
        if (layer.classList.contains('locked')) return;
        selectLayer(layer);
        state.isRotating = true;
        state.rotateLayer = layer;
        const rect = layer.getBoundingClientRect();
        state.rotateStart = {
            cx: rect.left + rect.width/2,
            cy: rect.top + rect.height/2,
            angle: Math.atan2(e.clientY - (rect.top + rect.height/2), e.clientX - (rect.left + rect.width/2)),
            rot: parseFloat(layer.dataset.rotation || 0)
        };
    }

    function updateRotate(e) {
        if (!state.isRotating) return;
        const rs = state.rotateStart;
        const angle = Math.atan2(e.clientY - rs.cy, e.clientX - rs.cx);
        const deg = rs.rot + (angle - rs.angle) * (180/Math.PI);
        state.rotateLayer.style.transform = `rotate(${deg}deg)`;
        state.rotateLayer.dataset.rotation = deg;
    }

    function endRotate() {
        if (state.isRotating) { saveState(); scheduleSave(); }
        state.isRotating = false;
        state.rotateLayer = null;
    }

    // =============== BRUSH ===============
    function startBrush(e) {
        state.isBrushing = true;
        const pos = getCanvasPos(e);
        state.lastBrushPos = pos;
        state.brushPoints = [pos];
        showBrushIndicator(e.clientX, e.clientY);
    }

    function updateBrush(e) {
        if (!state.isBrushing) return;
        const pos = getCanvasPos(e);
        state.brushPoints.push(pos);
        showBrushIndicator(e.clientX, e.clientY);
        
        const ctx = brushOverlay.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(state.lastBrushPos.x, state.lastBrushPos.y);
        ctx.lineTo(pos.x, pos.y);
        
        if (state.brushType === 'paint') {
            ctx.strokeStyle = state.brushColor;
            ctx.lineWidth = state.brushSize;
            ctx.globalCompositeOperation = 'source-over';
        } else if (state.brushType === 'blur') {
            ctx.strokeStyle = 'rgba(128,128,128,0.5)';
            ctx.lineWidth = state.brushSize;
            ctx.filter = `blur(${state.brushSize/3}px)`;
        }
        
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.filter = 'none';
        state.lastBrushPos = pos;
    }

    function endBrush() {
        if (!state.isBrushing) return;
        state.isBrushing = false;
        hideBrushIndicator();
        
        if (state.brushPoints.length > 1 && state.selectedLayer && state.selectedLayer.dataset.type === 'image') {
            applyBrushToImage();
        }
        
        state.brushPoints = [];
        brushOverlay.getContext('2d').clearRect(0, 0, state.canvasWidth, state.canvasHeight);
    }

    function applyBrushToImage() {
        const layer = state.selectedLayer;
        const img = layer.querySelector('img');
        if (!img) return;
        
        const offCanvas = document.createElement('canvas');
        offCanvas.width = layer.offsetWidth;
        offCanvas.height = layer.offsetHeight;
        const ctx = offCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0, offCanvas.width, offCanvas.height);
        
        if (state.brushType === 'paint') {
            ctx.drawImage(brushOverlay, 0, 0, offCanvas.width, offCanvas.height);
        } else if (state.brushType === 'blur') {
            const blurCanvas = document.createElement('canvas');
            blurCanvas.width = offCanvas.width;
            blurCanvas.height = offCanvas.height;
            const blurCtx = blurCanvas.getContext('2d');
            blurCtx.filter = `blur(${state.brushSize/2}px)`;
            blurCtx.drawImage(img, 0, 0, blurCanvas.width, blurCanvas.height);
            
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = offCanvas.width;
            maskCanvas.height = offCanvas.height;
            const maskCtx = maskCanvas.getContext('2d');
            maskCtx.drawImage(brushOverlay, 0, 0, offCanvas.width, offCanvas.height);
            
            ctx.globalCompositeOperation = 'destination-out';
            ctx.drawImage(maskCanvas, 0, 0);
            ctx.globalCompositeOperation = 'destination-over';
            ctx.drawImage(blurCanvas, 0, 0);
        }
        
        img.src = offCanvas.toDataURL('image/png');
        saveState();
        scheduleSave();
    }

    function showBrushIndicator(x, y) {
        let ind = $('.brush-indicator');
        if (!ind) {
            ind = document.createElement('div');
            ind.className = 'brush-indicator';
            document.body.appendChild(ind);
        }
        ind.style.display = 'block';
        ind.style.left = x + 'px';
        ind.style.top = y + 'px';
        const size = state.brushSize * state.displayScale;
        ind.style.width = size + 'px';
        ind.style.height = size + 'px';
    }

    function hideBrushIndicator() {
        const ind = $('.brush-indicator');
        if (ind) ind.style.display = 'none';
    }

    // =============== TOOL ACTIONS ===============
    function handleToolAction(action, btn) {
        if (action === 'paintBrush') { toggleBrush('paint', btn); return; }
        if (action === 'blurBrush') { toggleBrush('blur', btn); return; }
        
        stopBrushing();
        closePanel();
        
        switch(action) {
            case 'addText': addTextLayer(); break;
            case 'addImage': addImageLayer(); break;
            case 'addShape': addShapeLayer(); break;
            case 'addSticker': addSticker(); break;
            case 'changeBackground': openBackgroundPanel(); break;
            case 'layerPanel': openLayersPanel(); break;
            case 'imageAdjust': openImageAdjustPanel(); break;
            case 'imageFilter': openFilterPanel(); break;
            case 'cropImage': cropImage(); break;
            case 'collageGrid2': applyCollageTemplate(2); break;
            case 'collageGrid3': applyCollageTemplate(3); break;
            case 'collageGrid4': applyCollageTemplate(4); break;
            case 'collageFree': clearCollageTemplate(); break;
            case 'layerLock': toggleLayerLock(); break;
            case 'layerDuplicate': duplicateLayer(); break;
            case 'layerOpacity': openOpacityPanel(); break;
            case 'layerBlend': openBlendPanel(); break;
            case 'bringToFront': bringToFront(); break;
            case 'sendToBack': sendToBack(); break;
        }
    }

    function toggleBrush(type, btn) {
        if (state.brushType === type) { stopBrushing(); return; }
        stopBrushing();
        state.brushType = type;
        state.isBrushing = false;
        btn.classList.add('active-tool');
        brushOverlay.style.display = 'block';
        brushOverlay.style.pointerEvents = 'auto';
        if (type === 'paint') showColorPopup();
        openBrushSettings();
        toast(type === 'paint' ? 'Paint brush active' : 'Blur brush active');
    }

    function stopBrushing() {
        state.brushType = null;
        state.isBrushing = false;
        brushOverlay.style.display = 'none';
        brushOverlay.style.pointerEvents = 'none';
        brushOverlay.getContext('2d').clearRect(0, 0, state.canvasWidth, state.canvasHeight);
        hideBrushIndicator();
        hideColorPopup();
        $$('.tool-btn').forEach(b => b.classList.remove('active-tool'));
        if (state.panelOpen) closePanel();
    }

    // =============== LAYER MANAGEMENT ===============
    function addTextLayer(text = 'Tap to edit') {
        stopBrushing();
        const layer = createLayerElement('text');
        layer.textContent = text;
        layer.contentEditable = 'true';
        layer.dataset.placeholder = 'Type...';
        layer.classList.add('text-layer');
        layer.style.fontSize = '48px';
        layer.style.color = '#000000';
        layer.style.fontWeight = '700';
        
        layer.addEventListener('focus', () => { if (layer.textContent === 'Tap to edit') layer.textContent = ''; });
        layer.addEventListener('blur', () => { if (!layer.textContent.trim()) layer.textContent = 'Tap to edit'; scheduleSave(); });
        layer.addEventListener('input', () => scheduleSave());
        
        positionCenter(layer);
        addLayer(layer);
        selectLayer(layer);
        saveState();
        setTimeout(() => layer.focus(), 150);
    }

    function addImageLayer() {
        stopBrushing();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.addEventListener('change', (e) => {
            Array.from(e.target.files).forEach(file => {
                const reader = new FileReader();
                reader.onload = (ev) => createImageLayer(ev.target.result);
                reader.readAsDataURL(file);
            });
        });
        input.click();
    }

    function createImageLayer(url) {
        const layer = createLayerElement('image');
        layer.classList.add('image-layer');
        layer.style.width = '300px';
        layer.style.height = '300px';
        
        const img = document.createElement('img');
        img.src = url;
        img.draggable = false;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        layer.appendChild(img);
        
        img.onload = () => {
            const ratio = img.naturalWidth / img.naturalHeight;
            if (ratio > 1) { layer.style.width = '350px'; layer.style.height = (350/ratio) + 'px'; }
            else { layer.style.height = '350px'; layer.style.width = (350*ratio) + 'px'; }
        };
        if (img.complete && img.naturalWidth) img.onload();
        
        positionCenter(layer);
        addLayer(layer);
        selectLayer(layer);
        saveState();
    }

    function addImageToCollageCell(cell) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = document.createElement('img');
                img.src = ev.target.result;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                cell.innerHTML = '';
                cell.appendChild(img);
                cell.classList.add('filled');
                scheduleSave();
            };
            reader.readAsDataURL(file);
        });
        input.click();
    }

    function addShapeLayer() {
        stopBrushing();
        const layer = createLayerElement('shape');
        layer.classList.add('shape-layer');
        layer.style.width = '200px';
        layer.style.height = '200px';
        layer.style.background = '#6366f1';
        layer.style.borderRadius = '12px';
        positionCenter(layer);
        addLayer(layer);
        selectLayer(layer);
        saveState();
    }

    function addSticker() {
        stopBrushing();
        const stickers = ['⭐','❤️','🔥','💎','🚀','🎯','💡','🌈','🦋','🌺','⚡','🎵','👑','💫','🍀','🎪'];
        const sticker = stickers[Math.floor(Math.random() * stickers.length)];
        const layer = createLayerElement('text');
        layer.textContent = sticker;
        layer.classList.add('text-layer');
        layer.style.fontSize = '80px';
        layer.style.textAlign = 'center';
        layer.contentEditable = 'false';
        positionCenter(layer);
        addLayer(layer);
        selectLayer(layer);
        saveState();
    }

    function createLayerElement(type) {
        const layer = document.createElement('div');
        layer.id = 'layer-' + (++state.layerIdCounter);
        layer.className = 'layer';
        layer.dataset.type = type;
        layer.style.position = 'absolute';
        layer.style.zIndex = state.layers.length + 1;
        
        addHandles(layer);
        
        layer.addEventListener('pointerdown', (e) => {
            if (state.isBrushing) return;
            if (!e.target.classList.contains('resize-handle') && !e.target.classList.contains('rotate-handle')) {
                e.stopPropagation();
                if (!layer.classList.contains('locked')) selectLayer(layer);
            }
        });
        
        return layer;
    }

    function addHandles(layer) {
        const positions = [
            ['tl','top-left'],['tc','top-center'],['tr','top-right'],
            ['lc','left-center'],['rc','right-center'],
            ['bl','bottom-left'],['bc','bottom-center'],['br','bottom-right']
        ];
        positions.forEach(([cls, pos]) => {
            const h = document.createElement('div');
            h.className = 'resize-handle ' + cls;
            h.dataset.pos = pos;
            layer.appendChild(h);
        });
        
        const rh = document.createElement('div');
        rh.className = 'rotate-handle';
        rh.textContent = '↻';
        layer.appendChild(rh);
        
        const lock = document.createElement('div');
        lock.className = 'lock-indicator';
        lock.textContent = '🔒';
        layer.appendChild(lock);
    }

    function addLayer(layer) {
        canvas.appendChild(layer);
        state.layers.push(layer);
        updateEmptyState();
        updateToolbar();
    }

    function selectLayer(layer) {
        state.layers.forEach(l => l.classList.remove('selected'));
        layer.classList.add('selected');
        state.selectedLayer = layer;
        updateToolbar();
    }

    function deselectAll() {
        state.layers.forEach(l => l.classList.remove('selected'));
        state.selectedLayer = null;
        updateToolbar();
    }

    function deleteSelectedLayer() {
        if (!state.selectedLayer) return;
        const layer = state.selectedLayer;
        layer.style.transition = 'opacity 0.15s, transform 0.15s';
        layer.style.opacity = '0';
        layer.style.transform = 'scale(0.9)';
        setTimeout(() => {
            layer.remove();
            state.layers = state.layers.filter(l => l !== layer);
            state.selectedLayer = null;
            updateEmptyState();
            updateToolbar();
            saveState();
            scheduleSave();
        }, 150);
        toast('Layer deleted');
    }

    function toggleLayerLock() {
        if (!state.selectedLayer) return;
        state.selectedLayer.classList.toggle('locked');
        const isLocked = state.selectedLayer.classList.contains('locked');
        toast(isLocked ? '🔒 Layer locked' : '🔓 Layer unlocked');
        scheduleSave();
    }

    function duplicateLayer() {
        if (!state.selectedLayer) return;
        const orig = state.selectedLayer;
        const clone = orig.cloneNode(true);
        clone.id = 'layer-' + (++state.layerIdCounter);
        clone.style.left = (parseFloat(orig.style.left) + 30) + 'px';
        clone.style.top = (parseFloat(orig.style.top) + 30) + 'px';
        clone.classList.remove('selected', 'locked');
        
        clone.querySelectorAll('.resize-handle, .rotate-handle, .lock-indicator').forEach(el => el.remove());
        addHandles(clone);
        
        clone.addEventListener('pointerdown', (e) => {
            if (state.isBrushing) return;
            if (!e.target.classList.contains('resize-handle') && !e.target.classList.contains('rotate-handle')) {
                e.stopPropagation();
                if (!clone.classList.contains('locked')) selectLayer(clone);
            }
        });
        
        if (clone.dataset.type === 'text') {
            clone.contentEditable = 'true';
            clone.addEventListener('input', () => scheduleSave());
        }
        
        addLayer(clone);
        selectLayer(clone);
        saveState();
        toast('Layer duplicated');
    }

    function bringToFront() {
        if (!state.selectedLayer) return;
        const maxZ = Math.max(...state.layers.map(l => parseInt(l.style.zIndex) || 0));
        state.selectedLayer.style.zIndex = maxZ + 1;
        scheduleSave();
    }

    function sendToBack() {
        if (!state.selectedLayer) return;
        const minZ = Math.min(...state.layers.map(l => parseInt(l.style.zIndex) || 0));
        state.selectedLayer.style.zIndex = minZ - 1;
        scheduleSave();
    }

    function positionCenter(layer) {
        const lw = parseFloat(layer.style.width) || 200;
        const lh = parseFloat(layer.style.height) || 200;
        layer.style.left = Math.round((state.canvasWidth - lw) / 2) + 'px';
        layer.style.top = Math.round((state.canvasHeight - lh) / 2) + 'px';
    }

    function updateEmptyState() {
        emptyState.style.display = state.layers.length === 0 && state.collageCells.length === 0 ? 'block' : 'none';
    }

    function updateToolbar() {
        $$('.tool-group').forEach(g => g.classList.remove('active'));
        
        // Show mode-specific tools
        const modeTools = state.mode + 'Tools';
        const modeGroup = $('#' + modeTools);
        if (modeGroup) modeGroup.classList.add('active');
        
        // Show layer tools if layer selected
        if (state.selectedLayer) {
            $('#layerTools').classList.add('active');
        }
    }

    // =============== MODE SWITCHING ===============
    function switchMode(mode) {
        if (state.mode === mode) return;
        stopBrushing();
        closePanel();
        deselectAll();
        state.mode = mode;
        
        $$('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
        
        // Clear collage cells when switching away from collage
        if (mode !== 'collage') {
            state.collageCells.forEach(c => c.remove());
            state.collageCells = [];
            state.activeCollageTemplate = null;
            canvas.classList.remove('collage-mode');
        }
        
        updateToolbar();
        updateEmptyState();
        toast(mode.charAt(0).toUpperCase() + mode.slice(1) + ' mode');
    }

    // =============== COLLAGE ===============
    function applyCollageTemplate(count) {
        // Clear existing cells
        state.collageCells.forEach(c => c.remove());
        state.collageCells = [];
        state.activeCollageTemplate = count;
        canvas.classList.add('collage-mode');
        
        const w = state.canvasWidth;
        const h = state.canvasHeight;
        let cells = [];
        
        if (count === 2) {
            cells = [
                { x: 0, y: 0, w: w/2, h: h },
                { x: w/2, y: 0, w: w/2, h: h }
            ];
        } else if (count === 3) {
            cells = [
                { x: 0, y: 0, w: w/2, h: h/2 },
                { x: w/2, y: 0, w: w/2, h: h/2 },
                { x: 0, y: h/2, w: w, h: h/2 }
            ];
        } else if (count === 4) {
            cells = [
                { x: 0, y: 0, w: w/2, h: h/2 },
                { x: w/2, y: 0, w: w/2, h: h/2 },
                { x: 0, y: h/2, w: w/2, h: h/2 },
                { x: w/2, y: h/2, w: w/2, h: h/2 }
            ];
        }
        
        cells.forEach(cell => {
            const div = document.createElement('div');
            div.className = 'collage-cell';
            div.style.cssText = `
                left: ${cell.x}px; top: ${cell.y}px;
                width: ${cell.w}px; height: ${cell.h}px;
            `;
            div.textContent = 'Tap to add';
            canvas.appendChild(div);
            state.collageCells.push(div);
        });
        
        updateEmptyState();
        updateToolbar();
        toast(`${count}-grid collage ready`);
    }

    function clearCollageTemplate() {
        state.collageCells.forEach(c => c.remove());
        state.collageCells = [];
        state.activeCollageTemplate = null;
        canvas.classList.remove('collage-mode');
        updateEmptyState();
        updateToolbar();
        toast('Free collage mode');
    }

    // =============== PANELS ===============
    function openPanel(title) {
        panelTitle.textContent = title;
        panel.classList.add('open');
        state.panelOpen = true;
    }

    function closePanel() {
        panel.classList.remove('open');
        state.panelOpen = false;
    }

    function openBackgroundPanel() {
        openPanel('Canvas Background');
        panelContent.innerHTML = `
            <div class="color-grid" id="bgGrid"></div>
            <input type="color" id="bgColor" value="#ffffff" style="width:100%;height:44px;margin-top:8px;">
            <button class="primary-btn" id="bgImage" style="width:100%;margin-top:8px;">📷 Background Image</button>
            <button class="secondary-btn" id="bgReset" style="width:100%;margin-top:4px;">Reset White</button>
        `;
        
        const grid = $('#bgGrid');
        COLORS.slice(0, 18).forEach(c => {
            const s = document.createElement('div');
            s.className = 'color-swatch';
            s.style.background = c;
            s.addEventListener('click', () => {
                canvas.style.background = c;
                canvas.style.backgroundImage = 'none';
                $('#bgColor').value = c;
                scheduleSave();
            });
            grid.appendChild(s);
        });
        
        $('#bgColor').addEventListener('input', (e) => {
            canvas.style.background = e.target.value;
            canvas.style.backgroundImage = 'none';
            scheduleSave();
        });
        
        $('#bgImage').addEventListener('click', () => {
            const inp = document.createElement('input');
            inp.type = 'file';
            inp.accept = 'image/*';
            inp.addEventListener('change', (e) => {
                const f = e.target.files[0];
                if (f) {
                    const r = new FileReader();
                    r.onload = (ev) => {
                        canvas.style.background = `url(${ev.target.result})`;
                        canvas.style.backgroundSize = 'cover';
                        canvas.style.backgroundPosition = 'center';
                        scheduleSave();
                    };
                    r.readAsDataURL(f);
                }
            });
            inp.click();
        });
        
        $('#bgReset').addEventListener('click', () => {
            canvas.style.background = '#ffffff';
            canvas.style.backgroundImage = 'none';
            scheduleSave();
            closePanel();
        });
    }

    function openLayersPanel() {
        openPanel('Layers');
        let html = '<div style="display:flex;flex-direction:column;gap:6px;">';
        [...state.layers].reverse().forEach((l, i) => {
            const type = l.dataset.type;
            const icon = type === 'text' ? 'T' : type === 'image' ? '🖼' : '⬜';
            const locked = l.classList.contains('locked') ? ' 🔒' : '';
            const selected = l === state.selectedLayer ? ' style="background:var(--accent-bg);border-color:var(--accent);"' : '';
            html += `<button class="panel-btn" data-layer="${l.id}"${selected}>${icon} ${type}${locked}</button>`;
        });
        html += '</div>';
        if (state.layers.length === 0) html = '<p style="text-align:center;color:var(--text-secondary);">No layers yet</p>';
        panelContent.innerHTML = html;
        
        panelContent.querySelectorAll('.panel-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const layer = state.layers.find(l => l.id === btn.dataset.layer);
                if (layer) selectLayer(layer);
                closePanel();
            });
        });
    }

    function openImageAdjustPanel() {
        if (!state.selectedLayer || state.selectedLayer.dataset.type !== 'image') return;
        const img = state.selectedLayer.querySelector('img');
        if (!img) return;
        
        openPanel('Image Adjustments');
        const adjs = [
            { id: 'brightness', name: 'Brightness', min: 0, max: 200, val: 100, unit: '%' },
            { id: 'contrast', name: 'Contrast', min: 0, max: 200, val: 100, unit: '%' },
            { id: 'saturation', name: 'Saturation', min: 0, max: 200, val: 100, unit: '%' },
            { id: 'hue', name: 'Hue', min: 0, max: 360, val: 0, unit: '°' }
        ];
        
        panelContent.innerHTML = adjs.map(a => `
            <div class="control-group">
                <div class="control-label"><span>${a.name}</span><span class="control-value" id="${a.id}Val">${a.val}${a.unit}</span></div>
                <input type="range" id="${a.id}Slider" min="${a.min}" max="${a.max}" value="${a.val}">
            </div>
        `).join('') + `
            <button class="primary-btn" id="applyAdj" style="width:100%;margin-top:8px;">Apply</button>
            <button class="secondary-btn" id="resetAdj" style="width:100%;margin-top:4px;">Reset</button>
        `;
        
        const apply = () => {
            const b = $('#brightnessSlider').value;
            const c = $('#contrastSlider').value;
            const s = $('#saturationSlider').value;
            const h = $('#hueSlider').value;
            img.style.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) hue-rotate(${h}deg)`;
            $('#brightnessVal').textContent = b + '%';
            $('#contrastVal').textContent = c + '%';
            $('#saturationVal').textContent = s + '%';
            $('#hueVal').textContent = h + '°';
        };
        
        ['brightness','contrast','saturation','hue'].forEach(id => {
            $('#'+id+'Slider').addEventListener('input', apply);
        });
        
        $('#applyAdj').addEventListener('click', () => { saveState(); scheduleSave(); closePanel(); });
        $('#resetAdj').addEventListener('click', () => { img.style.filter = ''; saveState(); scheduleSave(); closePanel(); });
    }

    function openFilterPanel() {
        if (!state.selectedLayer || state.selectedLayer.dataset.type !== 'image') return;
        const img = state.selectedLayer.querySelector('img');
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
            { name: 'Fade', filter: 'brightness(120%) saturate(50%) contrast(90%)' }
        ];
        
        panelContent.innerHTML = `<div class="filter-grid">${filters.map(f => `
            <div class="filter-item" data-filter="${f.filter}">
                <span class="filter-name">${f.name}</span>
            </div>
        `).join('')}</div>`;
        
        panelContent.querySelectorAll('.filter-item').forEach(item => {
            item.addEventListener('click', () => {
                img.style.filter = item.dataset.filter === 'none' ? '' : item.dataset.filter;
                saveState();
                scheduleSave();
                closePanel();
            });
        });
    }

    function openOpacityPanel() {
        if (!state.selectedLayer) return;
        openPanel('Opacity');
        const current = parseFloat(state.selectedLayer.style.opacity || 1) * 100;
        panelContent.innerHTML = `
            <div class="control-group">
                <div class="control-label"><span>Opacity</span><span class="control-value" id="opVal">${current}%</span></div>
                <input type="range" id="opSlider" min="10" max="100" value="${current}">
            </div>
        `;
        $('#opSlider').addEventListener('input', (e) => {
            state.selectedLayer.style.opacity = e.target.value / 100;
            $('#opVal').textContent = e.target.value + '%';
            scheduleSave();
        });
    }

    function openBlendPanel() {
        if (!state.selectedLayer) return;
        openPanel('Blend Mode');
        const modes = ['normal','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion'];
        panelContent.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">${modes.map(m => `
            <button class="panel-btn" data-blend="${m}">${m.replace(/-/g,' ')}</button>
        `).join('')}</div>`;
        panelContent.querySelectorAll('.panel-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.selectedLayer.style.mixBlendMode = btn.dataset.blend === 'normal' ? '' : btn.dataset.blend;
                scheduleSave();
                closePanel();
            });
        });
    }

    function openBrushSettings() {
        openPanel('Brush Settings');
        panelContent.innerHTML = `
            <div class="control-group">
                <div class="control-label"><span>Size</span><span class="control-value" id="bsVal">${state.brushSize}px</span></div>
                <input type="range" id="bsSlider" min="5" max="200" value="${state.brushSize}">
            </div>
        `;
        $('#bsSlider').addEventListener('input', (e) => {
            state.brushSize = parseInt(e.target.value);
            $('#bsVal').textContent = state.brushSize + 'px';
        });
    }

    function cropImage() {
        if (!state.selectedLayer || state.selectedLayer.dataset.type !== 'image') return;
        toast('Use resize handles to crop');
    }

    // =============== COLOR POPUP ===============
    function showColorPopup() {
        colorPopup.style.display = 'block';
        const grid = $('#popupColorGrid');
        grid.innerHTML = '';
        COLORS.forEach(c => {
            const s = document.createElement('div');
            s.className = 'color-swatch';
            s.style.background = c;
            s.addEventListener('click', () => {
                state.brushColor = c;
                $('#popupColorInput').value = c;
                grid.querySelectorAll('.color-swatch').forEach(sw => sw.style.borderColor = 'transparent');
                s.style.borderColor = 'var(--accent)';
            });
            grid.appendChild(s);
        });
        colorPopup.style.top = '40%';
        colorPopup.style.left = '50%';
        colorPopup.style.transform = 'translate(-50%, -50%)';
    }

    function hideColorPopup() {
        colorPopup.style.display = 'none';
    }

    // =============== MENU ===============
    function toggleMenu() {
        if (state.menuOpen) closeMenu();
        else openMenu();
    }

    function openMenu() {
        state.menuOpen = true;
        hamburgerMenu.style.display = 'block';
    }

    function closeMenu() {
        state.menuOpen = false;
        hamburgerMenu.style.display = 'none';
    }

    function handleMenuAction(action) {
        switch(action) {
            case 'newProject':
                if (confirm('Start new project? All unsaved changes will be lost.')) clearAll();
                break;
            case 'saveProject':
                saveProject();
                toast('✅ Project saved');
                break;
            case 'exportImage':
                exportCanvas('jpeg');
                break;
            case 'exportPNG':
                exportCanvas('png');
                break;
            case 'resetZoom':
                state.displayScale = Math.min(
                    (canvasContainer.clientWidth - 40) / state.canvasWidth,
                    (canvasContainer.clientHeight - 40) / state.canvasHeight,
                    1
                );
                canvasWrapper.style.transform = `scale(${state.displayScale})`;
                toast('Zoom reset');
                break;
            case 'fitToScreen':
                updateDisplayScale();
                toast('Fit to screen');
                break;
            case 'canvasSize':
                openCanvasSizeModal();
                break;
            case 'clearCanvas':
                if (confirm('Clear all content?')) clearAll();
                break;
            case 'openDocs':
                window.open('docs.html', '_blank');
                break;
            case 'keyboardShortcuts':
                showShortcuts();
                break;
        }
    }

    function openCanvasSizeModal() {
        canvasSizeModal.style.display = 'flex';
        $('#customWidth').value = state.canvasWidth;
        $('#customHeight').value = state.canvasHeight;
    }

    function closeCanvasSizeModal() {
        canvasSizeModal.style.display = 'none';
    }

    function showShortcuts() {
        const shortcuts = [
            'Ctrl+Z - Undo', 'Ctrl+Shift+Z - Redo',
            'Ctrl+Plus - Zoom in', 'Ctrl+Minus - Zoom out',
            'Ctrl+0 - Reset zoom', 'Delete - Delete layer',
            'Escape - Deselect/Stop brush', 'Scroll - Zoom'
        ];
        alert('Keyboard Shortcuts:\n\n' + shortcuts.join('\n'));
    }

    // =============== EXPORT ===============
    async function exportCanvas(format = 'jpeg') {
        stopBrushing();
        deselectAll();
        closePanel();
        
        try {
            if (typeof domtoimage === 'undefined') {
                toast('Export library not loaded');
                return;
            }
            
            toast('Exporting...');
            
            const options = {
                quality: 0.95,
                bgcolor: '#ffffff',
                width: state.canvasWidth,
                height: state.canvasHeight,
                style: { transform: 'none', filter: 'none' }
            };
            
            const dataUrl = format === 'png' 
                ? await domtoimage.toPng(canvas, options)
                : await domtoimage.toJpeg(canvas, options);
            
            const link = document.createElement('a');
            link.download = `statsnap-${Date.now()}.${format}`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast('✅ Exported successfully!');
        } catch (err) {
            console.error('Export error:', err);
            toast('Export failed');
        }
    }

    function clearAll() {
        state.layers.forEach(l => l.remove());
        state.layers = [];
        state.selectedLayer = null;
        state.collageCells.forEach(c => c.remove());
        state.collageCells = [];
        state.activeCollageTemplate = null;
        canvas.style.background = '#ffffff';
        canvas.style.backgroundImage = 'none';
        canvas.classList.remove('collage-mode');
        state.undoStack = [];
        state.redoStack = [];
        updateEmptyState();
        updateToolbar();
        updateUndoRedo();
        saveState();
        scheduleSave();
    }

    // =============== UNDO/REDO ===============
    function saveState() {
        state.undoStack.push(serialize());
        if (state.undoStack.length > state.maxHistory) state.undoStack.shift();
        state.redoStack = [];
        updateUndoRedo();
    }

    function undo() {
        if (state.undoStack.length === 0) return;
        state.redoStack.push(serialize());
        restore(state.undoStack.pop());
        updateUndoRedo();
        scheduleSave();
        toast('Undo ↩️');
    }

    function redo() {
        if (state.redoStack.length === 0) return;
        state.undoStack.push(serialize());
        restore(state.redoStack.pop());
        updateUndoRedo();
        scheduleSave();
        toast('Redo ↪️');
    }

    function updateUndoRedo() {
        $('#undoBtn').disabled = state.undoStack.length === 0;
        $('#redoBtn').disabled = state.redoStack.length === 0;
    }

    function serialize() {
        return {
            layers: state.layers.map(l => ({
                id: l.id, type: l.dataset.type,
                html: l.innerHTML,
                style: l.getAttribute('style') || '',
                rotation: l.dataset.rotation || '0',
                locked: l.classList.contains('locked')
            })),
            canvasStyle: canvas.getAttribute('style') || '',
            canvasWidth: state.canvasWidth,
            canvasHeight: state.canvasHeight,
            mode: state.mode,
            collageTemplate: state.activeCollageTemplate,
            collageCells: state.collageCells.map(c => ({
                style: c.getAttribute('style'),
                html: c.innerHTML,
                filled: c.classList.contains('filled')
            })),
            version: '4.0'
        };
    }

    function restore(data) {
        if (!data) return;
        
        state.layers.forEach(l => l.remove());
        state.layers = [];
        state.selectedLayer = null;
        state.collageCells.forEach(c => c.remove());
        state.collageCells = [];
        
        if (data.canvasStyle) canvas.setAttribute('style', data.canvasStyle);
        state.canvasWidth = data.canvasWidth || 1080;
        state.canvasHeight = data.canvasHeight || 1920;
        state.mode = data.mode || 'design';
        
        applyCanvasSize();
        
        if (data.layers) {
            data.layers.forEach(ld => {
                const layer = document.createElement('div');
                layer.id = ld.id;
                layer.className = 'layer';
                layer.dataset.type = ld.type;
                layer.dataset.rotation = ld.rotation;
                layer.innerHTML = ld.html;
                layer.setAttribute('style', ld.style);
                if (ld.locked) layer.classList.add('locked');
                
                addHandles(layer);
                
                layer.addEventListener('pointerdown', (e) => {
                    if (state.isBrushing) return;
                    if (!e.target.classList.contains('resize-handle') && !e.target.classList.contains('rotate-handle')) {
                        e.stopPropagation();
                        if (!layer.classList.contains('locked')) selectLayer(layer);
                    }
                });
                
                if (ld.type === 'text') {
                    layer.contentEditable = 'true';
                    layer.addEventListener('input', () => scheduleSave());
                }
                
                canvas.appendChild(layer);
                state.layers.push(layer);
                
                const idNum = parseInt(ld.id.split('-')[1]);
                if (!isNaN(idNum)) state.layerIdCounter = Math.max(state.layerIdCounter, idNum);
            });
        }
        
        if (data.collageTemplate) {
            state.activeCollageTemplate = data.collageTemplate;
            canvas.classList.add('collage-mode');
            if (data.collageCells) {
                data.collageCells.forEach(cd => {
                    const div = document.createElement('div');
                    div.className = 'collage-cell';
                    if (cd.filled) div.classList.add('filled');
                    div.setAttribute('style', cd.style);
                    div.innerHTML = cd.html;
                    canvas.appendChild(div);
                    state.collageCells.push(div);
                });
            }
        }
        
        $$('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === state.mode));
        updateEmptyState();
        updateToolbar();
    }

    // =============== PERSISTENCE ===============
    async function initDB() {
        return new Promise((resolve) => {
            const req = indexedDB.open('statsnap-pro', 1);
            req.onerror = () => resolve();
            req.onsuccess = () => { state.db = req.result; resolve(); };
            req.onupgradeneeded = (e) => {
                e.target.result.createObjectStore('projects', { keyPath: 'id' });
            };
        });
    }

    async function saveProject() {
        if (!state.db) return;
        try {
            const tx = state.db.transaction('projects', 'readwrite');
            tx.objectStore('projects').put({ id: 'current', data: serialize(), ts: Date.now() });
        } catch(e) {}
    }

    function scheduleSave() {
        clearTimeout(state.saveTimeout);
        state.saveTimeout = setTimeout(saveProject, 2000);
    }

    function startAutoSave() {
        setInterval(saveProject, 30000);
    }

    async function loadProject() {
        if (!state.db) return;
        try {
            const tx = state.db.transaction('projects', 'readonly');
            const req = tx.objectStore('projects').get('current');
            req.onsuccess = () => {
                if (req.result && req.result.data) restore(req.result.data);
            };
        } catch(e) {}
    }

    // =============== THEME ===============
    function toggleTheme() {
        const cur = document.documentElement.getAttribute('data-theme');
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('statsnap-theme', next);
        toast(next === 'dark' ? '🌙 Dark mode' : '☀️ Light mode');
    }

    // =============== KEYBOARD ===============
    function onKeyboard(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        else if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) { e.preventDefault(); redo(); }
        else if (e.key === 'Delete' || e.key === 'Backspace') {
            if (state.selectedLayer && document.activeElement === document.body) { e.preventDefault(); deleteSelectedLayer(); }
        }
        else if (e.key === 'Escape') { stopBrushing(); closePanel(); deselectAll(); }
        else if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); updateDisplayScale(); toast('Reset zoom'); }
        else if ((e.ctrlKey || e.metaKey) && e.key === '=') { e.preventDefault(); state.displayScale = Math.min(2, state.displayScale + 0.05); canvasWrapper.style.transform = `scale(${state.displayScale})`; }
        else if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); state.displayScale = Math.max(0.1, state.displayScale - 0.05); canvasWrapper.style.transform = `scale(${state.displayScale})`; }
    }

    // =============== UTILS ===============
    function toast(msg) {
        const existing = $('.toast');
        if (existing) existing.remove();
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => { if (t.parentNode) t.remove(); }, 2000);
    }

    function updateUI() {
        updateEmptyState();
        updateToolbar();
        updateUndoRedo();
    }

    // =============== RETURN PUBLIC API ===============
    return { init, switchMode, exportCanvas, clearAll };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => Statsnap.init());

// Save on unload
window.addEventListener('beforeunload', () => {
    if (Statsnap.saveProject) Statsnap.saveProject();
});
