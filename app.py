import os
import uuid
import zipfile
import json
from flask import Flask, render_template, request, jsonify, send_file, url_for, send_from_directory, redirect
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

@app.route('/split')
def split():
    return render_template('split.html')

@app.route('/delete')
def delete():
    return render_template('delete.html')

@app.route('/reorder')
def reorder():
    return render_template('reorder.html')

@app.route('/extract')
def extract():
    return render_template('extract.html')

@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/privacy')
def privacy():
    return render_template('privacy.html')

@app.route('/contact')
def contact():
    return render_template('contact.html')

@app.route('/robots.txt')
def robots_txt():
    robots_path = os.path.join(app.root_path, 'static', 'robots.txt')
    if os.path.exists(robots_path):
        return send_from_directory('static', 'robots.txt')
    else:
        from flask import Response
        robots_content = """User-agent: *
Allow: /
Disallow: /static/uploads/
Disallow: /static/downloads/
Sitemap: https://pdfcutter.jp/static/sitemap.xml"""
        return Response(robots_content, mimetype='text/plain')

@app.route('/sitemap.xml')
def sitemap_xml():
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

def parse_page_specification(page_spec, total_pages):
    """ページ指定文字列を解析してページ番号のリストを返す"""
    if not page_spec.strip():
        return []
    
    pages = set()
    parts = page_spec.replace(' ', '').split(',')
    
    for part in parts:
        if '-' in part:
            try:
                start, end = map(int, part.split('-', 1))
                start = max(1, min(start, total_pages))
                end = max(start, min(end, total_pages))
                pages.update(range(start, end + 1))
            except ValueError:
                continue
        else:
            try:
                page = int(part)
                if 1 <= page <= total_pages:
                    pages.add(page)
            except ValueError:
                continue
    
    return sorted(list(pages))

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
                writer.add_page(reader.pages[page_num - 1])
                
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
        
        # ZIP作成
        zip_filename = f"{unique_id}_split_files.zip"
        zip_path = os.path.join(app.config['DOWNLOAD_FOLDER'], zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w') as zip_file:
            for file_info in output_files:
                file_path = os.path.join(app.config['DOWNLOAD_FOLDER'], f"{unique_id}_{file_info['filename']}")
                zip_file.write(file_path, file_info['filename'])
        
        return jsonify({
            'success': True,
            'message': f'{len(output_files)}個のファイルに分割しました',
            'files': output_files,
            'zip_url': url_for('download_file', filename=zip_filename)
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

@app.route('/delete-pages', methods=['POST'])
@limiter.limit("10 per minute")
def delete_pages():
    """PDFからページを削除するエンドポイント"""
    upload_path = None
    output_path = None
    
    try:
        app.logger.info("=== ページ削除処理開始 ===")
        
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'ファイルが選択されていません'})
        
        file = request.files['file']
        if file.filename == '' or not allowed_file(file.filename):
            return jsonify({'success': False, 'error': 'PDFファイルを選択してください'})
        
        # 削除対象ページを取得
        pages_to_delete_str = request.form.get('pages_to_delete', '[]')
        app.logger.info(f"削除対象ページ文字列: {pages_to_delete_str}")
        
        try:
            pages_to_delete = json.loads(pages_to_delete_str)
            pages_to_delete = [int(p) for p in pages_to_delete]
            pages_to_delete = set(pages_to_delete)
            app.logger.info(f"削除対象ページ: {pages_to_delete}")
        except (json.JSONDecodeError, ValueError, TypeError) as e:
            app.logger.error(f"ページ解析エラー: {str(e)}")
            return jsonify({'success': False, 'error': '削除ページの指定が無効です'})
        
        if not pages_to_delete:
            return jsonify({'success': False, 'error': '削除するページを選択してください'})
        
        # ファイルを保存
        filename = secure_filename(file.filename)
        unique_id = str(uuid.uuid4())
        upload_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{unique_id}_{filename}")
        
        # ディレクトリの存在確認
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        os.makedirs(app.config['DOWNLOAD_FOLDER'], exist_ok=True)
        
        file.save(upload_path)
        app.logger.info(f"ファイル保存: {upload_path}")
        
        # PDF読み込み
        with open(upload_path, 'rb') as pdf_file:
            reader = PyPDF2.PdfReader(pdf_file)
            total_pages = len(reader.pages)
            app.logger.info(f"総ページ数: {total_pages}")
            
            if total_pages > app.config['MAX_PAGES_PER_PDF']:
                return jsonify({'success': False, 'error': f'ページ数が{app.config["MAX_PAGES_PER_PDF"]}を超えています'})
            
            # 削除対象ページの検証
            invalid_pages = [p for p in pages_to_delete if p < 1 or p > total_pages]
            if invalid_pages:
                app.logger.error(f"無効なページ番号: {invalid_pages}")
                return jsonify({'success': False, 'error': f'無効なページ番号: {invalid_pages}'})
            
            # すべてのページを削除しようとしていないかチェック
            if len(pages_to_delete) >= total_pages:
                return jsonify({'success': False, 'error': 'すべてのページを削除することはできません'})
            
            # 残すページのリストを作成
            pages_to_keep = [i for i in range(1, total_pages + 1) if i not in pages_to_delete]
            
            if not pages_to_keep:
                return jsonify({'success': False, 'error': '削除後にページが残りません'})
            
            app.logger.info(f"残すページ: {pages_to_keep}")
            
            # 新しいPDFを作成
            writer = PyPDF2.PdfWriter()
            for page_num in pages_to_keep:
                writer.add_page(reader.pages[page_num - 1])
            
            app.logger.info(f"残りページ数: {len(pages_to_keep)}")
            
            # 出力ファイルを保存
            base_name = os.path.splitext(filename)[0]
            output_filename = f"{unique_id}_{base_name}_deleted.pdf"
            output_path = os.path.join(app.config['DOWNLOAD_FOLDER'], output_filename)
            
            with open(output_path, 'wb') as output_file:
                writer.write(output_file)
            
            app.logger.info(f"出力ファイル保存: {output_path}")
            
            # ファイルが正常に作成されたことを確認
            if not os.path.exists(output_path):
                raise Exception("出力ファイルの作成に失敗しました")
            
            file_size = os.path.getsize(output_path)
            if file_size == 0:
                raise Exception("出力ファイルが空です")
            
            app.logger.info(f"出力ファイルサイズ: {file_size} bytes")
            
            # ダウンロードURL（_externalをTrueにして絶対URLを生成）
            download_url = url_for('download_file', filename=output_filename, _external=True)
            app.logger.info(f"生成されたダウンロードURL: {download_url}")
            
            return jsonify({
                'success': True,
                'message': f'{len(pages_to_delete)}ページを削除しました',
                'filename': output_filename,
                'display_name': f'{base_name}_deleted.pdf',
                'deleted_pages': len(pages_to_delete),
                'remaining_pages': len(pages_to_keep),
                'download_url': download_url,
                'file_size': file_size
            })
    
    except Exception as e:
        app.logger.error(f"ページ削除エラー: {str(e)}")
        app.logger.error(traceback.format_exc())
        
        # エラー時にファイルをクリーンアップ
        for path in [upload_path, output_path]:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except:
                    pass
        
        return jsonify({'success': False, 'error': f'ページ削除中にエラーが発生しました: {str(e)}'})
    
    finally:
        # アップロードファイルを削除
        if upload_path and os.path.exists(upload_path):
            try:
                os.remove(upload_path)
                app.logger.info("一時アップロードファイル削除完了")
            except Exception as e:
                app.logger.error(f"一時ファイル削除エラー: {str(e)}")

@app.route('/extract-pages', methods=['POST'])
@limiter.limit("10 per minute")
def extract_pages():
    """PDFからページを抽出するエンドポイント"""
    upload_path = None
    output_path = None
    
    try:
        app.logger.info("=== ページ抽出処理開始 ===")
        
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'ファイルが選択されていません'})
        
        file = request.files['file']
        if file.filename == '' or not allowed_file(file.filename):
            return jsonify({'success': False, 'error': 'PDFファイルを選択してください'})
        
        # 抽出対象ページを取得
        pages_to_extract_str = request.form.get('pages_to_extract', '[]')
        app.logger.info(f"抽出対象ページ文字列: {pages_to_extract_str}")
        
        try:
            pages_to_extract = json.loads(pages_to_extract_str)
            pages_to_extract = [int(p) for p in pages_to_extract]
            pages_to_extract = sorted(list(set(pages_to_extract)))
            app.logger.info(f"抽出対象ページ: {pages_to_extract}")
        except (json.JSONDecodeError, ValueError, TypeError) as e:
            app.logger.error(f"ページ解析エラー: {str(e)}")
            return jsonify({'success': False, 'error': '抽出ページの指定が無効です'})
        
        if not pages_to_extract:
            return jsonify({'success': False, 'error': '抽出するページを選択してください'})
        
        # ファイルを保存
        filename = secure_filename(file.filename)
        unique_id = str(uuid.uuid4())
        upload_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{unique_id}_{filename}")
        
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        os.makedirs(app.config['DOWNLOAD_FOLDER'], exist_ok=True)
        
        file.save(upload_path)
        app.logger.info(f"ファイル保存: {upload_path}")
        
        # PDF読み込み
        with open(upload_path, 'rb') as pdf_file:
            reader = PyPDF2.PdfReader(pdf_file)
            total_pages = len(reader.pages)
            app.logger.info(f"総ページ数: {total_pages}")
            
            if total_pages > app.config['MAX_PAGES_PER_PDF']:
                return jsonify({'success': False, 'error': f'ページ数が{app.config["MAX_PAGES_PER_PDF"]}を超えています'})
            
            # 抽出対象ページの検証
            invalid_pages = [p for p in pages_to_extract if p < 1 or p > total_pages]
            if invalid_pages:
                app.logger.error(f"無効なページ番号: {invalid_pages}")
                return jsonify({'success': False, 'error': f'無効なページ番号: {invalid_pages}'})
            
            app.logger.info(f"抽出ページ数: {len(pages_to_extract)}")
            
            # 新しいPDFを作成
            writer = PyPDF2.PdfWriter()
            for page_num in pages_to_extract:
                writer.add_page(reader.pages[page_num - 1])
            
            # 出力ファイルを保存
            base_name = os.path.splitext(filename)[0]
            output_filename = f"{unique_id}_{base_name}_extracted.pdf"
            output_path = os.path.join(app.config['DOWNLOAD_FOLDER'], output_filename)
            
            with open(output_path, 'wb') as output_file:
                writer.write(output_file)
            
            app.logger.info(f"出力ファイル保存: {output_path}")
            
            if not os.path.exists(output_path):
                raise Exception("出力ファイルの作成に失敗しました")
            
            file_size = os.path.getsize(output_path)
            if file_size == 0:
                raise Exception("出力ファイルが空です")
            
            app.logger.info(f"出力ファイルサイズ: {file_size} bytes")
            
            download_url = url_for('download_file', filename=output_filename, _external=True)
            app.logger.info(f"生成されたダウンロードURL: {download_url}")
            
            return jsonify({
                'success': True,
                'message': f'{len(pages_to_extract)}ページを抽出しました',
                'filename': output_filename,
                'display_name': f'{base_name}_extracted.pdf',
                'extracted_pages': len(pages_to_extract),
                'download_url': download_url,
                'file_size': file_size
            })
    
    except Exception as e:
        app.logger.error(f"ページ抽出エラー: {str(e)}")
        app.logger.error(traceback.format_exc())
        
        for path in [upload_path, output_path]:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except:
                    pass
        
        return jsonify({'success': False, 'error': f'ページ抽出中にエラーが発生しました: {str(e)}'})
    
    finally:
        if upload_path and os.path.exists(upload_path):
            try:
                os.remove(upload_path)
                app.logger.info("一時アップロードファイル削除完了")
            except Exception as e:
                app.logger.error(f"一時ファイル削除エラー: {str(e)}")

