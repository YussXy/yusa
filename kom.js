// ================================================
// KONFIGURASI APPWRITE (PASTIKAN DI PALING ATAS)
// ================================================
const APPWRITE_ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
const APPWRITE_PROJECT = '6a3d1616000abdd5a4d9';
const APPWRITE_DATABASE = '6a3d1845df327cf5c492';
const APPWRITE_COLLECTION = '6a3d187243d8858b71ce';
const APPWRITE_KEY = 'standard_81f8353dd029a1f6fb7b3bf699339d894fab2d45f23b5db07feb1df25f931df31979ce9b0876a9126160c2094cdcc72b4625a5243f7ba7a595b0d8c63c118694009c54e766e9e1a54ce8e1d73818bfc787770d38cfaf082067fb2cfe19f63d0a1b32f9b728184b56f5d27942b9168dfe1d2265aa69427a0945900760b0e72017';

const CHAT_ROOM = 'yussxy-public';

// ================================================
// INISIALISASI CLIENT & DATABASES (DI PALING ATAS)
// ================================================
const client = new Appwrite.Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT);

client.headers = {
    ...client.headers,
    'X-Appwrite-Key': APPWRITE_KEY
};

const databases = new Appwrite.Databases(client);

console.log('✅ Appwrite client initialized');

// ================================================
// AMBIL DATA USER (SEBELUM FUNGSI LAIN)
// ================================================
let currentUser = null;
try {
    const raw = localStorage.getItem('app_user');
    if (raw) currentUser = JSON.parse(raw);
} catch(e) {}

// DEKLARASIKAN username DAN userId DI SINI (SEBELUM DIGUNAKAN)
const username = currentUser?.username || currentUser?.name || 'Guest';
const userId = currentUser?.id || currentUser?.device_id || `guest_${Date.now()}`;

console.log('👤 User:', username, 'ID:', userId);

// ================================================
// STATE GLOBAL
// ================================================
let messages = [];
let replyTarget = null;
let isProcessing = false;
let isTyping = false;
let typingTimeout = null;
let lastMessageId = null;

// ================================================
// AMBIL ELEMEN DOM (UNTUK KOM.HTML)
// ================================================
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');
const replyPreview = document.getElementById('replyPreview');
const replyPreviewText = document.getElementById('replyPreviewText');
const cancelReplyBtn = document.getElementById('cancelReplyBtn');

