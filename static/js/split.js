// PDF分割機能
class PDFSplitter {
    constructor(processor, fileHandler) {
        this.processor = processor;
        this.fileHandler = fileHandler;
        this.splitBtn = document.getElementById('splitBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.resultSection = document.getElementById('resultSection');
        this.resultContent = document.getElementById('resultContent');
        this.rangeInputs = document.getElementById('rangeInputs');
        this.specificInputs = document.getElementById('specificInputs');
        this.startPageInput = document.getElementById('startPage');
        this.endPageInput = document.getElementById('endPage');
        this.specificPagesInput = document.getElementById('specificPages');
        
        this.initEventListeners();
    }

    initEventListeners() {
        if (this.splitBtn) {
            this.splitBtn.addEventListener('click', () => this.splitPDF());
        }

        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.fileHandler.clearFiles());
        }

        // 分割オプション切り替え
        const splitTypeRadios = document.querySelectorAll('input[name="splitType"]');
        splitTypeRadios.forEach(radio => {
                        radio.addEventListener('change', () => this.toggleSplitOptions(radio.value));
        });
    }

    toggleSplitOptions(splitType) {
        // すべての入力エリアを非表示
        if (this.rangeInputs) this.rangeInputs.style.display = 'none';
        if (this.specificInputs) this.specificInputs.style.display = 'none';

        // 選択されたタイプに応じて表示
        if (splitType === 'range' && this.rangeInputs) {
            this.rangeInputs.style.display = 'block';
        } else if (splitType === 'specific' && this.specificInputs) {
            this.specificInputs.style.display = 'block';
        }
    }

    async splitPDF() {
        console.log('=== 分割処理開始 ===');
        
        if (!this.processor.currentPdfFile) {
            this.processor.showError(this.resultContent, 'PDFファイルを選択してください。');
            if (this.resultSection) this.resultSection.style.display = 'block';
            return;
        }

        const splitTypeElement = document.querySelector('input[name="splitType"]:checked');
        if (!splitTypeElement) {
            this.processor.showError(this.resultContent, '分割タイプを選択してください。');
            if (this.resultSection) this.resultSection.style.display = 'block';
            return;
        }

        const splitType = splitTypeElement.value;
        const formData = new FormData();
        formData.append('file', this.processor.currentPdfFile);
        formData.append('split_type', splitType);

        // 分割タイプに応じてパラメータ追加
        if (splitType === 'range') {
            const startPage = this.startPageInput ? this.startPageInput.value : '';
            const endPage = this.endPageInput ? this.endPageInput.value : '';
            
            if (!startPage || !endPage) {
                this.processor.showError(this.resultContent, '開始ページと終了ページを入力してください。');
                if (this.resultSection) this.resultSection.style.display = 'block';
                return;
            }
            
            formData.append('start_page', startPage);
            formData.append('end_page', endPage);
        } else if (splitType === 'specific') {
            const specificPages = this.specificPagesInput ? this.specificPagesInput.value : '';
            
            if (!specificPages.trim()) {
                this.processor.showError(this.resultContent, 'ページ番号を入力してください。');
                if (this.resultSection) this.resultSection.style.display = 'block';
                return;
            }
            
            formData.append('specific_pages', specificPages);
        }

        this.processor.showLoading();

        try {
            const response = await fetch('/split', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.processor.hideLoading();
            
            if (data.success) {
                this.processor.displaySplitResult(this.resultContent, data.files, data.zip_url);
                console.log('Split successful');
            } else {
                this.processor.showError(this.resultContent, data.error || '分割に失敗しました。');
            }
            
            if (this.resultSection) this.resultSection.style.display = 'block';
            
        } catch (error) {
            console.error('Fetch error:', error);
            this.processor.hideLoading();
            this.processor.showError(this.resultContent, '処理中にエラーが発生しました: ' + error.message);
            if (this.resultSection) this.resultSection.style.display = 'block';
        }
    }
}