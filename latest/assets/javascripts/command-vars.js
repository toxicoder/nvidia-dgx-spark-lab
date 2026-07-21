/**
 * Interactive command variable substitution for nvidia-dgx-spark-lab docs.
 * Users edit values in the panel; all {{PLACEHOLDER}} in following code blocks update live.
 * Copy buttons use the live substituted text.
 *
 * Usage in markdown:
 * <div class="cluster-config" data-vars="SPARK0_IP,NAMESPACE">
 *   <label>SPARK0_IP: <input data-var="SPARK0_IP" value="192.168.1.10" placeholder="spark0-ip"></label>
 * </div>
 *
 * Then in code:
 * ```bash
 * export KUBECONFIG=...
 * ./scripts/manage.sh status   # host: {{SPARK0_IP}}
 * ```
 *
 * NOTE: Noisy GitHub API 404s (for repo stats + releases) from the Material
 * theme are suppressed via docs/hooks.py (early inline patch injected in <head>).
 * We intentionally keep repo_url/edit_uri for "Edit page" and repo links.
 */

(function () {
  function getStorageKey() { return 'dgx-lab-docs-cluster-vars'; }

  function loadVars() {
    try {
      return JSON.parse(localStorage.getItem(getStorageKey()) || '{}');
    } catch (e) { return {}; }
  }
  function saveVars(vars) {
    try { localStorage.setItem(getStorageKey(), JSON.stringify(vars)); } catch (e) {}
  }

  function debounce(fn, delay) {
    let timer = null;
    return function () {
      const context = this;
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  }

  function applyToElement(el, vars) {
    const original = el.dataset.originalText || el.textContent;
    if (!el.dataset.originalText) el.dataset.originalText = original;

    let text = original;
    Object.keys(vars).forEach(function (key) {
      const val = vars[key] || '{{' + key + '}}';
      const re = new RegExp('\\{\\{' + key + '\\}\\}', 'g');
      text = text.replace(re, val);
    });
    if (text !== original) {
      el.textContent = text;
    }

    // Support Material copy buttons (content.code.copy feature).
    // The copy JS may snapshot at creation time or read current textContent/innerText at click.
    // We keep pre.dataset.clipboardText in sync (common pattern) and the code textContent.
    const pre = el.closest('pre');
    if (pre) {
      pre.dataset.clipboardText = text;
      pre._clipboardTextEl = el;
      // Also try to update any sibling/nearby copy button that may have been created by Material
      const copyBtn = pre.parentElement && pre.parentElement.querySelector('button');
      if (copyBtn && (copyBtn.title || '').toLowerCase().includes('copy')) {
        copyBtn.dataset.clipboardText = text;
      }
    }
  }

  function updateAllBlocks(vars) {
    // Quick bail if nothing to substitute (avoids expensive queries on most pages/mutations)
    const bodyText = document.body.textContent || '';
    if (!bodyText.includes('{{') && !bodyText.includes('data-var')) {
      // Still allow re-apply for elements that were previously registered via dataset
      // (their live textContent no longer contains {{ after substitution)
    }

    // Update any code block (or marked block) that has been registered with an original
    // containing placeholders. This ensures buttons and inputs always trigger
    // live substitution even after previous replacements.
    document.querySelectorAll('code, pre code, .highlight code').forEach(function (codeEl) {
      const hasNow = codeEl.textContent && /\{\{.*\}\}/.test(codeEl.textContent);
      const hasOriginal = !!codeEl.dataset.originalText;
      if (hasNow || hasOriginal) {
        applyToElement(codeEl, vars);
      }
    });
    // Also support explicit marked blocks
    document.querySelectorAll('[data-var-template]').forEach(function (el) {
      const hasNow = el.textContent && /\{\{.*\}\}/.test(el.textContent);
      const hasOriginal = !!el.dataset.originalText;
      if (hasNow || hasOriginal || el.hasAttribute('data-var-template')) {
        applyToElement(el, vars);
      }
    });
  }

  const debouncedUpdateAllBlocks = debounce(function (vars) {
    updateAllBlocks(vars);
  }, 32);  // ~1 frame; smooth for user edits, prevents thrashing from instant nav mutations

  function bindConfigPanel(panel) {
    if (panel._clusterBound) return;
    panel._clusterBound = true;

    const inputs = panel.querySelectorAll('input[data-var]');
    const vars = loadVars();

    inputs.forEach(function (input) {
      const key = input.dataset.var;
      if (vars[key]) input.value = vars[key];

      input.addEventListener('input', function () {
        vars[key] = input.value.trim();
        saveVars(vars);
        // Direct call for responsive typing in the panel (debounce is mainly for observer noise)
        updateAllBlocks(vars);
      });
    });

    // Profile buttons
    const profiles = panel.querySelectorAll('[data-profile]');
    profiles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const prof = btn.dataset.profile;
        if (prof === '1node') {
          vars.SPARK0_IP = 'localhost';
          vars.NAMESPACE = 'ai-inference';
        } else if (prof === '2node') {
          vars.SPARK0_IP = '192.168.1.10';
          vars.NAMESPACE = 'ai-inference';
        }
        // Apply to inputs (force even previously populated values)
        inputs.forEach(function (i) {
          if (vars[i.dataset.var] !== undefined) i.value = vars[i.dataset.var];
        });
        saveVars(vars);
        updateAllBlocks(vars);
        // Visual feedback for active profile
        panel.querySelectorAll('[data-profile]').forEach(function (b) {
          b.classList.remove('md-button--primary');
        });
        btn.classList.add('md-button--primary');
      });
    });

    // Initial apply
    updateAllBlocks(vars);
  }

  function init() {
    // Find or create a global config if none on page
    let panels = document.querySelectorAll('.cluster-config, [data-cluster-config]');
    if (panels.length === 0) {
      // Auto-inject a minimal one at top of main content for getting-started style pages
      const main = document.querySelector('main') || document.body;
      if (main && /getting-started|dev-workspaces|index/.test(location.pathname)) {
        const div = document.createElement('div');
        div.className = 'cluster-config admonition info';
        div.innerHTML = `
          <p><strong>Edit cluster variables</strong> — values are substituted live in all code examples below and used for Copy.</p>
          <div>
            <label>SPARK0_IP: <input data-var="SPARK0_IP" value="192.168.1.10" placeholder="spark0-ip"></label>
            <label>NAMESPACE: <input data-var="NAMESPACE" value="ai-inference"></label>
            <label>PORT example: <input data-var="DASHBOARD_PORT" value="32082"></label>
          </div>
          <div>
            <button data-profile="1node" class="md-button md-button--primary">1-node / localhost profile</button>
            <button data-profile="2node" class="md-button">2-node typical profile</button>
            <small>(live updates + copy buttons respect current values)</small>
          </div>
        `;
        const firstH1 = main.querySelector('h1');
        if (firstH1) firstH1.parentNode.insertBefore(div, firstH1.nextSibling);
        else main.prepend(div);
        panels = [div];
      }
    }

    panels.forEach(bindConfigPanel);

    // Also react to Material's dynamic content (tabs, instant nav, search, etc.)
    // Use debounced + cheap placeholder check + only react to added nodes that look relevant.
    // This prevents the page from becoming unresponsive due to constant full scans.
    const observer = new MutationObserver(function (mutations) {
      const vars = loadVars();
      let shouldUpdate = false;
      const panelsToBind = [];

      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        for (let j = 0; j < mutation.addedNodes.length; j++) {
          const node = mutation.addedNodes[j];
          if (node.nodeType === 1) { // ELEMENT_NODE
            const el = /** @type {Element} */ (node);
            if (
              el.tagName === 'CODE' ||
              el.tagName === 'PRE' ||
              el.classList.contains('highlight') ||
              el.querySelector('code, pre, .highlight, [data-var-template]')
            ) {
              shouldUpdate = true;
            }
            // Also catch dynamically inserted cluster-config panels (e.g. instant nav)
            // so their inputs/buttons get wired and LS values are applied to them.
            if (el.classList && el.classList.contains('cluster-config')) {
              panelsToBind.push(el);
            } else if (el.querySelector) {
              const nested = el.querySelectorAll('.cluster-config, [data-cluster-config]');
              for (let k = 0; k < nested.length; k++) {
                panelsToBind.push(nested[k]);
              }
            }
            if (shouldUpdate && panelsToBind.length > 0) break;
          }
        }
        if (shouldUpdate && panelsToBind.length > 0) break;
      }

      // Bind any newly arrived panels (guarded inside bindConfigPanel to avoid dups)
      for (let p = 0; p < panelsToBind.length; p++) {
        bindConfigPanel(panelsToBind[p]);
      }

      if (shouldUpdate || panelsToBind.length > 0) {
        debouncedUpdateAllBlocks(vars);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
