import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 10 * 1024 * 1024))  # 10MB
    
    # 絶対パスに修正
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads')
    DOWNLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'downloads')
    
    MAX_FILES_PER_REQUEST = 10
    MAX_PAGES_PER_PDF = 100

 # Google Analytics設定（★この1行だけ追加）
    GA_MEASUREMENT_ID = os.environ.get('GA_MEASUREMENT_ID', '')
