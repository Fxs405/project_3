const ReaderManager = {
    readers: {},
    activeReaderId: 1,
    isDualMode: false,
    readingStartTime: null,
    currentReadingTime: 0,
    readingTimer: null,
    currentChapterModalReader: null,
    
    init() {
        this.createReader(1);
        this.createReader(2);
    },
    
    createReader(readerId) {
        this.readers[readerId] = {
            id: readerId,
            currentBook: null,
            currentChapterIndex: 0,
            currentPageIndex: 0,
            pages: [],
            isPlaying: false,
            playInterval: null,
            scrollInterval: null,
            scrollAccumulator: 0,
            settings: {
                fontSize: 16,
                lineHeight: 1.8,
                pageMode: 'scroll',
                autoScrollSpeed: 30,
                autoPlaySpeed: 1500,
                theme: 'light'
            }
        };
        
        const savedSettings = Storage.getSettings();
        if (savedSettings) {
            this.readers[readerId].settings = { ...this.readers[readerId].settings, ...savedSettings };
        }
    },
    
    getActiveReader() {
        return this.readers[this.activeReaderId];
    },
    
    getReader(readerId) {
        return this.readers[readerId];
    },
    
    setActiveReader(readerId) {
        this.activeReaderId = readerId;
        
        document.querySelectorAll('.reader-tab').forEach(tab => {
            tab.classList.toggle('active', parseInt(tab.dataset.tab) === readerId);
        });
        
        document.querySelectorAll('.reader-panel').forEach(panel => {
            const panelId = parseInt(panel.id.split('-')[1]);
            const isActive = panelId === readerId;
            panel.classList.toggle('active', isActive);
            
            if (!this.isDualMode) {
                panel.style.display = isActive ? 'flex' : 'none';
            }
        });
        
        this.updateSettingsUI();
    },
    
    toggleDualMode(enabled) {
        this.isDualMode = enabled;
        const container = document.getElementById('reader-container');
        const reader1 = document.getElementById('reader-1');
        const reader2 = document.getElementById('reader-2');
        
        if (enabled) {
            container.classList.add('dual-reader');
            if (reader1) {
                reader1.classList.add('dual-mode');
                reader1.style.display = 'flex';
            }
            if (reader2) {
                reader2.classList.add('dual-mode');
                reader2.style.display = 'flex';
            }
        } else {
            container.classList.remove('dual-reader');
            if (reader1) {
                reader1.classList.remove('dual-mode');
            }
            if (reader2) {
                reader2.classList.remove('dual-mode');
            }
            this.setActiveReader(this.activeReaderId);
        }
    },
    
    startReadingTimer() {
        this.readingStartTime = Date.now();
        this.currentReadingTime = 0;
        
        if (this.readingTimer) {
            clearInterval(this.readingTimer);
        }
        
        this.readingTimer = setInterval(() => {
            this.currentReadingTime += 1;
            this.updateReadingTimeDisplay();
            
            if (this.isDualMode) {
                Object.values(this.readers).forEach(reader => {
                    if (reader.currentBook) {
                        Storage.updateReadingTime(reader.currentBook.id, 1);
                    }
                });
            } else {
                const activeReader = this.getActiveReader();
                if (activeReader && activeReader.currentBook) {
                    Storage.updateReadingTime(activeReader.currentBook.id, 1);
                }
            }
        }, 1000);
    },
    
    stopReadingTimer() {
        if (this.readingTimer) {
            clearInterval(this.readingTimer);
            this.readingTimer = null;
        }
        this.readingStartTime = null;
    },
    
    updateReadingTimeDisplay() {
        const currentTimeEl = document.getElementById('current-reading-time');
        const totalTimeEl = document.getElementById('total-reading-time');
        
        if (currentTimeEl) {
            currentTimeEl.textContent = this.formatTime(this.currentReadingTime);
        }
        
        let totalTime = 0;
        Object.values(this.readers).forEach(reader => {
            if (reader.currentBook) {
                totalTime += Storage.getReadingTime(reader.currentBook.id);
            }
        });
        
        if (totalTimeEl) {
            totalTimeEl.textContent = this.formatTime(totalTime + this.currentReadingTime);
        }
    },
    
    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },
    
    async loadBook(readerId, book) {
        const reader = this.readers[readerId];
        if (!reader) return false;
        
        reader.currentBook = book;
        reader.currentChapterIndex = book.currentChapter || 0;
        reader.currentPageIndex = book.currentPage || 0;
        
        if (book.chapters && book.chapters.length > 0) {
            await this.loadChapter(readerId, reader.currentChapterIndex);
        }
        
        const titleEl = document.getElementById(`reader-title-${readerId}`);
        if (titleEl) {
            titleEl.textContent = book.title || '';
        }
        
        const tabTitle = document.querySelector(`.reader-tab[data-tab="${readerId}"] .tab-title`);
        if (tabTitle) {
            tabTitle.textContent = book.title || `阅读器 ${readerId}`;
        }
        
        Storage.addHistory(book);
        
        if (!this.readingTimer) {
            this.startReadingTimer();
        }
        this.updateReadingTimeDisplay();
        
        this.updateScrollSpeedDisplay(readerId);
        
        return true;
    },
    
    async loadChapter(readerId, chapterIndex) {
        const reader = this.readers[readerId];
        if (!reader || !reader.currentBook || !reader.currentBook.chapters) {
            return false;
        }
        
        if (chapterIndex < 0 || chapterIndex >= reader.currentBook.chapters.length) {
            return false;
        }
        
        reader.currentChapterIndex = chapterIndex;
        reader.currentPageIndex = 0;
        
        const chapter = reader.currentBook.chapters[chapterIndex];
        reader.pages = Parser.parseContentToPages(chapter.content, reader.settings);
        
        this.updateReaderHeader(readerId, chapter.title);
        
        if (reader.settings.pageMode === 'page') {
            this.renderPages(readerId);
        } else {
            this.renderScroll(readerId);
        }
        
        this.updateProgress(readerId);
        this.saveProgress(readerId);
        
        return true;
    },
    
    updateReaderHeader(readerId, chapterTitle) {
        const chapterElement = document.getElementById(`reader-chapter-${readerId}`);
        if (chapterElement) {
            chapterElement.textContent = chapterTitle || '';
        }
    },
    
    renderScroll(readerId) {
        const reader = this.readers[readerId];
        if (!reader) return;
        
        const content = document.getElementById(`reader-content-${readerId}`);
        const chapter = reader.currentBook.chapters[reader.currentChapterIndex];
        
        let html = `<h2>${chapter.title}</h2>`;
        const paragraphs = Parser.splitContentToParagraphs(chapter.content);
        
        paragraphs.forEach(para => {
            html += `<p>${para}</p>`;
        });
        
        if (content) {
            content.innerHTML = html;
            content.scrollTop = 0;
            
            content.onscroll = () => this.onScroll(readerId);
        }
    },
    
    renderPages(readerId) {
        const reader = this.readers[readerId];
        if (!reader) return;
        
        const content = document.getElementById(`reader-content-${readerId}`);
        
        if (!content) return;
        
        if (reader.pages.length === 0) {
            content.innerHTML = '<p>暂无内容</p>';
            return;
        }
        
        let html = '';
        reader.pages.forEach((page, index) => {
            const active = index === reader.currentPageIndex ? 'active' : '';
            html += `<div class="page ${active}" data-page="${index}">${page}</div>`;
        });
        
        content.innerHTML = html;
    },
    
    onScroll(readerId) {
        const content = document.getElementById(`reader-content-${readerId}`);
        if (!content) return;
        
        const scrollTop = content.scrollTop;
        const scrollHeight = content.scrollHeight - content.clientHeight;
        
        if (scrollHeight > 0) {
            const progress = (scrollTop / scrollHeight) * 100;
            this.updateProgressUI(readerId, progress);
        }
    },
    
    nextPage(readerId) {
        const reader = this.readers[readerId];
        if (!reader) return false;
        
        if (reader.settings.pageMode === 'page') {
            if (reader.currentPageIndex < reader.pages.length - 1) {
                reader.currentPageIndex++;
                this.showCurrentPage(readerId);
                this.updateProgress(readerId);
                this.saveProgress(readerId);
                return true;
            } else {
                return this.nextChapter(readerId);
            }
        } else {
            const content = document.getElementById(`reader-content-${readerId}`);
            if (content) {
                const viewHeight = content.clientHeight;
                content.scrollTop += viewHeight * 0.8;
            }
            return true;
        }
    },
    
    prevPage(readerId) {
        const reader = this.readers[readerId];
        if (!reader) return false;
        
        if (reader.settings.pageMode === 'page') {
            if (reader.currentPageIndex > 0) {
                reader.currentPageIndex--;
                this.showCurrentPage(readerId);
                this.updateProgress(readerId);
                this.saveProgress(readerId);
                return true;
            } else {
                return this.prevChapter(readerId);
            }
        } else {
            const content = document.getElementById(`reader-content-${readerId}`);
            if (content) {
                const viewHeight = content.clientHeight;
                content.scrollTop -= viewHeight * 0.8;
            }
            return true;
        }
    },
    
    showCurrentPage(readerId) {
        const reader = this.readers[readerId];
        if (!reader) return;
        
        const content = document.getElementById(`reader-content-${readerId}`);
        if (!content) return;
        
        const pages = content.querySelectorAll('.page');
        pages.forEach((page, index) => {
            if (index === reader.currentPageIndex) {
                page.classList.add('active');
            } else {
                page.classList.remove('active');
            }
        });
    },
    
    nextChapter(readerId) {
        const reader = this.readers[readerId];
        if (!reader) return false;
        
        if (reader.currentChapterIndex < reader.currentBook.totalChapters - 1) {
            return this.loadChapter(readerId, reader.currentChapterIndex + 1);
        }
        return false;
    },
    
    prevChapter(readerId) {
        const reader = this.readers[readerId];
        if (!reader) return false;
        
        if (reader.currentChapterIndex > 0) {
            return this.loadChapter(readerId, reader.currentChapterIndex - 1);
        }
        return false;
    },
    
    goToChapter(readerId, chapterIndex) {
        return this.loadChapter(readerId, chapterIndex);
    },
    
    goToProgress(readerId, progress) {
        const reader = this.readers[readerId];
        if (!reader) return;
        
        if (reader.settings.pageMode === 'page') {
            const totalPages = reader.pages.length;
            const targetPage = Math.floor((progress / 100) * (totalPages - 1));
            reader.currentPageIndex = targetPage;
            this.showCurrentPage(readerId);
        } else {
            const content = document.getElementById(`reader-content-${readerId}`);
            if (content) {
                const scrollHeight = content.scrollHeight - content.clientHeight;
                content.scrollTop = (progress / 100) * scrollHeight;
            }
        }
        
        this.saveProgress(readerId);
    },
    
    updateProgress(readerId) {
        const reader = this.readers[readerId];
        if (!reader) return;
        
        let progress = 0;
        
        if (reader.settings.pageMode === 'page') {
            const totalPages = reader.pages.length;
            if (totalPages > 0) {
                progress = ((reader.currentPageIndex + 1) / totalPages) * 100;
            }
        } else {
            const content = document.getElementById(`reader-content-${readerId}`);
            if (content) {
                const scrollHeight = content.scrollHeight - content.clientHeight;
                if (scrollHeight > 0) {
                    progress = (content.scrollTop / scrollHeight) * 100;
                }
            }
        }
        
        this.updateProgressUI(readerId, progress);
    },
    
    updateProgressUI(readerId, progress) {
        const panel = document.getElementById(`reader-${readerId}`);
        if (!panel) return;
        
        const slider = panel.querySelector('.progress-slider');
        const text = panel.querySelector('.progress-text');
        
        if (slider) slider.value = progress.toFixed(2);
        if (text) text.textContent = `${progress.toFixed(1)}%`;
    },
    
    saveProgress(readerId) {
        const reader = this.readers[readerId];
        if (!reader || !reader.currentBook) return;
        
        let progress = 0;
        
        if (reader.settings.pageMode === 'page') {
            const totalPages = reader.pages.length;
            if (totalPages > 0) {
                progress = (reader.currentPageIndex / totalPages) * 100;
            }
        }
        
        Storage.updateBookProgress(
            reader.currentBook.id,
            progress,
            reader.currentChapterIndex,
            reader.currentPageIndex
        );
    },
    
    startAutoPlay(readerId) {
        const reader = this.readers[readerId];
        if (!reader || reader.isPlaying) return;
        
        reader.isPlaying = true;
        
        const panel = document.getElementById(`reader-${readerId}`);
        if (panel) {
            const playBtn = panel.querySelector('.play-btn');
            if (playBtn) playBtn.textContent = '⏸️';
        }
        
        if (reader.settings.pageMode === 'page') {
            reader.playInterval = setInterval(() => {
                const hasNext = this.nextPage(readerId);
                if (!hasNext) {
                    this.stopAutoPlay(readerId);
                }
            }, reader.settings.autoPlaySpeed);
        } else {
            this.startAutoScroll(readerId);
        }
    },
    
    startAutoScroll(readerId) {
        const reader = this.readers[readerId];
        if (!reader) return;
        
        const content = document.getElementById(`reader-content-${readerId}`);
        if (!content) return;
        
        if (reader.scrollInterval) {
            clearInterval(reader.scrollInterval);
        }
        
        reader.scrollAccumulator = 0;
        
        reader.scrollInterval = setInterval(() => {
            const maxScroll = content.scrollHeight - content.clientHeight;
            if (content.scrollTop >= maxScroll) {
                const hasNext = this.nextChapter(readerId);
                if (!hasNext) {
                    this.stopAutoPlay(readerId);
                }
            } else {
                const scrollPerFrame = reader.settings.autoScrollSpeed / 60;
                reader.scrollAccumulator += scrollPerFrame;
                
                if (reader.scrollAccumulator >= 1) {
                    const scrollAmount = Math.floor(reader.scrollAccumulator);
                    content.scrollTop += scrollAmount;
                    reader.scrollAccumulator -= scrollAmount;
                    this.onScroll(readerId);
                }
            }
        }, 1000 / 60);
    },
    
    stopAutoPlay(readerId) {
        const reader = this.readers[readerId];
        if (!reader || !reader.isPlaying) return;
        
        reader.isPlaying = false;
        
        const panel = document.getElementById(`reader-${readerId}`);
        if (panel) {
            const playBtn = panel.querySelector('.play-btn');
            if (playBtn) playBtn.textContent = '▶️';
        }
        
        if (reader.playInterval) {
            clearInterval(reader.playInterval);
            reader.playInterval = null;
        }
        
        if (reader.scrollInterval) {
            clearInterval(reader.scrollInterval);
            reader.scrollInterval = null;
        }
    },
    
    toggleAutoPlay(readerId) {
        const reader = this.readers[readerId];
        if (!reader) return;
        
        if (reader.isPlaying) {
            this.stopAutoPlay(readerId);
        } else {
            this.startAutoPlay(readerId);
        }
    },
    
    updateScrollSpeed(readerId, delta) {
        const reader = this.readers[readerId];
        if (!reader) return;
        
        const newSpeed = Math.max(10, Math.min(100, reader.settings.autoScrollSpeed + delta));
        reader.settings.autoScrollSpeed = newSpeed;
        
        this.updateScrollSpeedDisplay(readerId);
        
        if (reader.isPlaying && reader.settings.pageMode === 'scroll') {
            this.startAutoScroll(readerId);
        }
    },
    
    updateScrollSpeedDisplay(readerId) {
        const reader = this.readers[readerId];
        if (!reader) return;
        
        const speedValue = document.querySelector(`.speed-value[data-reader="${readerId}"]`);
        if (speedValue) {
            speedValue.textContent = reader.settings.autoScrollSpeed;
        }
    },
    
    updateSettings(readerId, newSettings) {
        const reader = this.readers[readerId];
        if (!reader) return;
        
        reader.settings = { ...reader.settings, ...newSettings };
        Storage.saveSettings(reader.settings);
        this.applySettings(readerId);
        
        if (reader.currentBook) {
            this.loadChapter(readerId, reader.currentChapterIndex);
        }
    },
    
    applySettings(readerId) {
        const reader = this.readers[readerId];
        if (!reader) return;
        
        document.documentElement.setAttribute('data-theme', reader.settings.theme);
        
        const readerContent = document.getElementById(`reader-content-${readerId}`);
        if (readerContent) {
            readerContent.style.fontSize = `${reader.settings.fontSize}px`;
            readerContent.style.lineHeight = reader.settings.lineHeight;
        }
        
        this.updateSettingsUI();
    },
    
    updateSettingsUI() {
        const activeReader = this.getActiveReader();
        if (!activeReader) return;
        
        const settings = activeReader.settings;
        
        const fontSizeSlider = document.getElementById('font-size-slider');
        const fontSizeDisplay = document.getElementById('font-size-display');
        const lineHeightSlider = document.getElementById('line-height-slider');
        const themeBtns = document.querySelectorAll('.theme-btn');
        const pageModeRadios = document.querySelectorAll('input[name="page-mode"]');
        
        if (fontSizeSlider) fontSizeSlider.value = settings.fontSize;
        if (fontSizeDisplay) fontSizeDisplay.textContent = `${settings.fontSize}px`;
        if (lineHeightSlider) lineHeightSlider.value = settings.lineHeight;
        
        themeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === settings.theme);
        });
        
        pageModeRadios.forEach(radio => {
            radio.checked = radio.value === settings.pageMode;
        });
    },
    
    getChapterList(readerId) {
        const reader = this.readers[readerId];
        if (!reader || !reader.currentBook || !reader.currentBook.chapters) {
            return [];
        }
        
        return reader.currentBook.chapters.map(chapter => ({
            index: chapter.index,
            title: chapter.title,
            isCurrent: chapter.index === reader.currentChapterIndex
        }));
    },
    
    showChapterModal(readerId) {
        this.currentChapterModalReader = readerId;
        const chapters = this.getChapterList(readerId);
        const container = document.getElementById('chapter-list');
        
        if (chapters.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">暂无章节</div>';
        } else {
            let html = '';
            chapters.forEach(chapter => {
                const active = chapter.isCurrent ? 'active' : '';
                html += `
                    <div class="chapter-item ${active}" onclick="App.goToChapterFromModal(${chapter.index})">
                        ${this.escapeHtml(chapter.title)}
                    </div>
                `;
            });
            container.innerHTML = html;
        }
        
        const modal = document.getElementById('chapter-modal');
        if (modal) {
            modal.classList.add('active');
        }
    },
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    closeBook(readerId) {
        const reader = this.readers[readerId];
        if (!reader) return;
        
        this.stopAutoPlay(readerId);
        this.saveProgress(readerId);
        
        const hasOpenBooks = Object.values(this.readers).some(r => r.id !== readerId && r.currentBook);
        if (!hasOpenBooks) {
            this.stopReadingTimer();
        }
        
        reader.currentBook = null;
        reader.currentChapterIndex = 0;
        reader.currentPageIndex = 0;
        reader.pages = [];
        
        const tabTitle = document.querySelector(`.reader-tab[data-tab="${readerId}"] .tab-title`);
        if (tabTitle) {
            tabTitle.textContent = `阅读器 ${readerId}`;
        }
        
        const titleEl = document.getElementById(`reader-title-${readerId}`);
        if (titleEl) {
            titleEl.textContent = '';
        }
        
        const chapterEl = document.getElementById(`reader-chapter-${readerId}`);
        if (chapterEl) {
            chapterEl.textContent = '';
        }
        
        const contentEl = document.getElementById(`reader-content-${readerId}`);
        if (contentEl) {
            contentEl.innerHTML = '<div class="empty-state"><p>请选择书籍开始阅读</p></div>';
        }
    }
};

