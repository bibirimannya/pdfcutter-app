// PDF並び替え機能（修正版）
class PDFReorder {
    constructor(processor) {
        this.processor = processor;
        this.currentPdfFile = null;
        this.pages = [];
        this.originalOrder = [];
        this.currentOrder = [];
        this.isModified = false;
        
        // DOM要素
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.selectFilesBtn = document.getElementById('selectFilesBtn');
        this.selectedFileSection = document.getElementById('selectedFileSection');
        this.selectedFile = document.getElementById('selectedFile');
        this.previewSection = document.getElementById('previewSection');
        this.sortableGrid = document.getElementById('sortableGrid');
        this.clearBtn = document.getElementById('clearBtn');
        this.resetOrderBtn = document.getElementById('resetOrderBtn');
        this.reverseOrderBtn = document.getElementById('reverseOrderBtn');
        this.reorderBtn = document.getElementById('reorderBtn');
        this.resultSection = document.getElementById('resultSection');
        this.resultContent = document.getElementById('resultContent');
        this.totalPagesSpan = document.getElementById('totalPages');
        this.orderStatusSpan = document.getElementById('orderStatus');
        this.modifiedPagesSpan = document.getElementById('modifiedPages');
        
        console.log('PDFReorder constructor called, DOM elements found:', {
            dropZone: !!this.dropZone,
            fileInput: !!this.fileInput,
            selectFilesBtn: !!this.selectFilesBtn
        });
        
        this.initEventListeners();
        this.initSortable();
    }

    handleFileSelection(file) {
        console.log('handleFileSelection called with file:', file?.name);
        
        if (!file || file.type !== 'application/pdf') {
            alert('PDFファイルを選択してください。');
            return;
        }
        
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (file.size > maxSize) {
            alert('ファイルサイズが大きすぎます。100MB以下のファイルを選択してください。');
            return;
        }
        
        this.currentPdfFile = file;
        this.displaySelectedFile(file);
        
        if (this.selectedFileSection) {
            this.selectedFileSection.style.display = 'block';
        }
        
        this.loadPdfInfo(file);
    }

