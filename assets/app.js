/*
 * assets/app.js —— 顾言 GU事 轻后台「视图层接口」
 * ----------------------------------------------------------------
 * 这是全站唯一的渲染层（render layer）。无论现在是「静态发布快照」
 * 还是将来切「整页动态（切花）」，都只通过本文件暴露的 SiteApp 契约操作。
 * 后端数据结构 / API 永不动；要动态化时只改 mode 开关 + 打开 transition。
 *
 * 稳定契约（未来不破坏）：
 *   SiteApp.init(opts)                 引导：按 mode 取数据并渲染
 *   SiteApp.mount(rootEl, data)        把所有 scene 渲染进容器
 *   SiteApp.renderSection(id, data)    渲染 / 更新单个 section
 *   SiteApp.setData(data)              替换数据并重渲染（无需刷新）
 *   SiteApp.goScene(id, opts)          ★整页动态切换（切花）总开关
 *   SiteApp.on(evt, cb) / _emit(evt)   事件钩子（切换前后等）
 *   SiteApp.sceneManager               场景管理器（含 transition 钩子）
 */
(function (global) {
  'use strict';

  // 简易转义（防 XSS；正文允许受限 HTML 时调用方自行保证）
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const SiteApp = {
    data: null,
    config: { mode: 'static', dynamic: { transition: 'fade', rootScroll: false } },
    mode: 'static',
    rootEl: null,
    _listeners: {},

    // ---------- 事件钩子 ----------
    on(evt, cb) { (this._listeners[evt] = this._listeners[evt] || []).push(cb); return this; },
    _emit(evt, payload) { (this._listeners[evt] || []).forEach(cb => { try { cb(payload); } catch (e) {} }); },

    // ---------- 引导 ----------
    async init(opts) {
      opts = opts || {};
      if (opts.config) this.config = Object.assign(this.config, opts.config);
      if (window.__SITE_CONFIG__) this.config = Object.assign(this.config, window.__SITE_CONFIG__);
      this.mode = this.config.mode || 'static';

      if (opts.data) {
        this.data = opts.data;
      } else if (window.__SITE_DATA__) {
        this.data = window.__SITE_DATA__;
      } else if (this.mode === 'dynamic') {
        // 动态模式：运行时从 API 拉取（需 Node 服务在跑）
        const r = await fetch('/api/site');
        this.data = await r.json();
      } else {
        console.warn('[SiteApp] 无数据来源：请传入 data、内联 window.__SITE_DATA__，或开启 dynamic 模式');
        return this;
      }

      if (opts.mountEl) this.mount(document.querySelector(opts.mountEl), this.data);
      return this;
    },

    // ---------- 挂载全部 scene ----------
    mount(rootEl, data) {
      this.rootEl = rootEl;
      this.data = data || this.data;
      rootEl.innerHTML = '';
      const scenes = (this.data && this.data.scenes) || ['journal'];
      scenes.forEach((id, i) => {
        const el = this.renderSection(id, this.data);
        if (el) {
          el.classList.add('scene');
          el.setAttribute('data-scene', id);
          if (this.mode === 'dynamic') el.style.display = (i === 0 ? '' : 'none');
          rootEl.appendChild(el);
        }
      });
      this._emit('mounted', { scenes });
      return this;
    },

    // ---------- 渲染单个 section（组件化、数据驱动） ----------
    renderSection(id, data) {
      const site = (data && data.site) || {};
      const fn = {
        hero: () => this._renderHero(site.hero),
        stage: () => this._renderQuote(site.quote, site.special),
        quote: () => this._renderQuote(site.quote, site.special),
        about: () => this._renderAbout(site.about),
        journal: () => this._renderJournal(data.articles),
        lab: () => this._renderPlaceholder('lab', 'AI 实验室'),
        career: () => this._renderPlaceholder('career', '事业线')
      }[id];
      return fn ? fn() : this._renderPlaceholder(id, id);
    },

    _renderHero(h) {
      h = h || {};
      const s = document.createElement('section');
      s.className = 'scene-hero';
      s.innerHTML =
        `<h1 class="hero-title">${h.titleHtml || '顾言 <span class="gu">GU</span>事'}</h1>` +
        `<p class="hero-sub">${esc(h.sub)}</p>` +
        `<p class="hero-en">${esc(h.en)}</p>`;
      return s;
    },

    _renderQuote(q, sp) {
      q = q || {}; sp = sp || {};
      const s = document.createElement('section');
      s.className = 'scene-quote';
      s.innerHTML =
        `<div class="kicker">${esc(q.kicker)}</div>` +
        `<div class="quote">${q.line || ''}</div>` +
        `<div class="hint">${esc(q.hint)}</div>`;
      return s;
    },

    _renderAbout(a) {
      a = a || {};
      const s = document.createElement('section');
      s.className = 'scene-about';
      const cards = (a.cards || []).map(c =>
        `<div class="att-card"><div class="num">${esc(c.num)}</div><h3>${esc(c.title)}</h3><p>${esc(c.body)}</p></div>`
      ).join('');
      s.innerHTML =
        `<div class="eyebrow">${esc(a.eyebrow)}</div>` +
        `<h2>${a.heading || ''}</h2>` +
        `<p class="sub">${esc(a.sub)}</p>` +
        `<div class="attitude">${cards}</div>`;
      return s;
    },

    // 日记卡片：产出与现有 index.html 完全兼容的 .card[data-cat] 结构，
    // 将来接入主页时，现有筛选 JS（grid.querySelectorAll('.card')[data-cat]）可直接复用。
    _renderJournal(articles) {
      const grid = document.createElement('div');
      grid.className = 'journal-grid';
      grid.id = 'journalGrid';
      const list = (articles || []).filter(a => a.status !== 'draft');
      const thumbs = ['t1', 't2', 't3', 't4', 't5', 't6'];
      grid.innerHTML = list.map((a, i) => {
        const tc = a.cover
          ? `<div class="thumb" style="background:url('${esc(a.cover)}') center/cover"></div>`
          : `<div class="thumb ${thumbs[i % thumbs.length]}"></div>`;
        const link = a.slug ? `posts/${esc(a.slug)}.html` : '#';
        return `<a class="card reveal" data-cat="${esc(a.category)}" href="${link}">` +
                 tc +
                 `<div class="body"><div class="tag">${esc(a.tag || a.category)}</div>` +
                 `<h3>${esc(a.title)}</h3><p>${esc(a.excerpt)}</p></div></a>`;
      }).join('');
      return grid;
    },

    _renderPlaceholder(id, label) {
      const s = document.createElement('section');
      s.className = 'scene-placeholder';
      s.innerHTML = `<h2>${esc(label)}</h2><p class="sub">（该区块内容将在后续阶段接入；当前以 index.html 为准）</p>`;
      return s;
    },

    // ---------- 替换数据重渲染 ----------
    setData(data) {
      this.data = data;
      if (this.rootEl) this.mount(this.rootEl, data);
      this._emit('dataChanged', { data });
      return this;
    },

    // ---------- ★ 整页动态切换（切花）总开关 ----------
    // static 模式：等同滚动定位（不破坏现有滚动浏览体验）
    // dynamic 模式：仅显示目标 scene 并播放过渡动画
    goScene(id, opts) {
      opts = opts || {};
      const target = this.rootEl && this.rootEl.querySelector(`[data-scene="${id}"]`);
      if (!target) return this;
      this._emit('sceneBefore', { id, target });

      if (this.mode === 'dynamic') {
        this.rootEl.querySelectorAll('.scene').forEach(el => {
          if (el !== target) { el.classList.remove('active'); el.style.display = 'none'; }
        });
        target.style.display = '';
        // 触发过渡（next frame 加 active，让 CSS transition 生效）
        requestAnimationFrame(() => target.classList.add('active'));
        this.sceneManager.transition(this.config.dynamic.transition, target);
      } else {
        target.scrollIntoView({ behavior: opts.smooth !== false ? 'smooth' : 'auto' });
      }

      this.current = id;
      this._emit('sceneAfter', { id, target });
      return this;
    },

    // ---------- 场景管理器（过渡钩子，初始为 no-op，未来打开即生效） ----------
    sceneManager: {
      transition(name, el) {
        // 默认无操作；未来可在此实现 fade / slide / 自定义 Web Animations。
        // preview.html 已通过 CSS [data-scene].active 提供基础 fade 演示。
        if (name === 'fade' && el) el.classList.add('fx-fade');
        else if (name === 'slide' && el) el.classList.add('fx-slide');
      }
    }
  };

  global.SiteApp = SiteApp;
})(window);
