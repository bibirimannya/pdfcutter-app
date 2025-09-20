// Cookie同意管理
class CookieConsent {
    constructor() {
        this.consentCookieName = 'cookie-consent';
        this.analyticsAllowed = false;
        this.adsenseAllowed = false;
        this.init();
    }

    init() {
        // 既存の同意状況をチェック
        const consent = this.getConsent();
        if (consent) {
            this.analyticsAllowed = consent.analytics;
            this.adsenseAllowed = consent.adsense;
            this.loadApprovedServices();
        } else {
            this.showConsentBanner();
        }
    }

    showConsentBanner() {
        const banner = document.createElement('div');
        banner.id = 'cookie-consent-banner';
        banner.innerHTML = `
            <div style="max-width: 1200px; margin: 0 auto;">
                <p>
                    このサイトでは、サービス向上のためにCookieを使用しています。
                    <a href="/privacy" target="_blank">プライバシーポリシー</a>
                </p>
                <button onclick="cookieConsent.acceptAll()">すべて許可</button>
                <button onclick="cookieConsent.acceptNecessaryOnly()" class="decline-btn">必要なもののみ</button>
            </div>
        `;
        document.body.appendChild(banner);
    }

    acceptAll() {
        this.analyticsAllowed = true;
        this.adsenseAllowed = true;
        this.saveConsent();
        this.hideConsentBanner();
        this.loadApprovedServices();
    }

    acceptNecessaryOnly() {
        this.analyticsAllowed = false;
        this.adsenseAllowed = false;
        this.saveConsent();
        this.hideConsentBanner();
    }

    hideConsentBanner() {
        const banner = document.getElementById('cookie-consent-banner');
        if (banner) {
            banner.remove();
        }
    }

    saveConsent() {
        const consent = {
            analytics: this.analyticsAllowed,
            adsense: this.adsenseAllowed,
            timestamp: new Date().getTime()
        };
        localStorage.setItem(this.consentCookieName, JSON.stringify(consent));
        
        // 実際のCookieも設定（30日間）
        const expires = new Date();
        expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000));
        document.cookie = `${this.consentCookieName}=${JSON.stringify(consent)}; expires=${expires.toUTCString()}; path=/`;
    }

    getConsent() {
        try {
            const consent = localStorage.getItem(this.consentCookieName);
            return consent ? JSON.parse(consent) : null;
        } catch (e) {
            return null;
        }
    }

    loadApprovedServices() {
        if (this.adsenseAllowed) {
            this.loadGoogleAdsense();
        }
        // Analytics は後で追加予定
    }

    loadGoogleAdsense() {
        // AdSenseスクリプトを動的に読み込み
        if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
            const script = document.createElement('script');
            script.async = true;
            script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3226248910880387';
            script.crossOrigin = 'anonymous';
            document.head.appendChild(script);

            // スクリプト読み込み完了後に広告を表示
            script.onload = () => {
                this.showAdsenseAds();
            };
        } else {
            this.showAdsenseAds();
        }
    }

    showAdsenseAds() {
        // 広告コンテナを表示
        const adsContainer = document.getElementById('adsense-container');
        if (adsContainer) {
            adsContainer.style.display = 'block';
            
            // AdSense広告を初期化
            try {
                (adsbygoogle = window.adsbygoogle || []).push({});
            } catch (e) {
                console.log('AdSense initialization error:', e);
            }
        }
    }
}

// Cookie同意システムを初期化
let cookieConsent;
document.addEventListener('DOMContentLoaded', function() {
    cookieConsent = new CookieConsent();
});

