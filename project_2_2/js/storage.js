const Storage = {
    KEYS: {
        BOOKS: 'reader_books',
        HISTORY: 'reader_history',
        SETTINGS: 'reader_settings',
        FOLDERS: 'reader_folders',
        READING_TIME: 'reader_reading_time'
    },

    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Storage get error:', e);
            return null;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    },

    remove(key) {
        localStorage.removeItem(key);
    },

    getBooks() {
        return this.get(this.KEYS.BOOKS) || [];
    },

    addBook(book) {
        const books = this.getBooks();
        const existingIndex = books.findIndex(b => b.id === book.id);
        
        if (existingIndex >= 0) {
            books[existingIndex] = { ...books[existingIndex], ...book };
        } else {
            books.unshift(book);
        }
        
        this.set(this.KEYS.BOOKS, books);
        return books;
    },

    removeBook(bookId) {
        const books = this.getBooks();
        const filtered = books.filter(b => b.id !== bookId);
        this.set(this.KEYS.BOOKS, filtered);
        return filtered;
    },

    getBook(bookId) {
        const books = this.getBooks();
        return books.find(b => b.id === bookId);
    },

    updateBookProgress(bookId, progress, currentChapter = 0, currentPage = 0) {
        const books = this.getBooks();
        const book = books.find(b => b.id === bookId);
        
        if (book) {
            book.progress = progress;
            book.currentChapter = currentChapter;
            book.currentPage = currentPage;
            book.lastReadAt = Date.now();
            this.set(this.KEYS.BOOKS, books);
        }
        
        return books;
    },

    getHistory() {
        return this.get(this.KEYS.HISTORY) || [];
    },

    addHistory(book) {
        const history = this.getHistory();
        const filtered = history.filter(h => h.id !== book.id);
        const newHistory = [
            {
                id: book.id,
                title: book.title,
                progress: book.progress || 0,
                currentChapter: book.currentChapter || 0,
                readAt: Date.now()
            },
            ...filtered
        ].slice(0, 100);
        
        this.set(this.KEYS.HISTORY, newHistory);
        return newHistory;
    },

    clearHistory() {
        this.remove(this.KEYS.HISTORY);
    },

    getSettings() {
        const defaultSettings = {
            fontSize: 16,
            lineHeight: 1.8,
            pageMode: 'scroll',
            autoPlaySpeed: 1500,
            theme: 'light'
        };
        
        const saved = this.get(this.KEYS.SETTINGS);
        return { ...defaultSettings, ...saved };
    },

    saveSettings(settings) {
        const current = this.getSettings();
        const merged = { ...current, ...settings };
        this.set(this.KEYS.SETTINGS, merged);
        return merged;
    },

    getFolders() {
        return this.get(this.KEYS.FOLDERS) || [];
    },

    addFolder(folder) {
        const folders = this.getFolders();
        const newFolder = {
            id: `folder_${Date.now()}`,
            name: folder.name,
            books: [],
            createdAt: Date.now()
        };
        folders.push(newFolder);
        this.set(this.KEYS.FOLDERS, folders);
        return newFolder;
    },

    updateFolder(folderId, updates) {
        const folders = this.getFolders();
        const folderIndex = folders.findIndex(f => f.id === folderId);
        if (folderIndex >= 0) {
            folders[folderIndex] = { ...folders[folderIndex], ...updates };
            this.set(this.KEYS.FOLDERS, folders);
        }
        return folders;
    },

    removeFolder(folderId) {
        const folders = this.getFolders();
        const folder = folders.find(f => f.id === folderId);
        if (folder) {
            const books = this.getBooks();
            folder.books.forEach(bookId => {
                const bookIndex = books.findIndex(b => b.folderId === folderId);
                if (bookIndex >= 0) {
                    delete books[bookIndex].folderId;
                }
            });
            this.set(this.KEYS.BOOKS, books);
        }
        const filtered = folders.filter(f => f.id !== folderId);
        this.set(this.KEYS.FOLDERS, filtered);
        return filtered;
    },

    addBookToFolder(bookId, folderId) {
        const folders = this.getFolders();
        const books = this.getBooks();
        
        books.forEach(book => {
            if (book.id === bookId) {
                if (book.folderId) {
                    const oldFolder = folders.find(f => f.id === book.folderId);
                    if (oldFolder) {
                        oldFolder.books = oldFolder.books.filter(id => id !== bookId);
                    }
                }
                book.folderId = folderId;
            }
        });
        
        if (folderId) {
            const targetFolder = folders.find(f => f.id === folderId);
            if (targetFolder && !targetFolder.books.includes(bookId)) {
                targetFolder.books.push(bookId);
            }
        }
        
        this.set(this.KEYS.FOLDERS, folders);
        this.set(this.KEYS.BOOKS, books);
        return { folders, books };
    },

    removeBookFromFolder(bookId, folderId) {
        const folders = this.getFolders();
        const books = this.getBooks();
        
        const folder = folders.find(f => f.id === folderId);
        if (folder) {
            folder.books = folder.books.filter(id => id !== bookId);
        }
        
        const book = books.find(b => b.id === bookId);
        if (book) {
            delete book.folderId;
        }
        
        this.set(this.KEYS.FOLDERS, folders);
        this.set(this.KEYS.BOOKS, books);
        return { folders, books };
    },

    getReadingTime(bookId) {
        const readingTime = this.get(this.KEYS.READING_TIME) || {};
        return readingTime[bookId] || 0;
    },

    updateReadingTime(bookId, duration) {
        const readingTime = this.get(this.KEYS.READING_TIME) || {};
        if (!readingTime[bookId]) {
            readingTime[bookId] = 0;
        }
        readingTime[bookId] += duration;
        this.set(this.KEYS.READING_TIME, readingTime);
        return readingTime[bookId];
    },

    getAllReadingTime() {
        return this.get(this.KEYS.READING_TIME) || {};
    }
};
