import os
import uuid
import zipfile
from flask import Flask, render_template, request, jsonify, send_file, url_for, send_from_directory
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.utils import secure_filename
import PyPDF2
from config import Config
import traceback

app = Flask(__name__)
app.config.from_object(Config)

# Rate limiting
limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"]
)

# アップロードとダウンロードディレクトリの作成
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['DOWNLOAD_FOLDER'], exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() == 'pdf'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/privacy')
def privacy():
    return render_template('privacy.html')

@app.route('/pdf-split-free')
def pdf_split_free():
    return render_template('landing/pdf_split_free.html')

@app.route('/pdf-merge-online')
def pdf_merge_online():
    return render_template('landing/pdf_merge_online.html')

@app.route('/how-to-use')
def how_to_use():
    return render_template('landing/how_to_use.html')

# スラッシュありからのリダイレクト
@app.route('/terms/')
def terms_redirect():
    return redirect('/terms', code=301)

@app.route('/privacy/')
def privacy_redirect():
    return redirect('/privacy', code=301)

@app.route('/pdf-split-free/')
def pdf_split_free_redirect():
    return redirect('/pdf-split-free', code=301)

@app.route('/pdf-merge-online/')
def pdf_merge_online_redirect():
    return redirect('/pdf-merge-online', code=301)

@app.route('/how-to-use/')
def how_to_use_redirect():
    return redirect('/how-to-use', code=301)

@app.route('/robots.txt')
def robots_txt():
    import os
    robots_path = os.path.join(app.root_path, 'static', 'robots.txt')
    if os.path.exists(robots_path):
        return send_from_directory('static', 'robots.txt')
    else:
        # ファイルが存在しない場合のフォールバック
        from flask import Response
        robots_content = """User-agent: *
Allow: /
Disallow: /static/uploads/
Disallow: /static/downloads/
Sitemap: https://pdfcutter.jp/static/sitemap.xml"""
        return Response(robots_content, mimetype='text/plain')

@app.route('/sitemap.xml')
def sitemap_xml():
    import os
    sitemap_path = os.path.join(app.root_path, 'static', 'sitemap.xml')
    if os.path.exists(sitemap_path):
        return send_from_directory('static', 'sitemap.xml')
    else:
        from flask import Response
        sitemap_content = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://pdfcutter.jp/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>"""
        return Response(sitemap_content, mimetype='application/xml')
