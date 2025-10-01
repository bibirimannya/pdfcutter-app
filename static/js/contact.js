// contact.js - お問い合わせフォーム処理

document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contactForm');
    const submitBtn = document.getElementById('submitBtn');
    const formResult = document.getElementById('formResult');

    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // バリデーション
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const subject = document.getElementById('subject').value;
            const message = document.getElementById('message').value.trim();

            if (!name || !email || !subject || !message) {
                showResult('error', '全ての必須項目を入力してください。');
                return;
            }

            if (!validateEmail(email)) {
                showResult('error', '有効なメールアドレスを入力してください。');
                return;
            }

            // 送信処理
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 送信中...';

            try {
                const response = await fetch('/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: name,
                        email: email,
                        subject: subject,
                        message: message
                    })
                });

                const result = await response.json();

                if (result.success) {
                    showResult('success', 'お問い合わせを受け付けました。ご連絡ありがとうございます。<br>担当者より1-3営業日以内にご返信いたします。');
                    contactForm.reset();
                } else {
                    showResult('error', result.error || '送信に失敗しました。時間をおいて再度お試しください。');
                }
            } catch (error) {
                console.error('Error:', error);
                showResult('error', '送信中にエラーが発生しました。時間をおいて再度お試しください。');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 送信する';
            }
        });
    }

    // FAQアコーディオン
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // 他のFAQを閉じる
            faqItems.forEach(i => i.classList.remove('active'));
            
            // クリックされたFAQを開く/閉じる
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    function showResult(type, message) {
        formResult.className = `form-result ${type}`;
        formResult.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
            <p>${message}</p>
        `;
        formResult.style.display = 'block';
        formResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        if (type === 'success') {
            setTimeout(() => {
                formResult.style.display = 'none';
            }, 10000);
        }
    }
});