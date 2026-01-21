/**
 * Shared layout components for UI pages
 */

import { getHighlightStyles } from "@atomic-ehr/hl7v2/src/hl7v2/highlight";

export type NavTab =
  | "invoices"
  | "outgoing"
  | "incoming"
  | "mllp-client"
  | "mapping-tasks"
  | "code-mappings";

export interface NavData {
  pendingMappingTasksCount: number;
}

export function renderNav(active: NavTab, navData: NavData): string {
  const tabs: Array<{
    id: NavTab;
    href: string;
    label: string;
    badge?: number;
  }> = [
    { id: "invoices", href: "/invoices", label: "Invoices" },
    { id: "outgoing", href: "/outgoing-messages", label: "Outgoing Messages" },
    { id: "incoming", href: "/incoming-messages", label: "Incoming Messages" },
    {
      id: "mapping-tasks",
      href: "/mapping/tasks",
      label: "Mapping Tasks",
      badge: navData.pendingMappingTasksCount,
    },
    { id: "code-mappings", href: "/mapping/table", label: "Code Mappings" },
    { id: "mllp-client", href: "/mllp-client", label: "MLLP Test Client" },
  ];

  return `
  <nav class="bg-white shadow mb-6">
    <div class="container mx-auto px-4">
      <div class="flex space-x-4">
        ${tabs
          .map(
            (tab) => `
        <a href="${tab.href}" class="py-4 px-2 border-b-2 flex items-center gap-2 ${active === tab.id ? "border-blue-500 text-blue-600 font-semibold" : "border-transparent text-gray-600 hover:text-gray-800"}">
          ${tab.label}
          ${tab.badge && tab.badge > 0 ? `<span class="px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">${tab.badge}</span>` : ""}
        </a>`,
          )
          .join("")}
      </div>
    </div>
  </nav>`;
}

export function renderLayout(
  title: string,
  nav: string,
  content: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${getHighlightStyles()}

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
    .loinc-autocomplete-wrapper {
      position: relative;
    }
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
    .loinc-dropdown-item:last-child {
      border-bottom: none;
    }
    .loinc-dropdown-item:hover {
      background: #f9fafb;
    }
    .loinc-dropdown-item.selected {
      background: #eff6ff;
    }
    .loinc-error {
      color: #dc2626;
      font-size: 0.875rem;
      margin-top: 4px;
    }
    .loinc-selected {
      background: #ecfdf5;
      border-color: #10b981;
    }
  </style>
</head>
<body class="bg-gray-100 min-h-screen">
  ${nav}
  <div class="container mx-auto px-4 pb-8">
    ${content}
  </div>
  <script>
    // LOINC Autocomplete
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

            // Clear hidden display field
            const form = input.closest('form');
            const displayInput = form?.querySelector('input[name="loincDisplay"]');
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

          // Prevent form submission if no valid selection
          const form = input.closest('form');
          if (form) {
            form.addEventListener('submit', (e) => {
              const displayInput = form.querySelector('input[name="loincDisplay"]');
              if (!displayInput?.value) {
                e.preventDefault();
                errorDiv.textContent = 'Please select a LOINC code from the dropdown';
                errorDiv.classList.remove('hidden');
              }
            });
          }
        });

        // Close dropdown when clicking outside
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
          item.innerHTML = \`
            <div class="font-mono font-medium text-sm">\${r.code}</div>
            <div class="text-sm text-gray-700">\${r.display}</div>
            \${r.component ? \`<div class="text-xs text-gray-500 mt-1">\${[r.component, r.property, r.timing, r.scale].filter(Boolean).join(' | ')}</div>\` : ''}
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
        const displayInput = form?.querySelector('input[name="loincDisplay"]');
        if (displayInput) displayInput.value = result.display;

        const errorDiv = wrapper.querySelector('.loinc-error');
        if (errorDiv) errorDiv.classList.add('hidden');

        hideDropdown();
      }

      // Initialize on DOM ready and after any dynamic content loads
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAutocomplete);
      } else {
        initAutocomplete();
      }
    })();
  </script>
</body>
</html>`;
}
