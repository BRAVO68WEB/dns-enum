import { createRoute } from 'honox/factory'
import { getCookie, setCookie } from 'hono/cookie'
import { nanoid } from '../lib/nanoid'

export default createRoute((c) => {
  if (!getCookie(c, 'visitor_id')) {
    setCookie(c, 'visitor_id', nanoid(16), {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 86400 * 30,
    })
  }

  return c.render(
    <div class="min-h-screen bg-gray-950 text-white relative overflow-hidden">
      <canvas id="letter-glitch" class="absolute inset-0 w-full h-full opacity-60"></canvas>
      <div class="absolute inset-0 bg-gradient-to-b from-gray-950/40 via-gray-950/60 to-gray-950 pointer-events-none"></div>

      <div class="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-4">
        <h1 id="split-title" class="text-5xl md:text-7xl font-bold text-center mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          DNS Enum
        </h1>

        <p class="text-xl text-gray-400 text-center mb-12 max-w-xl animate-fade-in-delayed">
          DNS Nameserver &amp; Subdomain Enumerator
        </p>

        <div class="w-full max-w-xl animate-fade-in-delayed-2">
          <form action="/results" method="GET" class="flex gap-3">
            <input
              type="text"
              name="domain"
              placeholder="Enter domain (e.g., example.com)"
              required
              pattern="^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$"
              title="Enter a valid domain"
              class="flex-1 px-5 py-3 bg-gray-900 border border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-500"
            />
            <button type="submit" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">
              Enumerate
            </button>
          </form>
        </div>

        <div class="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full animate-fade-in-delayed-3">
          <div class="bg-gray-900/50 border border-gray-800 rounded-lg p-5 hover:border-gray-700 transition-colors">
            <div class="text-blue-400 mb-2">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg>
            </div>
            <h3 class="font-semibold mb-1">Passive DNS</h3>
            <p class="text-sm text-gray-400">crt.sh, HackerTarget, Anubis</p>
          </div>
          <div class="bg-gray-900/50 border border-gray-800 rounded-lg p-5 hover:border-gray-700 transition-colors">
            <div class="text-purple-400 mb-2">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>
            </div>
            <h3 class="font-semibold mb-1">Brute Force</h3>
            <p class="text-sm text-gray-400">5000+ common subdomains</p>
          </div>
          <div class="bg-gray-900/50 border border-gray-800 rounded-lg p-5 hover:border-gray-700 transition-colors">
            <div class="text-green-400 mb-2">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            <h3 class="font-semibold mb-1">Async Jobs</h3>
            <p class="text-sm text-gray-400">Background processing + cache</p>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fade-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 1s ease-out forwards; }
        .animate-fade-in-delayed { animation: fade-in 1s ease-out 0.3s forwards; opacity: 0; }
        .animate-fade-in-delayed-2 { animation: fade-in 1s ease-out 0.6s forwards; opacity: 0; }
        .animate-fade-in-delayed-3 { animation: fade-in 1s ease-out 0.9s forwards; opacity: 0; }
      ` }} />

      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          const canvas = document.getElementById('letter-glitch');
          if (!canvas) return;
          const ctx = canvas.getContext('2d');

          const glitchColors = ['#2b4539', '#61dca3', '#61b3dc'];
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789';
          const fontSize = 16;
          const charWidth = 10;
          const charHeight = 20;
          let letters = [];
          let grid = { columns: 0, rows: 0 };
          let lastGlitchTime = Date.now();
          const glitchSpeed = 50;

          function getRandomChar() {
            return chars[Math.floor(Math.random() * chars.length)];
          }

          function getRandomColor() {
            return glitchColors[Math.floor(Math.random() * glitchColors.length)];
          }

          function init() {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            grid.columns = Math.ceil(rect.width / charWidth);
            grid.rows = Math.ceil(rect.height / charHeight);

            letters = Array.from({ length: grid.columns * grid.rows }, () => ({
              char: getRandomChar(),
              color: getRandomColor(),
              targetColor: getRandomColor(),
              progress: 1
            }));
          }

          function draw() {
            const rect = canvas.getBoundingClientRect();
            ctx.clearRect(0, 0, rect.width, rect.height);
            ctx.font = fontSize + 'px monospace';
            ctx.textBaseline = 'top';

            letters.forEach(function(letter, i) {
              const x = (i % grid.columns) * charWidth;
              const y = Math.floor(i / grid.columns) * charHeight;
              ctx.fillStyle = letter.color;
              ctx.fillText(letter.char, x, y);
            });
          }

          function update() {
            const count = Math.max(1, Math.floor(letters.length * 0.05));
            for (let i = 0; i < count; i++) {
              const idx = Math.floor(Math.random() * letters.length);
              letters[idx].char = getRandomChar();
              letters[idx].color = getRandomColor();
            }
          }

          function animate() {
            const now = Date.now();
            if (now - lastGlitchTime >= glitchSpeed) {
              update();
              draw();
              lastGlitchTime = now;
            }
            requestAnimationFrame(animate);
          }

          init();
          animate();

          window.addEventListener('resize', function() {
            clearTimeout(window._glitchResize);
            window._glitchResize = setTimeout(init, 100);
          });
        })();

        (function() {
          const title = document.getElementById('split-title');
          if (!title) return;
          
          const text = title.textContent;
          title.textContent = '';
          title.style.opacity = '1';
          
          const chars = text.split('');
          chars.forEach(function(char, i) {
            const span = document.createElement('span');
            span.textContent = char === ' ' ? '\u00A0' : char;
            span.style.display = 'inline-block';
            span.style.opacity = '0';
            span.style.transform = 'translateY(40px)';
            span.style.background = 'linear-gradient(to right, #60a5fa, #a78bfa)';
            span.style.webkitBackgroundClip = 'text';
            span.style.backgroundClip = 'text';
            span.style.webkitTextFillColor = 'transparent';
            span.style.transition = 'opacity 0.5s ease ' + (i * 0.05) + 's, transform 0.5s ease ' + (i * 0.05) + 's';
            title.appendChild(span);
            
            setTimeout(function() {
              span.style.opacity = '1';
              span.style.transform = 'translateY(0)';
            }, 100);
          });
        })();
      ` }} />
    </div>
  )
})
