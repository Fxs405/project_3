const App = {
    currentView: 'bookshelf',
    currentFolder: 'all',
    draggingBookId: null,
    pendingBookId: null,
    pendingReaderId: null,
    
    init() {
        Reader.init();
        this.bindEvents();
        this.loadFolders();
        this.loadBookshelf();
        this.loadHistory();
    },
    
    bindEvents() {
        document.getElementById('btn-library').addEventListener('click', () => {
            this.switchView('bookshelf');
        });
        
        document.getElementById('btn-history').addEventListener('click', () => {
            this.switchView('history');
        });
        
        document.getElementById('btn-settings').addEventListener('click', () => {
            this.showModal('settings-modal');
        });
        
        document.getElementById('btn-upload').addEventListener('click', () => {
            this.triggerUpload();
        });
        
        document.getElementById('btn-add-folder').addEventListener('click', () => {
            this.showModal('folder-modal');
            document.getElementById('folder-name-input').value = '';
            document.getElementById('folder-name-input').focus();
        });
        
        document.getElementById('btn-confirm-folder').addEventListener('click', () => {
            this.createFolder();
        });
        
        document.getElementById('btn-cancel-folder').addEventListener('click', () => {
            this.hideAllModals();
        });
        
        document.getElementById('folder-name-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.createFolder();
            }
        });
        
        document.getElementById('file-input').addEventListener('change', (e) => {
            this.handleFileUpload(e);
        });
        
        document.getElementById('btn-clear-history').addEventListener('click', () => {
            if (confirm('确定要清空所有阅读记录吗？')) {
                Storage.clearHistory();
                this.loadHistory();
            }
        });
        
        document.querySelectorAll('.reader-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = parseInt(tab.dataset.tab);
                ReaderManager.setActiveReader(tabId);
            });
        });
        
        document.getElementById('dual-mode-toggle').addEventListener('change', (e) => {
            ReaderManager.toggleDualMode(e.target.checked);
        });
        
        document.querySelectorAll('.select-book-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const readerId = parseInt(btn.dataset.reader);
                this.showBookSelectModal(readerId);
            });
        });
        
        document.querySelectorAll('.progress-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const readerId = parseInt(e.target.dataset.reader);
                const progress = parseFloat(e.target.value);
                ReaderManager.goToProgress(readerId, progress);
            });
        });
        
        document.querySelectorAll('.prev-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const readerId = parseInt(btn.dataset.reader);
                ReaderManager.prevPage(readerId);
            });
        });
        
        document.querySelectorAll('.next-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const readerId = parseInt(btn.dataset.reader);
                ReaderManager.nextPage(readerId);
            });
        });
        
        document.querySelectorAll('.play-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const readerId = parseInt(btn.dataset.reader);
                ReaderManager.toggleAutoPlay(readerId);
            });
        });
        
        document.querySelectorAll('.chapters-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const readerId = parseInt(btn.dataset.reader);
                ReaderManager.showChapterModal(readerId);
            });
        });
        
        document.querySelectorAll('.speed-decrease').forEach(btn => {
            btn.addEventListener('click', () => {
                const readerId = parseInt(btn.dataset.reader);
                ReaderManager.updateScrollSpeed(readerId, -5);
            });
        });
        
        document.querySelectorAll('.speed-increase').forEach(btn => {
            btn.addEventListener('click', () => {
                const readerId = parseInt(btn.dataset.reader);
                ReaderManager.updateScrollSpeed(readerId, 5);
            });
        });
        
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.hideAllModals();
            });
        });
        
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideAllModals();
                }
            });
        });
        
        document.getElementById('btn-font-increase').addEventListener('click', () => {
            const newSize = Math.min(ReaderManager.getActiveReader().settings.fontSize + 2, 32);
            Reader.updateSettings({ fontSize: newSize });
        });
        
        document.getElementById('btn-font-decrease').addEventListener('click', () => {
            const newSize = Math.max(ReaderManager.getActiveReader().settings.fontSize - 2, 12);
            Reader.updateSettings({ fontSize: newSize });
        });
        
        document.getElementById('font-size-slider').addEventListener('input', (e) => {
            Reader.updateSettings({ fontSize: parseInt(e.target.value) });
        });
        
        document.getElementById('line-height-slider').addEventListener('input', (e) => {
            Reader.updateSettings({ lineHeight: parseFloat(e.target.value) });
        });
        
        document.querySelectorAll('input[name="page-mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                Reader.updateSettings({ pageMode: e.target.value });
            });
        });
        
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                Reader.updateSettings({ theme: theme });
            });
        });
        
        document.getElementById('btn-back-library').addEventListener('click', () => {
            this.goBack();
        });
        
        document.getElementById('btn-reader-settings').addEventListener('click', () => {
            this.showModal('settings-modal');
        });
        
        document.addEventListener('keydown', (e) => {
            if (this.currentView === 'reader') {
                this.handleKeyboard(e);
            }
        });
        
        let touchStartX = 0;
        let touchStartY = 0;
        
        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest('.reader-content');
            if (target) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }
        });
        
        document.addEventListener('touchend', (e) => {
            const target = e.target.closest('.reader-content');
            if (!target) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const deltaX = touchStartX - touchEndX;
            const deltaY = touchStartY - touchEndY;
            
            if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
                const readerPanel = target.closest('.reader-panel');
                if (readerPanel) {
                    const readerId = parseInt(readerPanel.id.split('-')[1]);
                    if (deltaX > 0) {
                        ReaderManager.nextPage(readerId);
                    } else {
                        ReaderManager.prevPage(readerId);
                    }
                }
            }
        });
    },
    
    handleKeyboard(e) {
        const activeReaderId = ReaderManager.activeReaderId;
        
        switch(e.key) {
            case 'ArrowRight':
            case ' ':
                e.preventDefault();
                ReaderManager.nextPage(activeReaderId);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                ReaderManager.prevPage(activeReaderId);
                break;
            case 'ArrowDown':
                e.preventDefault();
                ReaderManager.nextChapter(activeReaderId);
                break;
            case 'ArrowUp':
                e.preventDefault();
                ReaderManager.prevChapter(activeReaderId);
                break;
            case 'Escape':
                this.switchView('bookshelf');
                break;
        }
    },
    
    switchView(viewName) {
        if (this.currentView === 'reader' && viewName !== 'reader') {
            Object.keys(ReaderManager.readers).forEach(id => {
                ReaderManager.closeBook(parseInt(id));
            });
        }
        
        this.currentView = viewName;
        
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
        }
        
        if (viewName === 'bookshelf') {
            this.loadFolders();
            this.loadBookshelf();
        } else if (viewName === 'history') {
            this.loadHistory();
        }
    },
    
    triggerUpload() {
        document.getElementById('file-input').click();
    },
    
    async handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const book = await Parser.parseFile(file);
            
            const existingBooks = Storage.getBooks();
            const existing = existingBooks.find(b => 
                b.title === book.title && b.fileType === book.fileType
            );
            
            if (existing) {
                const overwrite = confirm(`"${book.title}" 已存在于书库中，是否覆盖？`);
                if (!overwrite) {
                    e.target.value = '';
                    return;
                }
                book.progress = existing.progress;
                book.currentChapter = existing.currentChapter;
                book.currentPage = existing.currentPage;
                book.folderId = existing.folderId;
            }
            
            if (this.currentFolder !== 'all') {
                book.folderId = this.currentFolder;
            }
            
            Storage.addBook(book);
            
            if (book.folderId) {
                Storage.addBookToFolder(book.id, book.folderId);
            }
            
            this.loadFolders();
            this.loadBookshelf();
            
            e.target.value = '';
            
            const openNow = confirm(`书籍 "${book.title}" 上传成功！是否立即打开？`);
            if (openNow) {
                this.openBook(book.id);
            }
            
        } catch (error) {
            alert(`上传失败: ${error.message}`);
            e.target.value = '';
        }
    },
    
    loadFolders() {
        const folders = Storage.getFolders();
        const container = document.getElementById('folder-list');
        
        if (folders.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        let html = '';
        folders.forEach(folder => {
            const bookCount = folder.books ? folder.books.length : 0;
            const isActive = this.currentFolder === folder.id ? 'active' : '';
            html += `
                <div class="folder-item ${isActive}" data-folder="${folder.id}" draggable="false">
                    <span class="folder-icon">📁</span>
                    <span class="folder-name">${this.escapeHtml(folder.name)}</span>
                    <span class="folder-count">(${bookCount})</span>
                    <button class="folder-delete" onclick="App.deleteFolder('${folder.id}')">×</button>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        document.querySelectorAll('.folder-item').forEach(folder => {
            folder.addEventListener('click', (e) => {
                if (e.target.classList.contains('folder-delete')) return;
                this.selectFolder(folder.dataset.folder);
            });
            
            folder.addEventListener('dragover', (e) => {
                e.preventDefault();
                folder.classList.add('drag-over');
            });
            
            folder.addEventListener('dragleave', (e) => {
                folder.classList.remove('drag-over');
            });
            
            folder.addEventListener('drop', (e) => {
                e.preventDefault();
                folder.classList.remove('drag-over');
                const bookId = this.draggingBookId;
                const folderId = folder.dataset.folder;
                
                if (bookId && folderId) {
                    if (folderId === 'all') {
                        Storage.addBookToFolder(bookId, null);
                    } else {
                        Storage.addBookToFolder(bookId, folderId);
                    }
                    this.loadFolders();
                    this.loadBookshelf();
                }
                this.draggingBookId = null;
            });
        });
    },
    
    selectFolder(folderId) {
        this.currentFolder = folderId;
        
        document.querySelectorAll('.folder-item').forEach(folder => {
            folder.classList.toggle('active', folder.dataset.folder === folderId);
        });
        
        this.loadBookshelf();
    },
    
    createFolder() {
        const input = document.getElementById('folder-name-input');
        const name = input.value.trim();
        
        if (!name) {
            alert('请输入文件夹名称');
            return;
        }
        
        Storage.addFolder({ name: name });
        this.hideAllModals();
        this.loadFolders();
    },
    
    deleteFolder(folderId) {
        const folder = Storage.getFolders().find(f => f.id === folderId);
        if (!folder) return;
        
        const bookCount = folder.books ? folder.books.length : 0;
        
        let message = `确定要删除文件夹 "${folder.name}" 吗？`;
        if (bookCount > 0) {
            message += `\n该文件夹中有 ${bookCount} 本书籍，删除后书籍将移回"全部书籍"。`;
        }
        
        if (confirm(message)) {
            Storage.removeFolder(folderId);
            if (this.currentFolder === folderId) {
                this.currentFolder = 'all';
            }
            this.loadFolders();
            this.loadBookshelf();
        }
    },
    
    loadBookshelf() {
        let books = Storage.getBooks();
        
        if (this.currentFolder !== 'all') {
            books = books.filter(b => b.folderId === this.currentFolder);
        }
        
        const container = document.getElementById('bookshelf-list');
        
        if (books.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>${this.currentFolder === 'all' ? '书架空空如也，快去上传书籍吧！' : '该文件夹为空'}</p>
                    ${this.currentFolder === 'all' ? '<button id="btn-upload-empty" class="btn-primary" onclick="App.triggerUpload()">📤 上传第一本书</button>' : ''}
                </div>
            `;
            return;
        }
        
        let html = '';
        books.forEach(book => {
            const progress = book.progress || 0;
            const readingTime = Storage.getReadingTime(book.id);
            html += `
                <div class="book-card" data-id="${book.id}" draggable="true">
                    <div class="book-cover">📖</div>
                    <div class="book-info">
                        <div class="book-title" title="${this.escapeHtml(book.title)}">${this.escapeHtml(book.title)}</div>
                        <div class="book-progress">
                            ${progress > 0 ? `进度: ${progress.toFixed(1)}%` : '未阅读'}
                            ${book.author ? ` | ${this.escapeHtml(book.author)}` : ''}
                            ${readingTime > 0 ? `<br>📊 阅读: ${this.formatShortTime(readingTime)}` : ''}
                        </div>
                    </div>
                    <div class="book-card-actions">
                        <button class="btn-icon" onclick="App.openBook('${book.id}')">打开</button>
                        <button class="btn-icon" onclick="App.moveBook('${book.id}')">移动</button>
                        <button class="btn-icon" onclick="App.deleteBook('${book.id}')">删除</button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        document.querySelectorAll('.book-card').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                this.draggingBookId = card.dataset.id;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                this.draggingBookId = null;
            });
        });
    },
    
    formatShortTime(seconds) {
        if (seconds < 60) return `${seconds}秒`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}小时${minutes}分`;
    },
    
    moveBook(bookId) {
        const folders = Storage.getFolders();
        
        if (folders.length === 0) {
            alert('暂无文件夹，请先创建文件夹');
            return;
        }
        
        let options = folders.map(f => `${f.name} (${f.books ? f.books.length : 0}本)`).join('\n');
        const input = prompt(`请选择目标文件夹（输入序号）：\n0. 移到全部书籍\n${folders.map((f, i) => `${i + 1}. ${f.name}`).join('\n')}`);
        
        if (input === null) return;
        
        const index = parseInt(input);
        if (index === 0) {
            Storage.addBookToFolder(bookId, null);
        } else if (index >= 1 && index <= folders.length) {
            Storage.addBookToFolder(bookId, folders[index - 1].id);
        } else {
            alert('无效的序号');
            return;
        }
        
        this.loadFolders();
        this.loadBookshelf();
    },
    
    goBack() {
        this.switchView('bookshelf');
    },
    
    showBookSelectModal(readerId) {
        const books = Storage.getBooks();
        const container = document.getElementById('book-select-list');
        
        if (books.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>书库为空，请先上传书籍</p></div>';
        } else {
            let html = '';
            books.forEach(book => {
                const progress = book.progress || 0;
                html += `
                    <div class="book-select-item" onclick="App.selectBookForReader('${book.id}', ${readerId})">
                        <span class="book-icon">📖</span>
                        <div class="book-info">
                            <div class="book-title">${this.escapeHtml(book.title)}</div>
                            <div class="book-progress">${progress > 0 ? `进度: ${progress.toFixed(1)}%` : '未阅读'}</div>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
        
        this.showModal('select-book-modal');
    },
    
    selectBookForReader(bookId, readerId) {
        this.hideAllModals();
        
        const book = Storage.getBook(bookId);
        if (!book) {
            alert('书籍不存在');
            return;
        }
        
        this.openBookInReader(bookId, readerId);
    },
    
    openBookInReader(bookId, readerId) {
        const book = Storage.getBook(bookId);
        if (!book) {
            alert('书籍不存在');
            return;
        }
        
        this.switchView('reader');
        
        ReaderManager.setActiveReader(readerId);
        ReaderManager.loadBook(readerId, book);
    },
    
    openBook(bookId) {
        const book = Storage.getBook(bookId);
        if (!book) {
            alert('书籍不存在');
            return;
        }
        
        if (ReaderManager.isDualMode) {
            const reader1 = ReaderManager.getReader(1);
            const reader2 = ReaderManager.getReader(2);
            
            if (reader1.currentBook && reader2.currentBook) {
                this.pendingBookId = bookId;
                this.askWhichReader();
                return;
            } else if (!reader1.currentBook) {
                this.openBookInReader(bookId, 1);
            } else {
                this.openBookInReader(bookId, 2);
            }
        } else {
            this.openBookInReader(bookId, 1);
        }
    },
    
    askWhichReader() {
        const result = prompt('请选择要在哪个阅读器中打开：\n1. 阅读器 1\n2. 阅读器 2');
        if (result === '1') {
            this.openBookInReader(this.pendingBookId, 1);
        } else if (result === '2') {
            this.openBookInReader(this.pendingBookId, 2);
        }
        this.pendingBookId = null;
    },
    
    deleteBook(bookId) {
        const book = Storage.getBook(bookId);
        if (!book) return;
        
        if (confirm(`确定要删除 "${book.title}" 吗？`)) {
            Storage.removeBook(bookId);
            this.loadFolders();
            this.loadBookshelf();
        }
    },
    
    loadHistory() {
        const history = Storage.getHistory();
        const readingTimes = Storage.getAllReadingTime();
        const container = document.getElementById('history-list');
        
        if (history.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>暂无阅读记录</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        history.forEach(item => {
            const date = new Date(item.readAt);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            const readingTime = readingTimes[item.id] || 0;
            
            html += `
                <div class="history-item" onclick="App.openBook('${item.id}')">
                    <div class="book-icon">📖</div>
                    <div class="book-details">
                        <div class="book-name">${this.escapeHtml(item.title)}</div>
                        <div class="book-meta">
                            <span>进度: ${(item.progress || 0).toFixed(1)}%</span>
                            <span>📊 累计阅读: ${this.formatShortTime(readingTime)}</span>
                            <span>阅读时间: ${dateStr}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    },
    
    showChapterList() {
        Reader.showChapterModal();
    },
    
    goToChapterFromModal(chapterIndex) {
        const readerId = ReaderManager.currentChapterModalReader;
        if (readerId) {
            ReaderManager.goToChapter(readerId, chapterIndex);
        }
        this.hideAllModals();
    },
    
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    },
    
    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    },
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
