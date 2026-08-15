/**
 * Pixly - Simple Image Editor
 * CS50x Final Project
 */

'use strict';

class ImageEditor {
    #canvas;
    #ctx;
    #elements;
    #history = [];
    #historyIndex = -1;
    #currentImage = null;
    #currentBlobUrl = null;
    #currentFileName = 'image.png';
    #currentFileType = 'image/png';
    #renderScheduled = false;
    #isApplyingHistory = false;
    #maxHistory = 20;

    #filters = {
        blur: 0,
        brightness: 100,
        contrast: 100,
        grayscale: false,
        sepia: false
    };

    #cropState = {
        active: false,
        rect: { x: 0, y: 0, w: 0, h: 0 },
        isDragging: false
    };

    constructor() {
        this.#initElements();
        this.#bindEvents();
    }

    #initElements() {
        const get = id => document.getElementById(id);
        this.#canvas = get('editor-canvas');
        this.#ctx = this.#canvas.getContext('2d');

        this.#elements = {
            fileInput: get('image-upload'),
            btnOpen: get('btn-open'),
            btnOpenEmpty: get('btn-open-empty'),
            btnExport: get('btn-export'),
            emptyState: get('empty-state'),
            workspace: get('workspace'),
            dropOverlay: get('drop-overlay'),
            statusDimensions: get('status-dimensions'),
            statusFiletype: get('status-filetype'),
            toolButtons: document.querySelectorAll('.tool-btn, #btn-export, input[type="range"]'),
            btnCrop: get('btn-crop'),
            cropControls: get('crop-controls'),
            btnCropApply: get('btn-crop-apply'),
            btnCropCancel: get('btn-crop-cancel'),
            btnRotateLeft: get('btn-rotate-left'),
            btnRotateRight: get('btn-rotate-right'),
            btnFlipH: get('btn-flip-h'),
            btnFlipV: get('btn-flip-v'),
            btnResize: get('btn-resize'),
            resizeControls: get('resize-controls'),
            inputResizeW: get('resize-w'),
            inputResizeH: get('resize-h'),
            checkResizeLock: get('resize-lock'),
            btnResizeApply: get('btn-resize-apply'),
            btnResizeCancel: get('btn-resize-cancel'),
            sliderBlur: get('slider-blur'),
            blurVal: get('blur-val'),
            sliderBrightness: get('slider-brightness'),
            brightnessVal: get('brightness-val'),
            sliderContrast: get('slider-contrast'),
            contrastVal: get('contrast-val'),
            btnGrayscale: get('btn-grayscale'),
            btnSepia: get('btn-sepia'),
            btnUndo: get('btn-undo'),
            btnRedo: get('btn-redo'),
            btnReset: get('btn-reset')
        };
    }

    #bindEvents() {
        const elements = this.#elements;
        
        elements.btnOpen.addEventListener('click', () => elements.fileInput.click());
        elements.btnOpenEmpty.addEventListener('click', () => elements.fileInput.click());
        elements.fileInput.addEventListener('change', e => this.#handleFileSelect(e));
        elements.btnExport.addEventListener('click', () => this.#exportImage());

        // Drag & Drop image onto workspace
        if (elements.workspace) {
            ['dragenter', 'dragover'].forEach(evt => {
                elements.workspace.addEventListener(evt, e => {
                    e.preventDefault();
                    e.stopPropagation();
                    elements.workspace.classList.add('drag-over');
                    if (elements.dropOverlay) elements.dropOverlay.classList.remove('hidden');
                });
            });

            ['dragleave', 'drop'].forEach(evt => {
                elements.workspace.addEventListener(evt, e => {
                    e.preventDefault();
                    e.stopPropagation();
                    elements.workspace.classList.remove('drag-over');
                    if (elements.dropOverlay) elements.dropOverlay.classList.add('hidden');
                });
            });

            elements.workspace.addEventListener('drop', e => {
                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                    this.#handleFileSelect({ target: { files } });
                }
            });
        }

        // Global keyboard shortcuts
        document.addEventListener('keydown', e => {
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
                e.preventDefault();
                elements.fileInput.click();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                if (!elements.btnExport.disabled) this.#exportImage();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    if (!elements.btnRedo.disabled) this.#stepHistory(1);
                } else {
                    if (!elements.btnUndo.disabled) this.#stepHistory(-1);
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                if (!elements.btnRedo.disabled) this.#stepHistory(1);
            } else if (e.key === 'Escape') {
                this.#hideSubgroups();
                this.#scheduleRender();
            }
        });

        elements.btnRotateLeft.addEventListener('click', () => this.#applyTransform('rotL'));
        elements.btnRotateRight.addEventListener('click', () => this.#applyTransform('rotR'));
        elements.btnFlipH.addEventListener('click', () => this.#applyTransform('flipH'));
        elements.btnFlipV.addEventListener('click', () => this.#applyTransform('flipV'));

        elements.btnCrop.addEventListener('click', () => this.#startCrop());
        elements.btnCropCancel.addEventListener('click', () => this.#cancelCrop());
        elements.btnCropApply.addEventListener('click', () => this.#applyCrop());

        this.#canvas.addEventListener('pointerdown', e => this.#onPointerDown(e));
        this.#canvas.addEventListener('pointermove', e => this.#onPointerMove(e));
        this.#canvas.addEventListener('pointerup', e => this.#onPointerUp(e));
        this.#canvas.addEventListener('pointercancel', e => this.#onPointerUp(e));

        elements.btnResize.addEventListener('click', () => this.#openResize());
        elements.btnResizeCancel.addEventListener('click', () => elements.resizeControls.classList.add('hidden'));
        elements.btnResizeApply.addEventListener('click', () => this.#applyResize());

        elements.inputResizeW.addEventListener('input', () => this.#onResizeInput('w'));
        elements.inputResizeH.addEventListener('input', () => this.#onResizeInput('h'));

        elements.sliderBlur.addEventListener('input', e => this.#onFilterChange('blur', +e.target.value, elements.blurVal));
        elements.sliderBlur.addEventListener('change', () => this.#commitState());

        elements.sliderBrightness.addEventListener('input', e => this.#onFilterChange('brightness', +e.target.value, elements.brightnessVal));
        elements.sliderBrightness.addEventListener('change', () => this.#commitState());

        elements.sliderContrast.addEventListener('input', e => this.#onFilterChange('contrast', +e.target.value, elements.contrastVal));
        elements.sliderContrast.addEventListener('change', () => this.#commitState());

        elements.btnGrayscale.addEventListener('click', () => this.#toggleFilter('grayscale', elements.btnGrayscale));
        elements.btnSepia.addEventListener('click', () => this.#toggleFilter('sepia', elements.btnSepia));

        elements.btnUndo.addEventListener('click', () => this.#stepHistory(-1));
        elements.btnRedo.addEventListener('click', () => this.#stepHistory(1));
        elements.btnReset.addEventListener('click', () => this.#resetHistory());
    }

    async #handleFileSelect(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
            alert('Unsupported image format. Please select a PNG, JPEG, or WebP file.');
            return;
        }

        try {
            this.#clearHistory();
            this.#currentFileType = file.type;
            this.#currentFileName = file.name;
            this.#filters = { blur: 0, brightness: 100, contrast: 100, grayscale: false, sepia: false };
            this.#updateSlidersUI();

            const blobUrl = URL.createObjectURL(file);
            await this.#updateCurrentImage(blobUrl);
            this.#enableTools();
        } catch (err) {
            alert('Failed to load selected image.');
        } finally {
            e.target.value = '';
        }
    }

    static #loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image source'));
            img.src = src;
        });
    }

    static #canvasToBlob(canvas, type = 'image/png', quality = 0.92) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas blob generation failed')), type, quality);
        });
    }

    async #updateCurrentImage(src) {
        const img = await ImageEditor.#loadImage(src);
        this.#currentImage = img;

        if (this.#currentBlobUrl && this.#currentBlobUrl !== src && !this.#history.some(h => h.blobUrl === this.#currentBlobUrl)) {
            URL.revokeObjectURL(this.#currentBlobUrl);
        }
        this.#currentBlobUrl = src;

        this.#scheduleRender();

        if (!this.#isApplyingHistory) {
            this.#commitState();
        }
        this.#isApplyingHistory = false;
    }

    #scheduleRender() {
        if (this.#renderScheduled) return;
        this.#renderScheduled = true;
        requestAnimationFrame(() => {
            this.#render();
            this.#renderScheduled = false;
        });
    }

    #getFilterString() {
        const { blur, brightness, contrast, grayscale, sepia } = this.#filters;
        const parts = [];
        if (blur > 0) parts.push(`blur(${blur}px)`);
        if (brightness !== 100) parts.push(`brightness(${brightness}%)`);
        if (contrast !== 100) parts.push(`contrast(${contrast}%)`);
        if (grayscale) parts.push('grayscale(100%)');
        if (sepia) parts.push('sepia(100%)');
        return parts.join(' ') || 'none';
    }

    #render() {
        const img = this.#currentImage;
        if (!img) return;

        this.#canvas.width = img.width;
        this.#canvas.height = img.height;

        this.#ctx.clearRect(0, 0, img.width, img.height);
        this.#ctx.imageSmoothingEnabled = true;
        this.#ctx.imageSmoothingQuality = 'high';

        this.#ctx.filter = this.#getFilterString();
        this.#ctx.drawImage(img, 0, 0);

        if (this.#cropState.active) {
            this.#drawCropOverlay();
        }

        this.#elements.emptyState.classList.add('hidden');
        this.#canvas.classList.remove('hidden');
        this.#updateStatusBar();
    }

    #drawCropOverlay() {
        const { rect } = this.#cropState;
        const { width: w, height: h } = this.#canvas;

        this.#ctx.filter = 'none';
        this.#ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.#ctx.fillRect(0, 0, w, h);

        this.#ctx.save();
        this.#ctx.beginPath();
        this.#ctx.rect(rect.x, rect.y, rect.w, rect.h);
        this.#ctx.clip();

        this.#ctx.filter = this.#getFilterString();
        this.#ctx.drawImage(this.#currentImage, 0, 0);

        this.#ctx.filter = 'none';
        this.#ctx.strokeStyle = '#0078d4';
        this.#ctx.lineWidth = 2;
        this.#ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

        // Draw crop corner handles
        const handleSize = Math.max(8, Math.min(16, Math.min(w, h) * 0.02));
        this.#ctx.fillStyle = '#0078d4';
        const corners = [
            [rect.x, rect.y],
            [rect.x + rect.w, rect.y],
            [rect.x, rect.y + rect.h],
            [rect.x + rect.w, rect.y + rect.h]
        ];
        corners.forEach(([cx, cy]) => {
            this.#ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
        });

        // Draw dimensions badge
        const dimText = `${Math.round(Math.abs(rect.w))} × ${Math.round(Math.abs(rect.h))} px`;
        this.#ctx.font = '12px var(--font-family, sans-serif)';
        const textWidth = this.#ctx.measureText(dimText).width;
        const badgeX = rect.x + rect.w / 2 - textWidth / 2 - 6;
        const badgeY = Math.max(10, rect.y - 24);

        this.#ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        this.#ctx.fillRect(badgeX, badgeY, textWidth + 12, 20);
        this.#ctx.fillStyle = '#ffffff';
        this.#ctx.fillText(dimText, badgeX + 6, badgeY + 14);

        this.#ctx.restore();
    }

    #commitState() {
        if (this.#historyIndex < this.#history.length - 1) {
            const discarded = this.#history.slice(this.#historyIndex + 1);
            discarded.forEach(state => this.#revokeUnusedBlob(state.blobUrl));
            this.#history = this.#history.slice(0, this.#historyIndex + 1);
        }

        this.#history.push({
            blobUrl: this.#currentBlobUrl,
            filters: { ...this.#filters }
        });

        if (this.#history.length > this.#maxHistory) {
            const removed = this.#history.shift();
            this.#revokeUnusedBlob(removed.blobUrl);
        } else {
            this.#historyIndex++;
        }

        this.#updateHistoryUI();
    }

    #revokeUnusedBlob(url) {
        if (url && url !== this.#currentBlobUrl && !this.#history.some(h => h.blobUrl === url)) {
            URL.revokeObjectURL(url);
        }
    }

    #clearHistory() {
        this.#history.forEach(state => {
            if (state.blobUrl !== this.#currentBlobUrl) URL.revokeObjectURL(state.blobUrl);
        });
        if (this.#currentBlobUrl) URL.revokeObjectURL(this.#currentBlobUrl);

        this.#history = [];
        this.#historyIndex = -1;
        this.#currentBlobUrl = null;
    }

    async #stepHistory(direction) {
        const nextIndex = this.#historyIndex + direction;
        if (nextIndex < 0 || nextIndex >= this.#history.length) return;

        this.#hideSubgroups();
        this.#historyIndex = nextIndex;
        const state = this.#history[nextIndex];
        
        this.#filters = { ...state.filters };
        this.#updateSlidersUI();
        this.#isApplyingHistory = true;

        await this.#updateCurrentImage(state.blobUrl);
        this.#updateHistoryUI();
    }

    async #resetHistory() {
        if (this.#history.length > 0) {
            await this.#stepHistory(-this.#historyIndex);
        }
    }

    #updateHistoryUI() {
        const { btnUndo, btnRedo, btnReset } = this.#elements;
        btnUndo.disabled = this.#historyIndex <= 0;
        btnRedo.disabled = this.#historyIndex >= this.#history.length - 1;
        btnReset.disabled = this.#historyIndex <= 0;
    }

    #updateStatusBar() {
        this.#elements.statusDimensions.textContent = `Dimensions: ${this.#canvas.width} × ${this.#canvas.height} px`;
        const friendlyType = this.#currentFileType.split('/')[1]?.toUpperCase() ?? 'IMAGE';
        this.#elements.statusFiletype.textContent = `File: ${this.#currentFileName} (${friendlyType})`;
    }

    #enableTools() {
        this.#elements.toolButtons.forEach(btn => btn.disabled = false);
    }

    #hideSubgroups() {
        this.#cropState.active = false;
        this.#elements.cropControls.classList.add('hidden');
        this.#elements.resizeControls.classList.add('hidden');
    }

    async #applyTransform(action) {
        this.#hideSubgroups();
        const img = this.#currentImage;
        if (!img) return;

        const tempCanvas = document.createElement('canvas');
        const tCtx = tempCanvas.getContext('2d');
        const { width: w, height: h } = img;

        if (action === 'rotL' || action === 'rotR') {
            tempCanvas.width = h;
            tempCanvas.height = w;
            tCtx.translate(h / 2, w / 2);
            tCtx.rotate((action === 'rotR' ? 90 : -90) * Math.PI / 180);
            tCtx.drawImage(img, -w / 2, -h / 2);
        } else {
            tempCanvas.width = w;
            tempCanvas.height = h;
            tCtx.translate(action === 'flipH' ? w : 0, action === 'flipV' ? h : 0);
            tCtx.scale(action === 'flipH' ? -1 : 1, action === 'flipV' ? -1 : 1);
            tCtx.drawImage(img, 0, 0);
        }

        const blob = await ImageEditor.#canvasToBlob(tempCanvas);
        await this.#updateCurrentImage(URL.createObjectURL(blob));
    }

    #startCrop() {
        this.#hideSubgroups();
        const img = this.#currentImage;
        if (!img) return;

        this.#cropState.active = true;
        this.#cropState.rect = {
            x: img.width * 0.25,
            y: img.height * 0.25,
            w: img.width * 0.5,
            h: img.height * 0.5
        };
        this.#elements.cropControls.classList.remove('hidden');
        this.#scheduleRender();
    }

    #cancelCrop() {
        this.#cropState.active = false;
        this.#elements.cropControls.classList.add('hidden');
        this.#scheduleRender();
    }

    async #applyCrop() {
        const { rect } = this.#cropState;
        this.#cropState.active = false;
        this.#elements.cropControls.classList.add('hidden');

        if (rect.w <= 0 || rect.h <= 0) {
            this.#scheduleRender();
            return;
        }

        const tempCanvas = document.createElement('canvas');
        const tCtx = tempCanvas.getContext('2d');
        tempCanvas.width = rect.w;
        tempCanvas.height = rect.h;
        tCtx.drawImage(this.#currentImage, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);

        const blob = await ImageEditor.#canvasToBlob(tempCanvas);
        await this.#updateCurrentImage(URL.createObjectURL(blob));
    }

    #getCanvasPointerPos(e) {
        const rect = this.#canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (this.#canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.#canvas.height / rect.height)
        };
    }

    #onPointerDown(e) {
        if (!this.#cropState.active) return;
        this.#canvas.setPointerCapture(e.pointerId);
        const pos = this.#getCanvasPointerPos(e);
        this.#cropState.isDragging = true;
        this.#cropState.rect = { x: pos.x, y: pos.y, w: 0, h: 0 };
    }

    #onPointerMove(e) {
        if (!this.#cropState.active || !this.#cropState.isDragging) return;
        const pos = this.#getCanvasPointerPos(e);
        const rect = this.#cropState.rect;
        rect.w = pos.x - rect.x;
        rect.h = pos.y - rect.y;
        this.#scheduleRender();
    }

    #onPointerUp(e) {
        if (!this.#cropState.active || !this.#cropState.isDragging) return;
        this.#cropState.isDragging = false;
        try { this.#canvas.releasePointerCapture(e.pointerId); } catch {}

        const rect = this.#cropState.rect;
        if (rect.w < 0) { rect.x += rect.w; rect.w = Math.abs(rect.w); }
        if (rect.h < 0) { rect.y += rect.h; rect.h = Math.abs(rect.h); }

        rect.x = Math.max(0, rect.x);
        rect.y = Math.max(0, rect.y);
        if (rect.x + rect.w > this.#canvas.width) rect.w = this.#canvas.width - rect.x;
        if (rect.y + rect.h > this.#canvas.height) rect.h = this.#canvas.height - rect.y;

        this.#scheduleRender();
    }

    #openResize() {
        this.#hideSubgroups();
        const img = this.#currentImage;
        if (!img) return;

        this.#elements.resizeControls.classList.remove('hidden');
        this.#elements.inputResizeW.value = img.width;
        this.#elements.inputResizeH.value = img.height;
    }

    #onResizeInput(changedAxis) {
        if (!this.#elements.checkResizeLock.checked || !this.#currentImage) return;
        const { width, height } = this.#currentImage;
        if (width <= 0 || height <= 0) return;

        if (changedAxis === 'w') {
            const val = parseInt(this.#elements.inputResizeW.value, 10);
            if (!isNaN(val)) this.#elements.inputResizeH.value = Math.round(val * (height / width));
        } else {
            const val = parseInt(this.#elements.inputResizeH.value, 10);
            if (!isNaN(val)) this.#elements.inputResizeW.value = Math.round(val * (width / height));
        }
    }

    async #applyResize() {
        const w = parseInt(this.#elements.inputResizeW.value, 10);
        const h = parseInt(this.#elements.inputResizeH.value, 10);

        if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
            alert('Please enter valid positive dimensions.');
            return;
        }

        const tempCanvas = document.createElement('canvas');
        const tCtx = tempCanvas.getContext('2d');
        tempCanvas.width = w;
        tempCanvas.height = h;
        tCtx.imageSmoothingEnabled = true;
        tCtx.imageSmoothingQuality = 'high';
        tCtx.drawImage(this.#currentImage, 0, 0, w, h);

        this.#elements.resizeControls.classList.add('hidden');
        const blob = await ImageEditor.#canvasToBlob(tempCanvas);
        await this.#updateCurrentImage(URL.createObjectURL(blob));
    }

    #onFilterChange(name, value, valDisplay) {
        this.#filters[name] = value;
        valDisplay.textContent = value;
        this.#scheduleRender();
    }

    #toggleFilter(name, btnElement) {
        this.#filters[name] = !this.#filters[name];
        btnElement.classList.toggle('active', this.#filters[name]);
        this.#scheduleRender();
        this.#commitState();
    }

    #updateSlidersUI() {
        const { sliderBlur, blurVal, sliderBrightness, brightnessVal, sliderContrast, contrastVal, btnGrayscale, btnSepia } = this.#elements;
        sliderBlur.value = this.#filters.blur;
        blurVal.textContent = this.#filters.blur;

        sliderBrightness.value = this.#filters.brightness;
        brightnessVal.textContent = this.#filters.brightness;

        sliderContrast.value = this.#filters.contrast;
        contrastVal.textContent = this.#filters.contrast;

        btnGrayscale.classList.toggle('active', this.#filters.grayscale);
        btnSepia.classList.toggle('active', this.#filters.sepia);
    }

    async #exportImage() {
        if (!this.#currentImage) return;

        try {
            const exportCanvas = document.createElement('canvas');
            const exportCtx = exportCanvas.getContext('2d');
            exportCanvas.width = this.#currentImage.width;
            exportCanvas.height = this.#currentImage.height;

            exportCtx.imageSmoothingEnabled = true;
            exportCtx.imageSmoothingQuality = 'high';

            // Fill white background for JPEG exports to prevent transparent black backgrounds
            if (this.#currentFileType === 'image/jpeg') {
                exportCtx.fillStyle = '#ffffff';
                exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
            }

            exportCtx.filter = this.#getFilterString();
            exportCtx.drawImage(this.#currentImage, 0, 0);

            const blob = await ImageEditor.#canvasToBlob(exportCanvas, this.#currentFileType, 0.92);
            const downloadUrl = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `edited_${this.#currentFileName}`;
            a.click();

            setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
        } catch (err) {
            alert('Export failed. Please try again.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ImageEditor();
});