@app.route('/split', methods=['POST'])
@limiter.limit("10 per minute")
def split_pdf():
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'ファイルが選択されていません'})
        
        file = request.files['file']
        if file.filename == '' or not allowed_file(file.filename):
            return jsonify({'success': False, 'error': 'PDFファイルを選択してください'})
        
        # ファイルを保存
        filename = secure_filename(file.filename)
        unique_id = str(uuid.uuid4())
        upload_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{unique_id}_{filename}")
        file.save(upload_path)
        
        # PDF読み込み
        with open(upload_path, 'rb') as pdf_file:
            reader = PyPDF2.PdfReader(pdf_file)
            total_pages = len(reader.pages)
            
            if total_pages > app.config['MAX_PAGES_PER_PDF']:
                os.remove(upload_path)
                return jsonify({'success': False, 'error': f'ページ数が{app.config["MAX_PAGES_PER_PDF"]}を超えています'})
            
            # 分割タイプを取得
            split_type = request.form.get('split_type', 'all')
            pages_to_split = []
            
            if split_type == 'all':
                pages_to_split = list(range(1, total_pages + 1))
            elif split_type == 'range':
                start_page = int(request.form.get('start_page', 1))
                end_page = int(request.form.get('end_page', total_pages))
                start_page = max(1, min(start_page, total_pages))
                end_page = max(start_page, min(end_page, total_pages))
                pages_to_split = list(range(start_page, end_page + 1))
            elif split_type == 'specific':
                specific_pages = request.form.get('specific_pages', '')
                pages_to_split = parse_page_specification(specific_pages, total_pages)
            
            if not pages_to_split:
                os.remove(upload_path)
                return jsonify({'success': False, 'error': '有効なページが指定されていません'})
            
            # ページ分割実行
            output_files = []
            base_name = os.path.splitext(filename)[0]
            
            for page_num in pages_to_split:
                writer = PyPDF2.PdfWriter()
                writer.add_page(reader.pages[page_num - 1])  # 0ベースのインデックス
                
                output_filename = f"{base_name}_page_{page_num}.pdf"
                output_path = os.path.join(app.config['DOWNLOAD_FOLDER'], f"{unique_id}_{output_filename}")
                
                with open(output_path, 'wb') as output_file:
                    writer.write(output_file)
                
                output_files.append({
                    'filename': output_filename,
                    'page': page_num,
                    'download_url': url_for('download_file', filename=f"{unique_id}_{output_filename}")
                })
        
        # アップロードファイルを削除
        os.remove(upload_path)
        
        return jsonify({
            'success': True,
            'message': f'{len(output_files)}個のファイルに分割しました',
            'files': output_files
        })
        
    except Exception as e:
        app.logger.error(f"分割エラー: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': 'ファイルの分割中にエラーが発生しました'})

@app.route('/merge', methods=['POST'])
@limiter.limit("5 per minute")
def merge_pdf():
    try:
        files = request.files.getlist('files[]')
        
        if len(files) < 2:
            return jsonify({'success': False, 'error': '2つ以上のファイルを選択してください'})
        
        if len(files) > app.config['MAX_FILES_PER_REQUEST']:
            return jsonify({'success': False, 'error': f'一度にアップロードできるファイル数は{app.config["MAX_FILES_PER_REQUEST"]}個までです'})
        
        # ファイル検証
        for file in files:
            if not file.filename or not allowed_file(file.filename):
                return jsonify({'success': False, 'error': 'すべてPDFファイルを選択してください'})
        
        unique_id = str(uuid.uuid4())
        temp_files = []
        
        # PDF結合
        writer = PyPDF2.PdfWriter()
        total_pages = 0
        
        for file in files:
            filename = secure_filename(file.filename)
            temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{unique_id}_{filename}")
            file.save(temp_path)
            temp_files.append(temp_path)
            
            with open(temp_path, 'rb') as pdf_file:
                reader = PyPDF2.PdfReader(pdf_file)
                page_count = len(reader.pages)
                total_pages += page_count
                
                if total_pages > app.config['MAX_PAGES_PER_PDF']:
                    for temp_file in temp_files:
                        if os.path.exists(temp_file):
                            os.remove(temp_file)
                    return jsonify({'success': False, 'error': f'結合後のページ数が{app.config["MAX_PAGES_PER_PDF"]}を超えています'})
                
                for page in reader.pages:
                    writer.add_page(page)
        
        # 結合ファイルを保存
        output_filename = f"merged_{unique_id}.pdf"
        output_path = os.path.join(app.config['DOWNLOAD_FOLDER'], output_filename)
        
        with open(output_path, 'wb') as output_file:
            writer.write(output_file)
        
        # 一時ファイルを削除
        for temp_file in temp_files:
            if os.path.exists(temp_file):
                os.remove(temp_file)
        
        return jsonify({
            'success': True,
            'message': f'{len(files)}個のファイルを結合しました',
            'filename': f'merged_document.pdf',
            'download_url': url_for('download_file', filename=output_filename)
        })
        
    except Exception as e:
        app.logger.error(f"結合エラー: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': 'ファイルの結合中にエラーが発生しました'})

@app.route('/download/<filename>')
def download_file(filename):
    try:
        file_path = os.path.join(app.config['DOWNLOAD_FOLDER'], filename)
        if os.path.exists(file_path):
            return send_file(file_path, as_attachment=True)
        else:
            return jsonify({'error': 'ファイルが見つかりません'}), 404
    except Exception as e:
        app.logger.error(f"ダウンロードエラー: {str(e)}")
        return jsonify({'error': 'ダウンロード中にエラーが発生しました'}), 500

def parse_page_specification(spec, total_pages):
    """ページ指定文字列を解析して、ページ番号のリストを返す"""
    pages = set()
    
    if not spec.strip():
        return []
    
    try:
        parts = spec.split(',')
        for part in parts:
            part = part.strip()
            if '-' in part:
                # 範囲指定
                start, end = part.split('-', 1)
                start = int(start.strip())
                end = int(end.strip())
                start = max(1, min(start, total_pages))
                end = max(start, min(end, total_pages))
                pages.update(range(start, end + 1))
            else:
                # 単一ページ
                page = int(part)
                if 1 <= page <= total_pages:
                    pages.add(page)
        
        return sorted(list(pages))
    except ValueError:
        return []

if __name__ == '__main__':
    app.run(debug=True)