// ================================================
// FUNGSI UTILITY
// ================================================
function getTime() {
    return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
    setTimeout(() => {
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }, 50);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getReplyPreviewText(msg) {
    const maxLen = 40;
    let text = msg.content || '';
    if (text.length > maxLen) text = text.substring(0, maxLen) + '...';
    return text;
}

// ================================================
// FUNGSI LOAD MESSAGES (UNTUK KOM.HTML)
// ================================================
async function loadMessages() {
    if (!messagesContainer) return;
    try {
        const response = await databases.listDocuments(
            APPWRITE_DATABASE,
            APPWRITE_COLLECTION,
            [
                Appwrite.Query.equal('room', CHAT_ROOM),
                Appwrite.Query.orderDesc('$createdAt'),
                Appwrite.Query.limit(100)
            ]
        );

        messages = response.documents.reverse();
        renderMessages();
    } catch (err) {
        console.error('Gagal load pesan:', err);
        messagesContainer.innerHTML = `
            <div class="empty-chat">
                <i class="ri-error-warning-line"></i>
                <p>Gagal memuat pesan</p>
                <p style="font-size:12px;color:#ef4444;">${escapeHtml(err.message)}</p>
            </div>
        `;
    }
}

function renderMessages() {
    if (!messagesContainer) return;
    if (messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="empty-chat">
                <i class="ri-chat-smile-3-line"></i>
                <p>Belum ada pesan. Mulai chat!</p>
                <p style="font-size:12px;margin-top:4px;">${escapeHtml(username)} terhubung</p>
            </div>
        `;
        return;
    }

    let html = '';
    let lastDate = '';

    messages.forEach((msg) => {
        const isOwn = msg.user_id === userId || msg.username === username;
        const msgDate = new Date(msg.$createdAt);
        const dateStr = msgDate.toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        if (dateStr !== lastDate) {
            html += `<div class="message-date-divider"><span>${dateStr}</span></div>`;
            lastDate = dateStr;
        }

        const time = msgDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const senderName = msg.username || 'Anonymous';

        let replyHtml = '';
        let replyAvatar = '../image/logo/logo.jpg';
        if (msg.reply_to) {
            const repliedMsg = messages.find(m => m.$id === msg.reply_to);
            if (repliedMsg) {
                const repliedName = repliedMsg.username || 'Anonymous';
                const repliedText = getReplyPreviewText(repliedMsg);
                replyHtml = `
                    <div class="message-reply">
                        <img src="${replyAvatar}" class="reply-avatar" onerror="this.src='../image/logo/logo.jpg'">
                        <div class="reply-content">
                            <div class="reply-name">${escapeHtml(repliedName)}</div>
                            <div class="reply-text">${escapeHtml(repliedText)}</div>
                        </div>
                    </div>
                `;
            }
        }

        html += `
            <div class="message-wrapper ${isOwn ? 'own' : 'other'}" data-msg-id="${msg.$id}" data-msg-user="${msg.user_id}">
                <div class="message-bubble">
                    ${!isOwn ? `<div class="message-sender">${escapeHtml(senderName)}</div>` : ''}
                    ${replyHtml}
                    ${escapeHtml(msg.content)}
                    <div class="message-time">${time}</div>
                </div>
                <div class="message-actions">
                    <button class="message-action-btn reply-btn" onclick="startReply('${msg.$id}')"><i class="ri-reply-line"></i></button>
                </div>
            </div>
        `;
    });

    messagesContainer.innerHTML = html;
    scrollToBottom();
    setupSwipeReply();

    if (messages.length > 0) {
        lastMessageId = messages[messages.length - 1].$id;
    }
}

function setupSwipeReply() {
    let startX = 0;
    let currentWrapper = null;
    let isDragging = false;

    document.querySelectorAll('.message-wrapper').forEach(el => {
        el.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            currentWrapper = el;
            isDragging = true;
        }, { passive: true });

        el.addEventListener('touchmove', (e) => {
            if (!isDragging || !currentWrapper) return;
            const deltaX = e.touches[0].clientX - startX;
            if (deltaX > 30) {
                currentWrapper.classList.add('swiped');
                const msgId = currentWrapper.dataset.msgId;
                const msg = messages.find(m => m.$id === msgId);
                if (msg && msg.user_id !== userId) {
                    startReply(msgId);
                    setTimeout(() => {
                        if (currentWrapper) {
                            currentWrapper.classList.remove('swiped');
                        }
                    }, 300);
                }
                isDragging = false;
            }
        }, { passive: true });

        el.addEventListener('touchend', () => {
            if (currentWrapper) {
                currentWrapper.classList.remove('swiped');
            }
            isDragging = false;
            currentWrapper = null;
        }, { passive: true });
    });
}

function startReply(msgId) {
    const msg = messages.find(m => m.$id === msgId);
    if (!msg || msg.user_id === userId) return;
    replyTarget = msgId;
    if (replyPreviewText) replyPreviewText.textContent = getReplyPreviewText(msg);
    if (replyPreview) replyPreview.style.display = 'block';
    if (messageInput) messageInput.focus();
}

function cancelReply() {
    replyTarget = null;
    if (replyPreview) replyPreview.style.display = 'none';
    if (replyPreviewText) replyPreviewText.textContent = '';
}

async function checkNewMessages() {
    try {
        const response = await databases.listDocuments(
            APPWRITE_DATABASE,
            APPWRITE_COLLECTION,
            [
                Appwrite.Query.equal('room', CHAT_ROOM),
                Appwrite.Query.orderDesc('$createdAt'),
                Appwrite.Query.limit(1)
            ]
        );

        if (response.documents.length > 0) {
            const latest = response.documents[0];
            if (latest.$id !== lastMessageId) {
                lastMessageId = latest.$id;
                await loadMessages();
            }
        }
    } catch (err) {}
}

async function sendMessage() {
    const content = messageInput?.value?.trim();
    if (!content || isProcessing) return;

    isProcessing = true;
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<div style="width:20px;height:20px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;"></div>';
    }

    try {
        const payload = {
            room: CHAT_ROOM,
            user_id: userId,
            username: username,
            content: content
        };

        if (replyTarget) {
            payload.reply_to = replyTarget;
        }

        await databases.createDocument(
            APPWRITE_DATABASE,
            APPWRITE_COLLECTION,
            'unique()',
            payload
        );

        if (messageInput) messageInput.value = '';
        clearTyping();
        cancelReply();
        await loadMessages();

    } catch (err) {
        console.error('Gagal kirim:', err);
        alert('Gagal kirim pesan: ' + err.message);
    }

    isProcessing = false;
    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="ri-send-plane-fill"></i>';
    }
}

function setTyping() {
    if (!isTyping) {
        isTyping = true;
        if (typingIndicator) {
            typingIndicator.textContent = `${escapeHtml(username)} sedang mengetik...`;
        }
    }
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(clearTyping, 3000);
}

function clearTyping() {
    isTyping = false;
    if (typingIndicator) typingIndicator.textContent = '';
    clearTimeout(typingTimeout);
}

function subscribeMessages() {
    const subscription = client.subscribe(
        `databases.${APPWRITE_DATABASE}.collections.${APPWRITE_COLLECTION}.documents`,
        (response) => {
            if (response.event === 'database.documents.create') {
                const newMsg = response.payload;
                if (newMsg.room === CHAT_ROOM && newMsg.$id !== lastMessageId) {
                    const exists = messages.some(m => m.$id === newMsg.$id);
                    if (!exists) {
                        messages.push(newMsg);
                        renderMessages();
                    }
                }
            }
        }
    );
    return subscription;
}

function initUser() {
    try {
        const raw = localStorage.getItem('app_user');
        if (raw) {
            currentUser = JSON.parse(raw);
            const avatar = document.getElementById('headerAvatar');
            if (avatar) avatar.src = '../image/logo/logo.jpg';
            return !!currentUser;
        }
        return false;
    } catch (e) {
        return false;
    }
}

// ================================================
// FUNGSI BACKGROUND (TETAP SAMA)
// ================================================
function initBackground() {
    const savedBg = localStorage.getItem('chat_bg');
    const savedBlur = localStorage.getItem('chat_bg_blur') || 8;
    const savedDark = localStorage.getItem('chat_bg_dark') || 40;
    const chatBody = document.getElementById('chatBody');
    const bgEl = document.getElementById('chatBodyBg');
    const header = document.getElementById('chatHeader');
    const inputArea = document.getElementById('inputArea');

    if (!chatBody || !bgEl) return;

    if (savedBg && savedBg.startsWith('data:')) {
        bgEl.style.backgroundImage = `url(${savedBg})`;
        bgEl.style.backgroundSize = 'cover';
        bgEl.style.backgroundPosition = 'center';
        chatBody.classList.add('has-bg');
        if (header) header.classList.add('has-bg');
        if (inputArea) inputArea.classList.add('has-bg');
        
        const blurVal = parseInt(savedBlur);
        const darkVal = parseInt(savedDark) / 100;
        bgEl.style.filter = `blur(${blurVal}px)`;
        bgEl.style.setProperty('--dark-overlay', darkVal);
        
        const blurRange = document.getElementById('bgBlurRange');
        const darkRange = document.getElementById('bgDarkRange');
        if (blurRange) {
            blurRange.value = blurVal;
            document.getElementById('bgBlurValue').textContent = blurVal + 'px';
        }
        if (darkRange) {
            darkRange.value = savedDark;
            document.getElementById('bgDarkValue').textContent = savedDark + '%';
        }
        
    } else if (savedBg && savedBg !== 'default') {
        chatBody.classList.remove('has-bg');
        if (header) header.classList.remove('has-bg');
        if (inputArea) inputArea.classList.remove('has-bg');
        bgEl.style.backgroundImage = '';
        bgEl.style.filter = 'none';
        chatBody.className = `chat-body bg-${savedBg}`;
    } else {
        chatBody.classList.remove('has-bg');
        if (header) header.classList.remove('has-bg');
        if (inputArea) inputArea.classList.remove('has-bg');
        bgEl.style.backgroundImage = '';
        bgEl.style.filter = 'none';
        chatBody.className = 'chat-body bg-default';
    }
}

function initBgModal() {
    const modal = document.getElementById('bgModal');
    const openBtn = document.getElementById('bgToggleBtn');
    const closeBtn = document.getElementById('bgModalClose');
    const bgOptions = document.querySelectorAll('.bg-option');
    const fileInput = document.getElementById('bgFileInput');
    const blurRange = document.getElementById('bgBlurRange');
    const darkRange = document.getElementById('bgDarkRange');

    if (openBtn) {
        openBtn.addEventListener('click', () => {
            if (modal) modal.classList.add('active');
        });
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modal) modal.classList.remove('active');
        });
    }
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }

    bgOptions.forEach(option => {
        option.addEventListener('click', function() {
            const bg = this.dataset.bg;
            bgOptions.forEach(o => o.classList.remove('active'));
            this.classList.add('active');
            localStorage.setItem('chat_bg', bg);
            const chatBody = document.getElementById('chatBody');
            const bgEl = document.getElementById('chatBodyBg');
            const header = document.getElementById('chatHeader');
            const inputArea = document.getElementById('inputArea');
            
            if (bg === 'default') {
                chatBody.classList.remove('has-bg');
                if (header) header.classList.remove('has-bg');
                if (inputArea) inputArea.classList.remove('has-bg');
                bgEl.style.backgroundImage = '';
                bgEl.style.filter = 'none';
                chatBody.className = 'chat-body bg-default';
            } else {
                chatBody.classList.remove('has-bg');
                if (header) header.classList.remove('has-bg');
                if (inputArea) inputArea.classList.remove('has-bg');
                bgEl.style.backgroundImage = '';
                bgEl.style.filter = 'none';
                chatBody.className = `chat-body bg-${bg}`;
            }
            if (modal) modal.classList.remove('active');
        });
    });

    const savedBg = localStorage.getItem('chat_bg');
    if (savedBg && !savedBg.startsWith('data:') && savedBg !== 'default') {
        bgOptions.forEach(opt => {
            if (opt.dataset.bg === savedBg) opt.classList.add('active');
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = this.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                const dataUrl = ev.target.result;
                localStorage.setItem('chat_bg', dataUrl);
                const chatBody = document.getElementById('chatBody');
                const bgEl = document.getElementById('chatBodyBg');
                const header = document.getElementById('chatHeader');
                const inputArea = document.getElementById('inputArea');
                
                chatBody.classList.add('has-bg');
                if (header) header.classList.add('has-bg');
                if (inputArea) inputArea.classList.add('has-bg');
                bgEl.style.backgroundImage = `url(${dataUrl})`;
                bgEl.style.backgroundSize = 'cover';
                bgEl.style.backgroundPosition = 'center';
                
                const blurVal = parseInt(blurRange.value);
                const darkVal = parseInt(darkRange.value) / 100;
                bgEl.style.filter = `blur(${blurVal}px)`;
                bgEl.style.setProperty('--dark-overlay', darkVal);
                localStorage.setItem('chat_bg_blur', blurVal);
                localStorage.setItem('chat_bg_dark', darkRange.value);
                
                bgOptions.forEach(o => o.classList.remove('active'));
                if (modal) modal.classList.remove('active');
            };
            reader.readAsDataURL(file);
        });
    }

    if (blurRange) {
        blurRange.addEventListener('input', function() {
            const val = this.value;
            document.getElementById('bgBlurValue').textContent = val + 'px';
            const bgEl = document.getElementById('chatBodyBg');
            if (bgEl && document.getElementById('chatBody').classList.contains('has-bg')) {
                bgEl.style.filter = `blur(${val}px)`;
            }
            localStorage.setItem('chat_bg_blur', val);
        });
    }

    if (darkRange) {
        darkRange.addEventListener('input', function() {
            const val = this.value;
            document.getElementById('bgDarkValue').textContent = val + '%';
            const bgEl = document.getElementById('chatBodyBg');
            if (bgEl && document.getElementById('chatBody').classList.contains('has-bg')) {
                const darkVal = val / 100;
                bgEl.style.setProperty('--dark-overlay', darkVal);
            }
            localStorage.setItem('chat_bg_dark', val);
        });
    }

    const savedCustom = localStorage.getItem('chat_bg');
    if (savedCustom && savedCustom.startsWith('data:')) {
        const chatBody = document.getElementById('chatBody');
        const bgEl = document.getElementById('chatBodyBg');
        const header = document.getElementById('chatHeader');
        const inputArea = document.getElementById('inputArea');
        if (chatBody && bgEl) {
            chatBody.classList.add('has-bg');
            if (header) header.classList.add('has-bg');
            if (inputArea) inputArea.classList.add('has-bg');
            bgEl.style.backgroundImage = `url(${savedCustom})`;
            bgEl.style.backgroundSize = 'cover';
            bgEl.style.backgroundPosition = 'center';
            
            const savedBlur = localStorage.getItem('chat_bg_blur') || 8;
            const savedDark = localStorage.getItem('chat_bg_dark') || 40;
            bgEl.style.filter = `blur(${savedBlur}px)`;
            bgEl.style.setProperty('--dark-overlay', savedDark / 100);
            
            if (blurRange) {
                blurRange.value = savedBlur;
                document.getElementById('bgBlurValue').textContent = savedBlur + 'px';
            }
            if (darkRange) {
                darkRange.value = savedDark;
                document.getElementById('bgDarkValue').textContent = savedDark + '%';
            }
        }
    }
}

// ================================================
// INIT UNTUK KOM.HTML
// ================================================
function init() {
    if (!initUser()) {
        window.location.href = '../mm/mm.html';
        return;
    }

    initBackground();
    initBgModal();

    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = '../index.html';
        });
    }

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        messageInput.addEventListener('input', () => {
            if (messageInput.value.trim()) setTyping();
            else clearTyping();
        });
    }

    if (cancelReplyBtn) cancelReplyBtn.addEventListener('click', cancelReply);

    loadMessages();
    subscribeMessages();

    setInterval(checkNewMessages, 2000);

    console.log('💬 Chat loaded! User:', username);
}

// ================================================
// FUNGSI WIDGET UNTUK SPECIAL PAGE
// ================================================

// Fungsi untuk memuat pesan ke widget
async function loadWidgetMessages() {
    const container = document.getElementById('chatRoomMessages');
    if (!container) {
        console.log('⏳ Container chatRoomMessages belum siap');
        return;
    }
    
    console.log('📥 Memuat pesan untuk widget...');
    
    try {
        const response = await databases.listDocuments(
            APPWRITE_DATABASE,
            APPWRITE_COLLECTION,
            [
                Appwrite.Query.equal('room', CHAT_ROOM),
                Appwrite.Query.orderDesc('$createdAt'),
                Appwrite.Query.limit(50)
            ]
        );

        const msgs = response.documents.reverse();
        console.log('📨 Pesan ditemukan:', msgs.length);
        
        if (msgs.length === 0) {
            container.innerHTML = `
                <div class="empty-chat">
                    <i class="ri-chat-smile-3-line"></i>
                    <p>Belum ada pesan. Mulai chat!</p>
                    <p style="font-size:12px;color:var(--text-secondary);margin-top:8px;">Kirim pesan pertama kamu!</p>
                </div>
            `;
            return;
        }

        let html = '';
        let lastDate = '';

        msgs.forEach((msg) => {
            const isOwn = msg.user_id === userId || msg.username === username;
            const msgDate = new Date(msg.$createdAt);
            const dateStr = msgDate.toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric'
            });

            if (dateStr !== lastDate) {
                html += `<div class="message-date-divider"><span>${dateStr}</span></div>`;
                lastDate = dateStr;
            }

            const time = msgDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            const senderName = msg.username || 'Anonymous';

            let replyHtml = '';
            if (msg.reply_to) {
                const repliedMsg = msgs.find(m => m.$id === msg.reply_to);
                if (repliedMsg) {
                    const repliedName = repliedMsg.username || 'Anonymous';
                    const repliedText = (repliedMsg.content || '').substring(0, 30) + '...';
                    replyHtml = `
                        <div class="message-reply">
                            <div class="reply-content">
                                <div class="reply-name">${escapeHtml(repliedName)}</div>
                                <div class="reply-text">${escapeHtml(repliedText)}</div>
                            </div>
                        </div>
                    `;
                }
            }

            html += `
                <div class="message-wrapper ${isOwn ? 'own' : 'other'}" data-msg-id="${msg.$id}" data-msg-user="${msg.user_id}">
                    <div class="message-bubble">
                        ${!isOwn ? `<div class="message-sender">${escapeHtml(senderName)}</div>` : ''}
                        ${replyHtml}
                        ${escapeHtml(msg.content)}
                        <div class="message-time">${time}</div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
        
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 100);
        
    } catch (err) {
        console.error('❌ Gagal load widget messages:', err);
        container.innerHTML = `
            <div class="empty-chat">
                <i class="ri-error-warning-line"></i>
                <p>Gagal memuat pesan</p>
                <p style="font-size:11px;color:#ef4444;margin-top:6px;">${escapeHtml(err.message || 'Unknown error')}</p>
                <button onclick="loadWidgetMessages()" 
                        style="margin-top:12px;padding:8px 20px;background:#0a7e8c;border:none;border-radius:20px;color:white;cursor:pointer;">
                    <i class="ri-refresh-line"></i> Coba Lagi
                </button>
            </div>
        `;
    }
}

