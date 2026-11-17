"use strict";

/**
 * README modal (bezel key WIKI): shows README.md in an overlay.
 * Tiny Markdown renderer — headings, paragraphs, lists, tables, quotes, fenced code, inline
 * code / bold / italic / links. Raw HTML (banner, badges) is skipped; everything is escaped.
 */
const readmeModal = {
    _html: null,

    _esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    _slug(s) {
        return String(s).toLowerCase().replace(/[`*_~]/g, '').replace(/[^a-z0-9 -]/g, '').trim().replace(/ /g, '-');
    },

    _inline(raw) {
        let s = this._esc(raw);
        s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ''); // images
        s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
        s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
        s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:]|$)/g, '$1<i>$2</i>');
        s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => {
            if (u.charAt(0) === '#') return `<a href="${u}" data-readme-anchor="${u.slice(1)}">${t}</a>`;
            if (/^https?:\/\//.test(u)) return `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`;
            return t;
        });
        return s;
    },

    render(md) {
        const lines = String(md).replace(/\r/g, '').split('\n');
        const out = [];
        let i = 0;
        let para = [];
        let list = null;
        const flushPara = () => { if (para.length) { out.push('<p>' + this._inline(para.join(' ')) + '</p>'); para = []; } };
        const flushList = () => { if (list) { out.push('<' + list.tag + '>' + list.items.map((t) => '<li>' + this._inline(t) + '</li>').join('') + '</' + list.tag + '>'); list = null; } };
        let htmlDepth = 0;
        while (i < lines.length) {
            const line = lines[i];
            if (/^```/.test(line)) {
                flushPara(); flushList();
                const code = [];
                i++;
                while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
                i++;
                out.push('<pre><code>' + this._esc(code.join('\n')) + '</code></pre>');
                continue;
            }
            // Raw HTML blocks (banner / badges): skipped.
            if (/^\s*<(div|img|p|a|br|hr|table|details|summary|picture|center)\b/i.test(line) || htmlDepth > 0) {
                flushPara(); flushList();
                const opens = (line.match(/<(div|table|details|center)\b/gi) || []).length;
                const closes = (line.match(/<\/(div|table|details|center)>/gi) || []).length;
                htmlDepth = Math.max(0, htmlDepth + opens - closes);
                i++;
                continue;
            }
            const h = line.match(/^(#{1,4})\s+(.*)$/);
            if (h) {
                flushPara(); flushList();
                const n = h[1].length;
                out.push(`<h${n} id="readme-${this._slug(h[2])}">${this._inline(h[2])}</h${n}>`);
                i++;
                continue;
            }
            if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
                flushPara(); flushList();
                const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
                const head = cells(line);
                i += 2;
                const rows = [];
                while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
                out.push('<div class="vf-readme-table"><table><thead><tr>' + head.map((c) => '<th>' + this._inline(c) + '</th>').join('') + '</tr></thead><tbody>'
                    + rows.map((r) => '<tr>' + r.map((c) => '<td>' + this._inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
                continue;
            }
            const li = line.match(/^\s*([-*+]|\d+\.)\s+(.*)$/);
            if (li) {
                flushPara();
                const tag = /\d/.test(li[1]) ? 'ol' : 'ul';
                if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
                list.items.push(li[2]);
                i++;
                continue;
            }
            if (/^>\s?/.test(line)) {
                flushPara(); flushList();
                const q = [];
                while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
                out.push('<blockquote>' + this._inline(q.join(' ')) + '</blockquote>');
                continue;
            }
            if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flushPara(); flushList(); out.push('<hr>'); i++; continue; }
            if (!line.trim()) { flushPara(); flushList(); i++; continue; }
            flushList();
            para.push(line.trim());
            i++;
        }
        flushPara(); flushList();
        return out.join('\n');
    },

    ensureOverlay() {
        let overlay = document.getElementById('vfReadmeOverlay');
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'vfReadmeOverlay';
        overlay.className = 'difficulty-editor-overlay vf-readme-overlay hidden';
        overlay.innerHTML = `
            <div class="difficulty-editor-panel vf-readme-panel" role="dialog" aria-modal="true" aria-label="README">
                <header class="difficulty-editor-header">
                    <h2>README</h2>
                    <button type="button" class="de-close" id="vfReadmeClose" aria-label="Close">×</button>
                </header>
                <div class="vf-readme-body" id="vfReadmeBody"></div>
                <footer class="difficulty-editor-footer">
                    <button type="button" class="pe-btn" id="vfReadmeBack">BACK</button>
                </footer>
            </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#vfReadmeClose').addEventListener('click', () => this.hide());
        overlay.querySelector('#vfReadmeBack').addEventListener('click', () => this.hide());
        overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) this.hide(); });
        overlay.addEventListener('click', (e) => {
            const a = e.target.closest && e.target.closest('[data-readme-anchor]');
            if (!a) return;
            e.preventDefault();
            const t = overlay.querySelector('#readme-' + a.getAttribute('data-readme-anchor'));
            if (t) t.scrollIntoView({ block: 'start' });
        });
        overlay.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Escape') this.hide();
        });
        return overlay;
    },

    show() {
        const overlay = this.ensureOverlay();
        overlay.classList.remove('hidden');
        const body = overlay.querySelector('#vfReadmeBody');
        body.tabIndex = -1;
        body.focus({ preventScroll: true });
        if (this._html != null) { body.innerHTML = this._html; return; }
        body.innerHTML = '<p class="vf-readme-status">LOADING…</p>';
        fetch('README.md', { cache: 'no-cache' })
            .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
            .then((md) => { this._html = this.render(md); body.innerHTML = this._html; })
            .catch(() => { body.innerHTML = '<p class="vf-readme-status">README.md could not be loaded.</p>'; });
    },

    hide() {
        const overlay = document.getElementById('vfReadmeOverlay');
        if (overlay) overlay.classList.add('hidden');
    },

    isVisible() {
        const overlay = document.getElementById('vfReadmeOverlay');
        return !!overlay && !overlay.classList.contains('hidden');
    }
};
