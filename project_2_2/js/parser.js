const Parser = {
    async parseFile(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        
        if (extension === 'txt') {
            return this.parseTxt(file);
        } else if (extension === 'epub') {
            return this.parseEpub(file);
        } else {
            throw new Error('不支持的文件格式，请上传txt或epub文件');
        }
    },

    async parseTxt(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const content = await this.decodeTextWithEncoding(arrayBuffer, file);
                    const book = this.parseTxtContent(content, file.name);
                    resolve(book);
                } catch (err) {
                    reject(err);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('文件读取失败'));
            };
            
            reader.readAsArrayBuffer(file);
        });
    },

    async decodeTextWithEncoding(arrayBuffer, file) {
        const detectedEncoding = await this.detectEncoding(arrayBuffer, file);
        console.log('检测到的编码:', detectedEncoding);
        
        try {
            const decoder = new TextDecoder(detectedEncoding, { fatal: false });
            let decoded = decoder.decode(arrayBuffer);
            
            decoded = this.fixDecodingIssues(decoded);
            
            if (this.hasGarbledText(decoded)) {
                console.log('尝试使用其他编码...');
                const altEncodings = ['GB18030', 'GBK', 'GB2312', 'UTF-8', 'BIG5'];
                for (const enc of altEncodings) {
                    if (enc === detectedEncoding) continue;
                    try {
                        const altDecoder = new TextDecoder(enc, { fatal: false });
                        const altDecoded = altDecoder.decode(arrayBuffer);
                        const fixedAlt = this.fixDecodingIssues(altDecoded);
                        if (!this.hasGarbledText(fixedAlt)) {
                            console.log('使用替代编码成功:', enc);
                            return fixedAlt;
                        }
                    } catch (e) {
                        continue;
                    }
                }
            }
            
            return decoded;
        } catch (e) {
            console.warn('解码失败，尝试默认UTF-8:', e);
            try {
                const fallbackDecoder = new TextDecoder('UTF-8', { fatal: false });
                return fallbackDecoder.decode(arrayBuffer);
            } catch (e2) {
                throw new Error('无法解码文件，请检查文件编码');
            }
        }
    },

    async detectEncoding(arrayBuffer, file) {
        const bytes = new Uint8Array(arrayBuffer);
        const sampleSize = Math.min(bytes.length, 10000);
        
        if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
            return 'UTF-8';
        }
        if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
            return 'UTF-16BE';
        }
        if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
            return 'UTF-16LE';
        }
        
        let hasHighByte = false;
        let gbkScore = 0;
        let utf8Score = 0;
        let asciiScore = 0;
        
        let i = 0;
        while (i < sampleSize) {
            const b = bytes[i];
            
            if (b <= 0x7F) {
                asciiScore++;
                i++;
            } else {
                hasHighByte = true;
                
                if ((b >= 0x81 && b <= 0xFE) && (i + 1 < sampleSize)) {
                    const b2 = bytes[i + 1];
                    if ((b2 >= 0x40 && b2 <= 0x7E) || (b2 >= 0x80 && b2 <= 0xFE)) {
                        gbkScore++;
                        i += 2;
                        continue;
                    }
                }
                
                if ((b & 0xE0) === 0xC0 && (i + 1 < sampleSize)) {
                    const b2 = bytes[i + 1];
                    if ((b2 & 0xC0) === 0x80) {
                        utf8Score++;
                        i += 2;
                        continue;
                    }
                }
                
                if ((b & 0xF0) === 0xE0 && (i + 2 < sampleSize)) {
                    const b2 = bytes[i + 1];
                    const b3 = bytes[i + 2];
                    if ((b2 & 0xC0) === 0x80 && (b3 & 0xC0) === 0x80) {
                        utf8Score++;
                        i += 3;
                        continue;
                    }
                }
                
                i++;
            }
        }
        
        if (!hasHighByte) {
            return 'UTF-8';
        }
        
        const fileName = file.name.toLowerCase();
        if (fileName.includes('gbk') || fileName.includes('gb2312') || fileName.includes('gb18030')) {
            return 'GB18030';
        }
        if (fileName.includes('utf8') || fileName.includes('utf-8')) {
            return 'UTF-8';
        }
        
        console.log('编码检测分数 - GBK:', gbkScore, 'UTF-8:', utf8Score);
        
        if (gbkScore > utf8Score * 2) {
            return 'GB18030';
        }
        
        if (utf8Score > gbkScore * 2) {
            return 'UTF-8';
        }
        
        try {
            const utf8Decoder = new TextDecoder('UTF-8', { fatal: true });
            utf8Decoder.decode(arrayBuffer.slice(0, Math.min(10000, arrayBuffer.length)));
            return 'UTF-8';
        } catch (e) {
            return 'GB18030';
        }
    },

    fixDecodingIssues(text) {
        text = text.replace(/\r\n/g, '\n');
        text = text.replace(/\r/g, '\n');
        
        text = text.replace(/\u0000/g, '');
        text = text.replace(/\uFFFD/g, '');
        
        text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
        
        text = text.split('\n').map(line => {
            return line.trimEnd();
        }).join('\n');
        
        text = text.replace(/\n{3,}/g, '\n\n');
        
        return text;
    },

    hasGarbledText(text) {
        const garbledPatterns = [
            /[����]/,
            /[\u0080-\u009F]/,
            /[àáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ]/i,
            /Ã[¡-¿]/,
            /[À-ß][a-z]/
        ];
        
        let garbledCount = 0;
        for (const pattern of garbledPatterns) {
            const matches = text.match(pattern);
            if (matches) {
                garbledCount += matches.length;
            }
        }
        
        const chinesePattern = /[\u4e00-\u9fa5]/g;
        const chineseMatches = text.match(chinesePattern);
        const chineseCount = chineseMatches ? chineseMatches.length : 0;
        
        if (chineseCount === 0) {
            return false;
        }
        
        const garbledRatio = garbledCount / chineseCount;
        console.log('乱码检测 - 乱码字符:', garbledCount, '中文字符:', chineseCount, '比例:', garbledRatio);
        
        return garbledRatio > 0.1;
    },

    parseTxtContent(content, fileName) {
        const title = fileName.replace(/\.[^/.]+$/, '');
        const chapters = this.extractChapters(content);
        
        return {
            id: this.generateId(title),
            title: title,
            chapters: chapters,
            totalChapters: chapters.length,
            rawContent: content,
            fileType: 'txt',
            addedAt: Date.now()
        };
    },

    extractChapters(content) {
        const lines = content.split('\n');
        const chapterCandidates = [];
        
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];
            const trimmed = line.trim();
            
            if (trimmed.length === 0) continue;
            
            const candidate = this.checkChapterLine(trimmed, line, lineNum, lines);
            if (candidate) {
                chapterCandidates.push(candidate);
            }
        }
        
        const filteredCandidates = this.filterChapterCandidates(chapterCandidates, content);
        
        if (filteredCandidates.length === 0) {
            return [{
                index: 0,
                title: '正文',
                content: content
            }];
        }
        
        this.mergeConsecutiveChapters(filteredCandidates);
        
        this.deduplicateChapterTitles(filteredCandidates);
        
        const sortedCandidates = filteredCandidates.sort((a, b) => a.globalIndex - b.globalIndex);
        
        const chapters = [];
        
        for (let i = 0; i < sortedCandidates.length; i++) {
            const candidate = sortedCandidates[i];
            const nextCandidate = sortedCandidates[i + 1];
            
            let chapterContent = '';
            if (nextCandidate) {
                chapterContent = content.slice(candidate.globalIndex, nextCandidate.globalIndex);
            } else {
                chapterContent = content.slice(candidate.globalIndex);
            }
            
            chapters.push({
                index: i,
                title: candidate.title,
                content: chapterContent,
                lineNum: candidate.lineNum
            });
        }
        
        const beforeFirst = content.slice(0, sortedCandidates[0].globalIndex).trim();
        if (beforeFirst.length > 100) {
            chapters.unshift({
                index: 0,
                title: '前言/序章',
                content: beforeFirst,
                lineNum: 0
            });
            
            chapters.forEach((chapter, index) => {
                chapter.index = index;
            });
        }
        
        console.log(`识别到 ${chapters.length} 个章节`);
        return chapters;
    },

    checkChapterLine(trimmedLine, rawLine, lineNum, allLines) {
        const lineLength = trimmedLine.length;
        
        if (lineLength > 50) {
            return null;
        }
        
        const prevLine = lineNum > 0 ? allLines[lineNum - 1] : '';
        const nextLine = lineNum < allLines.length - 1 ? allLines[lineNum + 1] : '';
        
        const isIsolatedLine = (prevLine.trim() === '' && nextLine.trim() === '') ||
                               (prevLine.trim() === '' && nextLine.trim() !== '') ||
                               (prevLine.trim() !== '' && nextLine.trim() === '');
        
        let globalIndex = 0;
        for (let i = 0; i < lineNum; i++) {
            globalIndex += allLines[i].length + 1;
        }
        const leadingSpaces = rawLine.length - rawLine.trimStart().length;
        globalIndex += leadingSpaces;
        
        const standardPatterns = [
            {
                name: '第X章',
                regex: /^第\s*([零一二两三四五六七八九十百千万\d]+)\s*[章节回部卷集篇]\s*(.*)$/i,
                weight: 100,
                formatter: (match) => `第${match[1]}章${match[2] ? ' ' + match[2].trim() : ''}`
            },
            {
                name: 'Chapter',
                regex: /^Chapter\s*(\d+)[\s\.:：]*\s*(.*)$/i,
                weight: 90,
                formatter: (match) => `Chapter ${match[1]}${match[2] ? ' ' + match[2].trim() : ''}`
            },
            {
                name: '第X节',
                regex: /^第\s*([零一二两三四五六七八九十百千万\d]+)\s*[节]/i,
                weight: 80,
                formatter: (match) => match[0]
            },
            {
                name: '数字点标题',
                regex: /^(\d+)[\.\、\s]+\s*(.+)$/,
                weight: 60,
                formatter: (match) => `${match[1]}. ${match[2].trim()}`
            },
            {
                name: '中文数字标号',
                regex: /^([一二三四五六七八九十百千万]+)[\.\、\s]+\s*(.+)$/,
                weight: 55,
                formatter: (match) => `${match[1]}、${match[2].trim()}`
            },
            {
                name: '带括号数字',
                regex: /^[（(]\s*(\d+)\s*[)）]\s*(.+)$/,
                weight: 50,
                formatter: (match) => `(${match[1]}) ${match[2].trim()}`
            },
            {
                name: '带括号中文',
                regex: /^[（(]\s*([一二三四五六七八九十百千万]+)\s*[)）]\s*(.+)$/,
                weight: 45,
                formatter: (match) => `（${match[1]}）${match[2].trim()}`
            },
            {
                name: 'Volume',
                regex: /^Volume\s*(\d+)[\s\.:：]*\s*(.*)$/i,
                weight: 70,
                formatter: (match) => `Volume ${match[1]}${match[2] ? ' ' + match[2].trim() : ''}`
            },
            {
                name: 'Book',
                regex: /^Book\s*(\d+)[\s\.:：]*\s*(.*)$/i,
                weight: 65,
                formatter: (match) => `Book ${match[1]}${match[2] ? ' ' + match[2].trim() : ''}`
            }
        ];
        
        for (const pattern of standardPatterns) {
            const match = trimmedLine.match(pattern.regex);
            if (match) {
                const title = pattern.formatter(match);
                if (this.isValidChapterTitle(title)) {
                    return {
                        title: title,
                        lineNum: lineNum,
                        globalIndex: globalIndex,
                        weight: pattern.weight,
                        isStandard: true,
                        patternName: pattern.name
                    };
                }
            }
        }
        
        if (isIsolatedLine && lineLength >= 2 && lineLength <= 30) {
            if (!this.isBodyText(trimmedLine)) {
                return {
                    title: trimmedLine,
                    lineNum: lineNum,
                    globalIndex: globalIndex,
                    weight: 30,
                    isStandard: false,
                    patternName: '孤立行'
                };
            }
        }
        
        if (lineLength <= 20) {
            const possibleTitlePatterns = [
                /^[序前引结尾附][言语录章记篇]/,
                /^后记$/,
                /^附录$/,
                /^参考资料$/,
                /^索引$/,
                /^目录$/,
                /^楔子$/,
                /^尾声$/,
                /^结局$/,
                /^番外篇*/,
                /^外传*/
            ];
            
            for (const pattern of possibleTitlePatterns) {
                if (pattern.test(trimmedLine)) {
                    return {
                        title: trimmedLine,
                        lineNum: lineNum,
                        globalIndex: globalIndex,
                        weight: 85,
                        isStandard: true,
                        patternName: '特殊章节'
                    };
                }
            }
        }
        
        return null;
    },

    isValidChapterTitle(title) {
        const invalidPatterns = [
            /^\d+$/,
            /^[a-zA-Z]$/,
            /^[^\u4e00-\u9fa5a-zA-Z0-9]+$/,
            /^[、。，．！？；：""''（）【】]+$/,
            /^[的了是在有这我不为他就和你以们时子如来对上生出会可下也过子能道而事要把还]$/
        ];
        
        for (const pattern of invalidPatterns) {
            if (pattern.test(title.trim())) {
                return false;
            }
        }
        
        return true;
    },

    isBodyText(text) {
        const textLength = text.length;
        
        if (textLength < 2) return true;
        
        if (text.match(/^[a-zA-Z0-9\s]+$/)) {
            return false;
        }
        
        if (text.match(/[，。！？；：]$/)) {
            return true;
        }
        
        if (textLength >= 15 && text.match(/^[\u4e00-\u9fa5，。！？、；：""''（）【】\s]+$/)) {
            return true;
        }
        
        return false;
    },

    filterChapterCandidates(candidates, content) {
        if (candidates.length === 0) return [];
        
        const standardCandidates = candidates.filter(c => c.isStandard);
        const nonStandardCandidates = candidates.filter(c => !c.isStandard);
        
        console.log(`标准章节候选: ${standardCandidates.length}, 非标准: ${nonStandardCandidates.length}`);
        
        if (standardCandidates.length >= 3) {
            const avgDistance = this.calculateAverageDistance(standardCandidates);
            console.log(`标准章节平均距离: ${avgDistance}`);
            
            const filtered = standardCandidates.filter((c, i) => {
                if (i === 0) return true;
                
                const prev = standardCandidates[i - 1];
                const distance = c.globalIndex - prev.globalIndex;
                
                if (distance < 100) {
                    return c.weight > prev.weight;
                }
                
                return true;
            });
            
            return filtered;
        }
        
        if (nonStandardCandidates.length >= 2) {
            const avgDistance = this.calculateAverageDistance(nonStandardCandidates);
            
            if (avgDistance > 500) {
                return nonStandardCandidates;
            }
        }
        
        return standardCandidates;
    },

    calculateAverageDistance(candidates) {
        if (candidates.length < 2) return 0;
        
        let totalDistance = 0;
        for (let i = 1; i < candidates.length; i++) {
            totalDistance += candidates[i].globalIndex - candidates[i - 1].globalIndex;
        }
        
        return totalDistance / (candidates.length - 1);
    },

    mergeConsecutiveChapters(candidates) {
        for (let i = candidates.length - 1; i > 0; i--) {
            const current = candidates[i];
            const prev = candidates[i - 1];
            
            const distance = current.lineNum - prev.lineNum;
            
            if (distance === 1) {
                if (prev.title.length + current.title.length < 30) {
                    prev.title = prev.title + ' ' + current.title;
                    candidates.splice(i, 1);
                }
            }
        }
    },

    deduplicateChapterTitles(candidates) {
        const titleMap = new Map();
        
        for (let i = candidates.length - 1; i >= 0; i--) {
            const candidate = candidates[i];
            
            if (titleMap.has(candidate.title)) {
                const existingWeight = titleMap.get(candidate.title);
                
                if (candidate.weight <= existingWeight) {
                    candidates.splice(i, 1);
                }
            } else {
                titleMap.set(candidate.title, candidate.weight);
            }
        }
    },

    findChapterMatches(content, pattern) {
        const matches = [];
        let match;
        
        const regex = new RegExp(pattern.source, pattern.flags);
        
        while ((match = regex.exec(content)) !== null) {
            matches.push({
                title: match[0],
                index: match.index
            });
        }
        
        return matches;
    },

    parseContentToPages(content, settings) {
        const paragraphs = this.splitContentToParagraphs(content);
        return this.groupParagraphsToPages(paragraphs, settings);
    },

    splitContentToParagraphs(content) {
        const lines = content.split(/\r?\n/);
        const paragraphs = [];
        let currentParagraph = '';

        for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed.length === 0) {
                if (currentParagraph.length > 0) {
                    paragraphs.push(this.formatParagraph(currentParagraph));
                    currentParagraph = '';
                }
            } else {
                if (currentParagraph.length > 0) {
                    currentParagraph += ' ';
                }
                currentParagraph += trimmed;
            }
        }

        if (currentParagraph.length > 0) {
            paragraphs.push(this.formatParagraph(currentParagraph));
        }

        return paragraphs;
    },

    formatParagraph(text) {
        return text.replace(/\s+/g, ' ');
    },

    groupParagraphsToPages(paragraphs, settings) {
        const pages = [];
        const charLimit = this.calculateCharLimit(settings);
        let currentPage = '';
        let currentPageChars = 0;

        for (const paragraph of paragraphs) {
            const paraLength = paragraph.length + 2;

            if (currentPageChars + paraLength > charLimit && currentPageChars > 0) {
                pages.push(currentPage);
                currentPage = `<p>${paragraph}</p>`;
                currentPageChars = paraLength;
            } else {
                if (currentPage.length > 0) {
                    currentPage += `<p>${paragraph}</p>`;
                } else {
                    currentPage = `<p>${paragraph}</p>`;
                }
                currentPageChars += paraLength;
            }
        }

        if (currentPage.length > 0) {
            pages.push(currentPage);
        }

        return pages;
    },

    calculateCharLimit(settings) {
        const fontSize = settings.fontSize || 16;
        const lineHeight = settings.lineHeight || 1.8;
        
        const baseLimit = 800;
        const adjustment = (fontSize - 16) * 20;
        
        return Math.max(300, baseLimit - adjustment);
    },

    async parseEpub(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const content = e.target.result;
                    const book = await this.parseEpubContent(content, file.name);
                    resolve(book);
                } catch (err) {
                    reject(err);
                }
            };
            
            reader.onerror = () => {
                reject(new Error('EPUB文件读取失败'));
            };
            
            reader.readAsArrayBuffer(file);
        });
    },

    async parseEpubContent(arrayBuffer, fileName) {
        try {
            const JSZip = window.JSZip || (await this.loadJSZip());
            const zip = await JSZip.loadAsync(arrayBuffer);
            
            const opfPath = await this.findOpfPath(zip);
            const opfContent = await zip.file(opfPath).async('string');
            const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
            
            const metadata = this.parseOpfMetadata(opfContent);
            const manifest = this.parseOpfManifest(opfContent);
            const spine = this.parseOpfSpine(opfContent);
            
            const chapters = [];
            for (let i = 0; i < spine.length; i++) {
                const itemId = spine[i];
                const item = manifest[itemId];
                
                if (item && item.href) {
                    const fullPath = opfDir + item.href;
                    const file = zip.file(fullPath);
                    
                    if (file) {
                        const htmlContent = await file.async('string');
                        const textContent = this.extractTextFromHtml(htmlContent);
                        
                        chapters.push({
                            index: i,
                            title: this.sanitizeTitle(metadata.toc[i] || `第${i + 1}章`),
                            content: textContent
                        });
                    }
                }
            }
            
            return {
                id: this.generateId(metadata.title || fileName),
                title: this.sanitizeTitle(metadata.title || fileName.replace(/\.[^/.]+$/, '')),
                author: metadata.author,
                chapters: chapters,
                totalChapters: chapters.length,
                fileType: 'epub',
                addedAt: Date.now()
            };
        } catch (e) {
            console.error('EPUB parsing error:', e);
            throw new Error('EPUB文件解析失败，文件可能已损坏');
        }
    },

    async loadJSZip() {
        return new Promise((resolve, reject) => {
            if (window.JSZip) {
                resolve(window.JSZip);
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = () => resolve(window.JSZip);
            script.onerror = () => reject(new Error('无法加载JSZip库'));
            document.head.appendChild(script);
        });
    },

    async findOpfPath(zip) {
        const containerContent = await zip.file('META-INF/container.xml')?.async('string');
        if (containerContent) {
            const match = containerContent.match(/full-path=["']([^"']+)["']/);
            if (match) {
                return match[1];
            }
        }
        
        const files = Object.keys(zip.files);
        const opfFile = files.find(f => f.endsWith('.opf'));
        if (opfFile) {
            return opfFile;
        }
        
        throw new Error('无法在EPUB中找到内容文件');
    },

    parseOpfMetadata(opfContent) {
        const result = {
            title: '',
            author: '',
            toc: []
        };
        
        const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
        if (titleMatch) {
            result.title = titleMatch[1];
        }
        
        const creatorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
        if (creatorMatch) {
            result.author = creatorMatch[1];
        }
        
        return result;
    },

    parseOpfManifest(opfContent) {
        const manifest = {};
        const itemRegex = /<item[^>]+id=["']([^"']+)["'][^>]*href=["']([^"']+)["']/gi;
        let match;
        
        while ((match = itemRegex.exec(opfContent)) !== null) {
            manifest[match[1]] = {
                id: match[1],
                href: match[2]
            };
        }
        
        return manifest;
    },

    parseOpfSpine(opfContent) {
        const spine = [];
        const itemrefRegex = /<itemref[^>]+idref=["']([^"']+)["']/gi;
        let match;
        
        while ((match = itemrefRegex.exec(opfContent)) !== null) {
            spine.push(match[1]);
        }
        
        return spine;
    },

    extractTextFromHtml(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const scripts = doc.querySelectorAll('script, style');
        scripts.forEach(el => el.remove());
        
        let text = doc.body?.textContent || doc.textContent;
        
        text = text.replace(/\s+/g, ' ');
        text = text.replace(/&nbsp;/g, ' ');
        text = text.replace(/&[a-z]+;/g, '');
        
        return text.trim();
    },

    sanitizeTitle(title) {
        return title
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    },

    generateId(title) {
        const timestamp = Date.now();
        const hash = title
            .split('')
            .reduce((acc, char) => {
                acc = ((acc << 5) - acc) + char.charCodeAt(0);
                return acc & acc;
            }, 0);
        
        return `${timestamp}_${Math.abs(hash)}`;
    }
};
