// extract.js - PDFページ抽出機能

class PDFExtractProcessor {
    constructor() {
        this.currentFile = null;
        this.totalPages = 0;
        this.selectedPages = new Set();
        this.isProcessing = false;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    async uploadAndGetInfo(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/get_pdf_info', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('PDF情報の取得に失敗しました');
        }

        return await response.json();
    }

    async extractPages(file, pagesToExtract) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('pages_to_extract', JSON.stringify(pagesToExtract));

        const response = await fetch('/extract-pages', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('ページ抽出に失敗しました');
        }

        return await response.json();
    }
}

class ExtractUI {
    constructor(processor) {
        this.processor = processor;
        this.initElements();
        this.initEventListeners();
    }

    initElements() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.selectFileBtn = document.getElementById('selectFileBtn');
        this.clearFileBtn = document.getElementById('clearFileBtn');
        this.selectedFileSection = document.getElementById('selectedFileSection');
        this.selectedFile = document.getElementById('selectedFile');
        this.previewSection = document.getElementById('previewSection');
        this.pageGrid = document.getElementById('pageGrid');
        this.totalPagesCount = document.getElementById('totalPagesCount');
        this.selectedCount = document.getElementById('selectedCount');
        this.selectAllBtn = document.getElementById('selectAllBtn');
        this.deselectAllBtn = document.getElementById('deselectAllBtn');
        this.extractBtn = document.getElementById('extractBtn');
        this.resultSection = document.getElementById('resultSection');
        this.resultContent = document.getElementById('resultContent');
        this.loading = document.getElementById('loading');
    }

    initEventListeners() {
        if (this.selectFileBtn) {
            this.selectFileBtn.addEventListener('click', () => this.fileInput.click());
        }
        
        if (this.dropZone) {
            this.dropZone.addEventListener('click', (e) => {
                if (!e.target.closest('.select-files-btn')) {
                    this.fileInput.click();
                }
            });

            this.dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                this.dropZone.classList.add('dragover');
            });

            this.dropZone.addEventListener('dragleave', () => {
                this.dropZone.classList.remove('dragover');
            });

            this.dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                this.dropZone.classList.remove('dragover');
                const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
                if (files.length > 0) {
                    this.handleFileSelect(files[0]);
                }
            });
        }

        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileSelect(e.target.files[0]);
                }
            });
        }

        if (this.clearFileBtn) {
            this.clearFileBtn.addEventListener('click', () => this.clearAll());
        }
        
        if (this.selectAllBtn) {
            this.selectAllBtn.addEventListener('click', () => this.selectAll());
        }
        
        if (this.deselectAllBtn) {
            this.deselectAllBtn.addEventListener('click', () => this.deselectAll());
        }
        
        if (this.extractBtn) {
            this.extractBtn.addEventListener('click', () => this.handleExtract());
        }
    }

    async handleFileSelect(file) {
        try {
            this.showLoading();
            this.processor.currentFile = file;

            const result = await this.processor.uploadAndGetInfo(file);

            if (result.success) {
                this.processor.totalPages = result.total_pages;
                this.processor.selectedPages.clear();

                if (this.selectedFile) {
                    this.selectedFile.innerHTML = `
                        <div class="file-info">
                            <i class="fas fa-file-pdf"></i>
                            <div class="file-details">
                                <div class="file-name">${file.name}</div>
                                <div class="file-meta">${this.processor.formatFileSize(file.size)} • ${result.total_pages}ページ</div>
                            </div>
                        </div>
                    `;
                }

                if (this.selectedFileSection) this.selectedFileSection.style.display = 'block';
                if (this.previewSection) this.previewSection.style.display = 'block';
                if (this.resultSection) this.resultSection.style.display = 'none';

                this.renderPages();
                this.updatePageCount();
            } else {
                alert(result.error || 'PDFの読み込みに失敗しました');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('ファイルの処理中にエラーが発生しました');
        } finally {
            this.hideLoading();
        }
    }

    renderPages() {
        if (!this.pageGrid) return;
        
        this.pageGrid.innerHTML = '';
        
        for (let i = 1; i <= this.processor.totalPages; i++) {
            const pageItem = document.createElement('div');
            pageItem.className = 'page-item';
            pageItem.dataset.page = i;

            pageItem.innerHTML = `
                <div class="page-checkbox">
                    <input type="checkbox" id="page${i}" name="pages" value="${i}">
                    <div class="checkbox-custom"></div>
                </div>
                <div class="page-thumbnail">
                    <div class="placeholder">
                        <i class="fas fa-file-pdf"></i>
                    </div>
                </div>
                <div class="page-number">ページ ${i}</div>
                <div class="page-status">選択してください</div>
            `;

            const checkbox = pageItem.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => {
                this.togglePage(i, checkbox.checked);
            });

            pageItem.addEventListener('click', (e) => {
                if (!e.target.closest('.page-checkbox')) {
                    checkbox.checked = !checkbox.checked;
                    this.togglePage(i, checkbox.checked);
                }
            });

            this.pageGrid.appendChild(pageItem);
        }
    }

    togglePage(pageNum, selected) {
        if (!this.pageGrid) return;
        
        const pageItem = this.pageGrid.querySelector(`[data-page="${pageNum}"]`);
        if (!pageItem) return;
        
        const status = pageItem.querySelector('.page-status');

        if (selected) {
            this.processor.selectedPages.add(pageNum);
            pageItem.classList.add('selected');
            if (status) status.textContent = '抽出対象';
        } else {
            this.processor.selectedPages.delete(pageNum);
            pageItem.classList.remove('selected');
            if (status) status.textContent = '選択してください';
        }

        this.updatePageCount();
    }

    selectAll() {
        for (let i = 1; i <= this.processor.totalPages; i++) {
            const checkbox = document.getElementById(`page${i}`);
            if (checkbox && !checkbox.checked) {
                checkbox.checked = true;
                this.togglePage(i, true);
            }
        }
    }

    deselectAll() {
        this.processor.selectedPages.forEach(pageNum => {
            const checkbox = document.getElementById(`page${pageNum}`);
            if (checkbox) {
                checkbox.checked = false;
                this.togglePage(pageNum, false);
            }
        });
    }

    updatePageCount() {
        if (this.totalPagesCount) {
            this.totalPagesCount.textContent = this.processor.totalPages;
        }
        if (this.selectedCount) {
            this.selectedCount.textContent = this.processor.selectedPages.size;
        }
        
        if (this.extractBtn) {
            this.extractBtn.disabled = this.processor.selectedPages.size === 0;
        }
    }

    async handleExtract() {
        if (this.processor.selectedPages.size === 0) {
            alert('抽出するページを選択してください');
            return;
        }

        if (this.processor.isProcessing) return;

        try {
            this.processor.isProcessing = true;
            this.showLoading();

            const pagesToExtract = Array.from(this.processor.selectedPages).sort((a, b) => a - b);
            const result = await this.processor.extractPages(this.processor.currentFile, pagesToExtract);

            if (result.success) {
                if (this.resultContent) {
                    this.resultContent.innerHTML = `
                        <div class="success-message">
                            <i class="fas fa-check-circle"></i>
                            <h3>${result.message}</h3>
                            <p>${result.extracted_pages}ページを抽出しました</p>
                            <a href="${result.download_url}" class="download-btn" download>
                                <i class="fas fa-download"></i>
                                ダウンロード
                            </a>
                        </div>
                    `;
                }
                if (this.resultSection) {
                    this.resultSection.style.display = 'block';
                    this.resultSection.scrollIntoView({ behavior: 'smooth' });
                }
            } else {
                alert(result.error || 'ページ抽出に失敗しました');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('抽出処理中にエラーが発生しました');
        } finally {
            this.processor.isProcessing = false;
            this.hideLoading();
        }
    }

    clearAll() {
        this.processor.currentFile = null;
        this.processor.selectedPages.clear();
        if (this.fileInput) this.fileInput.value = '';
        if (this.selectedFileSection) this.selectedFileSection.style.display = 'none';
        if (this.previewSection) this.previewSection.style.display = 'none';
        if (this.resultSection) this.resultSection.style.display = 'none';
    }

    showLoading() {
        if (this.loading) this.loading.classList.remove('hidden');
    }

    hideLoading() {
        if (this.loading) this.loading.classList.add('hidden');
    }
}

// 初期化
let processor, ui;

document.addEventListener('DOMContentLoaded', () => {
    processor = new PDFExtractProcessor();
    ui = new ExtractUI(processor);
});