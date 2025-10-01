// PDF結合機能
class PDFMerger {
    constructor(processor, fileHandler) {
        this.processor = processor;
        this.fileHandler = fileHandler;
        this.mergeBtn = document.getElementById('mergeBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.resultSection = document.getElementById('resultSection');
        this.resultContent = document.getElementById('resultContent');
        
        this.initEventListeners();
    }

    initEventListeners() {
        if (this.mergeBtn) {
            this.mergeBtn.addEventListener('click', () => this.mergePDFs());
        }

        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.fileHandler.clearFiles());
        }
    }

    updateMergeButton() {
        if (this.mergeBtn) {
            const fileCount = this.processor.selectedFiles.length;
            this.mergeBtn.disabled = fileCount < 2;
        }
    }

    async mergePDFs() {
        console.log('=== 結合処理開始 ===');
        
        const currentFiles = this.processor.selectedFiles;
        
        if (currentFiles.length < 2) {
            this.processor.showError(this.resultContent, `2つ以上のファイルを選択してください。現在: ${currentFiles.length}個`);
            if (this.resultSection) this.resultSection.style.display = 'block';
            return;
        }

        const formData = new FormData();
        currentFiles.forEach((file, index) => {
            console.log(`Adding file ${index}: ${file.name}`);
            formData.append('files[]', file);
        });

        this.processor.showLoading();

        try {
            const response = await fetch('/merge', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.processor.hideLoading();
            
            if (data.success) {
                this.processor.displayMergeResult(
                    this.resultContent, 
                    data.filename, 
                    data.download_url, 
                    currentFiles.length
                );
                console.log('Merge successful');
            } else {
                this.processor.showError(this.resultContent, data.error || '結合に失敗しました。');
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