const Reader = {
    currentBook: null,
    currentChapterIndex: 0,
    currentPageIndex: 0,
    pages: [],
    isPlaying: false,
    playInterval: null,
    settings: {},
    
    init() {
        ReaderManager.init();
        this.settings = ReaderManager.getActiveReader().settings;
    },
    
    async loadBook(book) {
        return ReaderManager.loadBook(ReaderManager.activeReaderId, book);
    },
    
    async loadChapter(chapterIndex) {
        return ReaderManager.loadChapter(ReaderManager.activeReaderId, chapterIndex);
    },
    
    updateReaderHeader(chapterTitle) {
        return ReaderManager.updateReaderHeader(ReaderManager.activeReaderId, chapterTitle);
    },
    
    renderScroll() {
        return ReaderManager.renderScroll(ReaderManager.activeReaderId);
    },
    
    renderPages() {
        return ReaderManager.renderPages(ReaderManager.activeReaderId);
    },
    
    onScroll() {
        return ReaderManager.onScroll(ReaderManager.activeReaderId);
    },
    
    nextPage() {
        return ReaderManager.nextPage(ReaderManager.activeReaderId);
    },
    
    prevPage() {
        return ReaderManager.prevPage(ReaderManager.activeReaderId);
    },
    
    showCurrentPage() {
        return ReaderManager.showCurrentPage(ReaderManager.activeReaderId);
    },
    
    nextChapter() {
        return ReaderManager.nextChapter(ReaderManager.activeReaderId);
    },
    
    prevChapter() {
        return ReaderManager.prevChapter(ReaderManager.activeReaderId);
    },
    
    goToChapter(chapterIndex) {
        return ReaderManager.goToChapter(ReaderManager.activeReaderId, chapterIndex);
    },
    
    goToProgress(progress) {
        return ReaderManager.goToProgress(ReaderManager.activeReaderId, progress);
    },
    
    updateProgress() {
        return ReaderManager.updateProgress(ReaderManager.activeReaderId);
    },
    
    updateProgressUI(progress) {
        return ReaderManager.updateProgressUI(ReaderManager.activeReaderId, progress);
    },
    
    saveProgress() {
        return ReaderManager.saveProgress(ReaderManager.activeReaderId);
    },
    
    startAutoPlay() {
        return ReaderManager.startAutoPlay(ReaderManager.activeReaderId);
    },
    
    stopAutoPlay() {
        return ReaderManager.stopAutoPlay(ReaderManager.activeReaderId);
    },
    
    toggleAutoPlay() {
        return ReaderManager.toggleAutoPlay(ReaderManager.activeReaderId);
    },
    
    updateSettings(newSettings) {
        const targetRadios = document.querySelectorAll('input[name="settings-target"]');
        let target = 'reader1';
        targetRadios.forEach(radio => {
            if (radio.checked) target = radio.value;
        });
        
        if (target === 'both') {
            Object.keys(ReaderManager.readers).forEach(id => {
                ReaderManager.updateSettings(parseInt(id), newSettings);
            });
        } else if (target === 'reader1') {
            return ReaderManager.updateSettings(1, newSettings);
        } else if (target === 'reader2') {
            return ReaderManager.updateSettings(2, newSettings);
        }
    },
    
    applySettings() {
        return ReaderManager.applySettings(ReaderManager.activeReaderId);
    },
    
    updateSettingsUI() {
        return ReaderManager.updateSettingsUI();
    },
    
    getChapterList() {
        return ReaderManager.getChapterList(ReaderManager.activeReaderId);
    },
    
    closeBook() {
        return ReaderManager.closeBook(ReaderManager.activeReaderId);
    }
};
