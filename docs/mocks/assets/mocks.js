/*
 * Mission Control mocks: state switching and mock-only interactions.
 *
 * This file is mock chrome, not product code. It makes no network requests
 * and stores nothing. Pages render their default state without it.
 *
 * Markup conventions:
 *   <select data-mock-state>            options list the page's states
 *   data-when="a b"                     shown only in states a or b (ship with `hidden`
 *                                       unless the default state is listed)
 *   data-unless="a b"                   hidden in states a or b
 *   data-attr-<state>="k=v|k2=v2|!k3"   attributes set (or removed with !) in <state>
 *   data-open-when="a b"                a [data-toggle] that starts open in states a or b
 *   data-toggle aria-controls="id"      toggles data-open on #id (menus, drawer)
 *   data-close="id"                     closes #id and returns focus to its toggle
 *   data-nav="href"                     click-through navigation between mocks
 *   data-goto-state="state"             switches state on click (or on form submit)
 *   data-board-column="todo" aria-controls="board-id"   compact column selector
 *   data-toggle-password aria-controls="input-id"       show/hide password
 *   data-copy="text"                    copies text to the clipboard
 *   data-toast="template-id"            shows a toast from a <template>
 *   data-dismiss                        removes the closest .mc-toast
 */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var originals = new WeakMap();
  var attrTargets = [];
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function words(value) {
    return (value || '').split(/[\s,]+/).filter(Boolean);
  }

  function stateSelect() {
    return doc.querySelector('[data-mock-state]');
  }

  function stateFromHash() {
    var match = /(?:^#|&)state=([\w-]+)/.exec(location.hash);
    return match ? match[1] : null;
  }

  function measureBar() {
    var bar = doc.querySelector('.mock-bar');
    var notes = doc.querySelector('.mock-notes');
    var barHeight = bar ? bar.offsetHeight : 0;
    var chrome = barHeight;
    if (notes && !notes.hidden && getComputedStyle(notes).position === 'sticky') {
      chrome += notes.offsetHeight;
    }
    root.style.setProperty('--mock-bar-height', barHeight + 'px');
    root.style.setProperty('--mock-chrome-height', chrome + 'px');
    root.style.setProperty('--mock-sticky-height', stickyHeight() + 'px');
  }

  // Height of the app's own pinned chrome (compact top bar plus a pinned
  // project header or tab strip), so scroll padding keeps focus visible.
  function stickyHeight() {
    var total = 0;
    var topbar = doc.querySelector('.mc-topbar');
    if (topbar && getComputedStyle(topbar).display !== 'none') {
      total += topbar.offsetHeight;
    }
    var pinned = 0;
    doc.querySelectorAll('.mc-project-header, .mc-project-tabs').forEach(function (el) {
      if (el.offsetParent !== null && getComputedStyle(el).position === 'sticky') {
        pinned = Math.max(pinned, el.offsetHeight);
      }
    });
    return total + pinned;
  }

  function collectAttrTargets() {
    doc.querySelectorAll('*').forEach(function (el) {
      for (var i = 0; i < el.attributes.length; i += 1) {
        if (el.attributes[i].name.indexOf('data-attr-') === 0) {
          attrTargets.push(el);
          return;
        }
      }
    });
  }

  function remember(el, name) {
    var saved = originals.get(el);
    if (!saved) {
      saved = {};
      originals.set(el, saved);
    }
    if (!Object.prototype.hasOwnProperty.call(saved, name)) {
      saved[name] = el.hasAttribute(name) ? el.getAttribute(name) : null;
    }
  }

  function syncProperty(el, name) {
    if (name === 'value' && 'value' in el) {
      el.value = el.getAttribute('value') || '';
    }
    if (name === 'checked' && 'checked' in el) {
      el.checked = el.hasAttribute('checked');
    }
    if (name === 'selected' && 'selected' in el) {
      el.selected = el.hasAttribute('selected');
    }
  }

  function restore(el) {
    var saved = originals.get(el);
    if (!saved) {
      return;
    }
    Object.keys(saved).forEach(function (name) {
      if (saved[name] === null) {
        el.removeAttribute(name);
      } else {
        el.setAttribute(name, saved[name]);
      }
      syncProperty(el, name);
    });
  }

  function applyAttrs(el, spec) {
    spec.split('|').forEach(function (pair) {
      var text = pair.trim();
      if (!text) {
        return;
      }
      var remove = text.charAt(0) === '!';
      if (remove) {
        text = text.slice(1);
      }
      var eq = text.indexOf('=');
      var name = (eq === -1 ? text : text.slice(0, eq)).trim();
      var value = eq === -1 ? '' : text.slice(eq + 1).trim();
      remember(el, name);
      if (remove) {
        el.removeAttribute(name);
      } else {
        el.setAttribute(name, value);
      }
      syncProperty(el, name);
    });
  }

  function targetOf(toggle) {
    return doc.getElementById(toggle.getAttribute('aria-controls'));
  }

  function setOpen(toggle, open, moveFocus) {
    var target = targetOf(toggle);
    if (!target) {
      return;
    }
    toggle.setAttribute('aria-expanded', String(open));
    if (open) {
      target.setAttribute('data-open', '');
      if (moveFocus) {
        var first = target.querySelector(FOCUSABLE);
        if (first) {
          first.focus();
        }
      }
    } else {
      target.removeAttribute('data-open');
    }
  }

  function closeAll(keep) {
    doc.querySelectorAll('[data-toggle][aria-expanded="true"]').forEach(function (toggle) {
      var target = targetOf(toggle);
      if (toggle === keep || (keep && target && target.contains(keep))) {
        return;
      }
      setOpen(toggle, false, false);
    });
  }

  function applyState(requested) {
    var select = stateSelect();
    var state = requested;
    if (select) {
      var known = Array.prototype.some.call(select.options, function (option) {
        return option.value === state;
      });
      if (!known) {
        state = select.options.length ? select.options[0].value : 'default';
      }
      select.value = state;
    }
    doc.body.setAttribute('data-state', state);

    doc.querySelectorAll('[data-when]').forEach(function (el) {
      el.hidden = words(el.getAttribute('data-when')).indexOf(state) === -1;
    });
    doc.querySelectorAll('[data-unless]').forEach(function (el) {
      el.hidden = words(el.getAttribute('data-unless')).indexOf(state) !== -1;
    });

    attrTargets.forEach(restore);
    attrTargets.forEach(function (el) {
      var spec = el.getAttribute('data-attr-' + state);
      if (spec !== null) {
        applyAttrs(el, spec);
      }
    });

    doc.querySelectorAll('[data-open-when]').forEach(function (toggle) {
      setOpen(toggle, words(toggle.getAttribute('data-open-when')).indexOf(state) !== -1, false);
    });

    doc.querySelectorAll('.mock-notes').forEach(function (notes) {
      notes.hidden = !notes.querySelector('.mock-note:not([hidden])');
    });

    measureBar();
    revealCurrentTabs();
  }

  function setState(state) {
    applyState(state);
    if (history.replaceState) {
      history.replaceState(null, '', '#state=' + doc.body.getAttribute('data-state'));
    }
  }

  function showToast(templateId) {
    var template = doc.getElementById(templateId);
    var region = doc.querySelector('.mc-toast-region:not(.mc-toast-region--static)');
    if (!template || !region) {
      return;
    }
    region.appendChild(template.content.cloneNode(true));
    while (region.children.length > 3) {
      region.removeChild(region.firstElementChild);
    }
  }

  function copyText(button) {
    var text = button.getAttribute('data-copy');
    var label = button.querySelector('[data-copy-label]') || button;
    var original = label.textContent;
    var done = function () {
      label.textContent = 'Copied';
      setTimeout(function () {
        label.textContent = original;
      }, 1600);
    };
    try {
      navigator.clipboard.writeText(text).then(done, done);
    } catch (error) {
      done();
    }
  }

  function onClick(event) {
    var el = event.target;
    if (!(el instanceof Element)) {
      return;
    }

    var toggle = el.closest('[data-toggle]');
    if (toggle) {
      event.preventDefault();
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      closeAll(toggle);
      setOpen(toggle, open, open && event.detail === 0);
      return;
    }

    if (!el.closest('[data-open]')) {
      closeAll(null);
    }

    var closer = el.closest('[data-close]');
    if (closer) {
      var id = closer.getAttribute('data-close');
      var owner = doc.querySelector('[data-toggle][aria-controls="' + id + '"]');
      if (owner) {
        setOpen(owner, false, false);
        owner.focus();
      }
      return;
    }

    var nav = el.closest('[data-nav]');
    if (nav && !nav.disabled && nav.getAttribute('aria-disabled') !== 'true') {
      location.href = nav.getAttribute('data-nav');
      return;
    }

    var go = el.closest('[data-goto-state]');
    if (go && go.tagName !== 'FORM') {
      event.preventDefault();
      setState(go.getAttribute('data-goto-state'));
      return;
    }

    var column = el.closest('[data-board-column]');
    if (column) {
      var board = targetOf(column);
      if (board) {
        board.setAttribute('data-column', column.getAttribute('data-board-column'));
      }
      column.parentElement.querySelectorAll('[data-board-column]').forEach(function (button) {
        button.setAttribute('aria-pressed', String(button === column));
      });
      return;
    }

    var reveal = el.closest('[data-toggle-password]');
    if (reveal) {
      var input = targetOf(reveal);
      if (input) {
        var showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        reveal.setAttribute('aria-pressed', String(!showing));
      }
      return;
    }

    var copy = el.closest('[data-copy]');
    if (copy) {
      copyText(copy);
      return;
    }

    var toast = el.closest('[data-toast]');
    if (toast) {
      showToast(toast.getAttribute('data-toast'));
      return;
    }

    var dismiss = el.closest('[data-dismiss]');
    if (dismiss) {
      var item = dismiss.closest('.mc-toast');
      if (item) {
        item.remove();
      }
    }
  }

  function onKeydown(event) {
    if (event.key !== 'Escape') {
      return;
    }
    var open = doc.querySelectorAll('[data-toggle][aria-expanded="true"]');
    if (!open.length) {
      return;
    }
    var last = open[open.length - 1];
    closeAll(null);
    last.focus();
  }

  function onSubmit(event) {
    event.preventDefault();
    var next = event.target.getAttribute('data-goto-state');
    if (next) {
      setState(next);
    }
  }

  // Keep the current tab visible when a tab strip scrolls sideways on phones.
  function revealCurrentTabs() {
    doc.querySelectorAll('.mc-tabs').forEach(function (tabs) {
      var current = tabs.querySelector('[aria-current="page"]');
      if (!current || tabs.scrollWidth <= tabs.clientWidth) {
        return;
      }
      var offset = current.getBoundingClientRect().left - tabs.getBoundingClientRect().left;
      tabs.scrollLeft += offset - (tabs.clientWidth - current.offsetWidth) / 2;
    });
  }

  function init() {
    collectAttrTargets();
    var select = stateSelect();
    if (select) {
      select.addEventListener('change', function () {
        setState(select.value);
      });
    }
    applyState(stateFromHash() || (select ? select.value : 'default'));
    doc.addEventListener('click', onClick);
    doc.addEventListener('keydown', onKeydown);
    doc.addEventListener('submit', onSubmit);
    window.addEventListener('resize', measureBar);
    window.addEventListener('hashchange', function () {
      var state = stateFromHash();
      if (state) {
        applyState(state);
      }
    });
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
