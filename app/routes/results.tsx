import { createRoute } from 'honox/factory'
import { isValidDomain } from '../lib/dns'

export default createRoute(async (c) => {
  const domain = c.req.query('domain') || ''

  if (!domain) {
    return c.redirect('/')
  }

  if (!isValidDomain(domain)) {
    return c.render(
      <div class="py-8">
        <div class="max-w-4xl mx-auto px-4">
          <a href="/" class="text-blue-600 hover:underline">&larr; Back</a>
          <div class="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
            <p class="text-red-800">Error: Invalid domain format</p>
          </div>
        </div>
      </div>
    )
  }

  return c.render(
    <div class="py-8">
      <div class="max-w-4xl mx-auto px-4">
        <a href="/" class="text-blue-400 hover:underline">&larr; Back</a>

        <div class="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6 mt-4">
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-lg font-semibold">Querying {domain}</h2>
            <button id="refresh-btn" class="hidden px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Refresh
            </button>
          </div>
          <div id="job-status" class="flex items-center gap-3">
            <div class="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span id="status-text" class="text-gray-400 bg-clip-text text-transparent bg-[linear-gradient(90deg,#b5b5b5_0%,#b5b5b5_35%,#ffffff_50%,#b5b5b5_65%,#b5b5b5_100%)] bg-[length:200%_auto] animate-shine">Creating job...</span>
          </div>
          <div id="progress-bar-container" class="mt-4 hidden">
            <div class="w-full bg-gray-800 rounded-full h-2">
              <div id="progress-bar" class="bg-blue-500 h-2 rounded-full transition-all duration-500" style="width: 0%"></div>
            </div>
          </div>
        </div>

        <div id="results-container" class="hidden">
          <div id="error-container" class="hidden">
            <div class="bg-red-900/50 border border-red-800 rounded-lg p-4 mb-6">
              <p id="error-text" class="text-red-400"></p>
            </div>
          </div>

          <div class="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
            <h2 class="text-lg font-semibold mb-4">Nameservers</h2>
            <ul id="ns-list" class="list-disc list-inside space-y-1">
            </ul>
          </div>

          <div class="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h2 id="subdomain-title" class="text-lg font-semibold mb-4">Discovered Subdomains</h2>
            <div id="subdomain-table-container" class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-800">
                    <th class="text-left py-2 px-3 text-gray-400">Subdomain</th>
                    <th class="text-left py-2 px-3 text-gray-400">Type</th>
                    <th class="text-left py-2 px-3 text-gray-400">Value</th>
                    <th class="text-left py-2 px-3 text-gray-400">Source</th>
                  </tr>
                </thead>
                <tbody id="subdomain-tbody">
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          const domain = ${JSON.stringify(domain)};
          const statusText = document.getElementById('status-text');
          const progressBar = document.getElementById('progress-bar');
          const progressBarContainer = document.getElementById('progress-bar-container');
          const resultsContainer = document.getElementById('results-container');
          const refreshBtn = document.getElementById('refresh-btn');
          const errorContainer = document.getElementById('error-container');
          const errorText = document.getElementById('error-text');
          const nsList = document.getElementById('ns-list');
          const subdomainTitle = document.getElementById('subdomain-title');
          const subdomainTbody = document.getElementById('subdomain-tbody');

          const POLL_INTERVAL = 1500;
          const MAX_POLLS = 120;
          let pollCount = 0;
          let jobId = null;

          function setStatus(text, showSpinner) {
            statusText.textContent = text;
            const spinner = document.querySelector('.animate-spin');
            if (spinner) spinner.style.display = showSpinner ? '' : 'none';
            refreshBtn.classList.toggle('hidden', showSpinner);
          }

          function setProgress(pct) {
            progressBarContainer.classList.remove('hidden');
            progressBar.style.width = pct + '%';
          }

          function escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
          }

          function renderResults(result) {
            // Nameservers
            nsList.innerHTML = '';
            if (result.nameservers && result.nameservers.length > 0) {
              result.nameservers.forEach(function(ns) {
                const li = document.createElement('li');
                li.className = 'font-mono text-sm';
                li.textContent = ns;
                nsList.appendChild(li);
              });
            } else {
              const li = document.createElement('li');
              li.className = 'text-gray-500';
              li.textContent = 'No nameservers found';
              nsList.appendChild(li);
            }

            // Subdomains
            subdomainTbody.innerHTML = '';
            subdomainTitle.textContent = 'Discovered Subdomains (' + (result.subdomains ? result.subdomains.length : 0) + ')';

            if (result.subdomains && result.subdomains.length > 0) {
              result.subdomains.forEach(function(sub) {
                const tr = document.createElement('tr');
                tr.className = 'border-b border-gray-800 hover:bg-gray-800/50';
                tr.innerHTML =
                  '<td class="py-2 px-3 font-mono text-xs break-all">' + escapeHtml(sub.name) + '</td>' +
                  '<td class="py-2 px-3 font-mono text-xs">' + escapeHtml(sub.type) + '</td>' +
                  '<td class="py-2 px-3 font-mono text-xs break-all">' + escapeHtml(sub.value) + '</td>' +
                  '<td class="py-2 px-3 text-xs text-gray-500">' + escapeHtml(sub.source || '-') + '</td>';
                subdomainTbody.appendChild(tr);
              });
            } else {
              const tr = document.createElement('tr');
              tr.innerHTML = '<td colspan="4" class="py-4 text-center text-gray-500">No subdomains discovered</td>';
              subdomainTbody.appendChild(tr);
            }

            resultsContainer.classList.remove('hidden');
          }

          async function pollJob() {
            pollCount++;
            if (pollCount > MAX_POLLS) {
              setStatus('Query timed out. Please try again.', false);
              return;
            }

            try {
              const resp = await fetch('/api/jobs/' + jobId);
              if (!resp.ok) {
                setStatus('Error checking job status.', false);
                return;
              }

              const job = await resp.json();

              switch (job.status) {
                case 'pending':
                  setStatus('Job queued, waiting...', true);
                  setProgress(10);
                  setTimeout(pollJob, POLL_INTERVAL);
                  break;
                case 'processing':
                  setStatus('Querying DNS records and enumerating subdomains...', true);
                  setProgress(50);
                  setTimeout(pollJob, POLL_INTERVAL);
                  break;
                case 'complete':
                  setStatus('Complete!', false);
                  setProgress(100);
                  renderResults(job.result);
                  break;
                case 'error':
                  setStatus('Error occurred.', false);
                  setProgress(100);
                  errorText.textContent = 'Error: ' + (job.error || 'DNS query failed');
                  errorContainer.classList.remove('hidden');
                  resultsContainer.classList.remove('hidden');
                  break;
                default:
                  setStatus('Unknown status: ' + job.status, false);
              }
            } catch (err) {
              setStatus('Network error. Retrying...', true);
              setTimeout(pollJob, POLL_INTERVAL * 2);
            }
          }

          async function startJob(force) {
            pollCount = 0;
            jobId = null;
            resultsContainer.classList.add('hidden');
            errorContainer.classList.add('hidden');
            refreshBtn.classList.add('hidden');

            try {
              const resp = await fetch('/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain: domain, force: !!force })
              });

              if (!resp.ok) {
                const data = await resp.json();
                if (data.error === 'auth_required') {
                  window.location.href = '/auth/github';
                  return;
                }
                setStatus('Error: ' + (data.message || data.error || 'Failed to create job'), false);
                return;
              }

              const data = await resp.json();
              jobId = data.id;

              if (data.status === 'complete' && data.fromCache) {
                setStatus('Loaded from cache!', false);
                setProgress(100);
                renderResults(data.result);
                return;
              }

              setStatus('Job created, polling...', true);
              setProgress(5);
              setTimeout(pollJob, POLL_INTERVAL);
            } catch (err) {
              setStatus('Failed to start job. Please try again.', false);
            }
          }

          refreshBtn.addEventListener('click', function() {
            startJob(true);
          });

          startJob(false);
        })();
      ` }} />

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shine { from { background-position: 200% center; } to { background-position: -200% center; } }
        .animate-shine { animation: shine 3s linear infinite; }
      ` }} />
    </div>
  )
})
