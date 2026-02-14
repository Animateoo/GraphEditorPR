/*
    GraphEditor Host Script - Premiere Pro Version (Fidelity Master - FINAL STABLE)
    --------------------------------------------------------------------------
    ESTADO DE SEGURIDAD: Paso 582 - ¡BORRADO FULMINANTE ESTILO 1:00 PM!
    -------------------------------------------------------------------------
*/

var _GRAPHEDITOR = {};

(function () {
    'use strict';

    var BAKING_STEPS = 15;

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

    // Refresco de UI Suave (Solo movimiento de cabezal, sin reset de panel)
    function forceUIRefresh() {
        var seq = app.project.activeSequence;
        if (seq) {
            var p = seq.getPlayerPosition();
            if (p && p.ticks) {
                var ticksString = p.ticks.toString();
                // 1 frame aprox para que sea casi imperceptible
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
        if (!selection || selection.length === 0) return "Error";

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
        if (prop.numItems > 0) {
            for (var j = 0; j < prop.numItems; j++) try { recursiveApply(prop[j], oInfl, iInfl, vOut, vIn, mode, filters, isClean, isInterp, interpVal, playerTime); } catch (e) { }
        }
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
            if (isClean) performCleanAction(prop, playerTime);
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
        try { if (param.isTimeVarying && param.isTimeVarying()) { var keys = param.getKeys(); if (keys && keys.length > 0) { found[param.displayName || param.matchName || "Unknown"] = true; } } } catch (e) { }
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
        for (var i = 0; i < keys.length; i++) {
            var t = (typeof keys[i] === 'object') ? keys[i].seconds : keys[i];
            if (t <= playerTime + 0.005) { L = i; } else { R = i; break; }
        }
        if (L === -1 || R === -1) return null;

        var tL = (typeof keys[L] === 'object') ? keys[L].seconds : keys[L];
        var tR = (typeof keys[R] === 'object') ? keys[R].seconds : keys[R];

        var BAKE_THRESHOLD = 0.15;
        if (tR - tL > BAKE_THRESHOLD) return { startTime: tL, endTime: tR };

        var tempL = L, tempR = R;
        while (tempL > 0) {
            var cur = (typeof keys[tempL] === 'object') ? keys[tempL].seconds : keys[tempL];
            var prv = (typeof keys[tempL - 1] === 'object') ? keys[tempL - 1].seconds : keys[tempL - 1];
            if (cur - prv < BAKE_THRESHOLD) tempL--; else break;
        }
        while (tempR < keys.length - 1) {
            var cur = (typeof keys[tempR] === 'object') ? keys[tempR].seconds : keys[tempR];
            var nxt = (typeof keys[tempR + 1] === 'object') ? keys[tempR + 1].seconds : keys[tempR + 1];
            if (nxt - cur < BAKE_THRESHOLD) tempR++; else break;
        }

        return {
            startTime: (typeof keys[tempL] === 'object') ? keys[tempL].seconds : keys[tempL],
            endTime: (typeof keys[tempR] === 'object') ? keys[tempR].seconds : keys[tempR]
        };
    }

    function performCleanAction(prop, playerTime) {
        var seg = getSegmentKeys(prop, playerTime);
        if (!seg) return;

        var keys = prop.getKeys();
        var foundAny = false;
        for (var k = keys.length - 1; k >= 0; k--) {
            var t = (typeof keys[k] === 'object') ? keys[k].seconds : keys[k];
            if (t > seg.startTime + 0.001 && t < seg.endTime - 0.001) {
                try {
                    prop.removeKey(t);
                    foundAny = true;
                } catch (e) { }
            }
        }

        try {
            // Ponemos lineal explícitamente y con el flag de refresco en TRUE
            prop.setInterpolationTypeAtKey(seg.startTime, 0, true);
            prop.setInterpolationTypeAtKey(seg.endTime, 0, true);

            // TRUCO: Nudge de valor para forzar el recalculado de la curva visual
            var v = prop.getValueAtKey(seg.startTime);
            if (typeof v === 'number') {
                prop.setValueAtKey(seg.startTime, v + 0.00001, true);
                prop.setValueAtKey(seg.startTime, v, true);
            }
            prop.getValueAtKey(playerTime);
        } catch (e) { }

        forceUIRefresh();
    }

    function applyBakingLogic(prop, oInfl, iInfl, vOut, vIn, mode, playerTime) {
        var seg = getSegmentKeys(prop, playerTime);
        if (!seg) return;

        var startTime = seg.startTime;
        var endTime = seg.endTime;
        var startVal = prop.getValueAtKey(startTime);
        var endVal = prop.getValueAtKey(endTime);

        performCleanAction(prop, playerTime);

        var p1y = (mode === 'value') ? parseFloat(vOut) : 0;
        var p2y = (mode === 'value') ? parseFloat(vIn) + 1 : 1;

        for (var s = 1; s < BAKING_STEPS; s++) {
            var x = s / BAKING_STEPS;
            var t = solveBezierT(x, oInfl, 1 - iInfl);
            var ratio = getBezierPoint(t, 0, p1y, p2y, 1);
            var timePos = startTime + (x * (endTime - startTime));

            var newVal;
            if (startVal !== null && typeof startVal === 'object') {
                if (startVal.hasOwnProperty('x')) {
                    newVal = { x: startVal.x + (endVal.x - startVal.x) * ratio, y: startVal.y + (endVal.y - startVal.y) * ratio };
                } else if (startVal.length !== undefined) {
                    newVal = [];
                    for (var d = 0; d < startVal.length; d++) newVal.push(startVal[d] + (endVal[d] - startVal[d]) * ratio);
                } else { newVal = startVal; }
            } else {
                newVal = startVal + (endVal - startVal) * ratio;
            }
            prop.addKey(timePos);
            prop.setValueAtKey(timePos, newVal, true);
        }

        try {
            prop.setInterpolationTypeAtKey(startTime, 5, 2);
            prop.setInterpolationTypeAtKey(endTime, 5, 1);
            prop.getValueAtKey(startTime);
        } catch (e) { }
    }
})();
