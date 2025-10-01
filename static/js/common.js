// common.js - 共通ユーティリティ関数とグローバル変数

class PDFProcessor {
    constructor() {
        this.selectedFiles = [];
        this.currentPdfFile = null;
        this.loading = document.getElementById('loading');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showLoading() {
        if (this.loading) {
            this.loading.classList.remove('hidden');
        }
    }

    hideLoading() {
        if (this.loading) {
            this.loading.classList.add('hidden');
        }
    }

    showError(container, message) {
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${message}</p>
                </div>
            `;
        }
        console.error('Error:', message);
    }

    displayMergeResult(container, filename, downloadUrl, fileCount) {
        if (container) {
            container.innerHTML = `
                <div class="result-success">
                    <i class="fas fa-check-circle"></i>
                    <h3>結合完了</h3>
                    <p>${fileCount}個のファイルを結合しました</p>
                    <a href="${downloadUrl}" class="download-btn" download>
                        <i class="fas fa-download"></i>
                        結合済みPDFをダウンロード
                    </a>
                </div>
            `;
        }
    }

    displaySplitResult(container, files, zipUrl) {
        if (container) {
            let fileListHtml = '';
            if (files && files.length > 0) {
                fileListHtml = files.map(file => `
                    <div class="split-file-item">
                        <i class="fas fa-file-pdf"></i>
                        <span>${file.filename}</span>
                        <a href="${file.download_url}" class="download-link" download>
                            <i class="fas fa-download"></i>
                        </a>
                    </div>
                `).join('');
            }

            container.innerHTML = `
                <div class="result-success">
                    <i class="fas fa-check-circle"></i>
                    <h3>分割完了</h3>
                    <p>${files ? files.length : 0}個のファイルに分割しました</p>
                    
                    ${fileListHtml ? `
                        <div class="split-files-list">
                            <h4>分割されたファイル:</h4>
                            ${fileListHtml}
                        </div>
                    ` : ''}
                    
                    ${zipUrl ? `
                        <div class="zip-download">
                            <a href="${zipUrl}" class="download-btn" download>
                                <i class="fas fa-download"></i>
                                すべてのファイルを一括ダウンロード（ZIP）
                            </a>
                        </div>
                    ` : ''}
                </div>
            `;
        }
    }
}

// グローバルメニュー制御
document.addEventListener('DOMContentLoaded', () => {
    const navDropdown = document.querySelector('.nav-dropdown');
    const dropdownToggle = navDropdown?.querySelector('.dropdown-toggle');

    if (dropdownToggle) {
        dropdownToggle.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                e.preventDefault();
                navDropdown.classList.toggle('active');
            }
        });
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            navDropdown?.classList.remove('active');
        }
    });

    document.addEventListener('click', (e) => {
        if (navDropdown && !navDropdown.contains(e.target)) {
            navDropdown.classList.remove('active');
        }
    });
});

// グローバルインスタンス
window.pdfProcessor = new PDFProcessor();