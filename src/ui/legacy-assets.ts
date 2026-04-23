// Styles and scripts carried from the original Tailwind-based layout.
// Both `renderLayout` (legacy) and `renderShell` (new) embed these so page
// bodies that still rely on HL7 highlighting, LOINC autocomplete, or the
// Aidbox health dot continue to work during the refactor. Once every page
// body is rebuilt against the warm-paper design, the pieces tied to
// Tailwind markup (tooltip CSS, LOINC dropdown CSS) can retire.

import { getHighlightStyles } from "@atomic-ehr/hl7v2/src/hl7v2/highlight";

export const LEGACY_STYLES = `
${getHighlightStyles()}

/* Aidbox health dot — state driven by data-health-state attribute. */
[data-health-dot] {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d1d5db;
  flex-shrink: 0;
}
[data-health-dot][data-health-state="up"] { background: #22c55e; }
[data-health-dot][data-health-state="down"] { background: #ef4444; }

/* Custom tooltips for HL7 messages (show on hover) */
.hl7-message-container [data-tooltip] {
  position: relative;
}
.hl7-message-container [data-tooltip]::after {
  content: attr(data-tooltip);
  position: absolute;
  left: 0;
  top: 100%;
  background: #1e293b;
  color: #f8fafc;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  z-index: 100;
  pointer-events: none;
  margin-top: 4px;
  font-weight: normal;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s, visibility 0.15s;
}
.hl7-message-container [data-tooltip]:hover::after {
  opacity: 1;
  visibility: visible;
}

/* LOINC autocomplete dropdown */
.loinc-autocomplete-wrapper { position: relative; }
.loinc-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 300px;
  overflow-y: auto;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  z-index: 50;
  margin-top: 4px;
}
.loinc-dropdown-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
}
.loinc-dropdown-item:last-child { border-bottom: none; }
.loinc-dropdown-item:hover { background: #f9fafb; }
.loinc-dropdown-item.selected { background: #eff6ff; }
.loinc-error {
  color: #dc2626;
  font-size: 0.875rem;
  margin-top: 4px;
}
.loinc-selected {
  background: #ecfdf5;
  border-color: #10b981;
}
`;

// Polls /api/health every 10s and updates the status dot/label in the nav.
// Legacy layout renders the dot in the top nav; the new shell renders it
// in the sidebar footer. Both use the same data-health-* hooks.
export const HEALTH_CHECK_SCRIPT = `
(function() {
  const dot = document.querySelector('[data-health-dot]');
  const label = document.querySelector('[data-health-label]');
  const tooltip = document.querySelector('[data-health-tooltip]');
  if (!dot) return;

  async function check() {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) {
        dot.setAttribute('data-health-state', 'up');
        if (label) label.textContent = 'Aidbox';
        if (tooltip) tooltip.setAttribute('title', 'Aidbox up (' + data.ms + 'ms)');
      } else {
        dot.setAttribute('data-health-state', 'down');
        if (label) label.textContent = 'Aidbox down';
        if (tooltip) tooltip.setAttribute('title', 'Aidbox down: ' + (data.error || 'unreachable'));
      }
    } catch (err) {
      dot.setAttribute('data-health-state', 'down');
      if (label) label.textContent = 'Health check failed';
      if (tooltip) tooltip.setAttribute('title', 'Health check failed: ' + err.message);
    }
  }

  check();
  setInterval(check, 10000);
})();
`;

export const HL7_TOOLTIP_SCRIPT = `
function mergeHl7Tooltips(root) {
  const scope = root || document;
  const fieldWrappers = scope.querySelectorAll('.hl7-message-container .hl7-field-wrap[data-tooltip]');

  fieldWrappers.forEach((fieldWrapper) => {
    const fieldTooltip = fieldWrapper.getAttribute('data-tooltip');
    if (!fieldTooltip) return;

    const componentFields = fieldWrapper.querySelectorAll('.hl7-field[data-tooltip]');
    if (componentFields.length === 0) return;

    componentFields.forEach((componentField) => {
      const componentTooltip = componentField.getAttribute('data-tooltip');
      if (!componentTooltip) return;
      componentField.setAttribute('data-tooltip', fieldTooltip + ' -> ' + componentTooltip);
    });

    fieldWrapper.removeAttribute('data-tooltip');
  });
}

window.mergeHl7Tooltips = mergeHl7Tooltips;
`;

