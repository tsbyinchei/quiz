/* =======================================================
   CHẾ ĐỘ BẢO TRÌ (SYSTEM UPGRADE) - BẬT / TẮT
   =======================================================
   Để BẬT chế độ bảo trì toàn hệ thống: Đổi MAINTENANCE_MODE = true;
   Để TẮT chế độ bảo trì: Đổi MAINTENANCE_MODE = false;
======================================================= */

const MAINTENANCE_MODE = false;

if (MAINTENANCE_MODE) {
document.write(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hệ Thống Đang Nâng Cấp - TsByin Exam</title>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
            :root {
                --bg: #0a0e1a;
                --surface: rgba(17, 24, 39, 0.6);
                --line: #1e293b;
                --text: #f1f5f9;
                --text-muted: #64748b;
                --cyan: #22d3ee;
                --violet: #a78bfa;
                --grad: linear-gradient(135deg, #22d3ee 0%, #a78bfa 100%);
                --grad-text: linear-gradient(90deg, #22d3ee 0%, #818cf8 55%, #c084fc 100%);
            }
            body, html {
                margin: 0; padding: 0; width: 100%; height: 100%;
                background-color: var(--bg);
                font-family: 'Plus Jakarta Sans', sans-serif;
                color: var(--text); overflow: hidden;
            }

            /* Ambient Glow */
body::before {
    content: ''; position: absolute; inset: 0; z - index: -1; pointer - events: none;
    background:
    radial - gradient(ellipse 70 % 55 % at 100 % 5 %, rgba(34, 211, 238, 0.12) 0 %, transparent 55 %),
        radial - gradient(ellipse 50 % 45 % at 0 % 95 %, rgba(167, 139, 250, 0.1) 0 %, transparent 55 %);
    animation: pulse - bg 8s ease -in -out infinite alternate;
}
@keyframes pulse - bg { 0 % { opacity: 0.6; } 100 % { opacity: 1; } }

#maintenance {
    display: flex; align - items: center; justify - content: center;
    min - height: 100vh; padding: 20px; position: relative; z - index: 1;
}

            /* Main Card */
            .card {
    position: relative; z - index: 10;
    background: var(--surface);
    border: 1px solid var(--line);
    padding: 3.5rem 3rem;
    border - radius: 24px;
    text - align: center;
    max - width: 500px; width: 100 %;
    backdrop - filter: blur(20px);
    -webkit - backdrop - filter: blur(20px);
    box - shadow: 0 25px 50px - 12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
    animation: card - float 6s ease -in -out infinite;
}
@keyframes card - float { 0 %, 100 % { transform: translateY(0); } 50 % { transform: translateY(-8px); } }

            /* Modern Pulse Visual */
            .visual {
    position: relative; width: 100px; height: 100px; margin: 0 auto 2.5rem;
    display: flex; align - items: center; justify - content: center;
}
            .v - ring {
    position: absolute; inset: 0;
    border - radius: 50 %;
    border: 2px solid transparent;
    border - top - color: var(--cyan);
    border - left - color: rgba(34, 211, 238, 0.2);
    animation: spin 2s linear infinite;
}
            .v - ring - inner {
    position: absolute; inset: 12px;
    border - radius: 50 %;
    border: 2px solid transparent;
    border - bottom - color: var(--violet);
    border - right - color: rgba(167, 139, 250, 0.2);
    animation: spin - reverse 3s linear infinite;
}
@keyframes spin { 100 % { transform: rotate(360deg); } }
@keyframes spin - reverse { 100 % { transform: rotate(-360deg); } }
            
            .v - icon {
    position: relative; z - index: 2;
    color: var(--cyan);
    animation: icon - pulse 2s ease -in -out infinite;
    filter: drop - shadow(0 0 10px rgba(34, 211, 238, 0.3));
}
@keyframes icon - pulse { 0 %, 100 % { transform: scale(1); } 50 % { transform: scale(1.05); } }

            .badge {
    display: inline - flex; align - items: center; gap: 8px;
    padding: 6px 14px; border - radius: 30px; font - size: 0.72rem; font - weight: 700;
    background: rgba(34, 211, 238, 0.08); border: 1px solid rgba(34, 211, 238, 0.25);
    color: var(--cyan); text - transform: uppercase; letter - spacing: 1.5px; margin - bottom: 1.5rem;
}
            .badge - dot { width: 6px; height: 6px; border - radius: 50 %; background: var(--cyan); box - shadow: 0 0 8px var(--cyan); animation: dot - pulse 2s infinite; }
@keyframes dot - pulse { 0 %, 100 % { opacity: 1; } 50 % { opacity: 0.3; } }

            h1 {
    font - family: 'Space Grotesk', sans - serif; font - size: 2.2rem; font - weight: 700; margin: 0 0 1rem;
    background: var(--grad - text);
    -webkit - background - clip: text; background - clip: text; -webkit - text - fill - color: transparent;
    letter - spacing: -0.5px; line - height: 1.2;
}
            p { font - size: 1rem; color: var(--text - muted); line - height: 1.65; margin: 0 0 2.5rem; font - weight: 400; }

            /* Progress Line */
            .progress - container { width: 100 %; height: 4px; background: rgba(255, 255, 255, 0.05); border - radius: 4px; overflow: hidden; position: relative; }
            .progress - bar {
    position: absolute; top: 0; left: 0; bottom: 0; width: 30 %; border - radius: 4px;
    background: var(--grad); box - shadow: 0 0 15px rgba(34, 211, 238, 0.4);
    animation: scan 2s ease -in -out infinite alternate;
}
@keyframes scan { 0 % { width: 10 %; left: 0; } 100 % { width: 40 %; left: 60 %; } }

@media(max - width: 600px) { 
                .card { padding: 2.5rem 1.5rem; } 
                h1 { font - size: 1.8rem; }
}
        </style>
    </head>
    <body>
        <div id="maintenance">
            <div class="card">
                <div class="visual">
                    <div class="v-ring"></div>
                    <div class="v-ring-inner"></div>
                    <div class="v-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="url(#cyan-grad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <defs>
                                <linearGradient id="cyan-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="#22d3ee" />
                                    <stop offset="100%" stop-color="#a78bfa" />
                                </linearGradient>
                            </defs>
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                    </div>
                </div>

                <div class="badge"><div class="badge-dot"></div> System Upgrade</div>

                <h1>Hệ Thống Đang Nâng Cấp</h1>
                <p>Hệ thống thi trắc nghiệm đang bảo trì để tối ưu hóa hiệu năng và cập nhật tính năng mới. Vui lòng quay lại sau!</p>

                <div class="progress-container"><div class="progress-bar"></div></div>
            </div>
        </div>
    </body>
    </html>
`);
window.stop();
}
