// ファイルハンドリング関連の機能
class FileHandler {
    constructor(processor) {
        this.processor = processor;
        this.dropZone = document.querySelector('.file-drop-zone') || document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.selectFilesBtn = document.getElementById('selectFilesBtn') || document.getElementById('selectFileBtn');
        this.fileList = document.getElementById('fileList');
        this.selectedFile = document.getElementById('selectedFile');
        this.filesSection = document.getElementById('filesSection');
        this.splitOptionsSection = document.getElementById('splitOptionsSection');
        this.resultSection = document.getElementById('resultSection');
        
        this.initEventListeners();
    }

    initEventListeners() {
        if (!this.dropZone || !this.fileInput) return;

        // ファイル選択ボタン
        if (this.selectFilesBtn) {
            this.selectFilesBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.fileInput.click();
            });
        }

        // ドロップゾーンクリック
        this.dropZone.addEventListener('click', (e) => {
            if (e.target.closest('.select-files-btn') || e.target.closest('#selectFileBtn')) {
                return;
            }
            this.fileInput.click();
        });

        // ドラッグ&ドロップ
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
            if (files.length > 0) {
                this.handleFileSelection(files);
            } else {
                alert('PDFファイルを選択してください。');
            }
        });

        // ファイル選択
        this.fileInput.addEventListener('change', (e) => {
            if (this.fileInput.files.length > 0) {
                const files = Array.from(this.fileInput.files);
                this.handleFileSelection(files);
            }
        });
    }

    handleFileSelection(files) {
        if (this.splitOptionsSection) {
            // 分割モード：単一ファイル
            if (files.length > 1) {
                alert('分割機能では1つのPDFファイルのみ選択できます。');
                return;
            }
            this.processor.currentPdfFile = files[0];
            this.displaySelectedFile(files[0]);
            this.splitOptionsSection.style.display = 'block';
        } else {
            // 結合モード：複数ファイル
            this.processor.selectedFiles = [...files];
            this.displayFileList();
            this.updateUI();
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
                        <button type="button" class="remove-file-btn" onclick="fileHandler.clearSplitFile()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        }
    }

    displayFileList() {
        if (!this.fileList || this.processor.selectedFiles.length === 0) {
            if (this.fileList) {
                this.fileList.innerHTML = '<p>ファイルが選択されていません</p>';
            }
            return;
        }

        let html = '';
        this.processor.selectedFiles.forEach((file, index) => {
            html += `
                <div class="file-item" data-index="${index}">
                    <div class="file-info">
                        <i class="fas fa-file-pdf file-icon"></i>
                        <div class="file-details">
                            <h4>${file.name}</h4>
                            <p>${this.processor.formatFileSize(file.size)}</p>
                        </div>
                    </div>
                    <div class="file-actions">
                        <button type="button" class="remove-file-btn" onclick="fileHandler.removeFile(${index})">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        this.fileList.innerHTML = html;
    }

    removeFile(index) {
        this.processor.selectedFiles.splice(index, 1);
        this.displayFileList();
        this.updateUI();
    }

    clearSplitFile() {
        this.processor.currentPdfFile = null;
        this.fileInput.value = '';
        if (this.splitOptionsSection) this.splitOptionsSection.style.display = 'none';
        if (this.resultSection) this.resultSection.style.display = 'none';
    }

    clearFiles() {
        if (this.splitOptionsSection) {
            this.clearSplitFile();
        } else {
            this.processor.selectedFiles = [];
            if (this.filesSection) this.filesSection.style.display = 'none';
        }
        this.fileInput.value = '';
        if (this.resultSection) this.resultSection.style.display = 'none';
    }

    updateUI() {
        const fileCount = this.processor.selectedFiles.length;
        const fileCountElement = document.querySelector('.file-count');
        
        if (fileCountElement) {
            fileCountElement.textContent = `${fileCount}個のファイル`;
        }

        if (this.filesSection) {
            if (fileCount > 0) {
                this.filesSection.style.display = 'block';
            } else {
                this.filesSection.style.display = 'none';
            }
        }
    }
}