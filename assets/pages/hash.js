(function guardHashToolAccess() {
            const token = AuthManager.getToken();
            const role = AuthManager.getRole();
            if (!token || role !== 'Admin') {
                window.location.href = 'login.html';
            }
        })();

        document.getElementById('generateBtn').addEventListener('click', async () => {
            const inputText = document.getElementById('inputText').value;
            const outputText = document.getElementById('outputText');
            const feedback = document.getElementById('feedback');
            
            if (!inputText) {
                feedback.style.color = 'var(--danger-color)';
                feedback.textContent = '❌ Vui lòng nhập chuỗi cần băm!';
                outputText.value = '';
                return;
            }

            try {
                // Gá»i hÃ m sha256 Ä‘Ã£ Ä‘Æ°á»£c export á»Ÿ global (window.sha256) tá»« script.js
                const hashValue = await window.sha256(inputText);
                outputText.value = hashValue;
                
                feedback.style.color = 'var(--success-color)';
                feedback.textContent = '✅ Tạo mã thành công!';
            } catch (error) {
                feedback.style.color = 'var(--danger-color)';
                feedback.textContent = '❌ Lỗi khi tạo mã:' + error.message;
            }
        });

        document.getElementById('copyBtn').addEventListener('click', async () => {
            const outputText = document.getElementById('outputText');
            const feedback = document.getElementById('feedback');

            if (!outputText.value) {
                feedback.style.color = 'var(--danger-color)';
                feedback.textContent = '❌ Chưa có mã để copy!';
                return;
            }

            try {
                await navigator.clipboard.writeText(outputText.value);
                feedback.style.color = 'var(--success-color)';
                feedback.textContent = '📋 Đã copy vào Clipboard!';
                
                // Tráº£ láº¡i thÃ´ng bÃ¡o sau 2 giÃ¢y
                setTimeout(() => {
                    feedback.textContent = '';
                }, 2000);
            } catch (err) {
                // Fallback náº¿u API Clipboard bá»‹ cháº·n
                outputText.select();
                document.execCommand('copy');
                feedback.style.color = 'var(--success-color)';
                feedback.textContent = '📋 Đã copy vào Clipboard!';
            }
        });

        // Há»— trá»£ áº¥n Enter Ä‘á»ƒ táº¡o mÃ£ luÃ´n
        document.getElementById('inputText').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                document.getElementById('generateBtn').click();
            }
        });
