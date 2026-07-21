/**
 * Interactive command variable substitution for nvidia-dgx-spark-lab docs.
 * Users edit values in the panel; all {{PLACEHOLDER}} in following code blocks update live.
 * Copy buttons use the live substituted text.
 *
 * Usage in markdown:
 * <div class="cluster-config" data-vars="SPARK0_IP,NAMESPACE">
 *   <label>SPARK0_IP: <input data-var="SPARK0_IP" value="localhost" placeholder="spark0-ip"></label>
 * </div>
 *
 * Then in code:
 * ```bash
 * export KUBECONFIG=...
 * ./scripts/manage.sh status   # host: {{SPARK0_IP}}
 * ```
 *
 * Init contract (regression-tested):
 * 1. Seed vars from input HTML defaults.
 * 2. Overlay localStorage (user values win).
 * 3. Write merged values back to inputs.
 * 4. Apply substitution immediately (no raw {{PLACEHOLDER}} left for known keys).
 * 5. Sync profile button primary class to match resolved SPARK0_IP.
 *
 * NOTE: Noisy GitHub API 404s (for repo stats + releases) from the Material
 * theme are suppressed via docs/hooks.py (early inline patch injected in <head>).
 */

(function () {
  function getStorageKey() {
    return "dgx-lab-docs-cluster-vars";
  }

  function loadVars() {
    try {
      return JSON.parse(localStorage.getItem(getStorageKey()) || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveVars(vars) {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(vars));
    } catch (e) {
      /* ignore quota / private mode */
    }
  }

  function debounce(fn, delay) {
    var timer = null;
    return function () {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  }

  /**
   * Merge input defaults with localStorage. Storage wins for non-empty values.
   * @param {Record<string, string>} defaults
   * @param {Record<string, string>} stored
   * @returns {Record<string, string>}
   */
  function mergeVars(defaults, stored) {
    var out = {};
    var key;
    for (key in defaults) {
      if (Object.prototype.hasOwnProperty.call(defaults, key)) {
        out[key] = defaults[key];
      }
    }
    for (key in stored) {
      if (Object.prototype.hasOwnProperty.call(stored, key)) {
        var v = stored[key];
        if (v !== undefined && v !== null && String(v).length > 0) {
          out[key] = String(v);
        }
      }
    }
    return out;
  }

  /**
   * Map resolved vars to a known profile button id, or null.
   * @param {Record<string, string>} vars
   * @returns {string|null}
   */
  function profileForVars(vars) {
    var ip = (vars.SPARK0_IP || "").trim();
    if (ip === "localhost" || ip === "127.0.0.1") {
      return "1node";
    }
    if (ip === "192.168.1.10") {
      return "2node";
    }
    return null;
  }

  /**
   * Apply known profile values into vars (mutates and returns vars).
   * @param {string} prof
   * @param {Record<string, string>} vars
   * @returns {Record<string, string>}
   */
  function applyProfile(prof, vars) {
    if (prof === "1node") {
      vars.SPARK0_IP = "localhost";
      vars.NAMESPACE = vars.NAMESPACE || "ai-inference";
      if (!vars.DASHBOARD_PORT) {
        vars.DASHBOARD_PORT = "32082";
      }
    } else if (prof === "2node") {
      vars.SPARK0_IP = "192.168.1.10";
      vars.NAMESPACE = vars.NAMESPACE || "ai-inference";
      if (!vars.DASHBOARD_PORT) {
        vars.DASHBOARD_PORT = "32082";
      }
    }
    return vars;
  }

  function applyToElement(el, vars) {
    var original = el.dataset.originalText || el.textContent;
    if (!el.dataset.originalText) {
      el.dataset.originalText = original;
    }

    var text = original;
    Object.keys(vars).forEach(function (key) {
      var val = vars[key];
      if (val === undefined || val === null || val === "") {
        val = "{{" + key + "}}";
      }
      var re = new RegExp("\\{\\{" + key + "\\}\\}", "g");
      text = text.replace(re, val);
    });
    el.textContent = text;

    var pre = el.closest("pre");
    if (pre) {
      pre.dataset.clipboardText = text;
      pre._clipboardTextEl = el;
      var copyBtn = pre.parentElement && pre.parentElement.querySelector("button");
      if (copyBtn && (copyBtn.title || "").toLowerCase().includes("copy")) {
        copyBtn.dataset.clipboardText = text;
      }
    }
  }

  function updateAllBlocks(vars) {
    document.querySelectorAll("code, pre code, .highlight code").forEach(function (codeEl) {
      var hasNow = codeEl.textContent && /\{\{.*\}\}/.test(codeEl.textContent);
      var hasOriginal = !!codeEl.dataset.originalText;
      if (hasNow || hasOriginal) {
        applyToElement(codeEl, vars);
      }
    });
    document.querySelectorAll("[data-var-template]").forEach(function (el) {
      var hasNow = el.textContent && /\{\{.*\}\}/.test(el.textContent);
      var hasOriginal = !!el.dataset.originalText;
      if (hasNow || hasOriginal || el.hasAttribute("data-var-template")) {
        applyToElement(el, vars);
      }
    });
  }

  var debouncedUpdateAllBlocks = debounce(function (vars) {
    updateAllBlocks(vars);
  }, 32);

  function syncProfileButtons(panel, vars) {
    var active = profileForVars(vars);
    panel.querySelectorAll("[data-profile]").forEach(function (b) {
      if (active && b.dataset.profile === active) {
        b.classList.add("md-button--primary");
      } else {
        b.classList.remove("md-button--primary");
      }
    });
  }

  function seedDefaultsFromInputs(inputs) {
    var defaults = {};
    inputs.forEach(function (input) {
      var key = input.dataset.var;
      if (key) {
        defaults[key] = (input.value || "").trim();
      }
    });
    return defaults;
  }

  function writeVarsToInputs(inputs, vars) {
    inputs.forEach(function (input) {
      var key = input.dataset.var;
      if (key && vars[key] !== undefined) {
        input.value = vars[key];
      }
    });
  }

  function bindConfigPanel(panel) {
    if (panel._clusterBound) {
      return;
    }
    panel._clusterBound = true;

    var inputs = panel.querySelectorAll("input[data-var]");
    var defaults = seedDefaultsFromInputs(inputs);
    var vars = mergeVars(defaults, loadVars());
    writeVarsToInputs(inputs, vars);

    inputs.forEach(function (input) {
      var key = input.dataset.var;
      input.addEventListener("input", function () {
        vars[key] = input.value.trim();
        saveVars(vars);
        updateAllBlocks(vars);
        syncProfileButtons(panel, vars);
      });
    });

    panel.querySelectorAll("[data-profile]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyProfile(btn.dataset.profile, vars);
        writeVarsToInputs(inputs, vars);
        saveVars(vars);
        updateAllBlocks(vars);
        syncProfileButtons(panel, vars);
      });
    });

    // Initial apply — content must match panel without requiring a toggle first.
    updateAllBlocks(vars);
    syncProfileButtons(panel, vars);
  }

  function init() {
    var panels = document.querySelectorAll(".cluster-config, [data-cluster-config]");
    if (panels.length === 0) {
      var main = document.querySelector("main") || document.body;
      if (main && /getting-started|dev-workspaces|index/.test(location.pathname)) {
        var div = document.createElement("div");
        div.className = "cluster-config admonition info";
        div.innerHTML =
          "<p><strong>Edit cluster variables</strong> — values are substituted live in all code examples below and used for Copy.</p>" +
          "<div>" +
          '<label>SPARK0_IP: <input data-var="SPARK0_IP" value="localhost" placeholder="spark0-ip"></label> ' +
          '<label>NAMESPACE: <input data-var="NAMESPACE" value="ai-inference"></label> ' +
          '<label>PORT example: <input data-var="DASHBOARD_PORT" value="32082"></label>' +
          "</div>" +
          "<div>" +
          '<button type="button" data-profile="1node" class="md-button md-button--primary">1-node / localhost profile</button> ' +
          '<button type="button" data-profile="2node" class="md-button">2-node typical profile</button> ' +
          "<small>(live updates + copy buttons respect current values)</small>" +
          "</div>";
        var firstH1 = main.querySelector("h1");
        if (firstH1) {
          firstH1.parentNode.insertBefore(div, firstH1.nextSibling);
        } else {
          main.prepend(div);
        }
        panels = [div];
      }
    }

    panels.forEach(bindConfigPanel);

    var observer = new MutationObserver(function (mutations) {
      var vars = loadVars();
      var shouldUpdate = false;
      var panelsToBind = [];

      for (var i = 0; i < mutations.length; i++) {
        var mutation = mutations[i];
        for (var j = 0; j < mutation.addedNodes.length; j++) {
          var node = mutation.addedNodes[j];
          if (node.nodeType === 1) {
            var el = /** @type {Element} */ (node);
            if (
              el.tagName === "CODE" ||
              el.tagName === "PRE" ||
              (el.classList && el.classList.contains("highlight")) ||
              (el.querySelector && el.querySelector("code, pre, .highlight, [data-var-template]"))
            ) {
              shouldUpdate = true;
            }
            if (el.classList && el.classList.contains("cluster-config")) {
              panelsToBind.push(el);
            } else if (el.querySelector) {
              var nested = el.querySelectorAll(".cluster-config, [data-cluster-config]");
              for (var k = 0; k < nested.length; k++) {
                panelsToBind.push(nested[k]);
              }
            }
          }
        }
      }

      for (var p = 0; p < panelsToBind.length; p++) {
        bindConfigPanel(panelsToBind[p]);
      }

      if (shouldUpdate || panelsToBind.length > 0) {
        // Prefer live panel inputs over storage alone when present.
        var panel = document.querySelector(".cluster-config, [data-cluster-config]");
        if (panel) {
          var live = seedDefaultsFromInputs(panel.querySelectorAll("input[data-var]"));
          vars = mergeVars(live, vars);
        }
        debouncedUpdateAllBlocks(vars);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Expose pure helpers for Playwright contract checks (non-enumerable-ish via window).
  window.__dgxCommandVars = {
    mergeVars: mergeVars,
    profileForVars: profileForVars,
    applyProfile: applyProfile,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