// Fungsi untuk mengirim pesan dari widget
async function sendWidgetMessage() {
    const input = document.getElementById('chatRoomInput');
    const content = input?.value?.trim();
    if (!content || isProcessing) return;

    console.log('📤 Mengirim pesan:', content);

    isProcessing = true;
    const sendBtn = document.getElementById('chatRoomSendBtn');
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<div style="width:18px;height:18px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;"></div>';
    }

    try {
        const payload = {
            room: CHAT_ROOM,
            user_id: userId,
            username: username,
            content: content
        };

        if (window.widgetReplyTarget) {
            payload.reply_to = window.widgetReplyTarget;
            window.widgetReplyTarget = null;
            const preview = document.getElementById('chatRoomReplyPreview');
            if (preview) preview.style.display = 'none';
        }

        await databases.createDocument(
            APPWRITE_DATABASE,
            APPWRITE_COLLECTION,
            'unique()',
            payload
        );

        if (input) input.value = '';
        await loadWidgetMessages();

    } catch (err) {
        console.error('❌ Gagal kirim:', err);
        alert('Gagal kirim pesan: ' + err.message);
    }

    isProcessing = false;
    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="ri-send-plane-fill"></i>';
    }
}

// Fungsi untuk reply dari widget
function widgetStartReply(msgId) {
    console.log('💬 Reply ke:', msgId);
    
    const container = document.getElementById('chatRoomMessages');
    if (!container) return;
    
    const msgEl = container.querySelector(`.message-wrapper[data-msg-id="${msgId}"]`);
    if (!msgEl) {
        console.log('⚠️ Pesan tidak ditemukan di container');
        return;
    }
    
    if (msgEl.classList.contains('own')) {
        console.log('⚠️ Tidak bisa reply ke pesan sendiri');
        return;
    }
    
    window.widgetReplyTarget = msgId;
    const preview = document.getElementById('chatRoomReplyPreview');
    const text = document.getElementById('chatRoomReplyText');
    
    const bubble = msgEl.querySelector('.message-bubble');
    let msgText = '';
    if (bubble) {
        const children = bubble.childNodes;
        for (const node of children) {
            if (node.nodeType === 3) {
                msgText = node.textContent.trim();
                break;
            }
        }
        if (!msgText) {
            msgText = bubble.textContent.trim();
        }
    }
    
    if (preview) preview.style.display = 'block';
    if (text) text.textContent = (msgText || 'Pesan').substring(0, 40) + '...';
    
    const input = document.getElementById('chatRoomInput');
    if (input) input.focus();
}