@app.route('/get_pdf_info', methods=['POST'])
@limiter.limit("20 per minute")
def get_pdf_info():
    """PDFの基本情報を取得"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'ファイルが選択されていません'})
        
        file = request.files['file']
        if file.filename == '' or not allowed_file(file.filename):
            return jsonify({'success': False, 'error': 'PDFファイルを選択してください'})
        
        # ファイルを一時保存
        filename = secure_filename(file.filename)
        unique_id = str(uuid.uuid4())
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{unique_id}_{filename}")
        file.save(temp_path)
        
        try:
            # PDF情報を読み取り
            with open(temp_path, 'rb') as pdf_file:
                reader = PyPDF2.PdfReader(pdf_file)
                total_pages = len(reader.pages)
                
                if total_pages > app.config['MAX_PAGES_PER_PDF']:
                    return jsonify({
                        'success': False, 
                        'error': f'ページ数が{app.config["MAX_PAGES_PER_PDF"]}を超えています'
                    })
                
                return jsonify({
                    'success': True,
                    'total_pages': total_pages,
                    'filename': filename
                })
                
        finally:
            # 一時ファイルを削除
            if os.path.exists(temp_path):
                os.remove(temp_path)
            
    except Exception as e:
        app.logger.error(f"PDF情報取得エラー: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': 'PDFの読み込み中にエラーが発生しました'})

@app.route('/download/<filename>')
def download_file(filename):
    """ファイルダウンロード（ダウンロード後に自動削除）"""
    try:
        if not filename or '..' in filename or '/' in filename or '\\' in filename:
            app.logger.error(f"不正なファイル名: {filename}")
            return jsonify({'error': '不正なファイル名です'}), 400
        
        file_path = os.path.join(app.config['DOWNLOAD_FOLDER'], filename)
        
        if not os.path.exists(file_path):
            app.logger.error(f"ファイルが見つかりません: {file_path}")
            return jsonify({'error': 'ファイルが見つかりません'}), 404
        
        mimetype = 'application/pdf' if filename.endswith('.pdf') else 'application/zip'
        display_name = filename.split('_', 1)[1] if '_' in filename else filename
        
        app.logger.info(f"ダウンロード開始: {display_name}")
        
        # ファイルを送信後に削除
        response = send_from_directory(
            app.config['DOWNLOAD_FOLDER'], 
            filename, 
            as_attachment=True,
            mimetype=mimetype,
            download_name=display_name
        )
        
        # レスポンス送信後にファイルを削除するコールバックを登録
        @response.call_on_close
        def cleanup():
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    app.logger.info(f"ファイル削除完了: {filename}")
                    
                    # ZIPファイルの場合、含まれていた個別PDFファイルも削除
                    if filename.endswith('.zip'):
                        unique_id = filename.split('_')[0]
                        for f in os.listdir(app.config['DOWNLOAD_FOLDER']):
                            if f.startswith(unique_id) and f.endswith('.pdf'):
                                pdf_path = os.path.join(app.config['DOWNLOAD_FOLDER'], f)
                                try:
                                    os.remove(pdf_path)
                                    app.logger.info(f"関連ファイル削除: {f}")
                                except:
                                    pass
            except Exception as e:
                app.logger.error(f"ファイル削除エラー: {str(e)}")
        
        return response
            
    except Exception as e:
        app.logger.error(f"ダウンロードエラー: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({'error': f'ダウンロード中にエラーが発生しました: {str(e)}'}), 500

@app.route('/reorder', methods=['POST'])
def reorder_pdf():
    input_path = None
    output_path = None
    
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'ファイルが選択されていません'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'ファイルが選択されていません'}), 400
        
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({'success': False, 'error': 'PDFファイルを選択してください'}), 400
        
        # ページ順序を取得
        page_order_str = request.form.get('page_order', '[]')
        try:
            page_order = json.loads(page_order_str)
        except json.JSONDecodeError:
            return jsonify({'success': False, 'error': '不正なページ順序です'}), 400
        
        if not page_order:
            return jsonify({'success': False, 'error': 'ページ順序が指定されていません'}), 400
        
# 一意のファイル名を生成
        unique_id = str(uuid.uuid4())
        input_filename = f"input_{unique_id}.pdf"
        output_filename = f"reordered_{unique_id}.pdf"
        
        input_path = os.path.join(app.config['UPLOAD_FOLDER'], input_filename)
        output_path = os.path.join(app.config['DOWNLOAD_FOLDER'], output_filename)
        
        # ファイルを保存
        file.save(input_path)
        
        # PDFを読み込んで並び替え
        reader = PyPDF2.PdfReader(input_path)
        writer = PyPDF2.PdfWriter()
        
        total_pages = len(reader.pages)
        
        # ページ順序の検証
        if not page_order or max(page_order) > total_pages or min(page_order) < 1:
            raise ValueError(f"無効なページ番号が含まれています。1-{total_pages}の範囲で指定してください。")
        
        if len(page_order) != total_pages:
            raise ValueError(f"ページ数が一致しません。{total_pages}ページ必要ですが、{len(page_order)}ページが指定されました。")
        
        # 指定された順序でページを追加
        for page_num in page_order:
            if 1 <= page_num <= total_pages:
                writer.add_page(reader.pages[page_num - 1])
            else:
                raise ValueError(f"無効なページ番号: {page_num}")
        
        # 並び替えたPDFを保存
        with open(output_path, 'wb') as output_file:
            writer.write(output_file)
        
        # 元ファイルを削除
        if os.path.exists(input_path):
            os.remove(input_path)
            input_path = None
        
        # ファイルサイズを確認
        if os.path.getsize(output_path) == 0:
            raise ValueError("生成されたPDFファイルが空です")
        
        # ダウンロードURLを生成
        download_url = url_for('download_file', filename=output_filename)
        
        app.logger.info(f"PDF reorder successful: {output_filename}, size: {os.path.getsize(output_path)} bytes")
        
        return jsonify({
            'success': True,
            'message': 'PDFの並び替えが完了しました',
            'download_url': download_url,
            'total_pages': total_pages,
            'reordered_pages': len(page_order)
        })
        
    except Exception as e:
        # エラーが発生した場合はファイルをクリーンアップ
        for file_path in [input_path, output_path]:
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except:
                    pass
        
        app.logger.error(f"PDF reorder error: {str(e)}")
        return jsonify({
            'success': False, 
            'error': f'並び替え処理中にエラーが発生しました: {str(e)}'
        }), 500

@app.route('/debug/files')
def debug_files():
    upload_folder = app.config['UPLOAD_FOLDER']
    if os.path.exists(upload_folder):
        files = os.listdir(upload_folder)
        return jsonify({
            'upload_folder': upload_folder,
            'files': files,
            'total_files': len(files)
        })
    else:
        return jsonify({
            'error': 'Upload folder does not exist',
            'upload_folder': upload_folder
        })

@app.route('/cleanup')
def cleanup_files():
    """古いファイルをクリーンアップ（管理者用）"""
    if not app.debug:
        return jsonify({'error': 'Not allowed'}), 403
    
    import time
    cleanup_count = 0
    current_time = time.time()
    max_age = 3600  # 1時間
    
    # アップロードフォルダのクリーンアップ
    if os.path.exists(app.config['UPLOAD_FOLDER']):
        for filename in os.listdir(app.config['UPLOAD_FOLDER']):
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            if os.path.isfile(file_path):
                if current_time - os.path.getctime(file_path) > max_age:
                    try:
                        os.remove(file_path)
                        cleanup_count += 1
                    except:
                        pass
    
    # ダウンロードフォルダのクリーンアップ
    if os.path.exists(app.config['DOWNLOAD_FOLDER']):
        for filename in os.listdir(app.config['DOWNLOAD_FOLDER']):
            file_path = os.path.join(app.config['DOWNLOAD_FOLDER'], filename)
            if os.path.isfile(file_path):
                if current_time - os.path.getctime(file_path) > max_age:
                    try:
                        os.remove(file_path)
                        cleanup_count += 1
                    except:
                        pass
    
    return jsonify({'message': f'{cleanup_count} files cleaned up'})

@app.route('/contact', methods=['POST'])
@limiter.limit("5 per hour")
def contact_submit():
    try:
        data = request.get_json()
        
        name = data.get('name', '').strip()
        email = data.get('email', '').strip()
        subject = data.get('subject', '').strip()
        message = data.get('message', '').strip()
        
        # バリデーション
        if not name or not email or not subject or not message:
            return jsonify({'success': False, 'error': '全ての項目を入力してください'}), 400
        
        # メールアドレスの簡易バリデーション
        import re
        email_pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if not re.match(email_pattern, email):
            return jsonify({'success': False, 'error': '有効なメールアドレスを入力してください'}), 400
        
        # ここで実際のメール送信処理を実装
        # 例: SMTPサーバー経由でメール送信、またはデータベースに保存
        
        # ログに記録（本番環境では適切なロギングシステムを使用）
        app.logger.info(f"Contact form submission - Name: {name}, Email: {email}, Subject: {subject}")
        
        # 成功レスポンス
        return jsonify({
            'success': True,
            'message': 'お問い合わせを受け付けました'
        })
        
    except Exception as e:
        app.logger.error(f"Contact form error: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({'success': False, 'error': 'エラーが発生しました'}), 500

if __name__ == '__main__':
    app.run(debug=True)