export const LOINC_AUTOCOMPLETE_SCRIPT = `
(function() {
  const DEBOUNCE_MS = 400;
  let debounceTimer = null;
  let currentDropdown = null;
  let selectedIndex = -1;

  function initAutocomplete() {
    document.querySelectorAll('[data-loinc-autocomplete]').forEach(input => {
      if (input.dataset.loincInitialized) return;
      input.dataset.loincInitialized = 'true';

      const wrapper = document.createElement('div');
      wrapper.className = 'loinc-autocomplete-wrapper';
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      const errorDiv = document.createElement('div');
      errorDiv.className = 'loinc-error hidden';
      wrapper.appendChild(errorDiv);

      input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        hideDropdown();
        errorDiv.classList.add('hidden');
        input.classList.remove('loinc-selected');

        const form = input.closest('form');
        const displayInput =
          form?.querySelector('input[name="resolvedDisplay"]') ||
          form?.querySelector('input[name="targetDisplay"]');
        if (displayInput) displayInput.value = '';

        if (query.length < 2) return;

        debounceTimer = setTimeout(() => searchLoinc(query, input, wrapper, errorDiv), DEBOUNCE_MS);
      });

      input.addEventListener('keydown', (e) => {
        if (!currentDropdown) return;
        const items = currentDropdown.querySelectorAll('.loinc-dropdown-item');
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
          updateSelection(items);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, 0);
          updateSelection(items);
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
          e.preventDefault();
          items[selectedIndex]?.click();
        } else if (e.key === 'Escape') {
          hideDropdown();
        }
      });

      const form = input.closest('form');
      if (form) {
        form.addEventListener('submit', (e) => {
          const displayInput =
            form.querySelector('input[name="resolvedDisplay"]') ||
            form.querySelector('input[name="targetDisplay"]');
          if (!displayInput?.value) {
            e.preventDefault();
            errorDiv.textContent = 'Please select a LOINC code from the dropdown';
            errorDiv.classList.remove('hidden');
          }
        });
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.loinc-autocomplete-wrapper')) {
        hideDropdown();
      }
    });
  }

  async function searchLoinc(query, input, wrapper, errorDiv) {
    try {
      const res = await fetch('/api/terminology/loinc?q=' + encodeURIComponent(query));
      const data = await res.json();
      if (data.results?.length > 0) {
        showDropdown(data.results, input, wrapper);
      } else {
        errorDiv.textContent = 'No results found';
        errorDiv.classList.remove('hidden');
      }
    } catch (err) {
      errorDiv.textContent = 'Search failed';
      errorDiv.classList.remove('hidden');
    }
  }

  function showDropdown(results, input, wrapper) {
    hideDropdown();
    selectedIndex = -1;

    const dropdown = document.createElement('div');
    dropdown.className = 'loinc-dropdown';
    currentDropdown = dropdown;

    results.forEach((r, i) => {
      const item = document.createElement('div');
      item.className = 'loinc-dropdown-item';

      const axisParts = [
        r.component ? 'Component: ' + r.component : null,
        r.property ? 'Property: ' + r.property : null,
        r.timing,
        r.scale
      ].filter(Boolean);

      item.innerHTML = \`
        <div class="flex items-baseline gap-2">
          <span class="font-mono font-medium text-sm text-blue-600">\${r.code}</span>
          <span class="text-sm text-gray-800 truncate">\${r.display}</span>
        </div>
        \${axisParts.length > 0 ? \`<div class="text-xs text-gray-500 mt-0.5">\${axisParts.join(' · ')}</div>\` : ''}
      \`;
      item.addEventListener('click', () => selectItem(r, input, wrapper));
      dropdown.appendChild(item);
    });

    wrapper.appendChild(dropdown);
  }

  function hideDropdown() {
    if (currentDropdown) {
      currentDropdown.remove();
      currentDropdown = null;
    }
    selectedIndex = -1;
  }

  function updateSelection(items) {
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === selectedIndex);
    });
    if (selectedIndex >= 0) {
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }

  function selectItem(result, input, wrapper) {
    input.value = result.code;
    input.classList.add('loinc-selected');

    const form = input.closest('form');
    const displayInput =
      form?.querySelector('input[name="resolvedDisplay"]') ||
      form?.querySelector('input[name="targetDisplay"]');
    if (displayInput) displayInput.value = result.display;

    const errorDiv = wrapper.querySelector('.loinc-error');
    if (errorDiv) errorDiv.classList.add('hidden');

    hideDropdown();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      mergeHl7Tooltips();
      initAutocomplete();
    });
  } else {
    mergeHl7Tooltips();
    initAutocomplete();
  }
})();
`;
