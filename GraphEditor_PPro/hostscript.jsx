/*
    GraphEditor Host Script - Premiere Pro Version (Fidelity Master - SMOOTHIFY ENHANCED)
    --------------------------------------------------------------------------
    Reforzado para Premiere Pro 2026 - Soporte total de Máscaras y Curvas
    -------------------------------------------------------------------------
*/

var _GRAPHEDITOR = {};

(function () {
    'use strict';

    var BAKING_STEPS = 20; // Aumentado para mayor fluidez en máscaras

    // --- MOTOR DE INTERPOLACIÓN BEZIER ---
    function getBezierPoint(t, p0, p1, p2, p3) {
        var u = 1 - t;
        return (u * u * u * p0) + (3 * u * u * t * p1) + (3 * u * t * t * p2) + (t * t * t * p3);
    }

    function solveBezierT(x, p1x, p2x) {
        var t = x;
        for (var i = 0; i < 8; i++) {
            var currentX = getBezierPoint(t, 0, p1x, p2x, 1) - x;
            var dx = 3 * Math.pow(1 - t, 2) * p1x + 6 * (1 - t) * t * (p2x - p1x) + 3 * Math.pow(t, 2) * (1 - p2x);
            if (Math.abs(dx) < 0.0001) break;
            t -= currentX / dx;
            t = Math.max(0, Math.min(1, t));
        }
        return t;
    }

    // --- INTERPOLACIÓN DE VALORES COMPLEJOS (SOPORTE MÁSCARAS) ---
    function interpolateValue(v1, v2, t) {
        if (v1 === null || v1 === undefined) return v2;
        if (v2 === null || v2 === undefined) return v1;

        // Caso 1: Números simples
        if (typeof v1 === 'number') {
            return v1 + (v2 - v1) * t;
        }

        // Caso 2: Objetos con X/Y (Puntos de PPro)
        if (v1.hasOwnProperty('x') && v1.hasOwnProperty('y')) {
            return {
                x: v1.x + (v2.x - v1.x) * t,
                y: v1.y + (v2.y - v1.y) * t
            };
        }

        // Caso 3: Propiedades de Máscara (Shape / Path)
        if (v1.hasOwnProperty('vertices')) {
            var res = {
                vertices: [],
                inTangents: [],
                outTangents: [],
                closed: v1.closed
            };
            var len = v1.vertices.length;
            for (var i = 0; i < len; i++) {
                var pt1 = v1.vertices[i];
                var pt2 = (v2.vertices && v2.vertices[i]) ? v2.vertices[i] : pt1;
                res.vertices.push([pt1[0] + (pt2[0] - pt1[0]) * t, pt1[1] + (pt2[1] - pt1[1]) * t]);

                var it1 = v1.inTangents[i];
                var it2 = (v2.inTangents && v2.inTangents[i]) ? v2.inTangents[i] : it1;
                res.inTangents.push([it1[0] + (it2[0] - it1[0]) * t, it1[1] + (it2[1] - it1[1]) * t]);

                var ot1 = v1.outTangents[i];
                var ot2 = (v2.outTangents && v2.outTangents[i]) ? v2.outTangents[i] : ot1;
                res.outTangents.push([ot1[0] + (ot2[0] - ot1[0]) * t, ot1[1] + (ot2[1] - ot1[1]) * t]);
            }
            return res;
        }

        // Caso 4: Arrays (Colores, Escala 3D)
        if (v1.length !== undefined) {
            var arr = [];
            for (var d = 0; d < v1.length; d++) {
                arr.push(v1[d] + ((v2[d] || v1[d]) - v1[d]) * t);
            }
            return arr;
        }

        return v1; // Fallback
    }

    // Refresco de UI Suave
    function forceUIRefresh() {
        var seq = app.project.activeSequence;
        if (seq) {
            var p = seq.getPlayerPosition();
            if (p && p.ticks) {
                var ticksString = p.ticks.toString();
                var nudgeAmount = 2540160000;
                try {
                    var tNum = Number(ticksString);
                    seq.setPlayerPosition((tNum + nudgeAmount).toString());
                    seq.setPlayerPosition(ticksString);
                } catch (e) { }
            }
        }
    }

    _GRAPHEDITOR.applyInfluence = function (outVal, inVal, vOut, vIn, mode, filters) {
        var seq = app.project.activeSequence;
        if (!seq) return "Error";
        var selection = seq.getSelection();
        if (!selection || selection.length === 0) return "Selecciona clips";

        var seqPlayerTime = seq.getPlayerPosition().seconds;
        var oInfl = parseFloat(outVal) / 100;
        var iInfl = parseFloat(inVal) / 100;
        var filterArr = filters ? filters.split(',') : [];

        for (var i = 0; i < selection.length; i++) {
            var clip = selection[i];
            var clipLocalTime = (seqPlayerTime - clip.start.seconds) + clip.inPoint.seconds;
            if (clip.components) {
                processComponents(clip.components, oInfl, iInfl, vOut, vIn, mode, filterArr, false, false, 0, clipLocalTime);
            }
        }
        forceUIRefresh();
        return "Aplicado";
    };

    _GRAPHEDITOR.cleanCurve = function (filters) {
        var seq = app.project.activeSequence;
        if (!seq) return "Error";
        var selection = seq.getSelection();
        var filterArr = filters ? filters.split(',') : [];
        var seqPlayerTime = seq.getPlayerPosition().seconds;

        for (var i = 0; i < selection.length; i++) {
            var clip = selection[i];
            var clipLocalTime = (seqPlayerTime - clip.start.seconds) + clip.inPoint.seconds;
            if (clip.components) {
                processComponents(clip.components, 0, 0, 0, 0, '', filterArr, true, false, 0, clipLocalTime);
            }
        }
        forceUIRefresh();
        return "Reseteado";
    };

    _GRAPHEDITOR.setKeyframeType = function (type, filters) {
        var seq = app.project.activeSequence; if (!seq) return "Error";
        var selection = seq.getSelection(); if (!selection || selection.length === 0) return "Error";

        var interp = (type === 'bezier') ? 5 : (type === 'hold' ? 4 : 0);
        var filterArr = filters ? filters.split(',') : [];
        for (var i = 0; i < selection.length; i++) {
            if (selection[i].components) processComponents(selection[i].components, 0, 0, 0, 0, '', filterArr, false, true, interp);
        }
        forceUIRefresh();
        return type.toUpperCase();
    };

    function processComponents(components, oInfl, iInfl, vOut, vIn, mode, filters, isClean, isInterp, interpVal, playerTime) {
        if (!components) return;
        for (var c = 0; c < components.numItems; c++) {
            var comp = components[c];
            if (comp.properties) {
                for (var p = 0; p < comp.properties.numItems; p++) {
                    recursiveApply(comp.properties[p], oInfl, iInfl, vOut, vIn, mode, filters, isClean, isInterp, interpVal, playerTime);
                }
            }
        }
    }

    function recursiveApply(prop, oInfl, iInfl, vOut, vIn, mode, filters, isClean, isInterp, interpVal, playerTime) {
        if (!prop) return;

        // Recursión para grupos (Ej. Máscaras)
        try {
            if (prop.numItems > 0) {
                for (var j = 0; j < prop.numItems; j++) {
                    recursiveApply(prop[j], oInfl, iInfl, vOut, vIn, mode, filters, isClean, isInterp, interpVal, playerTime);
                }
            }
        } catch (e) { }

        if (prop.areKeyframesSupported && prop.areKeyframesSupported()) {
            if (filters && filters.length > 0) {
                var name = (prop.displayName || prop.matchName || "").toLowerCase();
                var isTarget = false;
                for (var f = 0; f < filters.length; f++) {
                    var fName = filters[f].toLowerCase();
                    if (name === fName) { isTarget = true; break; }
                }
                if (!isTarget) return;
            }
            if (isClean) performSegmentClean(prop, playerTime);
            else if (isInterp) try { setPropInterpolation(prop, interpVal); } catch (e) { }
            else applyBakingLogic(prop, oInfl, iInfl, vOut, vIn, mode, playerTime);
        }
    }

    _GRAPHEDITOR.scanActiveProperties = function () {
        var seq = app.project.activeSequence; if (!seq) return "";
        var selection = seq.getSelection(); if (!selection || selection.length === 0) return "";
        var found = {};
        for (var i = 0; i < selection.length; i++) {
            var clip = selection[i];
            if (clip.components) {
                for (var c = 0; c < clip.components.numItems; c++) {
                    var comp = clip.components[c];
                    if (comp.properties) {
                        for (var p = 0; p < comp.properties.numItems; p++) {
                            recursiveCheck(comp.properties[p], found);
                        }
                    }
                }
            }
        }
        var res = []; for (var key in found) res.push(key);
        return res.join(',');
    };

    function recursiveCheck(param, found) {
        if (!param) return;
        try { if (param.numItems > 0) { for (var i = 0; i < param.numItems; i++) recursiveCheck(param[i], found); } } catch (e) { }
        try {
            if (param.isTimeVarying && param.isTimeVarying()) {
                var keys = param.getKeys();
                if (keys && keys.length > 1) {
                    found[param.displayName || param.matchName || "Unknown"] = true;
                }
            }
        } catch (e) { }
    }

    function setPropInterpolation(prop, type) {
        var keys = prop.getKeys();
        if (!keys) return;
        for (var k = 0; k < keys.length; k++) {
            try {
                var t = (typeof keys[k] === 'object') ? keys[k].seconds : keys[k];
                prop.setInterpolationTypeAtKey(t, type, true);
            } catch (e) { }
        }
    }

    function getSegmentKeys(prop, playerTime) {
        var keys = prop.getKeys();
        if (!keys || keys.length < 2) return null;

        var L = -1, R = -1;
        // Buscamos el par de llaves que rodean el tiempo actual con un margen pequeño
        for (var i = 0; i < keys.length; i++) {
            var t = (typeof keys[i] === 'object') ? keys[i].seconds : keys[i];
            if (t <= playerTime + 0.01) { L = i; }
            if (t > playerTime - 0.01 && R === -1 && i > L) { R = i; break; }
        }

        // Si estamos al final o al principio extremo, cogemos el segmento adyacente
        if (L !== -1 && R === -1 && L > 0) { R = L; L = L - 1; }
        if (L === -1 && R !== -1 && R < keys.length - 1) { L = R; R = R + 1; }

        if (L === -1 || R === -1) return null;

        var finalL = L, finalR = R;
        var BAKE_THRESHOLD = 0.15;

        // PROTECCIÓN DE ANCHORS (Lógica Smoothify Original)
        // Se expande solo si detecta una ráfaga de puntos con ritmo constante (baking)
        while (finalL > 0) {
            var d1 = (typeof keys[finalL] === 'object' ? keys[finalL].seconds : keys[finalL]) -
                (typeof keys[finalL - 1] === 'object' ? keys[finalL - 1].seconds : keys[finalL - 1]);
            // Si el intervalo es grande o cambia, el punto finalL es un Anchor. Paramos.
            if (d1 > BAKE_THRESHOLD) break;
            if (finalL < keys.length - 1) {
                var d2 = (typeof keys[finalL + 1] === 'object' ? keys[finalL + 1].seconds : keys[finalL + 1]) -
                    (typeof keys[finalL] === 'object' ? keys[finalL].seconds : keys[finalL]);
                if (Math.abs(d1 - d2) > 0.001) break;
            }
            finalL--;
        }

        while (finalR < keys.length - 1) {
            var d1 = (typeof keys[finalR + 1] === 'object' ? keys[finalR + 1].seconds : keys[finalR + 1]) -
                (typeof keys[finalR] === 'object' ? keys[finalR].seconds : keys[finalR]);
            if (d1 > BAKE_THRESHOLD) break;
            var d2 = (typeof keys[finalR] === 'object' ? keys[finalR].seconds : keys[finalR]) -
                (typeof keys[finalR - 1] === 'object' ? keys[finalR - 1].seconds : keys[finalR - 1]);
            if (Math.abs(d1 - d2) > 0.001) break;
            finalR++;
        }

        return {
            startTime: (typeof keys[finalL] === 'object') ? keys[finalL].seconds : keys[finalL],
            endTime: (typeof keys[finalR] === 'object') ? keys[finalR].seconds : keys[finalR]
        };
    }

    function performSegmentClean(prop, playerTime) {
        var seg = getSegmentKeys(prop, playerTime);
        if (!seg) return;

        var keys = prop.getKeys();
        // Borramos SOLO lo que está estrictamente entre los anchors detectados
        for (var k = keys.length - 1; k >= 0; k--) {
            var t = (typeof keys[k] === 'object') ? keys[k].seconds : keys[k];
            if (t > seg.startTime + 0.002 && t < seg.endTime - 0.002) {
                try { prop.removeKey(t); } catch (e) { }
            }
        }

        try {
            // Ponemos en Lineal solo los anchors del tramo afectado
            prop.setInterpolationTypeAtKey(seg.startTime, 0, true);
            prop.setInterpolationTypeAtKey(seg.endTime, 0, true);

            // Truco de refresco visual
            var v = prop.getValueAtKey(seg.startTime);
            if (typeof v === 'number') {
                prop.setValueAtKey(seg.startTime, v + 0.000001, true);
                prop.setValueAtKey(seg.startTime, v, true);
            }
        } catch (e) { }
    }

    function applyBakingLogic(prop, oInfl, iInfl, vOut, vIn, mode, playerTime) {
        var seg = getSegmentKeys(prop, playerTime);
        if (!seg) return;

        var startTime = seg.startTime;
        var endTime = seg.endTime;
        var startVal = prop.getValueAtKey(startTime);
        var endVal = prop.getValueAtKey(endTime);

        performSegmentClean(prop, playerTime);

        var p1y = (mode === 'value') ? parseFloat(vOut) : 0;
        var p2y = (mode === 'value') ? parseFloat(vIn) + 1 : 1;

        for (var s = 1; s < BAKING_STEPS; s++) {
            var x = s / BAKING_STEPS;
            var t = solveBezierT(x, oInfl, 1 - iInfl);
            var ratio = getBezierPoint(t, 0, p1y, p2y, 1);
            var timePos = startTime + (x * (endTime - startTime));
            var newVal = interpolateValue(startVal, endVal, ratio);
            try {
                prop.addKey(timePos);
                prop.setValueAtKey(timePos, newVal, true);
            } catch (e) { }
        }

        try {
            prop.setInterpolationTypeAtKey(startTime, 5, 2);
            prop.setInterpolationTypeAtKey(endTime, 5, 1);
        } catch (e) { }
    }
})();
