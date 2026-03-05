/* --- GraphEditor main.js (Fidelity Merge: AE Visuals + PPro Functions) --- */
(function () {
    'use strict';

    var csInterface = new CSInterface();

    // Referencias UI
    const mainLayout = document.getElementById('mainLayout');
    const primaryColumn = document.getElementById('primaryColumn');
    const resizeGutter = document.getElementById('resizeGutter');
    const sliderOut = document.getElementById('sliderOut');
    const sliderIn = document.getElementById('sliderIn');
    const outValDisplay = document.getElementById('outValDisplay');
    const inValDisplay = document.getElementById('inValDisplay');
    const applyBtn = document.getElementById('applyBtn');
    const lockBtn = document.getElementById('lockBtn');
    const tabPresets = document.getElementById('tabPresets');
    const tabFavorites = document.getElementById('tabFavorites');
    const presetsGrid = document.getElementById('presetsGrid');
    const savePresetBtn = document.getElementById('savePresetBtn');
    const btnModeVel = document.getElementById('btnModeVelocity');
    const btnModeVal = document.getElementById('btnModeValue');
    const copyBtn = document.getElementById('copyBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const filterRow = document.getElementById('filterRow');

    // Referencias SVG
    const baseLineL = document.getElementById('graphBaseLeft');
    const baseLineR = document.getElementById('graphBaseRight');
    const graphContainer = document.getElementById('graphContainer');
    const speedGraphSVG = document.getElementById('speedGraphSVG');
    const graphCurve = document.getElementById('graphCurve');
    const graphFill = document.getElementById('graphFill');
    const hLineL = document.getElementById('handleLineLeft');
    const hLineR = document.getElementById('handleLineRight');
    const pointL = document.getElementById('handlePointLeft');
    const pointR = document.getElementById('handlePointRight');
    const dragAreaL = document.getElementById('dragAreaLeft');
    const dragAreaR = document.getElementById('dragAreaRight');
    const dragGroupLeft = document.getElementById('dragGroupLeft');
    const dragGroupRight = document.getElementById('dragGroupRight');

    // Constantes Visuales
    const SVG_WIDTH = 300;
    const SVG_HEIGHT = 300;
    const HANDLE_PADDING = 20;

    // Estado
    let isLocked = false;
    let isDraggingLeft = false;
    let isDraggingRight = false;
    let handleLeftY = 0;
    let handleRightY = 0;
    let favoritesSet = new Set();
    let customPresets = [];
    let allPresets = [];
    let graphMode = 'velocity';
    let currentViewScale = 1;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartValX = 0;
    let dragStartValY = 0;
    let dragStartScale = 1;

    // Estado Layout
    let isDraggingGutter = false;
    let layoutMode = '';
    const LAYOUT_THRESHOLD = 500;

    // --- 1. PRESETS POR DEFECTO ---
    const DEFAULT_PRESETS = [
        { id: 'ease_in', name: 'Ease In', o: 0, i: 70 },
        { id: 'ease_out', name: 'Ease Out', o: 70, i: 0 },
        { id: 'ease_in_out', name: 'Ease In Out', o: 70, i: 70 },
        { id: 'linear', name: 'Linear', o: 0.1, i: 0.1 },
        { id: 'steep_in', name: 'Steep In', o: 0, i: 100 },
        { id: 'steep_out', name: 'Steep Out', o: 100, i: 0 },
        { id: 'expo_in', name: 'Expo In', o: 0, i: 90 },
        { id: 'expo_out', name: 'Expo Out', o: 90, i: 0 },
        { id: 'sharp_in', name: 'Sharp In', o: 50, i: 100 },
        { id: 'sharp_out', name: 'Sharp Out', o: 100, i: 50 }
    ];

    // --- 2. MOTOR GRÁFICO (Adoptado 1:1 de AE) ---
    function cubicBezier(t, p0, p1, p2, p3) {
        const u = 1 - t; const tt = t * t; const uu = u * u; const uuu = uu * u; const ttt = tt * t;
        return (uuu * p0) + (3 * uu * t * p1) + (3 * u * tt * p2) + (ttt * p3);
    }
    function cubicBezierDerivative(t, p0, p1, p2, p3) {
        const u = 1 - t; return (3 * u * u * (p1 - p0)) + (6 * u * t * (p2 - p1)) + (3 * t * t * (p3 - p2));
    }

    function getStandardizedPath(o, i, vO, vI, mode) {
        let mcp1x = o / 100; let mcp2x = 1 - (i / 100);
        let mcp1y = (mode === 'velocity') ? 0 : vO; let mcp2y = (mode === 'velocity') ? 0 : vI;
        const steps = 25; let points = []; let minVal = 0, maxVal = 1;
        for (let s = 0; s <= steps; s++) {
            let t = s / steps;
            let bx = cubicBezier(t, 0, mcp1x, mcp2x, 1);
            let by = 0;
            if (mode === 'value') { by = cubicBezier(t, 0, mcp1y, mcp2y, 1); }
            else {
                let dx = cubicBezierDerivative(t, 0, mcp1x, mcp2x, 1); let dy = cubicBezierDerivative(t, 0, 0, 1, 1);
                if (dx > 0.0001) by = dy / dx; if (by > 25) by = 25;
            }
            if (by > maxVal) maxVal = by; if (by < minVal) minVal = by;
            points.push({ x: bx, y: by });
        }
        let rangeY = maxVal - minVal; if (rangeY < 0.001) rangeY = 1;
        const pad = 0.2;
        let visualMinY = minVal - (rangeY * pad);
        let visualMaxY = maxVal + (rangeY * pad);
        let visualRangeY = visualMaxY - visualMinY;
        const mapX = (x) => 10 + (x * 280);
        const mapY = (y) => 290 - ((y - visualMinY) / visualRangeY * 280);
        let d = "";
        points.forEach((p, idx) => { d += (idx === 0 ? "M" : "L") + " " + mapX(p.x).toFixed(1) + "," + mapY(p.y).toFixed(1); });
        return d;
    }

    function updateGraphVisuals() {
        let o = parseFloat(sliderOut.value);
        let i = parseFloat(sliderIn.value);
        outValDisplay.textContent = Math.round(o) + '%';
        inValDisplay.textContent = Math.round(i) + '%';

        let mcp1x = o / 100; let mcp2x = 1 - (i / 100);
        let mcp1y = (graphMode === 'velocity') ? 0 : handleLeftY;
        let mcp2y = (graphMode === 'velocity') ? 0 : handleRightY;

        const steps = 120; let rawPoints = []; let minVal = 0, maxVal = 1;
        if (graphMode === 'value') { minVal = Math.min(0, handleLeftY, handleRightY); maxVal = Math.max(1, handleLeftY, handleRightY); } else { maxVal = 2.0; }

        for (let s = 0; s <= steps; s++) {
            let t = s / steps;
            let bx = cubicBezier(t, 0, mcp1x, mcp2x, 1);
            let by = 0;
            if (graphMode === 'value') { by = cubicBezier(t, 0, mcp1y, mcp2y, 1); }
            else {
                let dx = cubicBezierDerivative(t, 0, mcp1x, mcp2x, 1); let dy = cubicBezierDerivative(t, 0, 0, 1, 1);
                if (dx > 0.0001) by = dy / dx; if (by > 100) by = 100;
            }
            if (by > maxVal) maxVal = by; if (by < minVal) minVal = by;

            if (rawPoints.length > 0) {
                let prev = rawPoints[rawPoints.length - 1];
                if (Math.abs(bx - prev.x) < 0.0001 && Math.abs(by - prev.y) < 0.0001) continue;
            }
            rawPoints.push({ x: bx, y: by });
        }

        let rangeY = maxVal - minVal; if (rangeY < 0.001) rangeY = 1;
        const paddingMultiplier = 0.2;
        let visualMinY = minVal - (rangeY * paddingMultiplier);
        let visualMaxY = maxVal + (rangeY * paddingMultiplier);
        let visualRangeY = visualMaxY - visualMinY;

        if (graphMode === 'value') currentViewScale = Math.max(1.0 + (paddingMultiplier * 2), visualRangeY); else currentViewScale = 1.0;

        let centerY = (visualMinY + visualMaxY) / 2;
        let viewMinY = centerY - (currentViewScale / 2); let viewMaxY = centerY + (currentViewScale / 2);
        let centerX = 0.5; let viewMinX = centerX - (currentViewScale / 2); let viewMaxX = centerX + (currentViewScale / 2);
        const usableSize = SVG_WIDTH - (HANDLE_PADDING * 2);

        const mapY = (val) => { let normalized = (graphMode === 'value') ? (val - viewMinY) / currentViewScale : (val - visualMinY) / visualRangeY; return SVG_HEIGHT - HANDLE_PADDING - (normalized * usableSize); };
        const mapX = (val) => { let normalized = (graphMode === 'value') ? (val - viewMinX) / currentViewScale : val; return HANDLE_PADDING + (normalized * usableSize); };

        let dCurve = "", dFill = ""; const floorY = mapY(0);
        for (let idx = 0; idx < rawPoints.length; idx++) {
            let p = rawPoints[idx]; let px = mapX(p.x); let py = mapY(p.y);
            let cmd = (idx === 0) ? "M" : "L"; dCurve += `${cmd} ${px},${py}`;
            if (idx === 0) dFill += `M ${px},${floorY} L ${px},${py}`; else dFill += ` L ${px},${py}`;
        }
        let endX = mapX(1); dFill += ` L ${endX},${floorY} Z`;
        graphCurve.setAttribute('d', dCurve); graphFill.setAttribute('d', dFill);

        // Grid
        let dGrid = ""; const FAR_PIXEL = 3000;
        if (graphMode === 'value') {
            const gridStep = 0.25;
            let startX = Math.floor((viewMinX - 2) / gridStep) * gridStep;
            let endX = Math.ceil((viewMaxX + 2) / gridStep) * gridStep;
            for (let gx = startX; gx <= endX; gx += gridStep) { let xPos = mapX(gx); dGrid += `M ${xPos},${-FAR_PIXEL} L ${xPos},${FAR_PIXEL} `; }
            let startY = Math.floor((viewMinY - 2) / gridStep) * gridStep;
            let endY = Math.ceil((viewMaxY + 2) / gridStep) * gridStep;
            for (let gy = startY; gy <= endY; gy += gridStep) { let yPos = mapY(gy); dGrid += `M ${-FAR_PIXEL},${yPos} L ${FAR_PIXEL},${yPos} `; }
        } else {
            [0.25, 0.5, 0.75].forEach(pct => {
                let pos = HANDLE_PADDING + (pct * usableSize); dGrid += `M ${pos},${-FAR_PIXEL} L ${pos},${FAR_PIXEL} `;
                let posY = SVG_HEIGHT - HANDLE_PADDING - (pct * usableSize); dGrid += `M ${-FAR_PIXEL},${posY} L ${FAR_PIXEL},${posY} `;
            });
        }
        document.getElementById('gridPath').setAttribute('d', dGrid);

        // Handles
        let h1x, h2x, h1y, h2y;
        if (graphMode === 'velocity') {
            // --- POSICIONAR ELEMENTOS Y EJES (Mapping original PPro) ---
            h1x = HANDLE_PADDING + ((o / 100) * 0.5 * usableSize); h1y = mapY(0);
            h2x = (HANDLE_PADDING + usableSize) - ((i / 100) * 0.5 * usableSize); h2y = mapY(0);
        } else {
            h1x = mapX(mcp1x); h1y = mapY(mcp1y); h2x = mapX(mcp2x); h2y = mapY(mcp2y);
        }

        // Ocultar líneas base para no ensuciar el diseño
        baseLineL.style.display = 'none';
        baseLineR.style.display = 'none';

        hLineL.setAttribute('x1', mapX(0)); hLineL.setAttribute('y1', mapY(0)); hLineL.setAttribute('x2', h1x); hLineL.setAttribute('y2', h1y);
        let anchorRightY = (graphMode === 'velocity') ? 0 : 1; hLineR.setAttribute('x1', mapX(1)); hLineR.setAttribute('y1', mapY(anchorRightY)); hLineR.setAttribute('x2', h2x); hLineR.setAttribute('y2', h2y);
        pointL.setAttribute('cx', h1x); pointL.setAttribute('cy', h1y); pointR.setAttribute('cx', h2x); pointR.setAttribute('cy', h2y);
        dragAreaL.setAttribute('x', h1x - 20); dragAreaL.setAttribute('y', h1y - 20); dragAreaR.setAttribute('x', h2x - 20); dragAreaR.setAttribute('y', h2y - 20);
    }

    // --- 3. INTERACCIÓN ---
    function startDragLeft(e) { isDraggingLeft = true; isDraggingRight = false; document.body.style.cursor = 'move'; dragStartX = e.clientX; dragStartY = e.clientY; dragStartValX = parseFloat(sliderOut.value); dragStartValY = handleLeftY; dragStartScale = (graphMode === 'value') ? currentViewScale : 1; }
    function startDragRight(e) { isDraggingRight = true; isDraggingLeft = false; document.body.style.cursor = 'move'; dragStartX = e.clientX; dragStartY = e.clientY; dragStartValX = parseFloat(sliderIn.value); dragStartValY = handleRightY; dragStartScale = (graphMode === 'value') ? currentViewScale : 1; }
    function handleDrag(e) {
        if (!isDraggingLeft && !isDraggingRight) return;
        const rect = speedGraphSVG.getBoundingClientRect();
        const usableSize = rect.width - (HANDLE_PADDING * 2 * (rect.width / SVG_WIDTH));

        let pixelsFor100;
        if (graphMode === 'velocity') { pixelsFor100 = usableSize * 0.48; } else { pixelsFor100 = usableSize / dragStartScale; }

        const deltaX = (e.clientX - dragStartX) / pixelsFor100 * 100;
        let changeX = isDraggingRight ? -deltaX : deltaX;
        let newValX = Math.max(0.1, Math.min(100, dragStartValX + changeX));

        if (graphMode === 'value') {
            const deltaY = -(e.clientY - dragStartY) / usableSize * dragStartScale;
            if (isDraggingLeft) handleLeftY = dragStartValY + deltaY; else handleRightY = dragStartValY + deltaY;
        }

        const shouldLink = isLocked || e.shiftKey;
        if (isDraggingLeft) {
            sliderOut.value = newValX;
            sliderOut.dispatchEvent(new Event('input'));
            if (shouldLink) { sliderIn.value = newValX; sliderIn.dispatchEvent(new Event('input')); if (graphMode === 'value') handleRightY = handleLeftY; }
        } else {
            sliderIn.value = newValX;
            sliderIn.dispatchEvent(new Event('input'));
            if (shouldLink) { sliderOut.value = newValX; sliderOut.dispatchEvent(new Event('input')); if (graphMode === 'value') handleLeftY = handleRightY; }
        }
        updateGraphVisuals();
    }
    function stopDrag() { isDraggingLeft = false; isDraggingRight = false; document.body.style.cursor = 'default'; }

    dragGroupLeft.addEventListener('mousedown', startDragLeft);
    dragGroupRight.addEventListener('mousedown', startDragRight);
    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', stopDrag);

    // --- 4. PRESETS DYNAMIC RENDERING ---
    function loadData() {
        try {
            const sFav = localStorage.getItem('grapheditorFavs_PPro');
            if (sFav) favoritesSet = new Set(JSON.parse(sFav));
            const sCust = localStorage.getItem('grapheditorCustomPresets_PPro');
            if (sCust) customPresets = JSON.parse(sCust);
            const sOrder = localStorage.getItem('grapheditorOrder_PPro');
            let order = sOrder ? JSON.parse(sOrder) : [];

            let baseList = DEFAULT_PRESETS.map(p => ({ ...p, isDefault: true }));
            baseList = baseList.concat(customPresets.map(p => ({ ...p, isDefault: false })));

            if (order.length > 0) {
                allPresets = order.map(id => baseList.find(p => p.id === id)).filter(p => p !== undefined);
                baseList.forEach(p => { if (!order.includes(p.id)) allPresets.push(p); });
            } else { allPresets = baseList; }
            renderPresets();
        } catch (e) { }
    }

    function saveOrder() { localStorage.setItem('grapheditorOrder_PPro', JSON.stringify(allPresets.map(p => p.id))); }
    function saveFavs() { localStorage.setItem('grapheditorFavs_PPro', JSON.stringify([...favoritesSet])); }
    function saveCustoms() { localStorage.setItem('grapheditorCustomPresets_PPro', JSON.stringify(allPresets.filter(p => !p.isDefault))); }

    function renderPresets() {
        presetsGrid.innerHTML = '';
        allPresets.forEach(p => {
            const div = document.createElement('div');
            div.className = 'preset-card' + (p.isDefault ? ' default-preset' : ' custom-preset');
            div.id = p.id; div.draggable = true;
            if (favoritesSet.has(p.id)) div.classList.add('is-favorite');
            const path = getStandardizedPath(p.o, p.i, p.vO || 0, p.vI || (graphMode === 'value' ? 1 : 0), graphMode);
            const name = p.customName || p.name;
            div.innerHTML = `<svg class="preset-icon" viewBox="0 0 300 300"><path d="${path}"/></svg>
                <div class="preset-name">${name}</div><span class="fav-icon">★</span>
                ${p.isDefault ? '' : '<button class="delete-preset-btn">✕</button>'}`;

            div.addEventListener('click', (e) => {
                if (e.target.classList.contains('fav-icon')) {
                    if (favoritesSet.has(p.id)) favoritesSet.delete(p.id); else favoritesSet.add(p.id);
                    saveFavs(); div.classList.toggle('is-favorite'); return;
                }
                if (e.target.classList.contains('delete-preset-btn')) { allPresets = allPresets.filter(pr => pr.id !== p.id); saveCustoms(); renderPresets(); return; }
                sliderOut.value = p.o; sliderIn.value = p.i;
                if (graphMode === 'value') { handleLeftY = p.vO || 0; handleRightY = p.vI || 1; }
                updateGraphVisuals(); applyToPPro();
            });
            div.addEventListener('dragstart', () => div.classList.add('is-dragging-item'));
            div.addEventListener('dragend', () => { div.classList.remove('is-dragging-item'); saveOrder(); });
            presetsGrid.appendChild(div);
        });
    }

    presetsGrid.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(presetsGrid, e.clientY);
        const dragging = document.querySelector('.is-dragging-item');
        if (afterElement == null) presetsGrid.appendChild(dragging); else presetsGrid.insertBefore(dragging, afterElement);
    });

    presetsGrid.addEventListener('drop', (e) => {
        e.preventDefault();
        const newOrder = [...presetsGrid.querySelectorAll('.preset-card')].map(c => c.id);
        allPresets = newOrder.map(id => allPresets.find(p => p.id === id));
        saveOrder();
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.preset-card:not(.is-dragging-item)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
            else return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // --- 5. TABS & MINIMIZE ---
    function handleTabClick(tabId) {
        const section = document.getElementById('presetsSection');
        const isTabActive = document.getElementById(tabId).classList.contains('active');
        if (isTabActive) {
            section.classList.toggle('is-minimized');
            mainLayout.classList.toggle('presets-minimized');
        } else {
            section.classList.remove('is-minimized');
            mainLayout.classList.remove('presets-minimized');
            if (tabId === 'tabPresets') {
                tabPresets.classList.add('active'); tabFavorites.classList.remove('active'); presetsGrid.classList.remove('showing-favorites-only');
            } else {
                tabFavorites.classList.add('active'); tabPresets.classList.remove('active'); presetsGrid.classList.add('showing-favorites-only');
            }
        }
        setTimeout(updateGraphVisuals, 50);
    }
    tabPresets.addEventListener('click', () => handleTabClick('tabPresets'));
    tabFavorites.addEventListener('click', () => handleTabClick('tabFavorites'));

    // --- 6. PREMIERE SCANNING & FILTERS ---
    function getActiveFilters() {
        const activeFilters = [];
        document.querySelectorAll('.filter-pill.active').forEach(p => { activeFilters.push(p.dataset.filter); });
        return activeFilters.join(',');
    }

    let lastResultStr = "";
    function scanProps() {
        csInterface.evalScript('_GRAPHEDITOR.scanActiveProperties()', function (result) {
            if (result === lastResultStr) return;
            lastResultStr = result;
            const filterRow = document.getElementById('filterRow');
            const previousState = {};
            filterRow.querySelectorAll('.filter-pill').forEach(btn => { previousState[btn.dataset.filter] = btn.classList.contains('active'); });

            const foundFilters = result ? result.split(',') : [];
            filterRow.innerHTML = '';
            foundFilters.forEach(propName => {
                if (!propName) return;
                const btn = document.createElement('button');
                btn.className = 'filter-pill is-available'; btn.dataset.filter = propName; btn.innerText = propName;
                if (previousState.hasOwnProperty(propName)) { if (previousState[propName]) btn.classList.add('active'); } else { btn.classList.add('active'); }
                btn.addEventListener('click', function () { this.classList.toggle('active'); });
                filterRow.appendChild(btn);
            });
        });
    }
    window.addEventListener('focus', scanProps);
    setInterval(scanProps, 1500);

    // --- 7. APPLICATION LOGIC (PPRO) ---
    function applyToPPro() {
        applyBtn.innerText = "APLICANDO...";
        const vOut = (graphMode === 'value') ? handleLeftY : 0;
        const vIn = (graphMode === 'value') ? (handleRightY - 1) : 0;
        const filterStr = getActiveFilters();
        csInterface.evalScript(`_GRAPHEDITOR.applyInfluence(${sliderOut.value}, ${sliderIn.value}, ${vOut}, ${vIn}, '${graphMode}', '${filterStr}')`, function (result) {
            applyBtn.innerText = result || "APLICADO";
            setTimeout(() => applyBtn.innerText = "APLICAR", 2000);
        });
    }

    function cleanCurvesInPPro() {
        const svg = copyBtn.querySelector('svg');
        if (svg) svg.style.display = 'none';
        copyBtn.textContent = '⏳';
        const filterStr = getActiveFilters();
        csInterface.evalScript(`_GRAPHEDITOR.cleanCurve('${filterStr}')`, function (result) {
            copyBtn.textContent = '';
            if (svg) { copyBtn.appendChild(svg); svg.style.display = 'block'; }
            applyBtn.innerText = result || "BORRADO";
            setTimeout(() => applyBtn.innerText = "APLICAR", 2000);
        });
    }

    function setType(type) {
        const filters = getActiveFilters();
        csInterface.evalScript(`_GRAPHEDITOR.setKeyframeType('${type}', '${filters}')`, function (result) {
            applyBtn.innerText = result || "OK";
            setTimeout(() => applyBtn.innerText = "APLICAR", 1500);
        });
    }

    // Listeners final
    copyBtn.addEventListener('click', cleanCurvesInPPro);
    applyBtn.addEventListener('click', applyToPPro);
    btnModeVel.addEventListener('click', () => { graphMode = 'velocity'; btnModeVel.classList.add('active'); btnModeVal.classList.remove('active'); updateGraphVisuals(); renderPresets(); });
    btnModeVal.addEventListener('click', () => { graphMode = 'value'; btnModeVal.classList.add('active'); btnModeVel.classList.remove('active'); updateGraphVisuals(); renderPresets(); });

    document.querySelectorAll('.kf-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            if (this.id === 'savePresetBtn' || this.id === 'copyBtn') return;
            if (this.dataset.type) { setType(this.dataset.type); }
        });
    });

    sliderOut.addEventListener('input', () => { if (isLocked) sliderIn.value = sliderOut.value; updateGraphVisuals(); });
    sliderIn.addEventListener('input', () => { if (isLocked) sliderOut.value = sliderIn.value; updateGraphVisuals(); });
    lockBtn.addEventListener('click', () => { isLocked = !isLocked; lockBtn.textContent = isLocked ? '🔒' : '🔓'; if (isLocked) { sliderIn.value = sliderOut.value; updateGraphVisuals(); } });

    savePresetBtn.addEventListener('click', () => {
        const name = prompt("Nombre:", "Preset");
        if (name) {
            const p = { id: 'cust_' + Date.now(), name: name, o: sliderOut.value, i: sliderIn.value, vO: handleLeftY, vI: handleRightY, isDefault: false };
            allPresets.push(p); saveCustoms(); renderPresets();
        }
    });

    clearAllBtn.addEventListener('click', () => { if (confirm("¿Borrar todos?")) { customPresets = []; allPresets = allPresets.filter(p => p.isDefault); saveCustoms(); renderPresets(); } });

    // Resize Gutter
    resizeGutter.addEventListener('mousedown', () => { isDraggingGutter = true; });
    window.addEventListener('mousemove', (e) => {
        if (!isDraggingGutter) return;
        let newH = e.clientY;
        if (newH > 150 && newH < window.innerHeight - 50) { primaryColumn.style.height = newH + 'px'; primaryColumn.style.flexBasis = newH + 'px'; updateGraphVisuals(); }
    });
    window.addEventListener('mouseup', () => { isDraggingGutter = false; });

    loadData();
    updateGraphVisuals();
    scanProps();

})();