    initEventListeners() {
        console.log('Initializing event listeners');
        
        if (!this.dropZone || !this.fileInput || !this.selectFilesBtn) {
            console.error('Required DOM elements not found');
            return;
        }

        // ファイル選択ボタンのイベント
        this.selectFilesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('Select files button clicked');
            this.fileInput.click();
        });

        // ドロップゾーンのイベント（ボタンクリックは除外）
        this.dropZone.addEventListener('click', (e) => {
            if (e.target === this.selectFilesBtn || 
                e.target.closest('.select-files-btn') || 
                this.selectFilesBtn.contains(e.target)) {
                return; // ボタンのクリックは処理しない
            }
            console.log('Drop zone clicked');
            this.fileInput.click();
        });

        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('dragover');
        });

        this.dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('dragover');
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('dragover');
            
            const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf');
            console.log('Files dropped:', files.length);
            
            if (files.length === 1) {
                this.handleFileSelection(files[0]);
            } else if (files.length > 1) {
                alert('並び替え機能では1つのPDFファイルのみ選択できます。');
            } else {
                alert('PDFファイルを選択してください。');
            }
        });

        // ファイルインプットのイベント
        this.fileInput.addEventListener('change', (e) => {
            console.log('File input changed, files:', e.target.files.length);
            if (this.fileInput.files.length > 0) {
                this.handleFileSelection(this.fileInput.files[0]);
            }
        });

        // ボタンのイベント設定
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Clear button clicked');
                this.clearFile();
            });
        }

        if (this.resetOrderBtn) {
            this.resetOrderBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Reset order button clicked');
                this.resetOrder();
            });
        }

        if (this.reverseOrderBtn) {
            this.reverseOrderBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Reverse order button clicked');
                this.reverseOrder();
            });
        }

        if (this.reorderBtn) {
            this.reorderBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Reorder button clicked');
                this.executeReorder();
            });
        }
    }

    displaySelectedFile(file) {
        if (this.selectedFile) {
            this.selectedFile.innerHTML = `
                <div class="file-item">
                    <div class="file-info">
                        <i class="fas fa-file-pdf file-icon"></i>
                        <div class="file-details">
                            <h4>${file.name}</h4>
                            <p>${this.processor.formatFileSize(file.size)}</p>
                        </div>
                    </div>
                    <div class="file-actions">
                        <button type="button" class="remove-file-btn" onclick="window.pdfReorder.clearFile()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        }
    }

    // PDF.jsを使用せず、サーバーからPDF情報を取得
    async loadPdfInfo(file) {
        try {
            console.log('Loading PDF info for:', file.name);
            this.processor.showLoading();

            // FormDataを作成してサーバーに送信
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/get_pdf_info', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.initializePages(data.total_pages);
                this.renderPageGrid();
                
                if (this.previewSection) {
                    this.previewSection.style.display = 'block';
                }
            } else {
                throw new Error(data.error || 'PDFの読み込みに失敗しました');
            }

            this.processor.hideLoading();

        } catch (error) {
            console.error('PDF loading error:', error);
            this.processor.hideLoading();
            this.processor.showError(this.resultContent, 'PDFファイルの読み込みに失敗しました: ' + error.message);
            if (this.resultSection) this.resultSection.style.display = 'block';
        }
    }

    initializePages(pageCount) {
        console.log('Initializing pages, count:', pageCount);
        
        this.pages = [];
        this.originalOrder = [];
        this.currentOrder = [];

        for (let i = 0; i < pageCount; i++) {
            this.pages.push({
                pageNum: i + 1,
                originalIndex: i,
                currentIndex: i
            });
            this.originalOrder.push(i);
            this.currentOrder.push(i);
        }

        this.isModified = false;
        this.updatePageInfo();
    }

    renderPageGrid() {
        console.log('Rendering page grid');
        if (!this.sortableGrid) return;

        let html = '';
        this.currentOrder.forEach((originalIndex, currentIndex) => {
            const pageNum = originalIndex + 1;
            html += `
                <div class="page-item" data-original-index="${originalIndex}" data-current-index="${currentIndex}" draggable="true">
                    <div class="page-preview">
                        <div class="page-thumbnail">
                            <i class="fas fa-file-pdf"></i>
                            <div class="page-number-badge">${pageNum}</div>
                        </div>
                        <div class="page-info">
                            <div class="current-position">現在の位置: ${currentIndex + 1}</div>
                            <div class="original-position">元の位置: ${pageNum}</div>
                        </div>
                    </div>
                    <div class="drag-handle">
                        <i class="fas fa-grip-vertical"></i>
                    </div>
                </div>
            `;
        });

        this.sortableGrid.innerHTML = html;
    }

    initSortable() {
        if (!this.sortableGrid) {
            console.error('Sortable grid not found');
            return;
        }

        console.log('Initializing sortable');
        let draggedElement = null;
        let draggedIndex = null;

        this.sortableGrid.addEventListener('dragstart', (e) => {
            const pageItem = e.target.closest('.page-item');
            if (pageItem) {
                console.log('Drag start');
                draggedElement = pageItem;
                draggedIndex = parseInt(pageItem.dataset.currentIndex);
                pageItem.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
            }
        });

        this.sortableGrid.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        this.sortableGrid.addEventListener('drop', (e) => {
            e.preventDefault();
            
            const targetPageItem = e.target.closest('.page-item');
            if (targetPageItem && draggedElement && draggedElement !== targetPageItem) {
                const targetIndex = parseInt(targetPageItem.dataset.currentIndex);
                
                console.log('Drop - moving from', draggedIndex, 'to', targetIndex);
                
                if (!isNaN(draggedIndex) && !isNaN(targetIndex)) {
                    this.moveArrayElement(this.currentOrder, draggedIndex, targetIndex);
                    this.renderPageGrid();
                    this.updatePageInfo();
                    this.checkModification();
                }
            }
        });

        this.sortableGrid.addEventListener('dragend', (e) => {
            if (draggedElement) {
                console.log('Drag end');
                draggedElement.style.opacity = '1';
                draggedElement = null;
                draggedIndex = null;
            }
        });
    }

    moveArrayElement(arr, fromIndex, toIndex) {
        if (fromIndex >= 0 && fromIndex < arr.length && toIndex >= 0 && toIndex < arr.length) {
            const element = arr.splice(fromIndex, 1)[0];
            arr.splice(toIndex, 0, element);
        }
    }

    resetOrder() {
        console.log('Resetting order');
        this.currentOrder = [...this.originalOrder];
        this.renderPageGrid();
        this.updatePageInfo();
        this.checkModification();
    }

    reverseOrder() {
        console.log('Reversing order');
        this.currentOrder.reverse();
        this.renderPageGrid();
        this.updatePageInfo();
        this.checkModification();
    }

    checkModification() {
        this.isModified = !this.arraysEqual(this.currentOrder, this.originalOrder);
        
        console.log('Check modification:', this.isModified);
        
        if (this.reorderBtn) {
            this.reorderBtn.disabled = !this.isModified;
        }
    }

    arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    updatePageInfo() {
        if (this.totalPagesSpan) {
            this.totalPagesSpan.textContent = this.pages.length;
        }

        if (this.orderStatusSpan) {
            if (this.isModified) {
                this.orderStatusSpan.textContent = '変更済み';
                this.orderStatusSpan.style.color = '#e74c3c';
            } else {
                this.orderStatusSpan.textContent = '元の順序';
                this.orderStatusSpan.style.color = '#27ae60';
            }
        }

        if (this.modifiedPagesSpan) {
            let modifiedCount = 0;
            this.currentOrder.forEach((originalIndex, currentIndex) => {
                if (originalIndex !== currentIndex) {
                    modifiedCount++;
                }
            });
            this.modifiedPagesSpan.textContent = modifiedCount;
        }
    }

    async executeReorder() {
        console.log('Executing reorder');
        
        if (!this.currentPdfFile || !this.isModified) {
            console.log('No file or no modifications');
            return;
        }
        
        if (this.reorderBtn) {
            this.reorderBtn.disabled = true;
            this.reorderBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 処理中...';
        }
        
        const formData = new FormData();
        formData.append('file', this.currentPdfFile);
        
        // ページ順序を1ベースに変換
        const newOrder = this.currentOrder.map(originalIndex => originalIndex + 1);
        formData.append('page_order', JSON.stringify(newOrder));

        console.log('Sending reorder request with order:', newOrder);
        
        this.processor.showLoading();

        try {
            const response = await fetch('/reorder', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                let errorMessage = `HTTP error! status: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    errorMessage = `${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('Reorder response:', data);
            
            this.processor.hideLoading();
            
            if (data.success) {
                this.displayReorderResult(data);
            } else {
                this.processor.showError(this.resultContent, data.error || '並び替えに失敗しました。');
            }
            
            if (this.resultSection) this.resultSection.style.display = 'block';
            
        } catch (error) {
            console.error('Fetch error:', error);
            this.processor.hideLoading();
            
            let errorMessage = '処理中にエラーが発生しました。';
            if (error.message.includes('405')) {
                errorMessage = 'サーバーがこの機能をサポートしていません。';
            } else if (error.message.includes('404')) {
                errorMessage = 'サービスが見つかりません。';
            } else {
                errorMessage += ' ' + error.message;
            }
            
            this.processor.showError(this.resultContent, errorMessage);
            if (this.resultSection) this.resultSection.style.display = 'block';
        } finally {
            if (this.reorderBtn) {
                this.reorderBtn.disabled = false;
                this.reorderBtn.innerHTML = '<i class="fas fa-sort"></i> 並び替えを実行してダウンロード';
            }
        }
    }

    displayReorderResult(data) {
        if (this.resultContent) {
            this.resultContent.innerHTML = `
                <div class="result-success">
                    <i class="fas fa-check-circle"></i>
                    <h3>並び替え完了</h3>
                    <p>${this.pages.length}ページのPDFの順序を変更しました</p>
                    <div class="reorder-summary">
                        <p>変更されたページ: ${this.modifiedPagesSpan ? this.modifiedPagesSpan.textContent : 0}ページ</p>
                    </div>
                    <div class="download-actions">
                        <a href="${data.download_url}" class="download-btn" id="downloadLink" target="_blank" rel="noopener noreferrer">
                            <i class="fas fa-download"></i>
                            並び替え済みPDFをダウンロード
                        </a>
                    </div>
                </div>
            `;

            const downloadLink = document.getElementById('downloadLink');
            if (downloadLink) {
                downloadLink.addEventListener('click', () => {
                    console.log('Download initiated');
                });
            }
        }
    }

    clearFile() {
        console.log('Clearing file');
        
        this.currentPdfFile = null;
        this.pages = [];
        this.originalOrder = [];
        this.currentOrder = [];
        this.isModified = false;
        
        if (this.fileInput) {
            this.fileInput.value = '';
        }
        
        if (this.selectedFileSection) this.selectedFileSection.style.display = 'none';
        if (this.previewSection) this.previewSection.style.display = 'none';
        if (this.resultSection) this.resultSection.style.display = 'none';
        
        if (this.reorderBtn) {
            this.reorderBtn.disabled = true;
        }
    }
}

// 初期化管理クラス（簡素化版）
class ReorderInitializer {
    constructor() {
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) {
            return Promise.resolve();
        }

        try {
            console.log('Starting initialization');

            if (!this.checkRequiredElements()) {
                throw new Error('Required DOM elements not found');
            }

            await this.waitForPdfProcessor();

            console.log('Creating PDFReorder instance');
            window.pdfReorder = new PDFReorder(window.pdfProcessor);
            this.initialized = true;
            
            console.log('PDFReorder initialization complete');

        } catch (error) {
            console.error('Initialization failed:', error);
            this.showInitializationError(error);
            throw error;
        }
    }

    checkRequiredElements() {
        const requiredElements = ['dropZone', 'fileInput', 'selectFilesBtn'];
        return requiredElements.every(id => {
            const element = document.getElementById(id);
            if (!element) {
                console.error(`Required element not found: ${id}`);
                return false;
            }
            return true;
        });
    }

    waitForPdfProcessor(maxWait = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkProcessor = () => {
                if (window.pdfProcessor) {
                    console.log('pdfProcessor found');
                    resolve();
                    return;
                }

                if (Date.now() - startTime > maxWait) {
                    reject(new Error('pdfProcessor not found within timeout'));
                    return;
                }

                setTimeout(checkProcessor, 100);
            };

            checkProcessor();
        });
    }

    showInitializationError(error) {
        const dropZone = document.getElementById('dropZone');
        if (dropZone) {
            dropZone.innerHTML = `
                <div class="drop-content error">
                    <i class="fas fa-exclamation-triangle" style="color: #e74c3c; font-size: 2em; margin-bottom: 1em;"></i>
                    <h3>初期化エラー</h3>
                    <p>並び替え機能の初期化に失敗しました。</p>
                    <p style="font-size: 0.9em; color: #666;">${error.message}</p>
                    <button onclick="location.reload()" class="select-files-btn" style="margin-top: 1em;">
                        <i class="fas fa-refresh"></i>
                        ページを再読み込み
                    </button>
                </div>
            `;
        }
    }
}

// 初期化実行
function initializeReorder() {
    console.log('initializeReorder called');
    const initializer = new ReorderInitializer();
    initializer.initialize().catch(error => {
        console.error('Failed to initialize reorder functionality:', error);
    });
}

// DOMContentLoaded時の初期化
document.addEventListener('DOMContentLoaded', initializeReorder);

// 既にDOMが読み込まれている場合の対応
if (document.readyState !== 'loading') {
    setTimeout(initializeReorder, 0);
}

// デバッグ用
window.debugReorder = function() {
    console.log('=== Debug Info ===');
    console.log('pdfProcessor:', window.pdfProcessor);
    console.log('pdfReorder:', window.pdfReorder);
    console.log('Current state:', window.pdfReorder ? {
        currentPdfFile: window.pdfReorder.currentPdfFile?.name,
        pages: window.pdfReorder.pages.length,
        isModified: window.pdfReorder.isModified
    } : 'not initialized');
};

console.log('reorder.js loaded');