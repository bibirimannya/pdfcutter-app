document.addEventListener('DOMContentLoaded', function() {
    const splitFile = document.getElementById('split-file');
    const splitBtn = document.getElementById('split-btn');
    const splitResult = document.getElementById('split-result');
    const mergeFiles = document.getElementById('merge-files');
    const mergeBtn = document.getElementById('merge-btn');
    const mergeResult = document.getElementById('merge-result');
    const fileList = document.getElementById('file-list');
    const loading = document.getElementById('loading');

    let selectedFiles = [];

    // File size formatter
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Show loading
    function showLoading() {
        loading.classList.remove('hidden');
    }

    // Hide loading
    function hideLoading() {
        loading.classList.add('hidden');
    }

    // Show error message
    function showError(container, message) {
        container.innerHTML = `<div class="error-message">${message}</div>`;
    }

    // PDF Split functionality
    splitFile.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            splitBtn.disabled = false;
        } else {
            splitBtn.disabled = true;
        }
    });

    splitBtn.addEventListener('click', function() {
        const file = splitFile.files[0];
        if (!file) {
            showError(splitResult, 'ファイルを選択してください。');
            return;
        }

        // ページ指定のプロンプトを表示
        const pageRange = prompt('分割するページを指定してください。\n例: 1-3 (1〜3ページ), 1,3,5 (1,3,5ページ), all (全ページ)');
        if (!pageRange) {
            return; // キャンセルされた場合
        }

        const formData = new FormData();
        formData.append('file', file);
        
        // Pythonのパラメータ名に合わせて修正
        if (pageRange.toLowerCase() === 'all') {
            formData.append('split_type', 'all');
        } else if (pageRange.includes('-') && !pageRange.includes(',')) {
            // 範囲指定 (例: 1-3)
            const [start, end] = pageRange.split('-');
            formData.append('split_type', 'range');
            formData.append('start_page', start.trim());
            formData.append('end_page', end.trim());
        } else {
            // 特定ページ指定 (例: 1,3,5 または 1-3,5-7)
            formData.append('split_type', 'specific');
            formData.append('specific_pages', pageRange);
        }

        showLoading();

        fetch('/split', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            if (data.success) {
                displaySplitResults(data.files);
            } else {
                showError(splitResult, data.error || '分割に失敗しました。');
            }
        })
        .catch(error => {
            hideLoading();
            showError(splitResult, '処理中にエラーが発生しました: ' + error.message);
        });
    });

    function displaySplitResults(files) {
        let html = '<h4>分割完了</h4>';
        files.forEach(file => {
            html += `
                <div class="result-item">
                    <div class="result-info">
                        <div class="result-name">${file.filename}</div>
                        <div class="result-page">ページ: ${file.page}</div>
                    </div>
                    <a href="${file.download_url}" class="download-btn" target="_blank">
                        <i class="fas fa-download"></i> ダウンロード
                    </a>
                </div>
            `;
        });
        splitResult.innerHTML = html;
    }

    // PDF Merge functionality
    mergeFiles.addEventListener('change', function() {
        selectedFiles = Array.from(this.files);
        displayFileList();
        mergeBtn.disabled = selectedFiles.length < 2;
    });

    function displayFileList() {
        let html = '';
        selectedFiles.forEach((file, index) => {
            html += `
                <div class="file-item">
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">${formatFileSize(file.size)}</span>
                </div>
            `;
        });
        fileList.innerHTML = html;
    }

    mergeBtn.addEventListener('click', function() {
        if (selectedFiles.length < 2) {
            showError(mergeResult, '2つ以上のファイルを選択してください。');
            return;
        }

        const formData = new FormData();
        selectedFiles.forEach(file => {
            formData.append('files[]', file);  // Pythonに合わせて修正
        });

        showLoading();

        fetch('/merge', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            if (data.success) {
                displayMergeResult(data.filename, data.download_url);
            } else {
                showError(mergeResult, data.error || '結合に失敗しました。');
            }
        })
        .catch(error => {
            hideLoading();
            showError(mergeResult, '処理中にエラーが発生しました: ' + error.message);
        });
    });

    function displayMergeResult(filename, downloadUrl) {
        mergeResult.innerHTML = `
            <div class="result-item">
                <div class="result-info">
                    <div class="result-name">結合済みPDF</div>
                    <div class="result-page">ファイル数: ${selectedFiles.length}</div>
                </div>
                <a href="${downloadUrl}" class="download-btn" target="_blank">
                    <i class="fas fa-download"></i> ダウンロード
                </a>
            </div>
        `;
    }
});