function widgetCancelReply() {
    window.widgetReplyTarget = null;
    const preview = document.getElementById('chatRoomReplyPreview');
    if (preview) preview.style.display = 'none';
}

// Subscribe untuk widget
function subscribeWidgetMessages() {
    try {
        const subscription = client.subscribe(
            `databases.${APPWRITE_DATABASE}.collections.${APPWRITE_COLLECTION}.documents`,
            (response) => {
                if (response.event === 'database.documents.create') {
                    const newMsg = response.payload;
                    if (newMsg.room === CHAT_ROOM) {
                        console.log('📨 Pesan baru:', newMsg.content);
                        loadWidgetMessages();
                    }
                }
            }
        );
        console.log('✅ Subscribsi widget aktif');
        return subscription;
    } catch (err) {
        console.error('❌ Gagal subscribe:', err);
        return null;
    }
}

// Setup swipe untuk widget
function setupWidgetSwipe() {
    const container = document.getElementById('chatRoomMessages');
    if (!container) return;
    
    let startX = 0;
    let currentEl = null;
    let isDragging = false;
    
    container.addEventListener('touchstart', (e) => {
        const wrapper = e.target.closest('.message-wrapper');
        if (!wrapper) return;
        if (wrapper.classList.contains('own')) return;
        startX = e.touches[0].clientX;
        currentEl = wrapper;
        isDragging = true;
    }, { passive: true });
    
    container.addEventListener('touchmove', (e) => {
        if (!isDragging || !currentEl) return;
        const deltaX = e.touches[0].clientX - startX;
        if (deltaX > 30) {
            const msgId = currentEl.dataset.msgId;
            if (msgId) {
                widgetStartReply(msgId);
            }
            isDragging = false;
        }
    }, { passive: true });
    
    container.addEventListener('touchend', () => {
        isDragging = false;
        currentEl = null;
    }, { passive: true });
}

