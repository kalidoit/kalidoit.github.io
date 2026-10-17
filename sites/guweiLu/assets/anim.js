/*
 * anim.js — 个人保险站 GSAP 动画层（渐进增强）
 * -------------------------------------------------------------
 * 设计原则（与项目铁律一致，绝不做破坏性改动）：
 *  1. 仅在 GSAP 成功加载后才运行；库缺失时整站保持静态，内容默认可见、不影响阅读。
 *  2. 尊重 prefers-reduced-motion：用户开启「减少动态」时完全不跑任何动画。
 *  3. 纯加法：不接管现有 .reveal 入场、.open 灯箱开关、主题切换等逻辑，
 *     只增强「未被 CSS/现有 JS 管控」的元素：
 *       · 信任指标数字 count-up（.tb-num / .num）
 *       · 履历灯箱(#lb) 内部 #lbNum / #lbTag 入场 stagger
 *       · 首屏装饰层 .orb / .hero-bg 缓慢呼吸（文本入场仍由 .reveal 负责）
 *       · 信任带 .tb-item 克制 hover 上浮
 *  4. 全部用 gsap.fromTo / gsap.to，避免与现有 transition（如 .lb-text 的 .2s）冲突。
 */
(function () {
  'use strict';

  if (typeof window.gsap === 'undefined') return; // 库未加载 → 静默退出，内容照常显示

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return; // 无障碍：零动画

  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  onReady(function () {
    try {

      /* ---------- 2) 数字 count-up（信任指标） ---------- */
      // about: .tb-num（数字文本节点 + <span> 单位）；index: .num（纯数字 span）
      var counters = document.querySelectorAll('.tb-num, .num');
      if (counters.length) {
        var countIO = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            animateCount(en.target);
            countIO.unobserve(en.target);
          });
        }, { threshold: 0.4 });
        counters.forEach(function (el) { countIO.observe(el); });
      }

      function animateCount(el) {
        // 数字节点：about .tb-num 的首个文本节点（其后跟 <span> 单位）；
        // index .num 整体即数字（其首个子节点也是文本节点）。
        var isTextNode = !!(el.firstChild && el.firstChild.nodeType === 3);
        var raw = (isTextNode ? el.firstChild.nodeValue : el.textContent).trim();
        var m = raw.match(/[\d,]+/);
        if (!m) return;
        var target = parseInt(m[0].replace(/,/g, ''), 10);
        if (isNaN(target) || target <= 0) return;
        var obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 1.4,
          ease: 'power2.out',
          onUpdate: function () {
            var val = Math.round(obj.v).toLocaleString('en-US');
            if (isTextNode) el.firstChild.nodeValue = val;
            else el.textContent = val;
          }
        });
      }

      /* ---------- 4) 履历灯箱(#lb) 内部文案 GSAP 入场 ---------- */
      // 监听 .open 类：仅对未被现有逻辑管控的 #lbNum / #lbTag 做 stagger，
      // 避开有 CSS .2s 过渡的 #lbText 与有 .ok 切换的 #lbImg，绝不重写开关。
      var lb = document.getElementById('lb');
      if (lb) {
        var lbMO = new MutationObserver(function () {
          if (lb.classList.contains('open')) {
            gsap.fromTo('#lbNum, #lbTag',
              { y: 14, autoAlpha: 0 },
              { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.1,
                ease: 'power2.out', delay: 0.12, overwrite: 'auto' });
          }
        });
        lbMO.observe(lb, { attributes: true, attributeFilter: ['class'] });
      }

      /* ---------- 1) 首屏氛围增强（装饰层；文本入场仍由 .reveal 负责） ---------- */
      if (document.querySelector('.orb')) {
        gsap.to('.orb', {
          y: '+=16', duration: 5.5, ease: 'sine.inOut',
          yoyo: true, repeat: -1, stagger: { each: 1.3, from: 'random' }
        });
      }
      var heroBg = document.querySelector('.hero-bg');
      if (heroBg) {
        gsap.to(heroBg, {
          scale: 1.06, opacity: 0.85, duration: 9,
          ease: 'sine.inOut', yoyo: true, repeat: -1
        });
      }

      /* ---------- hover 微交互（克制，最后做） ---------- */
      // 信任带 .tb-item 轻微上浮；该元素无既有 transform hover，纯加法。
      document.querySelectorAll('.tb-item').forEach(function (item) {
        item.addEventListener('mouseenter', function () {
          gsap.to(item, { y: -4, duration: 0.3, ease: 'power2.out' });
        });
        item.addEventListener('mouseleave', function () {
          gsap.to(item, { y: 0, duration: 0.4, ease: 'power2.out' });
        });
      });

    } catch (e) {
      // 单处异常不应影响页面其它逻辑；静默降级为静态内容。
      if (window.console) console.warn('anim.js 运行异常，已降级：', e);
    }
  });
})();
