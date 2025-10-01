class PDFDeleter {
    constructor() {
        this.processor = window.pdfProcessor;
        this.currentPdfFile = null;
        this.pagesInfo = null;
        this.pagesToDelete = new Set();
        
        this.initElements();
        this.initEventListeners();
    }

    initElements() {
        this.previewSection = document.getElementById('previewSection');
        this.pageGrid = document.getElementById('pageGrid');
        this.selectedFileSection = document.getElementById('selectedFileSection');
        this.resultSection = document.getElementById('resultSection');
        this.deleteBtn = document.getElementById('deleteBtn');
        this.selectAllBtn = document.getElementById('selectAllBtn');
        this.deselectAllBtn = document.getElementById('deselectAllBtn');
        this.totalPagesCount = document.getElementById('totalPagesCount');
        this.selectedCount = document.getElementById('selectedCount');
        this.remainingCount = document.getElementById('remainingCount');
    }

    initEventListeners() {
        if (this.deleteBtn) {
            this.deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleDelete();
            });
        }

        if (this.selectAllBtn) {
            this.selectAllBtn.addEventListener('click', () => {
                this.selectAllPages();
            });
        }

        if (this.deselectAllBtn) {
            this.deselectAllBtn.addEventListener('click', () => {
                this.clearSelection();
            });
        }

        document.addEventListener('filesSelected', (event) => {
            const files = event.detail.files;
            if (files && files.length === 1) {
                this.currentPdfFile = files[0];
                this.loadPdfPages();
            }
        });
    }

    async loadPdfPages() {
        if (!this.currentPdfFile) return;

        this.processor.showLoading();
        
        try {
            const formData = new FormData();
            formData.append('file', this.currentPdfFile);

            const response = await fetch('/get_pdf_info', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.pagesInfo = data;
                this.displayPages();
                if (this.previewSection) {
                    this.previewSection.style.display = 'block';
                }
            } else {
                if (this.previewSection) {
                    this.processor.showError(this.previewSection, data.error || 'PDFの読み込みに失敗しました');
                }
            }
        } catch (error) {
            console.error('Error loading PDF info:', error);
            if (this.previewSection) {
                this.processor.showError(this.previewSection, 'PDFの読み込み中にエラーが発生しました');
            }
        } finally {
            this.processor.hideLoading();
        }
    }

    displayPages() {
        if (!this.pagesInfo || !this.pageGrid) return;

        const totalPages = this.pagesInfo.total_pages;
        
        if (this.totalPagesCount) {
            this.totalPagesCount.textContent = totalPages;
        }
        
        let html = '';
        for (let i = 1; i <= totalPages; i++) {
            html += `
                <div class="page-item" data-page="${i}">
                    <input type="checkbox" id="page-${i}" value="${i}" class="page-checkbox">
                    <label for="page-${i}" class="page-label">
                        <div class="page-preview">
                            <i class="fas fa-file-pdf"></i>
                            <span class="page-number">${i}</span>
                        </div>
                    </label>
                </div>
            `;
        }

        this.pageGrid.innerHTML = html;
        
        const checkboxes = this.pageGrid.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.togglePage(parseInt(checkbox.value));
            });
        });

        this.updateSelectedPagesInfo();
    }

    togglePage(pageNumber) {
        if (this.pagesToDelete.has(pageNumber)) {
            this.pagesToDelete.delete(pageNumber);
        } else {
            this.pagesToDelete.add(pageNumber);
        }
        this.updateSelectedPagesInfo();
        this.updateDeleteButton();
    }

    selectAllPages() {
        if (!this.pagesInfo) return;

        const checkboxes = this.pageGrid.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            this.pagesToDelete.add(parseInt(checkbox.value));
        });
        
        this.updateSelectedPagesInfo();
        this.updateDeleteButton();
    }

    clearSelection() {
        this.pagesToDelete.clear();
        
        const checkboxes = this.pageGrid.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        
        this.updateSelectedPagesInfo();
        this.updateDeleteButton();
    }

    updateSelectedPagesInfo() {
        const selectedCountNum = this.pagesToDelete.size;
        const totalPages = this.pagesInfo ? this.pagesInfo.total_pages : 0;
        const remainingPages = totalPages - selectedCountNum;

        if (this.selectedCount) {
            this.selectedCount.textContent = selectedCountNum;
        }
        if (this.remainingCount) {
            this.remainingCount.textContent = remainingPages;
        }
    }

    updateDeleteButton() {
        if (!this.deleteBtn) return;

        const selectedCountNum = this.pagesToDelete.size;
        const totalPages = this.pagesInfo ? this.pagesInfo.total_pages : 0;

        if (selectedCountNum === 0 || selectedCountNum === totalPages) {
            this.deleteBtn.disabled = true;
        } else {
            this.deleteBtn.disabled = false;
        }
    }

    async handleDelete() {
        if (!this.currentPdfFile || this.pagesToDelete.size === 0) {
            alert('削除するページを選択してください。');
            return;
        }

        const totalPages = this.pagesInfo ? this.pagesInfo.total_pages : 0;
        if (this.pagesToDelete.size === totalPages) {
            alert('すべてのページを削除することはできません。少なくとも1ページは残してください。');
            return;
        }

        this.processor.showLoading();

        try {
            const formData = new FormData();
            formData.append('file', this.currentPdfFile);
            formData.append('pages_to_delete', JSON.stringify(Array.from(this.pagesToDelete)));

            const response = await fetch('/delete-pages', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Response data:', data);

            if (data.success) {
                this.displayDeleteResult(data);
                
                if (this.resultSection) {
                    this.resultSection.style.display = 'block';
                }
                
                // 即座にダウンロード開始
                this.downloadFile(data.download_url, data.display_name);
                
                setTimeout(() => {
                    this.resetFormExceptResult();
                }, 100);
                
            } else {
                if (this.resultSection) {
                    this.processor.showError(this.resultSection, data.error || 'ページの削除に失敗しました');
                    this.resultSection.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Error deleting pages:', error);
            if (this.resultSection) {
                this.processor.showError(this.resultSection, 'ページの削除中にエラーが発生しました');
                this.resultSection.style.display = 'block';
            }
        } finally {
            this.processor.hideLoading();
        }
    }

    displayDeleteResult(data) {
        if (!this.resultSection) return;

        const deletedCount = this.pagesToDelete.size;
        const remainingCount = data.remaining_pages || 0;
        const displayName = data.display_name || 'edited.pdf';

        const resultContent = document.getElementById('resultContent');
        if (resultContent) {
            resultContent.innerHTML = `
                <div class="result-success">
                    <i class="fas fa-check-circle"></i>
                    <h3>ページ削除完了</h3>
                    <p>${deletedCount}ページを削除しました（${remainingCount}ページが残りました）</p>
                    <p>ダウンロードが開始されない場合は下のボタンをクリックしてください</p>
                    <button class="download-btn" id="manualDownloadBtn">
                        <i class="fas fa-download"></i>
                        編集済みPDFをダウンロード
                    </button>
                </div>
            `;
            
            // 手動ダウンロードボタンのイベント
            setTimeout(() => {
                const manualBtn = document.getElementById('manualDownloadBtn');
                if (manualBtn) {
                    manualBtn.onclick = () => {
                        this.downloadFile(data.download_url, displayName);
                    };
                }
            }, 100);
        }
    }

    async downloadFile(url, filename) {
        try {
            console.log('Starting download:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                window.URL.revokeObjectURL(blobUrl);
                document.body.removeChild(a);
            }, 100);
            
            console.log('Download initiated successfully');
            
        } catch (error) {
            console.error('Download failed:', error);
            alert('ダウンロードに失敗しました。ページを更新してから再試行してください。');
        }
    }

    resetFormExceptResult() {
        this.currentPdfFile = null;
        this.pagesInfo = null;
        this.pagesToDelete.clear();
        
        if (window.fileHandler) {
            window.fileHandler.clearFiles();
        }
        
        if (this.previewSection) {
            this.previewSection.style.display = 'none';
        }
        
        if (this.pageGrid) {
            this.pageGrid.innerHTML = '';
        }
        
        if (this.totalPagesCount) {
            this.totalPagesCount.textContent = '0';
        }
        if (this.selectedCount) {
            this.selectedCount.textContent = '0';
        }
        if (this.remainingCount) {
            this.remainingCount.textContent = '0';
        }
    }

    resetForm() {
        this.resetFormExceptResult();
        
        if (this.resultSection) {
            this.resultSection.style.display = 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    if (!window.pdfDeleter) {
        console.log('Delete page DOM loaded');
        window.pdfDeleter = new PDFDeleter();
    }
    
    if (!window.fileHandler) {
        window.fileHandler = new FileHandler(window.pdfProcessor);
    }
    
    if (window.fileHandler) {
        const originalHandleFileSelection = window.fileHandler.handleFileSelection.bind(window.fileHandler);
        window.fileHandler.handleFileSelection = function(files) {
            originalHandleFileSelection(files);
            document.dispatchEvent(new CustomEvent('filesSelected', {
                detail: { files: files }
            }));
        };
    }
});