// INISIALISASI WIDGET (DIPANGGIL DARI SCRIPT.JS)
function initChatWidget() {
    console.log('🚀 Inisialisasi Chat Widget...');
    
    const container = document.getElementById('chatRoomMessages');
    if (!container) {
        console.log('❌ Container chatRoomMessages tidak ditemukan');
        return;
    }
    
    // Update username di footer
    const nameEl = document.getElementById('chatRoomUsername');
    if (nameEl) nameEl.textContent = username;
    
    // Load messages
    loadWidgetMessages();
    
    // Subscribe
    subscribeWidgetMessages();
    
    // Setup swipe
    setupWidgetSwipe();
    
    // Event listeners - GUNAKAN CLONE UNTUK MENGHINDARI DUPLIKAT
    const sendBtn = document.getElementById('chatRoomSendBtn');
    const input = document.getElementById('chatRoomInput');
    const cancelBtn = document.getElementById('chatRoomCancelReply');
    const expandBtn = document.getElementById('chatRoomExpandBtn');
    
    if (sendBtn) {
        const newSendBtn = sendBtn.cloneNode(true);
        sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
        newSendBtn.addEventListener('click', sendWidgetMessage);
        console.log('✅ Send button ready');
    }
    
    if (input) {
        const newInput = input.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        newInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendWidgetMessage();
            }
        });
        console.log('✅ Input ready');
    }
    
    if (cancelBtn) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', widgetCancelReply);
    }
    
    if (expandBtn) {
        const newExpandBtn = expandBtn.cloneNode(true);
        expandBtn.parentNode.replaceChild(newExpandBtn, expandBtn);
        newExpandBtn.addEventListener('click', function() {
            window.location.href = 'kom/kom.html';
        });
    }
    
    console.log('✅ Chat Widget siap! User:', username);
}

// ================================================
// EKSPOR KE GLOBAL
// ================================================
window.initChatWidget = initChatWidget;
window.sendWidgetMessage = sendWidgetMessage;
window.widgetStartReply = widgetStartReply;
window.widgetCancelReply = widgetCancelReply;
window.loadWidgetMessages = loadWidgetMessages;

console.log('✅ Chat Widget functions exported!');

// ================================================
// JALANKAN INIT UNTUK KOM.HTML
// ================================================
document.addEventListener('DOMContentLoaded', init);